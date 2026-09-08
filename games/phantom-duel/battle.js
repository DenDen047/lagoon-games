/* =========================================================================
   PHANTOM DUEL ― 戦闘
   動かすのは幻影そのもの。本体は戦場には出てこない。
   ========================================================================= */
'use strict';

const BASE_DMG = 20;       /* 打撃の基準値。ここに能力表の係数を掛ける */
const TIME_LIMIT = 99;

const Battle = {
  on: false,
  mode: 'rank',
  P: null, E: null,
  stage: null,
  dummies: [],
  shots: [],
  fx: [],
  texts: [],
  time: 0,
  freeze: 0,
  shake: 0,
  over: 0,
  stopT: 0,
  stopOwner: null,
  result: null,
  onEnd: null,
  dpsHits: [],
  practiceExp: 0,

  /* opts = { mode:'rank'|'practice', char, foe, onEnd } */
  init(opts) {
    this.mode = opts.mode;
    this.onEnd = opts.onEnd;
    this.stage = STAGES[opts.stage || (opts.mode === 'practice' ? 'dojo' : opts.foe.stage)];
    this.shots = []; this.fx = []; this.texts = []; this.dummies = [];
    this.time = 0; this.freeze = 0; this.shake = 0; this.over = 0;
    this.stopT = 0; this.stopOwner = null;
    this.result = null; this.dpsHits = []; this.practiceExp = 0;
    this.viewScale = 0; this.viewX = 0; this.viewY = 0;

    this.P = makeFighter(opts.char, 'p');
    this.P.x = 300; this.P.y = ARENA.h / 2; this.P.dir = 0;

    if (opts.mode === 'practice') {
      this.E = null;
      this.spawnDummies();
    } else {
      this.E = makeFighter(foeToChar(opts.foe), 'e');
      this.E.foe = opts.foe;
      this.E.x = ARENA.w - 300; this.E.y = ARENA.h / 2; this.E.dir = Math.PI;
      this.E.ai = { think: 0, strafe: rand() < 0.5 ? 1 : -1, jitter: 0, atkOn: false, atkTimer: 0.9 };
    }
    this.on = true;
  },

  spawnDummies() {
    const spec = [
      { x: 820, y: 250, name: 'ふつうの的', armor: 1.0, hp: 300 },
      { x: 990, y: 420, name: 'かたい的', armor: 0.55, hp: 420 },
      { x: 820, y: 590, name: 'うごく的', armor: 1.0, hp: 300, moving: true },
    ];
    this.dummies = spec.map((s) => ({
      x: s.x, y: s.y, hx: s.x, hy: s.y, r: 24, name: s.name, armor: s.armor,
      hp: s.hp, maxHp: s.hp, moving: !!s.moving, ph: rand(6), flash: 0, dead: 0,
    }));
  },

  frozenFor(F) { return this.stopT > 0 && F !== this.stopOwner; },

  /* =============================== 更新 =============================== */
  update(dt) {
    if (!this.on) return;
    if (this.freeze > 0) { this.freeze -= dt; return; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.4);

    if (this.over > 0) {
      this.over -= dt;
      this.stepFx(dt);
      if (this.over <= 0) this.finish();
      return;
    }

    if (this.stopT > 0) {
      this.stopT -= dt;
      if (this.stopT <= 0) {
        this.stopOwner = null;
        this.texts.push({ text: 'そして時は動きだす', x: ARENA.w / 2, y: 120, t: 0, life: 1.2,
          vy: -10, color: '#ffffff', size: 30, bold: true, screen: false });
        Sound.tone(180, 0.4, 'sawtooth', 0.08, 520);
      }
    }

    this.time += dt;
    if (this.mode === 'rank' && this.time >= TIME_LIMIT) {
      const pr = this.P.hp / this.P.maxHp, er = this.E.hp / this.E.maxHp;
      this.knockOut(pr >= er ? 'win' : 'lose', true);
      return;
    }

    if (this.E && !this.frozenFor(this.E)) aiThink(this.E, this.P, dt);
    stepFighter(this.P, dt, this.frozenFor(this.P));
    if (this.E) stepFighter(this.E, dt, this.frozenFor(this.E));
    this.stepDummies(dt);
    this.stepShots(dt);
    this.stepFx(dt);

    if (this.P.hp <= 0) this.knockOut('lose');
    else if (this.E && this.E.hp <= 0) this.knockOut('win');
  },

  stepDummies(dt) {
    const stopped = this.stopT > 0;
    this.dummies.forEach((d) => {
      d.flash = Math.max(0, d.flash - dt * 5);
      if (d.dead > 0) {
        d.dead -= dt;
        if (d.dead <= 0) d.hp = d.maxHp;
        return;
      }
      if (d.moving && !stopped) {
        d.ph += dt;
        d.x = d.hx + Math.cos(d.ph * 1.1) * 130;
        d.y = d.hy + Math.sin(d.ph * 1.7) * 90;
      }
    });
  },

  stepShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (this.frozenFor(s.owner)) continue;      /* 止まった時間のなかでは飛ばない */
      s.life -= dt;
      if (s.homing) {
        const tg = nearestTarget(s.owner, s.x, s.y);
        if (tg) {
          const a = Math.atan2(tg.y - s.y, tg.x - s.x);
          const cur = Math.atan2(s.vy, s.vx);
          const na = cur + clamp(angDiff(a, cur), -3.6 * dt, 3.6 * dt);
          const sp = Math.hypot(s.vx, s.vy);
          s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;

      let gone = s.life <= 0 || s.x < -40 || s.x > ARENA.w + 40 || s.y < -40 || s.y > ARENA.h + 40;
      if (!gone && !s.pierce && hitsBlock(s.x, s.y, s.r, this.stage)) {
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 10, t: 0, life: 0.22, color: s.color });
        gone = true;
      }
      if (!gone) {
        const hits = hitTargets(s.owner);
        for (const h of hits) {
          if (s.hitSet && s.hitSet.indexOf(h.key) >= 0) continue;
          if (dist(s.x, s.y, h.x, h.y) < s.r + h.r) {
            applyHit(s.owner, h, s.dmg, { kb: s.kb || 80, bind: s.bind, burn: s.burn, kind: 'shot' });
            if (s.pierce) s.hitSet.push(h.key);
            else gone = true;
            break;
          }
        }
      }
      if (gone) this.shots.splice(i, 1);
    }
  },

  stepFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.kind === 'quake') {
        const rr = f.r * easeOut(f.t / f.life);
        hitTargets(f.owner).forEach((h) => {
          if (f.hitSet.indexOf(h.key) >= 0) return;
          if (dist(f.x, f.y, h.x, h.y) < rr + h.r) {
            f.hitSet.push(h.key);
            applyHit(f.owner, h, f.dmg, { kb: 300, kind: 'quake' });
          }
        });
      } else if (f.kind === 'fire' && !this.frozenFor(f.owner)) {
        f.tick -= dt;
        if (f.tick <= 0) {
          f.tick = 0.3;
          hitTargets(f.owner).forEach((h) => {
            if (dist(f.x, f.y, h.x, h.y) < f.r + h.r) {
              applyHit(f.owner, h, f.dmg, { kind: 'fire', burn: 1.6, quiet: true });
            }
          });
        }
      }
      if (f.t >= f.life) this.fx.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      t.x += (t.vx || 0) * dt; t.y += (t.vy || 0) * dt;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
    while (this.dpsHits.length && this.time - this.dpsHits[0].t > 3) this.dpsHits.shift();
  },

  knockOut(result, byTime) {
    if (this.over > 0) return;
    this.result = result;
    this.over = 1.7;
    this.freeze = 0.16;
    this.shake = 1;
    this.stopT = 0; this.stopOwner = null;
    Sound.ko();
    const loser = result === 'win' ? this.E : this.P;
    if (loser) {
      this.fx.push({ kind: 'burst', x: loser.x, y: loser.y, r: 90, t: 0, life: 0.7, color: loser.c.colors.glow });
    }
    banner(byTime ? '時間切れ' : (result === 'win' ? 'K.O.' : 'YOU LOSE'), 1500, result === 'win' ? 'win' : 'lose');
  },

  finish() {
    this.on = false;
    const cb = this.onEnd;
    this.onEnd = null;
    if (cb) cb(this.result);
  },

  quit() {
    this.on = false;
    const cb = this.onEnd;
    this.onEnd = null;
    if (cb) cb('quit');
  },
};

