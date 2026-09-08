/* =========================================================================
   MOKO GOD ― ゲーム本体
   歩く / 斬る / 魔法をつかう / 魔物と戦う / レベルをあげる / 城へ
   ========================================================================= */
'use strict';

const HERO_SPEED = 180;
const ROLL_TIME = 0.34;
const ROLL_SPEED = 460;
const IFRAME_HIT = 0.7;
const DAY_SEC = 210;      /* 1日の長さ（秒） */

function sealCount(G) {
  return (G.seals.seal_leaf ? 1 : 0) + (G.seals.seal_sun ? 1 : 0) + (G.seals.seal_ice ? 1 : 0);
}

const Game = {
  G: null, canvas: null, playing: false, last: 0, saveT: 0, spawnT: 0, hudT: 0,
  newArmed: false,

  /* ============================== はじめ ============================== */
  boot() {
    this.canvas = document.getElementById('game');
    R.init(this.canvas);
    Input.init(this.canvas);
    UI.init();
    this.bindTitle();
    requestAnimationFrame((t) => this.loop(t));
  },

  bindTitle() {
    const cont = document.getElementById('btnContinue');
    cont.disabled = !Save.has();
    if (cont.disabled) cont.classList.add('ghost');

    document.getElementById('btnNew').addEventListener('click', () => {
      if (Save.has() && !this.newArmed) {
        this.newArmed = true;
        document.getElementById('newWarn').classList.add('on');
        return;
      }
      document.getElementById('titleScreen').classList.add('hidden');
      document.getElementById('nameScreen').classList.remove('hidden');
      document.getElementById('heroInput').value = HERO_DEFAULT;
      document.getElementById('heroInput').focus();
    });
    cont.addEventListener('click', () => this.continueGame());
    document.getElementById('btnHelp').addEventListener('click', () => {
      document.getElementById('titleHelp').classList.toggle('on');
    });
    document.getElementById('btnNameBack').addEventListener('click', () => {
      document.getElementById('nameScreen').classList.add('hidden');
      document.getElementById('titleScreen').classList.remove('hidden');
    });
    document.getElementById('btnStart').addEventListener('click', () => {
      const name = (document.getElementById('heroInput').value.trim() || HERO_DEFAULT).slice(0, 10);
      document.getElementById('nameScreen').classList.add('hidden');
      this.newGame(name);
    });
    document.getElementById('heroInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnStart').click();
    });
    document.getElementById('btnRevive').addEventListener('click', () => this.revive());
    document.getElementById('btnEndClose').addEventListener('click', () => {
      document.getElementById('endScreen').classList.add('hidden');
    });
    document.getElementById('btnEndTitle').addEventListener('click', () => {
      document.getElementById('endScreen').classList.add('hidden');
      this.save(); this.toTitle();
    });
  },

  toTitle() {
    this.playing = false;
    this.newArmed = false;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('newWarn').classList.remove('on');
    document.getElementById('titleScreen').classList.remove('hidden');
    const cont = document.getElementById('btnContinue');
    cont.disabled = !Save.has();
    if (!cont.disabled) cont.classList.remove('ghost');
  },

  /* ============================ 新しい旅 ============================ */
  freshState(name, seed) {
    const v = World.villages[0];
    return {
      ver: 2, seed, name,
      tod: 0.35, home: 0,
      p: {
        x: v.tx * TILE + 16, y: v.ty * TILE + 70,
        vx: 0, vy: 0, face: 1, aim: Math.PI / 2, wob: 0,
        lv: 1, exp: 0, coin: 30,
        hp: baseHp(1), mp: baseMp(1),
        weapon: 0, armor: 0, charm: 0,
        ownW: [0], ownA: [0], ownC: [0],
        bag: { herb: 3 },
        skill: 0, cool: [0, 0, 0, 0, 0, 0],
        swing: 0, swingMax: 0, hitIds: [], iframe: 0,
        roll: 0, rdx: 0, rdy: 0, ward: 0, dead: false,
      },
      seals: { seal_leaf: false, seal_sun: false, seal_ice: false },
      kills: 0, bossDown: {}, demonDown: false, metElder: false,
      mobs: [], npcs: [], bullets: [], novas: [], drops: [],
      nearNpc: null, quest: '', paused: false,
    };
  },

  newGame(name) {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    World.generate(seed);
    this.G = this.freshState(name, seed);
    this.buildNpcs();
    this.G.metElder = true;   /* 旅立ちの場面で村長が話しかけてくる */
    this.refreshQuest();
    this.start(true);
    UI.talk('村長', ELDER_LINES[0]);
  },

  continueGame() {
    const d = Save.read();
    if (!d) return;
    World.generate(d.seed);
    const G = this.freshState(d.name, d.seed);
    Object.assign(G.p, d.p);
    G.p.swing = 0; G.p.roll = 0; G.p.iframe = 0; G.p.ward = 0; G.p.dead = false;
    G.p.cool = [0, 0, 0, 0, 0, 0];
    G.seals = d.seals;
    G.kills = d.kills || 0;
    G.bossDown = d.bossDown || {};
    G.demonDown = !!d.demonDown;
    G.metElder = !!d.metElder;
    G.tod = d.tod ?? 0.35;
    this.G = G;
    this.buildNpcs();
    this.refreshQuest();
    this.start(true);
  },

  start(snap) {
    this.playing = true;
    document.getElementById('titleScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    R.follow(this.G.p.x, this.G.p.y, snap);
    UI.refreshHUD(this.G);
    UI.refreshSkills(this.G);
    FX.clear();
  },

  /* ============================ 村びと ============================ */
  buildNpcs() {
    const G = this.G;
    G.npcs = [];
    World.villages.forEach((v, vi) => {
      const jobs = v.main ? ['elder', 'smith', 'shop', 'inn', 'sage'] : ['smith', 'shop', 'inn'];
      const cx = v.tx * TILE + 16, cy = v.ty * TILE + 16;
      jobs.forEach((job, i) => {
        const a = (i / jobs.length) * TAU + vi;
        const p = { x: cx + Math.cos(a) * 74, y: cy + Math.sin(a) * 58 };
        const jd = NPC_JOBS[job];
        G.npcs.push({
          job, name: jd.name, icon: jd.icon, shop: jd.shop, village: vi,
          x: p.x, y: p.y, hx: p.x, hy: p.y, face: 1, wob: Math.random() * TAU,
          c1: jd.c1, c2: jd.c2,
        });
      });
      /* 子どもと村びとを何人か */
      const extra = v.main ? 4 : 2;
      for (let i = 0; i < extra; i++) {
        const a = Math.random() * TAU, r = 30 + Math.random() * 70;
        G.npcs.push({
          job: 'villager', name: MOKO_NAMES[(vi * 5 + i) % MOKO_NAMES.length], icon: '', village: vi,
          x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8,
          hx: cx, hy: cy, face: 1, wob: Math.random() * TAU,
          child: i % 2 === 0,
          c1: '#ffc2dc', c2: '#ff8ab4',
        });
      }
    });
  },

  /* ============================ ループ ============================ */
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    R.t += dt;

    if (!this.playing) { Input.endFrame(); return; }
    const G = this.G;
    const busy = UI.talkOn || UI.panelOpen || G.p.dead;
    if (!busy) this.update(dt);
    else { FX.update(dt); this.wobble(dt); }

    R.follow(G.p.x, G.p.y);
    R.drawWorld(G);
    const mm = R.minimapSpot();
    R.drawMinimap(R.ctx, G, mm.x, mm.y, mm.r);

    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; UI.refreshHUD(G); }
    this.saveT += dt;
    if (this.saveT > 12) { this.saveT = 0; this.save(); }

    Input.endFrame();
  },

  wobble(dt) {
    for (const n of this.G.npcs) n.wob += dt * 2;
    for (const m of this.G.mobs) m.wob += dt * 3;
  },

  update(dt) {
    const G = this.G;
    G.tod = (G.tod + dt / DAY_SEC) % 1;

    this.updateHotkeys();
    this.updatePlayer(dt);
    this.updateMobs(dt);
    this.updateBullets(dt);
    this.updateNovas(dt);
    this.updateNpcs(dt);
    this.updateDrops(dt);
    FX.update(dt);

    /* 魔物をわかせる */
    this.spawnT += dt;
    if (this.spawnT > 0.7) {
      this.spawnT = 0;
      World.spawnRing(G, G.p.x, G.p.y);
      World.cullFar(G, G.p.x, G.p.y);
    }
    this.checkBosses();
  },

  /* ============================ キー ============================ */
  updateHotkeys() {
    const G = this.G;
    if (Input.hit('Escape')) { UI.openMenu(); return; }
    if (Input.hit('m')) { UI.openMap(); return; }
    if (Input.hit('i') || Input.hit('Tab')) { UI.openBag(); return; }
    if (Input.hit('e')) this.act();
    if (Input.hit('f')) this.useItem('herb');
    for (let i = 0; i < SKILLS.length; i++) {
      if (Input.hit(String(i + 1))) this.cast(i);
    }
    if (Input.hit('q')) {
      const usable = SKILLS.map((s, i) => i).filter((i) => G.p.lv >= SKILLS[i].lv);
      if (usable.length) {
        const at = usable.indexOf(G.p.skill);
        G.p.skill = usable[(at + 1) % usable.length];
        UI.refreshSkills(G);
      }
    }
  },

  /* ============================ 勇者 ============================ */
  stats() {
    const p = this.G.p;
    const w = WEAPONS[p.weapon], a = ARMORS[p.armor], c = CHARMS[p.charm];
    return {
      maxhp: Math.round(baseHp(p.lv) + (c.hp || 0)),
      maxmp: Math.round(baseMp(p.lv) + (c.mp || 0)),
      atk: Math.round(baseAtk(p.lv) + w.atk + (c.atk || 0)),
      def: Math.round(baseDef(p.lv) + a.def + (c.def || 0)),
      speed: HERO_SPEED * a.spd * (c.spd || 1),
      w, a, c,
    };
  },

  updatePlayer(dt) {
    const G = this.G, p = G.p;
    const st = this.stats();
    p.hp = Math.min(p.hp, st.maxhp);
    p.mp = Math.min(p.mp + dt * (2.6 + p.lv * 0.14), st.maxmp);

    p.iframe = Math.max(0, p.iframe - dt);
    p.ward = Math.max(0, p.ward - dt);
    for (let i = 0; i < p.cool.length; i++) p.cool[i] = Math.max(0, p.cool[i] - dt);

    /* --- ねらう向き --- */
    if (!Input.isTouch) {
      const wx = Input.mouse.x + R.cam.x, wy = Input.mouse.y + R.cam.y;
      p.aim = Math.atan2(wy - p.y, wx - p.x);
    }

    /* --- 動く --- */
    const ax = Input.axis();
    if (p.roll > 0) {
      p.roll -= dt;
      this.moveEnt(p, p.rdx * ROLL_SPEED * dt, p.rdy * ROLL_SPEED * dt, 11);
      p.wob += dt * 22;
      if (Math.random() < 0.6) FX.list.push({ x: p.x, y: p.y + 6, vx: 0, vy: 0, life: 0.28, max: 0.28, color: 'rgba(210,230,255,.6)', r: 5, g: 0 });
    } else {
      let sp = st.speed;
      if (p.swing > 0) sp *= 0.45;
      const dx = ax.x * sp * dt, dy = ax.y * sp * dt;
      this.moveEnt(p, dx, dy, 11);
      if (ax.x || ax.y) {
        p.wob += dt * 9;
        if (Input.isTouch) p.aim = Math.atan2(ax.y, ax.x);
      } else p.wob += dt * 1.6;

      /* ころがる */
      if (Input.hit('Shift') && (ax.x || ax.y)) {
        p.roll = ROLL_TIME; p.iframe = Math.max(p.iframe, ROLL_TIME + 0.06);
        p.rdx = ax.x; p.rdy = ax.y;
      }
    }

    /* タッチのときは、指でふれた場所のほうへ剣をふる。
       ふれていないあいだは、歩いている向き。 */
    if (Input.isTouch && Input.mouse.down) {
      const wx = Input.mouse.x + R.cam.x, wy = Input.mouse.y + R.cam.y;
      if (dist(wx, wy, p.x, p.y) > 24) p.aim = Math.atan2(wy - p.y, wx - p.x);
    }
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;

    /* --- 斬る --- */
    if (p.swing > 0) {
      const before = p.swing;
      p.swing -= dt;
      /* ふりはじめの 65% にあたり判定 */
      if (before / p.swingMax > 0.35) this.swingHit();
      if (p.swing <= 0) p.hitIds.length = 0;
    } else if (!UI.talkOn && (Input.mouse.down || Input.held(' '))) {
      p.swing = st.w.spd; p.swingMax = st.w.spd; p.hitIds = [];
      if (!Input.isTouch) {
        const wx = Input.mouse.x + R.cam.x, wy = Input.mouse.y + R.cam.y;
        p.aim = Math.atan2(wy - p.y, wx - p.x);
      }
    }

    /* --- 近くの村びと --- */
    G.nearNpc = null;
    let best = 999;
    for (const n of G.npcs) {
      const d = dist(n.x, n.y, p.x, p.y);
      if (d < 56 && d < best) { best = d; G.nearNpc = n; }
    }
    /* 村の中では、すこしずつ回復する */
    if (World.villageAt(p.x, p.y, 150)) {
      p.hp = Math.min(st.maxhp, p.hp + dt * 6);
    }
  },

  /* その場に立てるか。体を四角とみなして四隅をしらべる。
     左右で判定がちがうと、水ぎわで身動きがとれなくなるので対称にする。 */
  canStand(x, y, r) {
    const h = r * 0.6;
    return World.walkPx(x - r, y - h) && World.walkPx(x + r, y - h)
        && World.walkPx(x - r, y + h) && World.walkPx(x + r, y + h);
  },

  /* あたり判定つきで動かす。縦横を別々に見るので、壁ぞいに滑る。 */
  moveEnt(e, dx, dy, r) {
    /* めりこんでいるときは、どこへでも逃げられるようにする */
    const trapped = !this.canStand(e.x, e.y, r);
    if (dx && (trapped || this.canStand(e.x + dx, e.y, r))) e.x += dx;
    if (dy && (trapped || this.canStand(e.x, e.y + dy, r))) e.y += dy;
    e.x = clamp(e.x, 20, World.pxW() - 20);
    e.y = clamp(e.y, 20, World.pxH() - 20);
  },

  /* 剣のあたり判定 */
  swingHit() {
    const G = this.G, p = G.p, st = this.stats();
    const w = st.w;
    for (const m of G.mobs) {
      if (p.hitIds.includes(m.id)) continue;
      const d = dist(m.x, m.y, p.x, p.y);
      const reach = w.range + 12 * (m.scale || 1);
      if (d > reach) continue;
      let da = Math.atan2(m.y - p.y, m.x - p.x) - p.aim;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      if (Math.abs(da) > w.arc / 2 + 0.25) continue;

      p.hitIds.push(m.id);
      const crit = Math.random() < 0.09;
      let dmg = st.atk * (0.9 + Math.random() * 0.2) * (crit ? 1.9 : 1) - m.def.def * 0.9;
      dmg = Math.max(1, Math.round(dmg));
      this.hurtMob(m, dmg, crit, Math.cos(p.aim), Math.sin(p.aim));
    }
  },

  /* ============================ 魔法 ============================ */
  cast(i) {
    const G = this.G, p = G.p;
    const s = SKILLS[i];
    if (!s || p.lv < s.lv) { toast('まだ覚えていない魔法だ', 'bad'); return; }
    if (p.cool[i] > 0) return;
    if (p.mp < s.mp) { toast('MPがたりない', 'bad'); return; }
    p.mp -= s.mp; p.cool[i] = s.cool; p.skill = i;
    const mag = 1 + (p.lv - 1) * 0.12;

    if (s.kind === 'bolt') {
      this.shoot(p.x, p.y, p.aim, s.speed, Math.round(s.dmg * mag), s.color, s.r, true);
    } else if (s.kind === 'spread') {
      for (let k = 0; k < s.n; k++) {
        const a = p.aim + (k - (s.n - 1) / 2) * s.spread;
        const b = this.shoot(p.x, p.y, a, s.speed, Math.round(s.dmg * mag), s.color, s.r, true);
        b.slow = s.slow;
      }
    } else if (s.kind === 'heal') {
      const mx = this.stats().maxhp;
      const h = Math.round(s.heal * mag);
      p.hp = Math.min(mx, p.hp + h);
      FX.text(p.x, p.y - 26, '+' + h, '#8ef0a8');
      FX.ring(p.x, p.y, 'rgba(142,240,168,.9)', 14, 70, 0.6);
    } else if (s.kind === 'nova') {
      const dmg = Math.round(s.dmg * mag);
      G.novas.push({ x: p.x, y: p.y, r: s.r, life: 0.45, max: 0.45, color: s.color });
      for (const m of G.mobs) {
        if (dist(m.x, m.y, p.x, p.y) > s.r) continue;
        const a = Math.atan2(m.y - p.y, m.x - p.x);
        this.hurtMob(m, Math.max(1, dmg - m.def.def), false, Math.cos(a), Math.sin(a));
      }
      FX.ring(p.x, p.y, s.color, 20, s.r * 1.6, 0.5);
      document.body.classList.add('shake');
      setTimeout(() => document.body.classList.remove('shake'), 200);
    } else if (s.kind === 'ward') {
      p.ward = s.time;
      FX.ring(p.x, p.y, s.color, 16, 60, 0.7);
      toast('まもりの光をまとった', 'good');
    }
    UI.refreshSkills(G);
  },

  shoot(x, y, a, speed, dmg, color, r, mine, home) {
    const b = {
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, color, r, mine: !!mine, life: 2.4, home: home || 0,
    };
    this.G.bullets.push(b);
    return b;
  },

  /* ============================ 道具 ============================ */
  useItem(id) {
    const G = this.G, p = G.p;
    if (!p.bag[id]) { toast('持っていない', 'bad'); return; }
    const it = ITEMS[id];
    if (it.quest) return;
    const st = this.stats();
    p.bag[id]--;
    if (p.bag[id] <= 0) delete p.bag[id];
    if (it.heal) { p.hp = Math.min(st.maxhp, p.hp + it.heal); FX.text(p.x, p.y - 26, '+' + Math.min(it.heal, st.maxhp), '#8ef0a8'); }
    if (it.mana) { p.mp = Math.min(st.maxmp, p.mp + it.mana); FX.text(p.x, p.y - 40, '+MP', '#9fd8ff'); }
    toast(it.name + ' をつかった', 'good');
  },

  /* ============================ 魔物 ============================ */
  updateMobs(dt) {
    const G = this.G, p = G.p;
    for (let i = G.mobs.length - 1; i >= 0; i--) {
      const m = G.mobs[i];
      const d = m.def;
      m.wob += dt * (d.fly ? 3.4 : 2.6);
      m.hurt = Math.max(0, m.hurt - dt);
      m.slow = Math.max(0, m.slow - dt);
      m.cool = Math.max(0, m.cool - dt);
      m.t += dt;

      /* ノックバック */
      if (Math.abs(m.kbx) > 1 || Math.abs(m.kby) > 1) {
        this.moveEnt(m, m.kbx * dt, m.kby * dt, 10);
        m.kbx *= 0.86; m.kby *= 0.86;
      }

      const dp = dist(m.x, m.y, p.x, p.y);
      const speed = d.speed * (m.slow > 0 ? 0.45 : 1);
      const aggro = m.boss ? 900 : 400;

      if (dp > aggro && !m.boss) {
        /* うろうろする */
        if (m.t > 2.2) { m.t = 0; m.wx = m.x + (Math.random() - 0.5) * 180; m.wy = m.y + (Math.random() - 0.5) * 180; }
        const a = Math.atan2(m.wy - m.y, m.wx - m.x);
        if (dist(m.wx, m.wy, m.x, m.y) > 12) {
          this.moveEnt(m, Math.cos(a) * speed * 0.4 * dt, Math.sin(a) * speed * 0.4 * dt, 10);
          m.face = Math.cos(a) >= 0 ? 1 : -1;
        }
        continue;
      }

      const a = Math.atan2(p.y - m.y, p.x - m.x);
      m.face = Math.cos(a) >= 0 ? 1 : -1;
      const ai = m.demon ? 'demon' : (d.ai || (d.shot ? 'shoot' : 'chase'));

      switch (ai) {
        case 'shoot': {
          const want = d.reach * 0.6;
          if (dp > want * 1.15) this.moveEnt(m, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, 10);
          else if (dp < want * 0.6) this.moveEnt(m, -Math.cos(a) * speed * 0.7 * dt, -Math.sin(a) * speed * 0.7 * dt, 10);
          if (m.cool <= 0 && dp < d.reach) {
            m.cool = d.cool;
            const s = d.shot;
            this.shoot(m.x, m.y, a, s.speed, s.dmg, s.color, s.r, false, s.home || 0);
          }
          break;
        }
        case 'charge': {
          if (m.state === 'dash') {
            this.moveEnt(m, m.dx * speed * 2.3 * dt, m.dy * speed * 2.3 * dt, 10);
            if (m.t > 0.45) { m.state = 'idle'; m.t = 0; m.cool = d.cool; }
            this.touchDamage(m, dp, 1.2);
          } else if (m.cool <= 0 && dp < 220) {
            m.state = 'dash'; m.t = 0; m.dx = Math.cos(a); m.dy = Math.sin(a);
            FX.rise(m.x, m.y, 'rgba(255,220,160,.7)', 4, 0.5);
          } else {
            this.moveEnt(m, Math.cos(a) * speed * 0.8 * dt, Math.sin(a) * speed * 0.8 * dt, 10);
            this.touchDamage(m, dp, 1);
          }
          break;
        }
        case 'burst': {
          if (dp < 320) this.moveEnt(m, Math.cos(a) * speed * 0.5 * dt, Math.sin(a) * speed * 0.5 * dt, 10);
          if (m.cool <= 0 && dp < 300) {
            m.cool = d.cool;
            const b = d.burst;
            for (let k = 0; k < b.n; k++) {
              this.shoot(m.x, m.y, (k / b.n) * TAU + m.t, b.speed, b.dmg, b.color, 5, false);
            }
          }
          this.touchDamage(m, dp, 1);
          break;
        }
        case 'slam': {
          if (dp > d.reach) this.moveEnt(m, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, 10);
          else if (m.cool <= 0) {
            m.cool = d.cool;
            G.novas.push({ x: m.x, y: m.y, r: d.reach * 2.4, life: 0.4, max: 0.4, color: '#c8b48a' });
            if (dp < d.reach * 2.4) this.hurtPlayer(d.atk * 1.4, a);
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 180);
          }
          break;
        }
        case 'demon': this.demonAI(m, dt, dp, a); break;
        default: {
          this.moveEnt(m, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, 10);
          this.touchDamage(m, dp, 1);
        }
      }

      /* 主は攻撃も混ぜる */
      if (m.guardian && d.shot && m.cool <= 0 && dp < 360) {
        m.cool = 1.4;
        const s = d.shot;
        for (let k = -1; k <= 1; k++) {
          this.shoot(m.x, m.y, a + k * 0.28, s.speed, s.dmg, s.color, s.r, false, s.home || 0);
        }
      }
    }
  },

  /* さわられたときのダメージ */
  touchDamage(m, dp, mul) {
    const reach = (m.def.reach || 26) + 10 * (m.scale || 1);
    if (dp > reach) return;
    if (m.cool > 0) return;
    m.cool = m.def.cool || 1;
    const a = Math.atan2(this.G.p.y - m.y, this.G.p.x - m.x);
    this.hurtPlayer(m.def.atk * mul, a);
  },

  hurtMob(m, dmg, crit, kx, ky) {
    m.hp -= dmg;
    m.hurt = 0.14;
    m.kbx = kx * (m.boss ? 60 : 260) / (m.scale || 1);
    m.kby = ky * (m.boss ? 60 : 260) / (m.scale || 1);
    FX.text(m.x + (Math.random() - 0.5) * 10, m.y - 20 * (m.scale || 1), String(dmg), crit ? '#ffd24a' : '#ffffff');
    FX.burst(m.x, m.y, crit ? '#ffd24a' : '#ff8a8a', crit ? 10 : 5, 90, 0.4);
    if (m.hp <= 0) this.killMob(m);
  },

  killMob(m) {
    const G = this.G;
    const i = G.mobs.indexOf(m);
    if (i >= 0) G.mobs.splice(i, 1);
    FX.burst(m.x, m.y, '#ffffff', 16, 130, 0.7);
    G.kills++;

    if (m.demon) return this.winGame(m);
    if (m.guardian) return this.guardianDown(m);

    this.addExp(m.def.exp);
    const coin = Math.round(m.def.coin * (0.7 + Math.random() * 0.7));
    G.drops.push({ x: m.x, y: m.y, kind: 'coin', n: coin, icon: '🪙', life: 30 });
    if (Math.random() < 0.16) {
      const id = Math.random() < 0.7 ? 'herb' : 'water';
      G.drops.push({ x: m.x + 14, y: m.y + 8, kind: 'item', id, n: 1, icon: ITEMS[id].icon, life: 30 });
    }
  },

  guardianDown(m) {
    const G = this.G;
    const g = GUARDIANS[m.guardian];
    G.seals[g.seal] = true;
    G.bossDown[m.guardian] = true;
    this.addExp(g.exp);
    G.p.coin += g.coin;
    toast(`${ITEMS[g.seal].icon} ${ITEMS[g.seal].name} を手に入れた！`, 'holy');
    UI.talk(g.name, [g.down, sealCount(G) >= 3 ? '三つの印がそろった。城の門がひらく。' : 'のこりの印を、さがしなさい。']);
    this.refreshQuest();
    this.save();
  },

  winGame(m) {
    const G = this.G;
    G.demonDown = true;
    this.addExp(DEMON.exp);
    G.p.coin += DEMON.coin;
    this.refreshQuest();
    this.save();
    UI.talk(DEMON.name, [DEMON.defeat], () => {
      document.getElementById('endTitle').textContent = 'おわり ― 影のあけた朝';
      document.getElementById('endBody').innerHTML =
        `<p>クロモコは灰になって、黒い城はしずかになった。</p>
         <p>村へ帰ると、モコたちが門の外まで出て待っていた。だれも、あなたを神とは呼ばなかった。名前で呼んだ。</p>
         <p class="stat">レベル ${G.p.lv} ／ たおした魔物 ${G.kills} ／ 所持金 ${G.p.coin}</p>`;
      document.getElementById('endScreen').classList.remove('hidden');
    });
  },

  /* --------------------------- 魔王のたたかい --------------------------- */
  demonAI(m, dt, dp, a) {
    const G = this.G;
    const ph = m.hp / m.maxhp > 0.6 ? 0 : m.hp / m.maxhp > 0.3 ? 1 : 2;
    m.phase = ph;
    const speed = DEMON.speed * (1 + ph * 0.2) * (m.slow > 0 ? 0.5 : 1);

    if (m.state === 'dash') {
      this.moveEnt(m, m.dx * speed * 3 * dt, m.dy * speed * 3 * dt, 14);
      if (m.t > 0.5) { m.state = 'idle'; m.t = 0; m.cool = 1.2 - ph * 0.25; }
      if (dp < 56) this.hurtPlayer(DEMON.atk * 1.5, a);
      return;
    }
    if (dp > 90) this.moveEnt(m, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, 14);

    if (m.cool > 0) return;
    m.pat = (m.pat + 1) % (ph >= 1 ? 4 : 3);
    m.cool = 1.5 - ph * 0.3;

    if (m.pat === 0) {
      /* 影の弾幕 */
      const n = 10 + ph * 4;
      for (let k = 0; k < n; k++) {
        this.shoot(m.x, m.y, (k / n) * TAU + m.t, 170 + ph * 30, 30 + ph * 9, '#c88aff', 7, false);
      }
    } else if (m.pat === 1) {
      /* まっすぐ突っこむ */
      m.state = 'dash'; m.t = 0; m.dx = Math.cos(a); m.dy = Math.sin(a);
      FX.rise(m.x, m.y, 'rgba(255,90,140,.8)', 8, 0.5);
    } else if (m.pat === 2) {
      /* 追ってくる影の矢 */
      for (let k = -1; k <= 1; k++) {
        this.shoot(m.x, m.y, a + k * 0.3, 200, 36 + ph * 11, '#ff5a7a', 8, false, 1.8);
      }
    } else {
      /* 影のモコを呼ぶ */
      for (let k = 0; k < 3; k++) {
        const ang = Math.random() * TAU;
        const nm = makeMob('kagemadoushi', m.x + Math.cos(ang) * 130, m.y + Math.sin(ang) * 130);
        if (World.walkPx(nm.x, nm.y)) G.mobs.push(nm);
      }
      toast('クロモコが影を呼んだ', 'bad');
    }
  },

  /* ============================ 弾 ============================ */
  updateBullets(dt) {
    const G = this.G, p = G.p;
    for (let i = G.bullets.length - 1; i >= 0; i--) {
      const b = G.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { G.bullets.splice(i, 1); continue; }
      if (b.home && !b.mine) {
        const a = Math.atan2(p.y - b.y, p.x - b.x);
        const sp = Math.hypot(b.vx, b.vy);
        const ca = Math.atan2(b.vy, b.vx);
        let da = a - ca;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        const na = ca + clamp(da, -b.home * dt, b.home * dt);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (!World.walkPx(b.x, b.y)) {
        FX.burst(b.x, b.y, b.color, 6, 70, 0.35);
        G.bullets.splice(i, 1); continue;
      }
      if (b.mine) {
        let hit = false;
        for (const m of G.mobs) {
          if (dist(m.x, m.y, b.x, b.y) > 14 * (m.scale || 1) + b.r) continue;
          const a = Math.atan2(b.vy, b.vx);
          this.hurtMob(m, Math.max(1, Math.round(b.dmg - m.def.def * 0.5)), false, Math.cos(a), Math.sin(a));
          if (b.slow) m.slow = b.slow;
          hit = true; break;
        }
        if (hit) { FX.burst(b.x, b.y, b.color, 8, 80, 0.4); G.bullets.splice(i, 1); }
      } else if (dist(p.x, p.y, b.x, b.y) < 13 + b.r) {
        const a = Math.atan2(b.vy, b.vx);
        this.hurtPlayer(b.dmg, a);
        FX.burst(b.x, b.y, b.color, 8, 80, 0.4);
        G.bullets.splice(i, 1);
      }
    }
  },

  updateNovas(dt) {
    const G = this.G;
    for (let i = G.novas.length - 1; i >= 0; i--) {
      G.novas[i].life -= dt;
      if (G.novas[i].life <= 0) G.novas.splice(i, 1);
    }
  },

  /* ============================ 村びと ============================ */
  updateNpcs(dt) {
    for (const n of this.G.npcs) {
      n.wob += dt * 2.4;
      if (Math.random() < 0.004) { n.tx2 = n.hx + (Math.random() - 0.5) * 90; n.ty2 = n.hy + (Math.random() - 0.5) * 70; }
      if (n.tx2 !== undefined) {
        const a = Math.atan2(n.ty2 - n.y, n.tx2 - n.x);
        if (dist(n.tx2, n.ty2, n.x, n.y) > 6) {
          n.x += Math.cos(a) * 22 * dt; n.y += Math.sin(a) * 22 * dt;
          n.face = Math.cos(a) >= 0 ? 1 : -1;
        }
      }
    }
  },

  /* ============================ 落ちもの ============================ */
  updateDrops(dt) {
    const G = this.G, p = G.p;
    for (let i = G.drops.length - 1; i >= 0; i--) {
      const d = G.drops[i];
      d.life -= dt;
      if (d.life <= 0) { G.drops.splice(i, 1); continue; }
      const dd = dist(d.x, d.y, p.x, p.y);
      if (dd < 90) {
        const a = Math.atan2(p.y - d.y, p.x - d.x);
        const pull = clamp((90 - dd) * 4, 30, 320);
        d.x += Math.cos(a) * pull * dt; d.y += Math.sin(a) * pull * dt;
      }
      if (dd < 20) {
        if (d.kind === 'coin') { p.coin += d.n; FX.text(p.x, p.y - 30, '+' + d.n + '🪙', '#ffe08a'); }
        else { p.bag[d.id] = (p.bag[d.id] || 0) + d.n; FX.text(p.x, p.y - 30, ITEMS[d.id].name, '#9fe8ff'); }
        G.drops.splice(i, 1);
      }
    }
  },

  /* ============================ ダメージ ============================ */
  hurtPlayer(raw, a) {
    const G = this.G, p = G.p;
    if (p.iframe > 0 || p.dead) return;
    const st = this.stats();
    /* 守りは「割合で減らす」。足し算で引くと、後半のダメージが 1 に潰れてしまう。 */
    let dmg = raw * (0.9 + Math.random() * 0.2) * (100 / (100 + st.def * 2.2));
    if (p.ward > 0) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.iframe = IFRAME_HIT;
    FX.text(p.x, p.y - 30, String(dmg), '#ff8a9a');
    FX.burst(p.x, p.y, '#ff6a7a', 8, 90, 0.4);
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 160);
    if (p.hp <= 0) this.die();
  },

  die() {
    const G = this.G;
    G.p.hp = 0; G.p.dead = true;
    const lost = Math.floor(G.p.coin * 0.4);
    G.p.coin -= lost;
    document.getElementById('deadLost').textContent = lost > 0 ? `所持金を ${lost} 落とした。` : '落としたものはなかった。';
    document.getElementById('deadScreen').classList.remove('hidden');
    this.save();
  },

  revive() {
    const G = this.G, p = G.p;
    document.getElementById('deadScreen').classList.add('hidden');
    /* いちばん近い村へ帰る */
    let best = World.villages[0], bd = 1e9;
    for (const v of World.villages) {
      const d = dist(v.tx * TILE, v.ty * TILE, p.x, p.y);
      if (d < bd) { bd = d; best = v; }
    }
    p.x = best.tx * TILE + 16; p.y = best.ty * TILE + 70;
    const st = this.stats();
    p.hp = st.maxhp; p.mp = st.maxmp;
    p.dead = false; p.iframe = 1.4;
    G.mobs.length = 0; G.bullets.length = 0;
    R.follow(p.x, p.y, true);
    toast(best.name + ' で目をさました');
  },

  /* ============================ レベル ============================ */
  addExp(n) {
    const G = this.G, p = G.p;
    p.exp += n;
    FX.text(p.x, p.y - 44, '+' + n + ' EXP', '#c8ffb4');
    while (p.lv < LEVEL_MAX && p.exp >= expToNext(p.lv)) {
      p.exp -= expToNext(p.lv);
      p.lv++;
      const st = this.stats();
      p.hp = st.maxhp; p.mp = st.maxmp;
      FX.ring(p.x, p.y, '#ffe08a', 22, 140, 0.9);
      toast(`レベル ${p.lv} になった！`, 'holy');
      const got = SKILLS.find((s) => s.lv === p.lv);
      if (got) {
        toast(`${got.icon} ${got.name} をおぼえた`, 'good');
        UI.talk('', [`${got.name} をおぼえた。${got.desc}`]);
      }
      UI.refreshSkills(G);
    }
  },

  /* ============================ 話す・入る ============================ */
  act() {
    const G = this.G;
    if (G.nearNpc) return this.talkTo(G.nearNpc);
    toast('近くに話せる相手はいない');
  },

  talkTo(n) {
    const G = this.G;
    const seals = sealCount(G);
    if (n.shop) { UI.openShop(n.shop, n.name); return; }
    if (n.job === 'elder') {
      G.metElder = true;
      UI.talk('村長', ELDER_LINES[Math.min(seals, 3)]);
      this.refreshQuest();
      return;
    }
    if (n.job === 'sage') {
      UI.talk('物知り', [SAGE_LINES[Math.floor(Math.random() * SAGE_LINES.length)]]);
      return;
    }
    const lines = VILLAGE_LINES[Math.min(seals, 3)];
    UI.talk(n.name, [lines[Math.floor(Math.random() * lines.length)]]);
  },

  /* ============================ ボス ============================ */
  checkBosses() {
    const G = this.G, p = G.p;
    /* 土地の主 */
    for (const l of World.lairs) {
      const g = GUARDIANS[l.key];
      if (G.seals[g.seal]) continue;
      if (G.mobs.some((m) => m.guardian === l.key)) continue;
      const lx = l.tx * TILE + 16, ly = l.ty * TILE + 16;
      if (dist(lx, ly, p.x, p.y) < 190) {
        G.mobs.push(makeGuardian(l.key, lx, ly - 40));
        UI.talk(g.name, [g.line]);
        toast(`${g.name} があらわれた！`, 'bad');
      }
    }
    /* 魔王 */
    if (!G.demonDown && sealCount(G) >= 3 && !G.mobs.some((m) => m.demon)) {
      const cx = World.castle.tx * TILE + 16, cy = World.castle.ty * TILE + 16;
      if (dist(cx, cy, p.x, p.y) < 200) {
        G.mobs.push(makeDemon(cx, cy - 60));
        UI.talk(DEMON.name + '（' + DEMON.title + '）', DEMON.lines);
        toast('クロモコとの、さいごの戦い', 'bad');
      }
    }
  },

  refreshQuest() {
    const G = this.G;
    const s = sealCount(G);
    if (G.demonDown) G.quest = 'クロモコをたおした。この星は、もうあなたのものではない。';
    else if (s >= 3) G.quest = '印が三つそろった。北の黒い城へ。';
    else if (!G.metElder) G.quest = '村長に話しかけよう。';
    else {
      const left = [];
      if (!G.seals.seal_leaf) left.push('森の主');
      if (!G.seals.seal_sun) left.push('砂の王');
      if (!G.seals.seal_ice) left.push('氷の女王');
      G.quest = `印は ${s}/3。のこりは ${left.join('・')}。`;
    }
  },

  /* ============================ セーブ ============================ */
  save() {
    if (!this.G) return;
    const G = this.G;
    Save.write({
      ver: 2, seed: G.seed, name: G.name, tod: G.tod,
      p: {
        x: G.p.x, y: G.p.y, lv: G.p.lv, exp: G.p.exp, coin: G.p.coin,
        hp: G.p.hp, mp: G.p.mp, weapon: G.p.weapon, armor: G.p.armor, charm: G.p.charm,
        ownW: G.p.ownW, ownA: G.p.ownA, ownC: G.p.ownC, bag: G.p.bag, skill: G.p.skill,
      },
      seals: G.seals, kills: G.kills, bossDown: G.bossDown,
      demonDown: G.demonDown, metElder: G.metElder,
    });
  },
};

window.addEventListener('load', () => Game.boot());
