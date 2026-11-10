/* =========================================================================
   SLIME FUSION ― バトル
   3たい3 の ターンせい。わざ と パワー、色チェンジ、とくせい。
   え は canvas、コマンドは DOM (#cmd)
   ========================================================================= */
'use strict';

const wait = (ms) => new Promise((res) => setTimeout(res, ms / Battle.mul()));

const Battle = {
  on: false,
  fast: false,
  turbo: 1,        // テスト用。?debug で あげる
  mul() { return (this.fast ? 2.2 : 1) * this.turbo; },
  units: [], fx: [], floats: [], shots: [],
  phase: 'idle',
  log: '',
  turn: 0,
  def: null,       // { kind, title, bg, enemies:[slime], boss?, onEnd }
  pick: null,      // コマンドを えらんでいる なかま
  targeting: null,

  start(def) {
    this.def = def;
    this.on = true;
    this.turn = 0;
    this.fx = []; this.floats = []; this.shots = [];
    this.units = [];
    partySlimes().forEach((s, i) => this.units.push(this.makeUnit(s, 'ally', i)));
    def.enemies.forEach((s, i) => this.units.push(this.makeUnit(s, 'foe', i, def.bossIndex === i, def.dummy, def.hpMul)));
    G.mode = 'battle';
    UI.showBattle(def.title);
    this.say(def.intro || `${def.title}！`);
    this.beginTurn();
  },

  makeUnit(s, side, idx, boss, dummy, hpMul = 1) {
    const st = calcStats(s);
    let tr = traitsOf(s);
    /* ボスは さいせい しない (たたかいが ながく なりすぎる) */
    if (boss) tr = tr.filter((t) => t !== 'regen');
    /* ボスは 一げきで たおされない かわりに、HP が 多い */
    if (boss) { st.atk = Math.round(st.atk * 0.75); st.def = Math.round(st.def * 0.85); }
    const max = Math.round(st.hp * (boss ? this.def.bossHp || 1.6 : 1) * (side === 'foe' ? hpMul : 1));
    return {
      s, side, idx, boss: !!boss, dummy: !!dummy, tr,
      st, max, hp: max, alive: true,
      color: baseColor(s), colors: s.colors.length ? s.colors.slice() : ['plain'],
      sp: tr.includes('hoard') ? 3 : 1,
      slow: 0, flinch: false, guard: false, sturdyUsed: false, grit: false, spdUp: 0,
      x: 0, y: 0, r: 40, ox: 0, oy: 0, flash: 0, shake: 0, mood: null, fade: 1, hop: Math.random() * 6,
      name: s.nick ? `${s.nick}` : spName(s),
    };
  },
  allies() { return this.units.filter((u) => u.side === 'ally'); },
  foes() { return this.units.filter((u) => u.side === 'foe'); },
  live(side) { return this.units.filter((u) => u.side === side && u.alive); },
  say(t) { this.log = t; UI.battleLog(t); },

  /* ------------------------------ ターン ------------------------------ */
  beginTurn() {
    this.turn++;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (this.turn > 1) u.sp = Math.min(5, u.sp + 1);
      u.guard = false; u.changed = false; u.cmd = null;
    }
    this.phase = 'command';
    this.pick = this.live('ally')[0];
    UI.battleCommand();
  },

  /* なかまの コマンドが そろったら じっこう */
  setCommand(u, cmd) {
    u.cmd = cmd;
    const rest = this.live('ally').filter((a) => !a.cmd);
    if (rest.length) { this.pick = rest[0]; UI.battleCommand(); return; }
    this.pick = null;
    this.run();
  },
  back() {
    const live = this.live('ally');
    const i = live.indexOf(this.pick);
    if (i > 0) { this.pick = live[i - 1]; this.pick.cmd = null; UI.battleCommand(); }
  },

  changeColor(u, col) {
    if (u.changed || u.color === col || !u.colors.includes(col)) return false;
    u.color = col; u.changed = true;
    if (u.tr.includes('chameleon')) u.sp = Math.min(5, u.sp + 1);
    Sfx.color();
    this.burst(u.x, u.y, COLORS[col].c, 18);
    u.flash = 0.8;
    return true;
  },

  async run() {
    this.phase = 'anim';
    UI.battleCommand();
    /* てきの きめごと */
    for (const f of this.live('foe')) this.enemyThink(f);
    /* ガードは さいしょに */
    for (const u of this.units) if (u.alive && u.cmd && u.cmd.type === 'guard') u.guard = true;
    const order = this.units.filter((u) => u.alive && u.cmd).map((u) => ({ u, k: this.speedOf(u) * rand(0.9, 1.1) + (this.turn === 1 && u.tr.includes('brave') ? 9999 : 0) }));
    order.sort((a, b) => b.k - a.k);
    for (const { u } of order) {
      if (!u.alive) continue;
      await this.act(u);
      if (!this.live('ally').length || !this.live('foe').length) break;
    }
    /* ターンの おわり */
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.slow > 0) u.slow--;
      if (u.tr.includes('regen') && u.hp < u.max) {
        const v = Math.max(1, Math.round(u.max * 0.06));
        u.hp = Math.min(u.max, u.hp + v);
        this.float(u, '+' + v, '#7aff9a');
      }
    }
    await wait(250);
    if (!this.live('foe').length) return this.finish(true);
    if (!this.live('ally').length) return this.finish(false);
    if (this.turn >= 40) { this.say('じかんぎれ！ いったん かえろう'); await wait(900); return this.finish(false); }
    this.beginTurn();
  },

  speedOf(u) {
    let s = u.st.spd * (1 + u.spdUp * 0.25);
    if (u.slow > 0) s *= 0.5;
    return s;
  },

  enemyThink(f) {
    if (f.dummy) { f.cmd = { type: 'idle' }; return; }
    const allies = this.live('ally');
    /* 色を かえる。ボスは よく かえる */
    if (f.colors.length > 1 && Math.random() < (f.boss ? 0.75 : 0.3)) {
      const tgt = pick(allies);
      const good = f.colors.filter((c) => affinity(c, tgt.color) > 1);
      const safe = f.colors.filter((c) => allies.every((a) => affinity(a.color, c) <= 1));
      const want = good.length ? pick(good) : safe.length ? pick(safe) : null;
      if (want && want !== f.color) { this.changeColor(f, want); this.colorNote = f; }
    }
    const moves = movesOf(f.s, f.color).filter((m) => m.cost <= f.sp);
    if (f.hp < f.max * 0.3 && Math.random() < 0.15) { f.cmd = { type: 'guard' }; return; }
    const target = Math.random() < 0.35 ? allies.reduce((a, b) => (a.hp / a.max < b.hp / b.max ? a : b)) : pick(allies);
    let best = moves[0], bestV = -1;
    for (const m of moves) {
      let v = m.heal ? (this.live('foe').some((x) => x.hp < x.max * 0.5) ? 90 : 0) : m.pow * (m.hits || 1) * (m.all ? allies.length * 0.8 : 1) * affinity(m.el, target.color);
      v *= rand(0.6, 1.3);
      if (v > bestV) { bestV = v; best = m; }
    }
    f.cmd = { type: 'move', move: best, target };
  },

  /* ------------------------------ こうどう ------------------------------ */
  async act(u) {
    const c = u.cmd;
    if (u.flinch) { u.flinch = false; this.say(`${u.name}は ひるんで うごけない！`); await wait(650); return; }
    if (c.type === 'guard') { this.say(`${u.name}は みを まもっている`); u.flash = 0.5; await wait(450); return; }
    if (c.type === 'idle') { this.say(`${u.name}は じっと している`); await wait(400); return; }
    const m = c.move;
    if (m.cost > u.sp) { this.say(`${u.name}は パワーが たりない！`); await wait(500); return; }
    u.sp -= m.cost;
    this.say(`${u.name}の ${m.name}！`);
    if (m.heal || m.id === 'ears') {
      Sfx.heal();
      for (const a of this.live(u.side)) {
        const v = Math.round(a.max * m.heal);
        a.hp = Math.min(a.max, a.hp + v);
        this.float(a, '+' + v, '#7aff9a'); this.burst(a.x, a.y, '#aaffcc', 10);
      }
      await wait(700); return;
    }
    const enemySide = u.side === 'ally' ? 'foe' : 'ally';
    let targets = m.all ? this.live(enemySide) : [c.target && c.target.alive ? c.target : pick(this.live(enemySide))];
    targets = targets.filter(Boolean);
    if (!targets.length) return;
    const col = m.el === 'plain' ? '#ffffff' : COLORS[m.el].c;
    if (m.contact) {
      const t0 = targets[0];
      await this.tween(u, (k) => { u.ox = (t0.x - u.x) * 0.7 * k; u.oy = (t0.y - u.y) * 0.7 * k - Math.sin(k * Math.PI) * 30; }, 220);
      Sfx.hit(m.pow >= 70);
    } else {
      Sfx.swing(m.sig ? 'beam' : 'shoot');
      u.oy = -12;
      await Promise.all(targets.map((t) => this.shoot(u, t, col, m.sig || m.pow >= 80)));
      u.oy = 0;
    }
    for (const t of targets) {
      const hits = m.hits || 1;
      for (let h = 0; h < hits; h++) { if (t.alive) await this.hit(u, t, m, h); }
    }
    if (m.contact) await this.tween(u, (k) => { u.ox *= 1 - k; u.oy *= 1 - k; }, 180);
    u.ox = u.oy = 0;
    if (m.selfSpd) { u.spdUp = Math.min(3, u.spdUp + 1); this.float(u, 'すばやさ↑', '#9ae0ff'); }
    if (m.healAll) for (const a of this.live(u.side)) { const v = Math.round(a.max * m.healAll); a.hp = Math.min(a.max, a.hp + v); this.float(a, '+' + v, '#7aff9a'); }
    await wait(380);
  },

  calcDamage(u, t, m) {
    let atk = u.st.atk;
    if (u.tr.includes('rage') && u.hp < u.max / 3) atk *= 1.5;
    if (u.grit) atk *= 1.5;
    if (this.live(u.side).some((a) => a.tr.includes('boss'))) atk *= 1.1;
    let d = (m.pow * atk) / Math.max(1, t.st.def) * 0.55 * rand(0.88, 1.08);
    const aff = affinity(m.el, t.color);
    d *= aff;
    if (m.el !== 'plain' && m.el === u.color) d *= 1.2;
    if (m.el !== 'plain' && u.tr.includes('prism')) d *= 1.2;
    const critP = 0.06 + (m.crit || 0) + (u.tr.includes('lucky') ? 0.15 : 0);
    const crit = Math.random() < critP;
    if (crit) d *= 1.5;
    if (t.guard) d *= 0.45;
    return { d: Math.max(1, Math.round(d)), aff, crit };
  },

  async hit(u, t, m, h) {
    if (t.tr.includes('wobbly') && Math.random() < 0.15) {
      this.float(t, 'よけた！', '#ffffff'); t.ox = (t.side === 'ally' ? -1 : 1) * 24; await wait(260); t.ox = 0; return;
    }
    const { d, aff, crit } = this.calcDamage(u, t, m);
    this.damage(t, d, u);
    const col = m.el === 'plain' ? '#ffffff' : COLORS[m.el].c;
    this.burst(t.x, t.y, col, crit ? 22 : 12);
    Sfx.hit(crit || aff > 1);
    if (crit) this.float(t, 'きゅうしょ！', '#ffd23a', -26);
    if (h === 0 && aff > 1) { this.say('こうかは ばつぐんだ！'); this.float(t, 'ばつぐん！', '#ff7a3a', -44); }
    else if (h === 0 && aff < 1) { this.say('こうかは いまひとつ…'); this.float(t, 'いまひとつ', '#a0a0c0', -44); }
    if (u.tr.includes('absorb') || m.drain) {
      const v = Math.max(1, Math.round(d * (m.drain || 0.25)));
      u.hp = Math.min(u.max, u.hp + v); this.float(u, '+' + v, '#7aff9a');
    }
    if (m.contact && t.tr.includes('thorny') && u.alive) {
      const v = Math.max(1, Math.round(u.max * 0.06));
      this.damage(u, v, null); this.float(u, 'トゲ！ -' + v, '#ff9a9a', -20);
    }
    if (t.alive && m.flinch && Math.random() < m.flinch && this.speedOf(u) > 0) t.flinch = true;
    if (t.alive && (m.slow || u.tr.includes('sticky')) && Math.random() < (m.slow ? 0.6 : 0.3)) { t.slow = 2; this.float(t, 'のろくなった', '#c0a0ff', 20); }
    await wait(m.hits ? 220 : 340);
  },

  damage(t, d) {
    if (!t.alive) return;
    if (t.hp - d <= 0 && t.tr.includes('sturdy') && !t.sturdyUsed && t.hp > 1) {
      t.sturdyUsed = true; d = t.hp - 1;
      this.float(t, 'がんじょう！', '#ffd23a', -60);
    }
    t.hp = Math.max(0, t.hp - d);
    t.flash = 1; t.shake = 0.35; t.mood = 'hurt';
    setTimeout(() => { t.mood = null; }, 500);
    this.float(t, '-' + d, t.side === 'ally' ? '#ff6a6a' : '#ffffff');
    if (t.hp <= 0) {
      t.alive = false; t.cmd = null; Sfx.ko();
      this.burst(t.x, t.y, '#ffffff', 20);
      for (const a of this.live(t.side)) if (a.tr.includes('grit') && !a.grit) { a.grit = true; this.float(a, 'まけないぞ！', '#ffb03a', -50); }
    }
  },

  /* ------------------------------ おわり ------------------------------ */
  async finish(win) {
    this.phase = 'end';
    UI.battleCommand();
    await wait(400);
    if (win) Sfx.win(); else Sfx.lose();
    const res = { win, exp: 0, coins: 0, ups: [], recruit: null };
    if (win) {
      const foes = this.foes();
      res.exp = Math.round(foes.reduce((a, f) => a + f.s.lv * 3 + 6, 0) * (this.def.expMul || 1) * (this.def.bossIndex !== undefined ? 1.6 : 1));
      res.coins = Math.round(foes.reduce((a, f) => a + f.s.lv * 2 + 4, 0) * (this.def.coinMul || 1));
      P.coins += res.coins;
      P.wins++;
      for (const a of this.allies()) {
        const got = a.alive ? res.exp : Math.round(res.exp / 2);
        const before = a.s.lv;
        const ups = gainExp(a.s, got);
        if (ups) res.ups.push({ s: a.s, from: before, to: a.s.lv });
      }
      if (res.ups.length) setTimeout(() => Sfx.levelup(), 700);
    }
    if (this.def.onEnd) this.def.onEnd(res);
    saveGame();
    UI.battleResult(res);
  },

  leave() {
    this.on = false;
    this.phase = 'idle';
    G.mode = 'home';
  },

  /* ------------------------------ えんしゅつ ------------------------------ */
  tween(u, fn, ms) {
    return new Promise((res) => {
      const t0 = performance.now(), dur = ms / this.mul();
      const step = () => {
        const k = clamp((performance.now() - t0) / dur, 0, 1);
        fn(easeOut(k));
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  },
  shoot(u, t, col, big) {
    return new Promise((res) => {
      this.shots.push({ x0: u.x, y0: u.y - u.r * 0.2, x1: t.x, y1: t.y, k: 0, dur: 0.32 / this.mul(), col, big, done: res });
    });
  },
  burst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), v = rand(60, 260);
      this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.4, 0.8), max: 0.8, col, s: rand(3, 7) });
    }
  },
  float(u, text, col, dy = 0) {
    this.floats.push({ x: u.x + rand(-10, 10), y: u.y - u.r - 10 + dy, text, col, life: 1.1 });
  },

  layout() {
    const W = G.W, H = G.H - UI.cmdHeight();
    const portrait = W < H * 1.1;
    const place = (list, side) => {
      const n = list.length;
      list.forEach((u, i) => {
        let x, y;
        if (portrait) {
          x = W * ((i + 1) / (n + 1));
          y = side === 'foe' ? H * 0.4 + (i % 2) * H * 0.11 : H * 0.88 - (i % 2) * H * 0.11;
        } else {
          /* よこ画面は 2れつに ずらして かさならない ように */
          const SLOT = { 1: [[0.25, 0.66]], 2: [[0.27, 0.5], [0.13, 0.78]], 3: [[0.3, 0.45], [0.12, 0.63], [0.3, 0.83]] }[n] || [[0.25, 0.66]];
          const [fx, fy] = SLOT[i] || SLOT[0];
          x = W * (side === 'ally' ? fx : 1 - fx);
          y = H * fy;
        }
        const base = Math.min(W / (portrait ? 3.6 : 8), H / 5.2) * 0.5;
        u.r = slimeR(u.s, base) * (u.boss ? 1.45 : 1);
        /* うえの メッセージに なまえの おびが かからない ように */
        u.x = x; u.y = Math.max(y, 118 + u.r * 1.25 + 26);
      });
    };
    place(this.allies(), 'ally');
    place(this.foes(), 'foe');
  },

  update(dt) {
    for (const u of this.units) {
      u.flash = Math.max(0, u.flash - dt * 3);
      u.shake = Math.max(0, u.shake - dt);
      if (!u.alive) u.fade = Math.max(0, u.fade - dt * 2);
    }
    for (const p of this.fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    this.fx = this.fx.filter((p) => p.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y -= 34 * dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const s of this.shots) {
      s.k += dt / s.dur;
      if (s.k >= 1 && !s.fin) { s.fin = true; s.done(); }
    }
    this.shots = this.shots.filter((s) => !s.fin);
  },

  draw(ctx) {
    const W = G.W, H = G.H;
    this.layout();
    drawArena(ctx, W, H, this.def.bg, G.time);
    const list = this.units.slice().sort((a, b) => a.y - b.y);
    for (const u of list) {
      if (u.fade <= 0) continue;
      const hop = u.alive ? Math.abs(Math.sin(G.time * 3 + u.hop)) * u.r * 0.08 : 0;
      const sx = u.shake > 0 ? Math.sin(G.time * 70) * 6 : 0;
      ctx.save();
      ctx.translate(u.x + u.ox + sx, u.y + u.oy - hop);
      if (u.side === 'foe') ctx.scale(-1, 1);
      const picked = this.pick === u && this.phase === 'command';
      if (picked) {
        ctx.fillStyle = 'rgba(255,240,120,0.35)';
        ctx.beginPath(); ctx.ellipse(0, u.r * 0.8 + hop, u.r * 1.3, u.r * 0.35, 0, 0, TAU); ctx.fill();
      }
      if (this.targeting && u.side === 'foe' && u.alive) {
        ctx.strokeStyle = `rgba(255,90,90,${0.5 + Math.sin(G.time * 8) * 0.4})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(0, u.r * 0.8 + hop, u.r * 1.3, u.r * 0.35, 0, 0, TAU); ctx.stroke();
      }
      drawSlime(ctx, u.s, { r: u.r, col: u.color, t: G.time + u.hop, sq: Math.sin(G.time * 6 + u.hop) * 0.03, look: 0.6, mood: u.alive ? u.mood : 'hurt', flash: u.flash, alpha: u.fade });
      if (u.guard) {
        ctx.strokeStyle = 'rgba(140,220,255,0.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, u.r * 1.25, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      if (u.alive) this.drawBar(ctx, u, picked);
    }
    for (const s of this.shots) {
      const k = clamp(s.k, 0, 1);
      const x = lerp(s.x0, s.x1, k), y = lerp(s.y0, s.y1, k) - Math.sin(k * Math.PI) * 40;
      ctx.fillStyle = s.col; ctx.shadowColor = s.col; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(x, y, s.big ? 16 : 9, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x, y, s.big ? 7 : 4, 0, TAU); ctx.fill();
    }
    for (const p of this.fx) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
      ctx.font = `900 ${f.text.length > 4 ? 16 : 22}px ${FONT}`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  },

  drawBar(ctx, u, picked) {
    const w = clamp(u.r * 1.9, 96, 150), x = u.x - w / 2, y = u.y - u.r * 1.25 - 26 - (u.boss ? 10 : 0);
    ctx.save();
    ctx.fillStyle = picked ? 'rgba(80,60,0,0.85)' : 'rgba(0,0,0,0.6)';
    roundRect(ctx, x - 4, y - 16, w + 8, 30, 7); ctx.fill();
    ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffe08a';
    const lv = 'Lv' + u.s.lv;
    ctx.fillText(lv, x + w, y - 4);
    /* なまえは のこりの はばに おさまるまで けずる */
    const room = w - 13 - ctx.measureText(lv).width - 4;
    let nm = u.name.replace('スライム', '');
    if (!nm) nm = u.name;
    while (nm.length > 1 && ctx.measureText(nm).width > room) nm = nm.slice(0, -1);
    if (nm !== u.name.replace('スライム', '') && nm !== u.name) nm = nm.slice(0, -1) + '…';
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(nm, x + 13, y - 4);
    ctx.fillStyle = COLORS[u.color].c; ctx.beginPath(); ctx.arc(x + 5, y - 8, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#331'; ctx.fillRect(x, y + 1, w, 6);
    const k = u.hp / u.max;
    ctx.fillStyle = k > 0.5 ? '#5ae05a' : k > 0.25 ? '#ffd23a' : '#ff4a4a';
    ctx.fillRect(x, y + 1, w * k, 6);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < u.sp ? '#6ad8ff' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + i * (w / 5) + 1, y + 9, w / 5 - 2, 3);
    }
    ctx.restore();
  },

  /* canvas を タップした とき。ねらう あいてを えらぶ */
  tap(x, y) {
    if (!this.targeting) return false;
    const hitU = this.live('foe').find((u) => Math.hypot(u.x - x, u.y - y) < u.r * 1.3);
    if (hitU) { UI.chooseTarget(hitU); return true; }
    return false;
  },
};