/* =========================================================================
   ファイター
   ========================================================================= */
function foeToChar(f) {
  return {
    id: f.id, preset: f.preset || null, name: f.name, cry: f.cry, type: f.type,
    level: f.level, exp: 0, stats: f.stats, colors: f.colors, parts: f.parts,
    owner: f.who,
  };
}

function makeFighter(c, side) {
  const d = derive(c);
  return {
    c, d, side,
    hp: d.maxHp, maxHp: d.maxHp,
    x: 0, y: 0, dir: 0, moving: false,
    gauge: 0,
    combo: 0, comboCd: 0, recharge: 0,
    atkCd: 0, autoCd: 0, punch: 0, punchSide: 1,
    dashCd: 0, dodgeCd: 0, dodgeT: 0, dvx: 0, dvy: 0, invuln: 0,
    slashT: 0, slashVX: 0, slashVY: 0, slashHit: null,
    bindT: 0, wardT: 0, burnT: 0, burnBy: null, drainBy: null,
    chargeT: 0, chargeMax: 1, pending: null,
    rushCount: 0, endureUsed: false,
    hurtT: 0, flash: 0,
    awake: c.level >= MAX_LEVEL,
    cmd: { mx: 0, my: 0, ax: 0, ay: 0, atk: false, abil: false, dodge: false },
    ai: null,
    abilCycle: 0,
  };
}

function opponentOf(F) { return F.side === 'p' ? Battle.E : Battle.P; }

/** 攻撃が当たりうる相手を並べる */
function hitTargets(F) {
  const out = [];
  const E = opponentOf(F);
  if (E) out.push({ key: 'foe', ref: E, kind: 'fighter', x: E.x, y: E.y, r: HIT_R });
  if (F.side === 'p') {
    Battle.dummies.forEach((d, i) => {
      if (d.dead > 0) return;
      out.push({ key: 'd' + i, ref: d, kind: 'dummy', x: d.x, y: d.y, r: d.r });
    });
  }
  return out;
}

function nearestTarget(F, x, y) {
  let best = null, bd = 1e9;
  hitTargets(F).forEach((h) => {
    const d = dist(x, y, h.x, h.y);
    if (d < bd) { bd = d; best = h; }
  });
  return best;
}

/* =========================================================================
   1体ぶんの更新
   ========================================================================= */
