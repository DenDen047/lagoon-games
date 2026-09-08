/* =========================================================================
   SUNSET SHIFT ― 本体（見下ろし）
   1日の流れ  朝の支度 → 9:00 出社 → 18:00 退社 → 夜のパトロール → 就寝
   ========================================================================= */
'use strict';

const Game = {
  canvas: null, ctx: null, last: 0,
  night: null,
  started: false,
  drawList: [],

  init() {
    this.canvas = el('game');
    this.ctx = this.canvas.getContext('2d');
    UI.init();
    Input.init(this.canvas);
    Work.initInput(this.canvas);
    addEventListener('resize', () => this.resize());
    this.resize();

    G.items = {}; G.totalSolved = 0;
    Sky.init(1234); City.gen(1234);

    const save = Save.read();
    el('btnContinue').disabled = !save;
    let armed = false;
    el('btnNew').addEventListener('click', () => {
      Sfx.unlock();
      if (save && !armed) { armed = true; el('newWarn').classList.add('on'); return; }
      this.newGame();
    });
    el('btnContinue').addEventListener('click', () => { Sfx.unlock(); this.loadGame(); });
    el('btnHelp').addEventListener('click', () => { Sfx.unlock(); el('titleHelp').classList.toggle('on'); });

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    G.W = Math.floor(innerWidth); G.H = Math.floor(innerHeight); G.dpr = dpr;
    G.Z = clamp(G.W / 1080, 0.7, 1.45);
    G.VW = G.W / G.Z; G.VH = G.H / G.Z;
    this.canvas.width = Math.floor(G.W * dpr);
    this.canvas.height = Math.floor(G.H * dpr);
    this.canvas.style.width = G.W + 'px';
    this.canvas.style.height = G.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  /* ---------------------------- はじめる ---------------------------- */
  newGame() {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    G.seed = seed;
    const rng = new RNG(seed);
    Sky.init(seed); City.gen(seed);
    const bio = rollBio(rng);
    G.heroes = [new Hero(GRAVITON), new Hero(BLUEPRINT), new Hero(bio)];
    G.hero = G.heroes[0];
    G.day = 1; G.hour = 7; G.peace = 70; G.rating = 50; G.money = 24000;
    G.items = {}; G.totalSolved = 0;
    this.placeHero();
    this.started = true;
    el('titleScreen').classList.add('hidden');
    el('hud').classList.remove('hidden');
    UI.showBioReport(bio, 'new');
  },

  placeHero() {
    const home = City.spots[0];
    for (const h of G.heroes) h.reset(home.x, home.y - 46);
    G.cam.x = clamp(home.x - G.VW / 2, 0, City.W - G.VW);
    G.cam.y = clamp(home.y - G.VH / 2, 0, City.H - G.VH);
  },

  afterBioReport() { this.save(); UI.showMorning(); },

  loadGame() {
    const s = Save.read();
    if (!s) return;
    G.seed = s.seed;
    Sky.init(s.seed); City.gen(s.seed);
    G.heroes = [new Hero(GRAVITON), new Hero(BLUEPRINT), new Hero(s.bio)];
    const tech = G.heroes[1];
    tech.owned = s.tech.owned; tech.modules = s.tech.modules; tech.data = s.tech.data;
    for (let i = 0; i < 3; i++) G.heroes[i].solved = (s.solved && s.solved[i]) || 0;
    G.hero = G.heroes.find((h) => h.def.id === s.heroId) || G.heroes[0];
    G.day = s.day; G.hour = 7; G.peace = s.peace; G.rating = s.rating; G.money = s.money;
    G.items = s.items || {}; G.totalSolved = s.totalSolved || 0;
    this.placeHero();
    this.started = true;
    el('titleScreen').classList.add('hidden');
    el('hud').classList.remove('hidden');
    UI.showMorning();
  },

  save() {
    if (!this.started) return;
    const tech = G.heroes[1];
    Save.write({
      v: 2, seed: G.seed, day: G.day, peace: G.peace, rating: G.rating, money: G.money,
      items: G.items, totalSolved: G.totalSolved, heroId: G.hero.def.id,
      bio: G.heroes[2].def,
      tech: { owned: tech.owned, modules: tech.modules, data: tech.data },
      solved: G.heroes.map((h) => h.solved),
    });
  },

  toTitle() {
    this.started = false;
    G.mode = 'title';
    el('titleScreen').classList.remove('hidden');
    el('hud').classList.add('hidden');
    el('btnContinue').disabled = !Save.read();
    UI.mission(null);
  },

  /* ------------------------------ 会社 ------------------------------ */
  startWork() {
    UI.close();
    G.mode = 'work';
    document.body.classList.add('working');
    UI.prompt(null); UI.mission(null);
    FX.clear();
    for (const h of G.heroes) { h.hp = h.maxHp; h.gauge = h.maxGauge; }
    Work.start(G.hero, G.day);
  },

  skipWork() {
    UI.close();
    G.rating = Math.max(0, G.rating - 14);
    toast('無断で休んだ。社内評価がさがった', 'bad');
    G.hour = 18;
    for (const h of G.heroes) { h.hp = h.maxHp; h.gauge = h.maxGauge; }
    if (!this.checkOver()) this.startPatrol();
  },

  finishWork() {
    const r = Work.result;
    G.money += r.pay;
    G.rating = clamp(G.rating + r.dRating, 0, 100);
    this.save();
    if (this.checkOver()) return;
    UI.showWorkResult(r);
  },

  /* ---------------------------- 夜のパトロール ---------------------------- */
  startPatrol() {
    G.mode = 'patrol';
    document.body.classList.remove('working');
    G.hour = 18.15;
    Battle.reset(); Traffic.reset(); FX.clear();
    const h = G.hero;
    const home = City.spots[0];
    h.reset(home.x, home.y - 46);
    h.gauge = (G.items.energy || 0) > 0 ? h.maxGauge : h.maxGauge * 0.6;
    if ((G.items.energy || 0) > 0) { G.items.energy--; toast('エナジーバーを食べた', 'good'); }
    G.cam.x = clamp(h.x - G.VW / 2, 0, City.W - G.VW);
    G.cam.y = clamp(h.y - G.VH / 2, 0, City.H - G.VH);
    for (let i = 0; i < 10; i++) Traffic.spawn(G.cam, G.VW, G.VH);

    const boss = G.day >= 7;
    const n = boss ? 1 : Math.min(4, 2 + Math.floor(G.day / 2));
    const list = [];
    const rng = new RNG((G.seed ^ (G.day * 7919)) >>> 0);
    for (let i = 0; i < n; i++) {
      const inc = rng.pick(INCIDENTS.filter((x) => (G.day >= 3 || x.id !== 'heavy')));
      let x = 0, y = 0, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        x = rng.f(220, City.W - 220); y = rng.f(220, City.H - 220);
        ok = !City.blocked(x, y, 0, 40) && dist(x, y, h.x, h.y) > 700;
        for (const p of list) if (dist(x, y, p.x, p.y) < 800) ok = false;
      }
      list.push({ def: inc, x, y, state: 'wait', wave: 0, timer: inc.time, revealed: (G.items.info || 0) > 0 || i === 0 });
    }
    if ((G.items.info || 0) > 0) { G.items.info--; toast('情報屋が今夜の場所を教えてくれた', 'good'); }
    this.night = { list, solved: 0, failed: 0, kills: 0, pay: 0, dPeace: 0, boss, bossSpawned: false, bossDone: false, active: null };
    Battle.onKillCb = () => { this.night.kills++; };
    UI.mission('街を回る。事件の場所へ向かおう', null, '🌆');
  },

  spawnBoss() {
    const n = this.night;
    n.bossSpawned = true;
    const h = G.hero;
    const a = rand(TAU);
    const x = clamp(h.x + Math.cos(a) * 420, 120, City.W - 120);
    const y = clamp(h.y + Math.sin(a) * 420, 120, City.H - 120);
    const e = new Enemy('heavy', x, y, { hp: BOSS.hp, boss: true, name: BOSS.name });
    e.r = 30; e.h = 76; e.big = true;
    e.d = Object.assign({}, ENEMIES.heavy, { atk: 22, reach: 96, spd: 68, drop: 60000, col: '#4a5064', acc: '#ff5f6d' });
    Battle.enemies.push(e);
    Traffic.halt(true);
    toast(BOSS.full + ' が現れた', 'bad');
    UI.mission(BOSS.name + ' を止める', null, '⚙️');
    shakeCam(20); Sfx.bad();
  },

  /* ------------------------------ 更新 ------------------------------ */
  update(dt) {
    if (G.mode === 'work') {
      Work.update(dt);
      if (Work.done) { Work.done = false; this.finishWork(); }
      return;
    }
    if (G.mode !== 'patrol') return;

    const h = G.hero;
    const n = this.night;
    const fighting = Battle.alive() > 0;
    if (Battle.hitStop > 0) { Battle.hitStop -= dt; dt *= 0.15; }

    G.hour += dt * (fighting ? 0.014 : 0.036);
    h.update(dt, !G.paused);
    Battle.update(dt, h);
    Traffic.update(dt, G.cam, G.VW, G.VH);
    FX.update(dt);

    if (n.active) {
      const inc = n.active;
      inc.timer -= dt;
      const left = Battle.alive();
      const rescueLeft = Battle.civilians.filter((c) => !c.safe).length;
      if (left === 0 && inc.wave + 1 < inc.def.waves.length) {
        inc.wave++;
        Battle.spawnWave(inc.def.waves[inc.wave], h.x, h.y);
        toast('まだ来る', 'bad');
      } else if (left === 0 && rescueLeft === 0) {
        this.clearIncident(inc);
      } else if (inc.timer <= 0) {
        this.failIncident(inc);
      } else {
        UI.mission(inc.def.desc + (rescueLeft ? `（あと${rescueLeft}人）` : left ? `（残り${left}）` : ''), inc.timer, inc.def.icon);
      }
    } else if (n.boss && !n.bossSpawned && n.solved + n.failed >= n.list.length) {
      this.spawnBoss();
    } else if (n.bossSpawned && !n.bossDone) {
      if (Battle.alive() === 0) {
        n.bossDone = true;
        Traffic.halt(false);
        G.peace = Math.min(100, G.peace + 30);
        G.money += 60000;
        this.save();
        UI.showClear();
        return;
      }
    } else {
      for (const inc of n.list) {
        if (inc.state !== 'wait') continue;
        if (dist(h.x, h.y, inc.x, inc.y) < 190) { this.beginIncident(inc); break; }
      }
      if (!n.active) {
        const next = n.list.filter((i) => i.state === 'wait').sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
        if (next) UI.mission(`${next.def.name} が起きている`, null, next.def.icon);
        else if (!n.boss) UI.mission('今夜はもう静かだ。家へ帰ろう', null, '🌙');
      }
    }

    if (h.deadT > 1.2) {
      h.deadT = 0;
      h.hp = h.maxHp * 0.4;
      G.peace = Math.max(0, G.peace - 12);
      if (n.active) this.failIncident(n.active);
      toast('倒れた。いったん退いた', 'bad');
      const home = City.spots[0];
      h.reset(home.x, home.y - 46);
    }

    this.interact();
    if (G.hour >= 24) this.endNight();

    const cam = G.cam;
    cam.x = lerp(cam.x, clamp(h.x + h.vx * 0.22 - G.VW / 2, 0, Math.max(0, City.W - G.VW)), clamp(dt * 5, 0, 1));
    cam.y = lerp(cam.y, clamp(h.y + h.vy * 0.22 - h.z * 0.85 - G.VH / 2, -h.z * 0.85, Math.max(0, City.H - G.VH)), clamp(dt * 5, 0, 1));
    cam.shake *= Math.pow(0.0016, dt);
  },

  interact() {
    const h = G.hero;
    if (G.paused) { UI.prompt(null); return; }
    let msg = null, act = null;

    if (h.held) {
      msg = '投げる';
      act = () => {
        const c = h.held;
        h.held = null;
        c.state = 'thrown';
        const f = h.face;
        c.vx = Math.cos(f) * 900; c.vy = Math.sin(f) * 900;
        c.vz = 220; c.z = 40; c.spin = rand(-4, 4);
        Sfx.car(); shakeCam(8);
      };
    } else {
      const civ = Battle.civilians.find((c) => !c.safe && !c.carried && dist(c.x, c.y, h.x, h.y) < 52);
      const carried = Battle.civilians.find((c) => c.carried);
      const act2 = this.night && this.night.active;
      if (carried && act2 && dist(h.x, h.y, act2.safeX, act2.safeY) < 80) {
        msg = 'ここで下ろす';
        act = () => {
          carried.carried = false; carried.safe = true;
          carried.x = act2.safeX + rand(-24, 24); carried.y = act2.safeY + rand(-24, 24);
          FX.text(carried.x, carried.y - 34, 'たすかった', '#7ee39b', 16);
          Sfx.good();
        };
      } else if (civ && !carried) {
        msg = 'かかえる';
        act = () => { civ.carried = true; Sfx.ui(); };
      } else {
        const spot = City.spots.find((s) => dist(s.x, s.y, h.x, h.y) < 70);
        if (spot && !(this.night && this.night.active)) { msg = spot.name; act = () => UI.showSpot(spot); }
        else if (h.def.id === 'grav' && h.onGround) {
          const car = Traffic.grabbable(h.x + Math.cos(h.face) * 40, h.y + Math.sin(h.face) * 40, 110);
          if (car) { msg = '車をつかむ'; act = () => { h.held = car; car.state = 'held'; Sfx.power(); }; }
        }
      }
    }
    UI.prompt(msg);
    if (msg && Input.consume('interact')) act();
    if (Input.consume('pause')) UI.showPause();
  },

  beginIncident(inc) {
    inc.state = 'run';
    inc.timer = inc.def.time;
    const a = rand(TAU);
    inc.safeX = clamp(inc.x + Math.cos(a) * 260, 60, City.W - 60);
    inc.safeY = clamp(inc.y + Math.sin(a) * 260, 60, City.H - 60);
    this.night.active = inc;
    Battle.spawnWave(inc.def.waves[0], G.hero.x, G.hero.y);
    Traffic.halt(true);
    if (inc.def.rescue) {
      for (let i = 0; i < 2; i++) {
        Battle.civilians.push({ x: inc.x + rand(-50, 50), y: inc.y + rand(-50, 50), z: 0, t: 0, carried: false, safe: false, col: pick(['#c8543c', '#3c6bc8', '#4c8f5c', '#8f6bc8']) });
      }
      const c = Traffic.spawn(G.cam, G.VW, G.VH, 'sedan');
      c.x = inc.x; c.y = inc.y; c.sp = 0; c.state = 'wreck'; c.wreckT = 0;
    }
    toast(inc.def.name + '！', 'bad');
    Sfx.bad();
    UI.mission(inc.def.desc, inc.timer, inc.def.icon);
  },

  clearIncident(inc) {
    inc.state = 'done';
    this.night.active = null;
    this.night.solved++;
    G.totalSolved++;
    const h = G.hero;
    h.solved++;
    const pay = inc.def.pay;
    G.money += pay;
    G.peace = Math.min(100, G.peace + inc.def.peace);
    this.night.pay += pay;
    this.night.dPeace += inc.def.peace;
    Traffic.halt(false);
    Battle.civilians.length = 0;
    toast(`${inc.def.name} を解決。謝礼 ${yen(pay)}円`, 'good');
    Sfx.good();
    UI.mission(null);

    if (h.def.id === 'tech') {
      const got = 1 + (h.has('analyzer') ? 1 : 0);
      h.data += got;
      toast(`解析データを ${got} 個ひろった`, 'good');
    } else if (h.def.id === 'bio' && h.solved % 2 === 0) {
      const rng = new RNG((G.seed ^ (h.solved * 104729) ^ G.day) >>> 0);
      const m = mutateBio(h.def, rng);
      h.maxHp = h.def.base.hp;
      h.hp = Math.min(h.maxHp, h.hp + 20);
      h.maxGauge = h.def.gauge.max;
      Sfx.power();
      UI.showMutation(m, h.def);
    } else if (h.def.id === 'grav' && h.solved % 2 === 0) {
      h.def.base.hp += 8;
      h.maxHp = h.def.base.hp;
      h.hp = Math.min(h.maxHp, h.hp + 24);
      toast('重核の扱いに慣れてきた（体力+8）', 'good');
    }
    this.save();
  },

  failIncident(inc) {
    inc.state = 'done';
    this.night.active = null;
    this.night.failed++;
    const lost = inc.def.peace * 0.8;
    G.peace = Math.max(0, G.peace - lost);
    this.night.dPeace -= lost;
    for (const e of Battle.enemies) e.dead = true;
    Battle.civilians.length = 0;
    Traffic.halt(false);
    toast(inc.def.name + ' を止められなかった', 'bad');
    UI.mission(null);
  },

  endNight() {
    const n = this.night;
    for (const inc of n.list) {
      if (inc.state === 'wait') { n.failed++; n.dPeace -= inc.def.peace * 0.6; G.peace = Math.max(0, G.peace - inc.def.peace * 0.6); }
    }
    n.list.forEach((i) => (i.state = 'done'));
    n.active = null;
    Battle.reset();
    Traffic.halt(false);
    UI.mission(null);
    G.mode = 'night';

    let rent = 0, note = '';
    if (G.day % 7 === 0) {
      rent = COMPANY.rent;
      G.money -= rent;
      if (G.money < 0) { G.rating = Math.max(0, G.rating - 10); note = '家賃が足りず、会社の前借りに頼った。評価がさがった。'; }
    }
    if (G.day === 6) note = note || '親会社が「実証地区」の資料を配っていた。明日の夜、何かが来る。';
    this.save();
    UI.showNight({ solved: n.solved, failed: n.failed, kills: n.kills, pay: n.pay, dPeace: n.dPeace, rent, note });
  },

  nextDay() {
    if (this.checkOver()) return;
    G.day++;
    G.hour = 7;
    for (const h of G.heroes) { h.hp = h.maxHp; h.gauge = h.maxGauge; }
    G.mode = 'hub';
    this.save();
    UI.showMorning();
  },

  checkOver() {
    if (G.rating <= 0) {
      G.mode = 'over'; Save.clear();
      UI.showOver('解雇', '第三営業部から名前が消えた。街を守っても、席がなければ次の夜に出る体力もない。');
      return true;
    }
    if (G.peace <= 0) {
      G.mode = 'over'; Save.clear();
      UI.showOver('実証地区', '治安の数字が底を打ち、この区画は取り壊しの対象になった。三人の勤め先も、その中にあった。');
      return true;
    }
    return false;
  },

  /* ------------------------------ 描画 ------------------------------ */
  draw() {
    const ctx = this.ctx;
    if (G.mode === 'work') { Work.draw(ctx, G.W, G.H); return; }
    if (!this.started) { ctx.clearRect(0, 0, G.W, G.H); return; }

    const VW = G.VW, VH = G.VH;
    const L = Sky.light(G.hour);
    const cam = {
      x: G.cam.x + rand(-G.cam.shake, G.cam.shake),
      y: G.cam.y + rand(-G.cam.shake, G.cam.shake),
    };
    const h = G.hero;

    ctx.save();
    ctx.scale(G.Z, G.Z);
    City.drawGround(ctx, cam, L, VW, VH);

    /* 影を一枚にまとめてから、一度だけ重ねる。 */
    const sctx = ShadowLayer.begin(G.W, G.H, G.dpr, L, G.Z);
    Sky.cloudShadows(sctx, cam, L, VW, VH);
    City.shadows(sctx, cam, L, VW, VH);
    Traffic.shadows(sctx, cam, L, VW, VH);
    Battle.shadows(sctx, cam, L, VW, VH);
    if (h) h.shadow(sctx, cam, L);
    ShadowLayer.flush(ctx, VW, VH, L);

    Battle.drawGroundFx(ctx, cam, L);
    this.groundMarks(ctx, cam, L);

    /* 手前のものほど後に描く。 */
    /* 主人公を覆っている建物は透かす。 */
    if (!this._occl) this._occl = new Set();
    const occl = this._occl;
    if (h) City.occluders(h.x, h.y, h.z, occl); else occl.clear();

    const list = this.drawList;
    list.length = 0;
    City.collect(list, cam, VW, VH);
    Traffic.collect(list, cam, VW, VH);
    Battle.collect(list, cam, VW, VH);
    if (h) list.push({ key: h.z > 6 ? 1e6 + h.y + 1 : h.y + 0.1, o: h, kind: 'hero' });
    list.sort((a, b) => a.key - b.key);
    for (const it of list) {
      if (it.kind === 'building') {
        const see = occl.has(it.o);
        if (see) ctx.globalAlpha = 0.4;
        City.drawBuilding(ctx, cam, L, it.o);
        if (see) ctx.globalAlpha = 1;
      }
      else if (it.kind === 'prop') City.drawProp(ctx, cam, L, it.o);
      else if (it.kind === 'spot') City.drawSpot(ctx, cam, L, it.o);
      else if (it.kind === 'car') Traffic.drawCar(ctx, cam, L, it.o);
      else if (it.kind === 'enemy') it.o.draw(ctx, cam, L);
      else if (it.kind === 'civil') Battle.drawCivilian(ctx, cam, L, it.o);
      else if (it.kind === 'hero') {
        it.o.draw(ctx, cam, L);
        if (it.o.held) Traffic.drawHeld(ctx, cam, L, it.o.held, it.o.x + Math.cos(it.o.face) * 26, it.o.y + Math.sin(it.o.face) * 26, it.o.z + 46, it.o.face + Math.sin(performance.now() * 0.003) * 0.08);
      }
    }

    Battle.drawShots(ctx, cam);
    FX.draw(ctx, cam);

    Sky.ambientPass(ctx, VW, VH, L);
    City.drawLights(ctx, cam, L, VW, VH);
    Traffic.drawLights(ctx, cam, L, VW, VH);
    this.markers(ctx, cam, VW, VH);
    Sky.grade(ctx, VW, VH, L);
    ctx.restore();

    this.minimap(ctx);
  },

  /* 地面に置く目印。 */
  groundMarks(ctx, cam, L) {
    const n = this.night;
    if (!n) return;
    const t = performance.now() * 0.003;
    for (const inc of n.list) {
      if (inc.state === 'done') continue;
      if (!inc.revealed && inc.state !== 'run') continue;
      const x = inc.x - cam.x, y = inc.y - cam.y;
      const on = inc.state === 'run';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 120 + Math.sin(t) * 10;
      const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
      g.addColorStop(0, rgba(on ? '#ff5f6d' : '#ffb454', 0));
      g.addColorStop(0.8, rgba(on ? '#ff5f6d' : '#ffb454', 0.22));
      g.addColorStop(1, rgba(on ? '#ff5f6d' : '#ffb454', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (n.active && n.active.def.rescue) {
      const x = n.active.safeX - cam.x, y = n.active.safeY - cam.y;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 1.6);
      ctx.strokeStyle = '#7ee39b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#7ee39b';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('救護所', x, y - 54);
      ctx.restore();
    }
  },

  /* 画面の外の事件を指す矢印。 */
  markers(ctx, cam, VW, VH) {
    const n = this.night;
    if (!n) return;
    ctx.save();
    ctx.textAlign = 'center';
    for (const inc of n.list) {
      if (inc.state === 'done') continue;
      const on = inc.state === 'run';
      if (!inc.revealed && !on) continue;
      const sx = inc.x - cam.x, sy = inc.y - cam.y;
      if (sx > 30 && sx < VW - 30 && sy > 30 && sy < VH - 30) {
        ctx.globalAlpha = 0.95;
        ctx.font = `800 24px ${FONT}`;
        ctx.fillText(inc.def.icon, sx, sy - 34 + Math.sin(performance.now() * 0.004) * 5);
        continue;
      }
      const cx = VW / 2, cy = VH / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const rx = VW / 2 - 46, ry = VH / 2 - 46;
      const px = cx + Math.cos(a) * Math.min(rx, ry / Math.abs(Math.sin(a) || 0.0001));
      const py = cy + Math.sin(a) * Math.min(ry, rx / Math.abs(Math.cos(a) || 0.0001));
      ctx.save();
      ctx.translate(clamp(px, 30, VW - 30), clamp(py, 30, VH - 30));
      ctx.rotate(a);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = on ? '#ff5f6d' : '#ffb454';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#eef2ff';
      ctx.font = `700 12px ${FONT}`;
      ctx.fillText(Math.round(dist(inc.x, inc.y, cam.x + VW / 2, cam.y + VH / 2) / 10) + 'm',
        clamp(px, 30, VW - 30), clamp(py, 30, VH - 30) + 26);
    }
    ctx.restore();
  },

  /* 右下のミニマップ。 */
  minimap(ctx) {
    if (G.mode !== 'patrol') return;
    const size = Math.min(168, G.W * 0.22);
    const pad = 12;
    const x0 = G.W - size - pad, y0 = G.H - size - pad - (Input.isTouch ? 210 : 0);
    const k = size / Math.max(City.W, City.H);
    ctx.save();
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = 'rgba(8,11,20,0.8)';
    ctx.beginPath(); ctx.roundRect(x0, y0, size, size, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x0, y0, size, size, 10); ctx.clip();
    /* 道路。 */
    ctx.fillStyle = 'rgba(70,80,100,0.5)';
    ctx.fillRect(x0, y0, City.W * k, City.H * k);
    ctx.strokeStyle = 'rgba(190,205,235,0.5)';
    ctx.lineWidth = Math.max(1.5, ROADW * k * 0.7);
    for (let i = 0; i <= COLS; i++) {
      const x = x0 + City.roadX(i) * k;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + City.H * k); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      const y = y0 + City.roadY(j) * k;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + City.W * k, y); ctx.stroke();
    }
    /* 目印と事件。 */
    for (const s of City.spots) {
      ctx.fillStyle = 'rgba(216,240,255,0.8)';
      ctx.beginPath(); ctx.arc(x0 + s.x * k, y0 + s.y * k, 2.6, 0, TAU); ctx.fill();
    }
    if (this.night) {
      for (const inc of this.night.list) {
        if (inc.state === 'done' || (!inc.revealed && inc.state !== 'run')) continue;
        ctx.fillStyle = inc.state === 'run' ? '#ff5f6d' : '#ffb454';
        ctx.beginPath(); ctx.arc(x0 + inc.x * k, y0 + inc.y * k, 4 + Math.sin(performance.now() * 0.005) * 1.2, 0, TAU); ctx.fill();
      }
    }
    for (const e of Battle.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = 'rgba(255,120,110,0.9)';
      ctx.beginPath(); ctx.arc(x0 + e.x * k, y0 + e.y * k, 2, 0, TAU); ctx.fill();
    }
    const h = G.hero;
    if (h) {
      ctx.fillStyle = '#6fd3ff';
      ctx.beginPath(); ctx.arc(x0 + h.x * k, y0 + h.y * k, 3.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(111,211,255,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x0 + h.x * k, y0 + h.y * k);
      ctx.lineTo(x0 + h.x * k + Math.cos(h.face) * 9, y0 + h.y * k + Math.sin(h.face) * 9);
      ctx.stroke();
    }
    /* 画面の範囲。 */
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(x0 + G.cam.x * k, y0 + G.cam.y * k, Math.min(G.VW, City.W) * k, Math.min(G.VH, City.H) * k);
    ctx.restore();
    ctx.restore();
  },

  /* ------------------------------ ループ ------------------------------ */
  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    if (!G.paused) this.update(dt);
    if (this.started) { this.draw(); UI.hud(); }
    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },
};

addEventListener('DOMContentLoaded', () => Game.init());