function stepFighter(F, dt, frozen) {
  if (frozen) return;
  const d = F.d, cmd = F.cmd;

  F.hurtT = Math.max(0, F.hurtT - dt);
  F.flash = Math.max(0, F.flash - dt * 4);
  F.bindT = Math.max(0, F.bindT - dt);
  F.wardT = Math.max(0, F.wardT - dt);
  F.invuln = Math.max(0, F.invuln - dt);
  F.dodgeCd = Math.max(0, F.dodgeCd - dt);
  F.dashCd = Math.max(0, F.dashCd - dt);
  F.atkCd = Math.max(0, F.atkCd - dt);
  F.comboCd = Math.max(0, F.comboCd - dt);
  F.autoCd = Math.max(0, F.autoCd - dt);
  F.gauge = Math.min(100, F.gauge + d.gaugeRate * dt);

  if (F.recharge > 0) {
    F.recharge -= dt;
    if (F.recharge <= 0) { F.combo = 0; Sound.charge(); }
  }

  /* 燃えている */
  if (F.burnT > 0) {
    F.burnT -= dt;
    F.hp -= 8 * dt;
    if (Math.random() < dt * 8) {
      Battle.fx.push({ kind: 'spark', x: F.x + rand(14, -14), y: F.y + rand(14, -14),
        r: 7, t: 0, life: 0.25, color: '#ff9d4d' });
    }
  }
  /* 縛られているあいだの継続ダメージ（喰鎖） */
  if (F.bindT > 0 && F.drainBy && F.drainBy.awake && F.drainBy.c.type === 'bind') {
    F.hp -= 6 * dt;
  }

  /* ---- 居合の踏み込み ---- */
  if (F.slashT > 0) {
    F.slashT -= dt;
    moveBody(F, F.slashVX * dt, F.slashVY * dt);
    hitTargets(F).forEach((h) => {
      if (F.slashHit.indexOf(h.key) >= 0) return;
      if (dist(F.x, F.y, h.x, h.y) < F.d.reach * 0.8 + h.r) {
        F.slashHit.push(h.key);
        applyHit(F, h, 34 * F.d.pow, { kb: 260, kind: 'punch' });
      }
    });
    return;
  }

  /* ---- 回避 ---- */
  if (cmd.dodge && F.dodgeCd <= 0 && F.bindT <= 0 && F.dodgeT <= 0) {
    F.dodgeCd = 1.5;
    F.dodgeT = 0.22;
    F.invuln = 0.26;
    let ax = cmd.mx, ay = cmd.my;
    if (!ax && !ay) { ax = Math.cos(F.dir); ay = Math.sin(F.dir); }
    const m = Math.hypot(ax, ay) || 1;
    F.dvx = (ax / m) * 700; F.dvy = (ay / m) * 700;
    Sound.tone(420, 0.1, 'sine', 0.05, 700);
  }

  /* ---- 移動 ---- */
  let vx = 0, vy = 0;
  if (F.dodgeT > 0) {
    F.dodgeT -= dt;
    vx = F.dvx; vy = F.dvy;
  } else if (F.bindT <= 0) {
    const m = Math.hypot(cmd.mx, cmd.my);
    if (m > 0.08) {
      const sp = d.moveSpd * (F.slow || 1);
      vx = (cmd.mx / m) * sp;
      vy = (cmd.my / m) * sp;
    }
  }
  F.moving = Math.hypot(vx, vy) > 10;
  moveBody(F, vx * dt, vy * dt);

  /* ---- 向き ---- */
  const adx = cmd.ax - F.x, ady = cmd.ay - F.y;
  if (Math.hypot(adx, ady) > 12) F.dir = Math.atan2(ady, adx);
  else if (F.moving) F.dir = Math.atan2(vy, vx);

  /* ---- 溜め ---- */
  if (F.chargeT > 0) {
    F.chargeT -= dt;
    if (F.chargeT <= 0 && F.pending) { F.pending(); F.pending = null; }
    return;
  }

  if (F.punch > 0) {
    F.punch -= dt * 5.5;
    if (F.punch < 0) F.punch = 0;
  }
  stepAttack(F, dt);

  if (cmd.abil) useAbility(F);
}

function moveBody(F, dx, dy) {
  const r = HIT_R;
  /* すでに柱に埋まっているときは、どこへも動けなくならないように素通しにする */
  const stuck = hitsBlock(F.x, F.y, r, Battle.stage);
  const nx = clamp(F.x + dx, r, ARENA.w - r);
  if (stuck || !hitsBlock(nx, F.y, r, Battle.stage)) F.x = nx;
  const ny = clamp(F.y + dy, r, ARENA.h - r);
  if (stuck || !hitsBlock(F.x, ny, r, Battle.stage)) F.y = ny;
}

function hitsBlock(x, y, r, stage) {
  if (!stage) return false;
  for (const b of stage.blocks) {
    if (b.r != null) {
      if (dist(x, y, b.x, b.y) < b.r + r) return true;
    } else {
      const hw = b.w / 2, hh = b.h / 2;
      const cx = clamp(x, b.x - hw, b.x + hw);
      const cy = clamp(y, b.y - hh, b.y + hh);
      if (dist(x, y, cx, cy) < r) return true;
    }
  }
  return false;
}

/* =========================================================================
   攻撃
   ========================================================================= */
function stepAttack(F, dt) {
  const type = F.c.type, d = F.d, cmd = F.cmd;

  /* 自動型と万能型は、押されていなくても自分で攻める */
  if (type === 'auto' || type === 'omni') {
    const t = nearestTarget(F, F.x, F.y);
    if (t && F.autoCd <= 0 && dist(F.x, F.y, t.x, t.y) < 320) {
      F.autoCd = (type === 'omni' ? 0.66 : 0.52) / d.rate;
      const a = Math.atan2(t.y - F.y, t.x - F.x);
      if (F.awake || type === 'omni') {
        fireShot(F, a, { dmg: BASE_DMG * d.dmg, speed: d.bullet, r: 8, homing: F.awake });
      } else {
        doHit(F, a, BASE_DMG * d.dmg, d.reach, 100);
      }
    }
  }

  if (!cmd.atk) return;

  if (type === 'moot') {
    if (F.recharge > 0 || F.comboCd > 0) return;
    F.comboCd = 0.30 / d.rate;
    F.combo++;
    if (F.combo >= 2) F.recharge = 0.62 / d.rate;
    doHit(F, F.dir, BASE_DMG * d.dmg, d.reach + 6, 230, { heavy: true, burst: F.awake });
  } else if (type === 'rush' || type === 'world') {
    if (F.atkCd > 0) return;
    F.atkCd = (type === 'world' ? 0.115 : 0.13) / d.rate;
    doHit(F, F.dir, BASE_DMG * d.dmg, d.reach, 34, { light: true });
    F.rushCount++;
    if (F.awake && type === 'rush' && F.rushCount % 8 === 0) {
      Battle.fx.push({ kind: 'quake', x: F.x, y: F.y, r: 96, t: 0, life: 0.32,
        color: F.c.colors.glow, owner: F, dmg: 12 * d.pow, hitSet: [] });
      Sound.boom();
    }
  } else if (type === 'shot') {
    if (F.atkCd > 0) return;
    F.atkCd = 0.32 / d.rate;
    /* 三条は1発ぶんの威力を分けあう。至近距離で3発ぜんぶ当てても壊れないように。 */
    const spread = F.awake ? [-0.22, 0, 0.22] : [0];
    const each = BASE_DMG * d.dmg * (F.awake ? 0.6 : 1);
    spread.forEach((o) => fireShot(F, F.dir + o, { dmg: each, speed: d.bullet, r: 7 }));
    Sound.shot();
  } else if (type === 'flame') {
    if (F.atkCd > 0) return;
    F.atkCd = 0.10 / d.rate;
    doHit(F, F.dir, BASE_DMG * d.dmg, d.reach + 8, 18, { light: true, fire: true, burn: F.awake ? 3 : 0 });
  } else if (type === 'blade') {
    if (F.atkCd > 0) return;
    F.atkCd = 0.52 / d.rate;
    doHit(F, F.dir, BASE_DMG * d.dmg, d.reach + 10, 180, { heavy: true, wide: true });
    if (F.awake) {
      fireShot(F, F.dir, { dmg: BASE_DMG * d.dmg * 0.5, speed: d.bullet * 0.9, r: 10, color: F.c.colors.glow });
    }
  } else if (type === 'auto' || type === 'omni') {
    if (F.dashCd > 0) return;
    const t = nearestTarget(F, F.x, F.y);
    if (!t) return;
    F.dashCd = 2.0;
    const a = Math.atan2(t.y - F.y, t.x - F.x);
    moveBody(F, Math.cos(a) * 70, Math.sin(a) * 70);
    doHit(F, a, BASE_DMG * d.dmg * 2.1, d.reach + 6, 220, { heavy: true });
  } else if (type === 'bind') {
    if (F.atkCd > 0) return;
    F.atkCd = 0.40 / d.rate;
    doHit(F, F.dir, BASE_DMG * d.dmg, d.reach, 80, { whip: true, wide: true });
  } else if (type === 'mend') {
    if (F.atkCd > 0) return;
    F.atkCd = 0.34 / d.rate;
    doHit(F, F.dir, BASE_DMG * d.dmg, d.reach, 110);
  }
}

/** 前方に一撃出す */
function doHit(F, ang, dmg, reach, kb, o) {
  o = o || {};
  const ext = reach * 0.55;
  const hx = F.x + Math.cos(ang) * ext;
  const hy = F.y + Math.sin(ang) * ext;
  F.punch = 1;
  F.punchSide = -F.punchSide;
  F.dir = ang;

  let landed = false;
  hitTargets(F).forEach((h) => {
    if (landed && !o.wide) return;
    if (dist(hx, hy, h.x, h.y) < reach * 0.7 + h.r) {
      landed = true;
      applyHit(F, h, dmg, {
        kb: kb, kind: o.fire ? 'fire' : (o.light ? 'light' : 'punch'),
        burst: o.burst, burn: o.burn, punchAt: { x: hx, y: hy },
      });
    }
  });

  Battle.fx.push({
    kind: o.fire ? 'flame' : 'swipe', x: hx, y: hy, a: ang, t: 0, life: o.fire ? 0.2 : 0.16,
    color: o.fire ? '#ff9d4d' : F.c.colors.glow, big: !!o.heavy, whip: !!o.whip,
    reach: reach, from: { x: F.x, y: F.y },
  });
  if (!landed) Sound.tone(o.light ? 620 : 300, 0.04, 'triangle', 0.03);
  else if (o.heavy) Sound.punch();
  else Sound.hit();
}

function fireShot(F, ang, o) {
  const speed = o.speed || F.d.bullet;
  Battle.shots.push({
    x: F.x + Math.cos(ang) * 18, y: F.y + Math.sin(ang) * 18,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    r: o.r || 7, dmg: o.dmg, owner: F, pierce: !!o.pierce, homing: !!o.homing,
    life: o.life || (F.d.shotRange / speed), color: o.color || F.c.colors.glow,
    kb: o.kb, bind: o.bind, burn: o.burn, hitSet: o.pierce ? [] : null,
  });
}

/* =========================================================================
   能力
   ========================================================================= */
function useAbility(F) {
  const t = TYPES[F.c.type];
  let kind = F.c.type;
  if (kind === 'omni') kind = ['shot', 'bind', 'auto', 'world'][F.abilCycle % 4];
  if (F.gauge < t.ability.cost || F.chargeT > 0) return;
  F.gauge -= t.ability.cost;
  if (F.c.type === 'omni') F.abilCycle++;
  const d = F.d;

  if (kind === 'moot') {
    Battle.fx.push({ kind: 'quake', x: F.x, y: F.y, r: 150, t: 0, life: 0.45,
      color: F.c.colors.glow, owner: F, dmg: 26 * d.pow, hitSet: [] });
    Battle.shake = Math.max(Battle.shake, 0.8);
    Sound.boom();
    pushCry(F, '大地たたき');
  } else if (kind === 'rush') {
    F.chargeT = 0.32; F.chargeMax = 0.32;
    Sound.charge();
    F.pending = () => {
      moveBody(F, Math.cos(F.dir) * 60, Math.sin(F.dir) * 60);
      doHit(F, F.dir, 40 * d.pow, d.reach + 16, 400, { heavy: true, burst: F.awake });
      Battle.shake = Math.max(Battle.shake, 0.7);
      Sound.boom();
      pushCry(F, '渾身');
    };
  } else if (kind === 'shot') {
    fireShot(F, F.dir, { dmg: 30 * d.pow, speed: d.bullet * 1.25, r: 14, pierce: true, life: 2.2, kb: 150 });
    Sound.tone(240, 0.25, 'sawtooth', 0.09, 90);
    pushCry(F, '貫通弾');
  } else if (kind === 'auto') {
    for (let i = -1; i <= 1; i++) {
      fireShot(F, F.dir + i * 0.5, { dmg: 14 * d.pow, speed: d.bullet * 0.8, r: 8, homing: true, life: 2.6 });
    }
    Sound.shot();
    pushCry(F, '追尾の礫');
  } else if (kind === 'bind') {
    fireShot(F, F.dir, { dmg: 10 * d.pow, speed: d.bullet * 1.1, r: 11, life: 1.6, bind: 2.2, color: '#ffffff' });
    Sound.tone(880, 0.2, 'square', 0.06, 300);
    pushCry(F, '縛鎖');
  } else if (kind === 'mend') {
    F.wardT = 4;
    const heal = 30 * d.pow;
    F.hp = Math.min(F.maxHp, F.hp + heal);
    Battle.fx.push({ kind: 'ward', x: F.x, y: F.y, r: 54, t: 0, life: 0.6, color: F.c.colors.glow });
    Sound.tone(520, 0.3, 'sine', 0.08, 900);
    pushCry(F, '加護');
    Battle.texts.push({ text: '+' + Math.round(heal), x: F.x, y: F.y - 30, t: 0, life: 0.9,
      vy: -40, color: '#7dffc4', size: 16 });
  } else if (kind === 'flame') {
    Battle.fx.push({ kind: 'fire', x: F.x + Math.cos(F.dir) * 60, y: F.y + Math.sin(F.dir) * 60,
      r: 78, t: 0, life: 4, tick: 0, color: '#ff9d4d', owner: F, dmg: 9 * d.pow });
    Sound.boom();
    pushCry(F, '火柱');
  } else if (kind === 'blade') {
    F.slashT = 0.24;
    F.slashHit = [];
    F.slashVX = Math.cos(F.dir) * 980;
    F.slashVY = Math.sin(F.dir) * 980;
    F.invuln = 0.24;
    Battle.fx.push({ kind: 'iai', x: F.x, y: F.y, a: F.dir, t: 0, life: 0.35, color: F.c.colors.glow });
    Sound.tone(1200, 0.18, 'square', 0.07, 300);
    pushCry(F, '居合');
  } else if (kind === 'world') {
    const dur = F.c.type === 'omni' ? 1.6 : (F.awake ? 4 : 2.6);
    Battle.stopT = dur;
    Battle.stopOwner = F;
    Battle.shake = Math.max(Battle.shake, 0.6);
    Battle.texts.push({ text: '時よ止まれ', x: F.x, y: F.y - 48, t: 0, life: 1.4, vy: -14,
      color: '#ffe98f', size: 26, bold: true });
    Sound.tone(90, 0.6, 'sawtooth', 0.12, 40);
    Sound.tone(1400, 0.5, 'sine', 0.05, 200);
  }
}

function pushCry(F, text) {
  Battle.texts.push({
    text: text, x: F.x, y: F.y - 38, t: 0, life: 0.8, vy: -26,
    color: F.c.colors.glow, size: 18, bold: true,
  });
}

/* =========================================================================
   ダメージ
   ========================================================================= */
function applyHit(F, h, dmg, o) {
  o = o || {};
  const tgt = h.ref;

  if (h.kind === 'dummy') {
    const real = dmg * tgt.armor;
    tgt.hp -= real;
    tgt.flash = 1;
    Battle.dpsHits.push({ t: Battle.time, d: real });
    Battle.texts.push({ text: String(Math.round(real)), x: h.x + rand(12, -12), y: h.y - 24,
      t: 0, life: 0.7, vy: -58, color: '#ffffff', size: 15 });
    if (!o.quiet && !o.burst) {
      F.cryTick = (F.cryTick || 0) + 1;
      if (o.kind !== 'light' || F.cryTick % 3 === 1) {
        Battle.texts.push({ text: F.c.cry, x: h.x + rand(22, -22), y: h.y + 22, t: 0, life: 0.5,
          vy: -16, color: '#ffffff', size: o.kind === 'light' ? 13 : 16, bold: true });
      }
    }
    if (o.burst) burstAt(F, h.x, h.y, dmg * 0.45);
    if (tgt.hp <= 0 && tgt.dead <= 0) {
      tgt.dead = 2;
      Battle.fx.push({ kind: 'burst', x: tgt.x, y: tgt.y, r: 64, t: 0, life: 0.6, color: '#ffd76e' });
      Battle.practiceExp += 8;
      Sound.boom();
      Battle.texts.push({ text: '経験値 +8', x: tgt.x, y: tgt.y - 40, t: 0, life: 1.2, vy: -40,
        color: '#ffd76e', size: 16, bold: true });
    }
    return;
  }

  const E = tgt;
  if (E.invuln > 0) {
    Battle.texts.push({ text: 'かわした', x: E.x, y: E.y - 28, t: 0, life: 0.6, vy: -40, color: '#9fd4ff', size: 14 });
    return;
  }

  let real = dmg;
  /* 止まった時間のなかでの一撃は確実に入る */
  if (Battle.stopT > 0 && F === Battle.stopOwner) real *= 1.4;
  if (E.wardT > 0) real *= 0.45;
  E.hp -= real;
  E.hurtT = 0.2;
  E.flash = 1;

  if (o.kb) {
    const fx = o.punchAt ? o.punchAt.x : F.x;
    const fy = o.punchAt ? o.punchAt.y : F.y;
    const a = Math.atan2(E.y - fy, E.x - fx);
    moveBody(E, Math.cos(a) * o.kb * 0.06, Math.sin(a) * o.kb * 0.06);
  }
  if (o.bind) { E.bindT = o.bind; E.drainBy = F; }
  if (o.burn) { E.burnT = Math.max(E.burnT, o.burn); E.burnBy = F; }

  Battle.texts.push({
    text: String(Math.round(real)), x: h.x + rand(11, -11), y: h.y - 26, t: 0, life: 0.7, vy: -58,
    color: o.kind === 'light' || o.kind === 'fire' ? '#ffd76e' : '#ff8a6e',
    size: o.kind === 'light' || o.kind === 'fire' ? 14 : 18,
  });
  Battle.fx.push({ kind: 'spark', x: h.x, y: h.y, r: o.kind === 'light' ? 12 : 20, t: 0,
    life: 0.22, color: o.kind === 'fire' ? '#ff9d4d' : F.c.colors.glow });

  /* 連打型はかけ声が出すぎるので、何発かに1回だけ出す */
  if (!o.quiet && !o.burst && (o.kind === 'punch' || o.kind === 'light')) {
    F.cryTick = (F.cryTick || 0) + 1;
    if (o.kind !== 'light' || F.cryTick % 3 === 1) {
      Battle.texts.push({ text: F.c.cry, x: h.x + rand(22, -22), y: h.y + 22, t: 0, life: 0.55,
        vy: -16, color: '#ffffff', size: o.kind === 'light' ? 13 : 17, bold: true });
    }
  }
  if (o.kind === 'punch' || o.kind === 'quake') {
    Battle.freeze = Math.max(Battle.freeze, 0.05);
    Battle.shake = Math.max(Battle.shake, 0.5);
  }
  F.gauge = Math.min(100, F.gauge + 2);

  if (o.burst) burstAt(F, h.x, h.y, dmg * 0.45);

  /* 不屈：倒れる一撃を1回だけ耐える */
  if (E.hp <= 0 && E.awake && E.c.type === 'mend' && !E.endureUsed) {
    E.endureUsed = true;
    E.hp = Math.max(1, E.maxHp * 0.14);
    E.wardT = 2.5;
    Battle.fx.push({ kind: 'ward', x: E.x, y: E.y, r: 80, t: 0, life: 0.8, color: '#7dffc4' });
    Battle.texts.push({ text: '不屈', x: E.x, y: E.y - 40, t: 0, life: 1.1, vy: -30,
      color: '#7dffc4', size: 22, bold: true });
    Sound.levelup();
  }
}

/** レベル10のパンチ型。殴った相手がそのあと爆発する。 */
function burstAt(F, x, y, dmg) {
  Battle.fx.push({ kind: 'burst', x: x, y: y, r: 74, t: 0, life: 0.5, color: '#ffb347' });
  Battle.fx.push({ kind: 'quake', x: x, y: y, r: 74, t: 0, life: 0.16, color: '#ffd76e',
    owner: F, dmg: dmg, hitSet: [], silent: true });
  Battle.shake = Math.max(Battle.shake, 0.7);
  Sound.boom();
  Battle.texts.push({ text: 'ドカーン', x: x, y: y - 50, t: 0, life: 0.7, vy: -34,
    color: '#ffb347', size: 17, bold: true });
}

/* =========================================================================
   相手の考えかた
   ========================================================================= */
function aiThink(E, P, dt) {
  const ai = E.ai, d = E.d;
  const type = E.c.type;
  const skill = clamp(E.c.level / 10, 0.2, 1);
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = rand(0.5, 0.22) * (1.6 - skill);
    if (rand() < 0.3) ai.strafe = -ai.strafe;
    ai.jitter = rand(40, -40) * (1.2 - skill);
  }

  const want = { moot: 46, rush: 40, world: 44, flame: 62, blade: 74,
                 shot: 330, auto: 250, bind: 92, mend: 60, omni: 260 }[type] || 90;
  const dx = P.x - E.x, dy = P.y - E.y;
  const dd = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx);

  let mx = 0, my = 0;
  const gap = dd - (want + d.reach * 0.5 + ai.jitter);
  E.slow = 1;
  if (Math.abs(gap) > 26) {
    const s = gap > 0 ? 1 : -1;
    /* 下がるときは少し遅く、遠くから詰めるときは少し速い。
       離れて撃つだけで勝てる、という戦いかたを成立させないため。 */
    if (s < 0) E.slow = 0.78;
    else if (dd > 240) E.slow = 1.22;
    mx += Math.cos(ang) * s; my += Math.sin(ang) * s;
  }
  mx += Math.cos(ang + Math.PI / 2) * ai.strafe * 0.75;
  my += Math.sin(ang + Math.PI / 2) * ai.strafe * 0.75;
  E.cmd.mx = mx; E.cmd.my = my;
  E.cmd.ax = P.x; E.cmd.ay = P.y;

  ai.atkTimer -= dt;
  if (ai.atkTimer <= 0) {
    ai.atkOn = !ai.atkOn;
    ai.atkTimer = ai.atkOn ? rand(1.2, 0.5) * (0.55 + skill * 0.85)
                           : rand(1.0, 0.4) * (1.5 - skill);
  }
  const reach = (type === 'shot' || type === 'auto' || type === 'omni') ? 400 : d.reach + 46;
  E.cmd.atk = ai.atkOn && Battle.time > 1 && dd < reach;

  const cost = TYPES[type].ability.cost;
  let useIt = false;
  if (E.gauge >= cost) {
    if (type === 'mend') useIt = E.hp < E.maxHp * 0.6;
    else if (type === 'world' || type === 'omni') useIt = dd < 260;
    else if (type === 'moot' || type === 'rush' || type === 'flame') useIt = dd < 130;
    else if (type === 'blade') useIt = dd > 90 && dd < 420;
    else useIt = dd < 440 && rand() < 0.6 + skill * 0.4;
  }
  E.cmd.abil = useIt;

  let danger = false;
  for (const s of Battle.shots) {
    if (s.owner === E) continue;
    if (dist(s.x, s.y, E.x, E.y) < 100) danger = true;
  }
  E.cmd.dodge = danger && E.dodgeCd <= 0 && rand() < 0.08 + skill * 0.12;
}

/* =========================================================================
   描画
   ========================================================================= */
Battle.draw = function (ctx, cw, ch) {
  const st = this.stage;
  const base = clamp(Math.max(cw / ARENA.w, ch / ARENA.h), 0.5, 2.0);
  /* 幻影が小さいので、画面が広いときほど寄る */
  const minScale = clamp(cw / 1500, 0.4, 0.85);
  let wantScale = base, focusX, focusY;
  if (this.E) {
    const x0 = Math.min(this.P.x, this.E.x) - 150, x1 = Math.max(this.P.x, this.E.x) + 150;
    const y0 = Math.min(this.P.y, this.E.y) - 130, y1 = Math.max(this.P.y, this.E.y) + 130;
    focusX = (x0 + x1) / 2; focusY = (y0 + y1) / 2;
    wantScale = clamp(Math.min(cw / (x1 - x0), ch / (y1 - y0)), minScale, base);
  } else {
    focusX = this.P.x + 120; focusY = this.P.y;
  }
  this.viewScale = this.viewScale ? lerp(this.viewScale, wantScale, 0.09) : wantScale;
  this.viewX = this.viewX ? lerp(this.viewX, focusX, 0.14) : focusX;
  this.viewY = this.viewY ? lerp(this.viewY, focusY, 0.14) : focusY;
  const scale = this.viewScale;

  let camX = clamp(this.viewX, cw / (2 * scale), ARENA.w - cw / (2 * scale));
  let camY = clamp(this.viewY, ch / (2 * scale), ARENA.h - ch / (2 * scale));
  if (cw / scale >= ARENA.w) camX = ARENA.w / 2;
  if (ch / scale >= ARENA.h) camY = ARENA.h / 2;
  this.cam = { x: camX, y: camY, s: scale };

  ctx.save();
  ctx.fillStyle = '#0b0d16';
  ctx.fillRect(0, 0, cw, ch);
  ctx.translate(cw / 2, ch / 2);
  if (this.shake > 0) ctx.translate(rand(10, -10) * this.shake, rand(10, -10) * this.shake);
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);

  drawArena(ctx, st);
  drawFx(ctx, false);

  const actors = [];
  actors.push({ y: this.P.y, fn: () => drawFighter(ctx, this.P) });
  if (this.E) actors.push({ y: this.E.y, fn: () => drawFighter(ctx, this.E) });
  this.dummies.forEach((d) => { if (d.dead <= 0) actors.push({ y: d.y, fn: () => drawDummy(ctx, d) }); });
  actors.sort((a, b) => a.y - b.y).forEach((a) => a.fn());

  drawShots(ctx);
  drawFx(ctx, true);
  if (this.stopT > 0) drawTimeStop(ctx, camX, camY, cw, ch, scale);
  drawTexts(ctx);

  ctx.restore();
};

function drawArena(ctx, st) {
  ctx.fillStyle = st.floor;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.strokeStyle = st.line;
  ctx.lineWidth = 2;
  for (let x = 80; x < ARENA.w; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); ctx.stroke();
  }
  for (let y = 80; y < ARENA.h; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); ctx.stroke();
  }
  ctx.strokeStyle = st.accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, ARENA.w - 8, ARENA.h - 8);

  st.blocks.forEach((b) => {
    ctx.fillStyle = shade(st.accent, -0.25);
    ctx.strokeStyle = shade(st.accent, 0.15);
    ctx.lineWidth = 3;
    if (b.r != null) {
      shadowBlob(ctx, b.x, b.y, b.r * 1.05, b.r * 0.5, 0.3);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(st.accent, 0.4);
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.2, b.y - b.r * 0.2, b.r * 0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      shadowBlob(ctx, b.x, b.y + b.h / 2, b.w * 0.55, b.h * 0.3, 0.3);
      rrect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8); ctx.fill(); ctx.stroke();
    }
  });
}

function drawFighter(ctx, F) {
  /* 足もとの色わ。どちらが自分か分かるように。 */
  ctx.save();
  ctx.strokeStyle = rgba(F.side === 'p' ? '#6effe9' : '#ff6f91', 0.75);
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(F.x, F.y + 12, 20, 8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  if (F.wardT > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.sin(Battle.time * 8) * 0.1;
    ctx.fillStyle = '#7dffc4';
    ctx.beginPath(); ctx.arc(F.x, F.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (F.invuln > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#9fd4ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(F.x, F.y, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  const pl = F.punchSide < 0 ? F.punch : 0;
  const pr = F.punchSide > 0 ? F.punch : 0;
  let charge = 0;
  if (F.chargeT > 0) charge = 1 - F.chargeT / F.chargeMax;
  else if (F.c.type === 'moot' && F.recharge > 0) charge = 1 - F.recharge / (0.62 / F.d.rate);
  const frozen = Battle.frozenFor(F);
  drawGhost(ctx, F.c, F.x, F.y, F.dir, Battle.time, {
    scale: GHOST_SCALE, punchL: pl, punchR: pr, flash: F.flash,
    charge: charge, stopped: frozen,
  });
  if (frozen) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#2b3a7a';
    ctx.beginPath(); ctx.arc(F.x, F.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (F.burnT > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ff9d4d';
    for (let i = 0; i < 3; i++) {
      const a = Battle.time * 6 + i * 2.1;
      ctx.beginPath();
      ctx.arc(F.x + Math.cos(a) * 12, F.y + Math.sin(a) * 10 - 6, 5 + Math.sin(a * 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (F.bindT > 0) {
    ctx.save();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(F.x, F.y, 18 + i * 5, Battle.time * 4 + i, Battle.time * 4 + i + 2.2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDummy(ctx, d) {
  ctx.save();
  shadowBlob(ctx, d.x, d.y, 24, 11, 0.3);
  ctx.fillStyle = d.flash > 0 ? '#ffffff' : '#8a94a8';
  ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#39404f'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#d8574a';
  ctx.beginPath(); ctx.arc(d.x, d.y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rrect(ctx, d.x - 28, d.y - 42, 56, 8, 4); ctx.fill();
  ctx.fillStyle = '#6effe9';
  rrect(ctx, d.x - 27, d.y - 41, 54 * clamp(d.hp / d.maxHp, 0, 1), 6, 3); ctx.fill();
  ctx.fillStyle = '#cfd8e8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.name, d.x, d.y - 48);
  ctx.restore();
}

function drawShots(ctx) {
  Battle.shots.forEach((s) => {
    ctx.save();
    const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, s.r * 2.4);
    g.addColorStop(0, s.color);
    g.addColorStop(1, rgba(s.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

/** under=false は足もと（炎の柱など）、under=true は上に重ねるもの */
function drawFx(ctx, over) {
  Battle.fx.forEach((f) => {
    const isUnder = (f.kind === 'fire');
    if (isUnder === over) return;
    const k = f.t / f.life;
    ctx.save();
    if (f.kind === 'spark') {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + f.t * 4;
        const r1 = f.r * (0.4 + k), r2 = f.r * (0.9 + k * 1.4);
        ctx.beginPath();
        ctx.moveTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
        ctx.lineTo(f.x + Math.cos(a) * r2, f.y + Math.sin(a) * r2);
        ctx.stroke();
      }
    } else if (f.kind === 'swipe') {
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = f.big ? 8 : 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(f.x, f.y, (f.reach || 40) * 0.5, f.a - 1.1, f.a + 1.1);
      ctx.stroke();
      if (f.whip) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.from.x, f.from.y);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
      }
    } else if (f.kind === 'flame') {
      ctx.globalAlpha = (1 - k) * 0.85;
      for (let i = 0; i < 5; i++) {
        const t2 = i / 5;
        const px = f.from.x + (f.x - f.from.x) * (0.3 + t2 * 0.9);
        const py = f.from.y + (f.y - f.from.y) * (0.3 + t2 * 0.9);
        ctx.fillStyle = i < 2 ? '#ffe98f' : f.color;
        ctx.beginPath();
        ctx.arc(px + rand(6, -6), py + rand(6, -6), 11 - i * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.kind === 'fire') {
      ctx.globalAlpha = 0.5 + Math.sin(f.t * 9) * 0.12;
      const g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.r);
      g.addColorStop(0, 'rgba(255,233,143,0.9)');
      g.addColorStop(0.5, 'rgba(255,157,77,0.6)');
      g.addColorStop(1, 'rgba(255,110,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    } else if (f.kind === 'iai') {
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = f.color; ctx.lineWidth = 6 * (1 - k) + 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + Math.cos(f.a) * 250, f.y + Math.sin(f.a) * 250);
      ctx.stroke();
    } else if (f.kind === 'quake') {
      if (!f.silent) {
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 8 * (1 - k) + 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * easeOut(k), 0, Math.PI * 2); ctx.stroke();
      }
    } else if (f.kind === 'burst') {
      ctx.globalAlpha = 1 - k;
      const rr = f.r * (0.3 + k);
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, rr);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, f.color);
      g.addColorStop(1, rgba(f.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI * 2); ctx.fill();
    } else if (f.kind === 'ward') {
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = f.color; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + k * 0.8), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  });
}

/** 時間が止まっているあいだの画面 */
function drawTimeStop(ctx, camX, camY, cw, ch, scale) {
  const w = cw / scale, h = ch / scale;
  const x0 = camX - w / 2, y0 = camY - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(18, 16, 46, 0.42)';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(255, 233, 143, 0.30)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Battle.stopT * 0.4;
    ctx.beginPath();
    ctx.moveTo(camX + Math.cos(a) * 130, camY + Math.sin(a) * 130);
    ctx.lineTo(camX + Math.cos(a) * (w + h), camY + Math.sin(a) * (w + h));
    ctx.stroke();
  }
  ctx.restore();
}

function drawTexts(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  Battle.texts.forEach((t) => {
    const k = t.t / t.life;
    ctx.globalAlpha = 1 - k * k;
    ctx.font = (t.bold ? 'bold ' : '') + (t.size || 18) + 'px "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  });
  ctx.restore();
}
