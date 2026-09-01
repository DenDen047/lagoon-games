/* =========================================================================
   MOKO GOD ― ゲーム本体
   タイトル / えほん / 雲の上 / 地上 / 城 / セーブ
   ========================================================================= */
'use strict';

const YEAR_SEC = 26;      /* 1年がすぎる長さ（ふつうの速さで、秒） */
const GOD_SPEED_SKY = 250;
const GOD_SPEED_GROUND = 190;
const GOD_SPEED_CASTLE = 260;

const Game = {
  G: null,
  canvas: null,
  playing: false,
  last: 0,
  autoT: 0,
  agentT: 0,
  hudT: 0,

  /* ============================== はじめ ============================== */
  boot() {
    this.canvas = document.getElementById('game');
    World.generate(1);
    R.init(this.canvas);
    Input.init(this.canvas);
    SKY.build();
    Book.init();
    UI.init();
    this.bindTitle();
    requestAnimationFrame((t) => this.loop(t));
  },

  bindTitle() {
    const hasSave = Save.has();
    const cont = document.getElementById('btnContinue');
    cont.disabled = !hasSave;
    if (!hasSave) cont.classList.add('ghost');

    document.getElementById('btnNew').addEventListener('click', () => {
      if (Save.has() && !this.newArmed) {
        this.newArmed = true;
        document.getElementById('newWarn').classList.add('on');
        return;
      }
      document.getElementById('titleScreen').classList.add('hidden');
      document.getElementById('nameScreen').classList.remove('hidden');
      const inp = document.getElementById('planetInput');
      inp.value = PLANET_NAMES[Math.floor(Math.random() * PLANET_NAMES.length)];
      document.getElementById('godInput').value = GOD_DEFAULT;
    });
    cont.addEventListener('click', () => this.continueGame());
    document.getElementById('btnHelp').addEventListener('click', () => {
      document.getElementById('titleHelp').classList.toggle('on');
    });
    document.getElementById('btnRandName').addEventListener('click', () => {
      document.getElementById('planetInput').value = PLANET_NAMES[Math.floor(Math.random() * PLANET_NAMES.length)];
    });
    document.getElementById('btnNameBack').addEventListener('click', () => {
      document.getElementById('nameScreen').classList.add('hidden');
      document.getElementById('titleScreen').classList.remove('hidden');
    });
    document.getElementById('btnCreate').addEventListener('click', () => {
      const planet = (document.getElementById('planetInput').value.trim() || PLANET_NAMES[0]).slice(0, 14);
      const godName = (document.getElementById('godInput').value.trim() || GOD_DEFAULT).slice(0, 10);
      document.getElementById('nameScreen').classList.add('hidden');
      this.newGame(planet, godName);
    });
    document.getElementById('planetInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnCreate').click();
    });
    document.getElementById('btnEndClose').addEventListener('click', () => {
      document.getElementById('endScreen').classList.add('hidden');
    });
    document.getElementById('btnEndTitle').addEventListener('click', () => {
      document.getElementById('endScreen').classList.add('hidden');
      this.save(true); this.toTitle();
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

  /* ============================ 新しい星 ============================ */
  freshState(planet, godName, seed) {
    return {
      ver: 1, seed, planet, godName,
      year: 1, tod: 0.32, speed: 1, faith: 60, faithRate: 0,
      scene: 'sky',
      god: { x: SKY.spawn.x, y: SKY.spawn.y, gx: 0, gy: 0, cx: 0, cy: 300, face: 1, wob: 0, hurt: 0 },
      towns: [], herds: [], edits: [], chronicle: [],
      nextTownId: 1, nextHerdId: 1,
      demon: { alive: true, power: 6, hp: 120, maxHp: 120, bridge: false, sealed: 0, met: false },
      ui: { miracle: 'land', species: 'pyonta', cur: null },
      flags: {},
      landing: null,
      castle: { orbs: [], shots: [], dx: 0, dy: -120, hurt: 0, face: 1, cool: 0, shotCool: 0, burst: 0 },
      agents: [],
    };
  },

  newGame(planet, godName) {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    World.generate(seed);
    const G = this.freshState(planet, godName, seed);
    this.G = G;
    R.thumbDirty = true;

    /* いちばんはじめの街 */
    const rng = new RNG(seed ^ 0x5bf03635);
    const cradle = World.findCradle(rng);
    const t0 = World.makeTown(G, cradle.tx, cradle.ty, 'はじまりの里');
    G.ui.cur = { tx: t0.tx, ty: t0.ty };

    /* はじめのいきもの */
    World.spawnHerd(G, clamp(t0.tx + 5, 1, World.w - 2), clamp(t0.ty - 4, 1, World.h - 2), 'pyonta', 5);
    World.spawnHerd(G, clamp(t0.tx - 6, 1, World.w - 2), clamp(t0.ty + 5, 1, World.h - 2), 'pyonta', 4);

    this.log(`${planet} という星が生まれた。`);
    this.log(`海に丘がもりあがり、${t0.name} に さいしょのモコたちが目をさました。`);

    Book.start(() => this.begin(true));
  },

  continueGame() {
    const d = Save.read();
    if (!d) { toast('セーブがありません', 'bad'); return; }
    try { this.loadState(d); } catch (e) { toast('セーブを読めませんでした', 'bad'); return; }
    document.getElementById('titleScreen').classList.add('hidden');
    this.begin(false);
  },

  begin(showIntroTalk) {
    const G = this.G;
    document.getElementById('hud').classList.remove('hidden');
    this.playing = true;
    this.last = performance.now();
    R.thumbDirty = true;
    if (G.scene === 'ground') R.snap(G.god.gx, G.god.gy, { w: World.pxW(), h: World.pxH() });
    else R.snap(G.god.x, G.god.y);
    UI.refreshHUD(G);
    this.updateQuest();
    if (showIntroTalk) {
      UI.talk(G.godName, [
        { who: G.godName, text: 'ここは雲の上。下には、生まれたばかりの星がひろがっている。' },
        { who: '', text: '歩いて「天窓」へ行くと、地上のようすが見られる。「創世の祭壇」では奇跡をえらべる。' },
        { who: '', text: '「降りの門」から地上へ降りれば、モコたちのあいだを歩ける。' },
      ]);
    }
    this.save();
  },

  /* ============================== セーブ ============================== */
  save(loud) {
    const G = this.G;
    if (!G) return;
    const d = {
      ver: 1, seed: G.seed, planet: G.planet, godName: G.godName,
      year: G.year, tod: G.tod, faith: G.faith, speed: G.speed,
      scene: G.scene, god: G.god, landing: G.landing,
      towns: G.towns, herds: G.herds, edits: G.edits,
      chronicle: G.chronicle.slice(-200),
      nextTownId: G.nextTownId, nextHerdId: G.nextHerdId,
      demon: G.demon, ui: { miracle: G.ui.miracle, species: G.ui.species, cur: G.ui.cur },
      flags: G.flags,
    };
    const ok = Save.write(d);
    if (loud) toast(ok ? '記録した' : '記録できなかった', ok ? 'good' : 'bad');
  },

  loadState(d) {
    World.generate(d.seed);
    World.applyEdits(d.edits);
    const G = this.freshState(d.planet, d.godName, d.seed);
    Object.assign(G, {
      year: d.year, tod: d.tod, faith: d.faith, speed: d.speed ?? 1,
      scene: d.scene === 'castle' ? 'sky' : d.scene,
      god: d.god, landing: d.landing || null,
      towns: d.towns, herds: d.herds, edits: d.edits,
      chronicle: d.chronicle || [],
      nextTownId: d.nextTownId, nextHerdId: d.nextHerdId,
      demon: Object.assign({ met: false }, d.demon),
      flags: d.flags || {},
    });
    G.ui = Object.assign(G.ui, d.ui || {});
    for (const t of G.towns) if (!t.houses || !t.houses.length) World.rebuildHouses(t);
    this.G = G;
    R.thumbDirty = true;
  },

  log(text) {
    const G = this.G;
    G.chronicle.push({ y: G.year, t: text });
    if (G.chronicle.length > 400) G.chronicle.splice(0, 100);
  },

  setSpeed(s) { this.G.speed = s; UI.refreshHUD(this.G); },

  /* ============================== ループ ============================== */
  loop(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    R.t += dt;

    if (Book.running) {
      Book.update(dt);
      Input.endFrame();
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    if (this.playing) {
      this.update(dt);
      this.draw(dt);
      this.hudT += dt;
      if (this.hudT > 0.25) { this.hudT = 0; UI.refreshHUD(this.G); this.updateQuest(); }
      UI.drawMap();
    }
    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt) {
    const G = this.G;
    FX.update(dt);
    G.god.wob += dt * 6;

    const busy = UI.panelOpen || UI.talkOn;
    const timeRuns = G.speed > 0 && !busy && G.scene !== 'castle';
    if (timeRuns) {
      G.tod += (dt * G.speed) / YEAR_SEC;
      while (G.tod >= 1) {
        G.tod -= 1;
        World.yearTick(G, (t) => this.log(t));
        this.checkEnding();
        this.save();
      }
    }

    /* キーの受けつけ */
    if (!busy) {
      if (Input.hit('m')) UI.openMap();
      if (Input.hit('q')) UI.openMiracles();
      if (Input.hit('r')) UI.openChronicle();
      if (Input.hit('e')) this.act();
      for (let i = 1; i <= 9; i++) if (Input.hit(String(i)) && MIRACLES[i - 1]) UI.pickMiracle(MIRACLES[i - 1].id);
    }
    if (Input.hit('Escape')) { if (UI.panelOpen) UI.close(); else if (!UI.talkOn) UI.openMenu(); }
    if (UI.talkOn && (Input.hit(' ') || Input.hit('Enter') || Input.hit('e'))) UI.talkNext();

    if (busy) return;
    if (G.scene === 'sky') this.updateSky(dt);
    else if (G.scene === 'ground') this.updateGround(dt);
    else if (G.scene === 'castle') this.updateCastle(dt);

    this.autoT += dt;
    if (this.autoT > 30) { this.autoT = 0; this.save(); }
  },

  draw() {
    const G = this.G;
    if (G.scene === 'sky') R.drawSky(G);
    else if (G.scene === 'ground') R.drawGround(G);
    else R.drawCastle(G);
  },

  /* ============================== 雲の上 ============================== */
  updateSky(dt) {
    const G = this.G, g = G.god;
    const ax = Input.axis();
    const sp = GOD_SPEED_SKY * dt;
    if (ax.x || ax.y) {
      const nx = g.x + ax.x * sp, ny = g.y + ax.y * sp;
      if (SKY.onCloud(nx, g.y, G)) g.x = nx;
      if (SKY.onCloud(g.x, ny, G)) g.y = ny;
      if (ax.x) g.face = ax.x > 0 ? 1 : -1;
      if (Math.random() < 0.14) FX.rise(g.x, g.y + 10, 'rgba(255,255,255,.7)', 1, 0.8);
    }
    g.x = clamp(g.x, 40, SKY.W - 40); g.y = clamp(g.y, 40, SKY.H - 40);
    R.follow(g.x, g.y);

    const s = SKY.spotAt(g.x, g.y);
    UI.setPrompt(s ? `${s.name}：${s.hint}` : '');
  },

  /* ============================== 地上 ============================== */
  updateGround(dt) {
    const G = this.G, g = G.god;
    const ax = Input.axis();
    const sp = GOD_SPEED_GROUND * dt;
    if (ax.x || ax.y) {
      const nx = g.gx + ax.x * sp, ny = g.gy + ax.y * sp;
      if (World.walkableAtPx(nx, g.gy)) g.gx = nx;
      if (World.walkableAtPx(g.gx, ny)) g.gy = ny;
      if (ax.x) g.face = ax.x > 0 ? 1 : -1;
    }
    g.gx = clamp(g.gx, 8, World.pxW() - 8); g.gy = clamp(g.gy, 8, World.pxH() - 8);
    R.follow(g.gx, g.gy, { w: World.pxW(), h: World.pxH() });

    /* 画面をタップ／クリックしたら、そこに奇跡 */
    if (Input.mouse.clicked) {
      const wx = Input.mouse.x + R.cam.x, wy = Input.mouse.y + R.cam.y;
      this.castMiracle(Math.floor(wx / TILE), Math.floor(wy / TILE));
    }

    this.agentT += dt;
    if (this.agentT > 0.6) { this.agentT = 0; this.syncAgents(); }
    this.updateAgents(dt);

    /* 近くにあるもの */
    const near = this.nearestInteract();
    if (near) UI.setPrompt(near.prompt);
    else UI.setPrompt('');
  },

  pillars() {
    const G = this.G;
    const out = G.towns.map((t) => ({ x: t.tx * TILE + 16 + 62, y: t.ty * TILE + 16 - 34, town: t }));
    if (G.landing) out.push({ x: G.landing.x, y: G.landing.y, town: null });
    return out;
  },

  nearestInteract() {
    const G = this.G, g = G.god;
    for (const p of this.pillars()) {
      if (dist(g.gx, g.gy, p.x, p.y) < 62) {
        return { kind: 'pillar', prompt: '昇りの柱：雲の上へもどる' };
      }
    }
    let best = null, bd = 74;
    for (const a of G.agents) {
      if (a.kind !== 'moko') continue;
      const d = dist(g.gx, g.gy, a.x, a.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) return { kind: 'moko', agent: best, prompt: `${best.name} に話しかける` };
    return null;
  },

  /* --------------------------- 地上のモコたち --------------------------- */
  syncAgents() {
    const G = this.G, g = G.god, RANGE = 1200;
    G.agents = G.agents.filter((a) => dist(a.x, a.y, g.gx, g.gy) < RANGE * 1.5);

    for (const t of G.towns) {
      const cx = t.tx * TILE + 16, cy = t.ty * TILE + 16;
      if (dist(cx, cy, g.gx, g.gy) > RANGE) continue;
      const want = clamp(Math.round(t.pop / 4), 3, 12);
      const have = G.agents.filter((a) => a.kind === 'moko' && a.town === t.id).length;
      for (let i = have; i < want; i++) {
        const rng = new RNG((t.id * 977 + i * 31 + G.year) >>> 0);
        const a = rng.f(0, TAU), r = rng.f(20, 110);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (!World.walkableAtPx(x, y)) continue;
        const child = rng.chance(0.3);
        G.agents.push({
          kind: 'moko', town: t.id, x, y, hx: cx, hy: cy,
          tx: x, ty: y, face: 1, wob: rng.f(0, TAU), child,
          name: rng.pick(MOKO_NAMES) + (child ? 'ちゃん' : ''),
          c1: child ? '#ffd8e8' : '#ffc2dc', c2: child ? '#f0a8c8' : '#ff8ab4',
          spd: child ? 46 : 32, wait: rng.f(0, 2), sleep: false, said: false,
        });
      }
    }

    for (const h of G.herds) {
      const cx = h.tx * TILE + 16, cy = h.ty * TILE + 16;
      if (dist(cx, cy, g.gx, g.gy) > RANGE) continue;
      const want = clamp(h.n, 1, 6);
      const have = G.agents.filter((a) => a.kind === 'beast' && a.hid === h.id).length;
      for (let i = have; i < want; i++) {
        const rng = new RNG((h.id * 613 + i * 47) >>> 0);
        const a = rng.f(0, TAU), r = rng.f(10, 70);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        G.agents.push({
          kind: 'beast', hid: h.id, sp: h.sp, x, y, hx: cx, hy: cy,
          tx: x, ty: y, face: 1, wob: rng.f(0, TAU), spd: 34, wait: rng.f(0, 2),
        });
      }
    }
  },

  updateAgents(dt) {
    const G = this.G;
    const night = !(G.tod > 0.25 && G.tod < 0.78);
    for (const a of G.agents) {
      a.wob += dt * (a.kind === 'moko' ? 5 : 6);
      if (a.kind === 'moko') {
        const t = G.towns.find((x) => x.id === a.town);
        a.sleep = night && t && t.era < 1 ? true : (night && Math.random() < 0.0006 ? true : a.sleep);
        if (night) { a.hx = t ? t.tx * TILE + 16 : a.hx; a.hy = t ? t.ty * TILE + 16 : a.hy; }
        if (a.sleep && night) continue;
        if (!night) a.sleep = false;
      }
      a.wait -= dt;
      if (a.wait <= 0) {
        a.wait = 1 + Math.random() * 2.5;
        const r = a.kind === 'moko' ? (night ? 40 : 110) : 80;
        const ang = Math.random() * TAU, d = Math.random() * r;
        const nx = a.hx + Math.cos(ang) * d, ny = a.hy + Math.sin(ang) * d;
        if (World.walkableAtPx(nx, ny)) { a.tx = nx; a.ty = ny; }
      }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 3) {
        const step = Math.min(a.spd * dt, d);
        const nx = a.x + (dx / d) * step, ny = a.y + (dy / d) * step;
        if (World.walkableAtPx(nx, ny)) { a.x = nx; a.y = ny; a.face = dx > 0 ? 1 : -1; }
        else a.wait = 0;
      }
    }
  },

  /* =============================== 行動 =============================== */
  act() {
    const G = this.G;
    if (UI.talkOn) { UI.talkNext(); return; }
    if (UI.panelOpen) return;
    if (G.scene === 'sky') {
      const s = SKY.spotAt(G.god.x, G.god.y);
      if (!s) return;
      this.useSpot(s);
    } else if (G.scene === 'ground') {
      const near = this.nearestInteract();
      if (!near) return;
      if (near.kind === 'pillar') this.ascend();
      else this.talkTo(near.agent);
    }
  },

  useSpot(s) {
    const G = this.G;
    switch (s.id) {
      case 'shrine':
        this.save(true);
        FX.ring(G.god.x, G.god.y, 'rgba(255,236,170,.9)', 18, 120, 0.8);
        UI.talk('', [{ who: 'はじまりの社', text: `ここまでの${G.year}年が、社の石に刻まれた。（記録した）` }]);
        break;
      case 'window': UI.openMap(); break;
      case 'altar': UI.openMiracles(); break;
      case 'tower': UI.openChronicle(); break;
      case 'gate': {
        const target = G.landing
          ? { tx: Math.floor(G.landing.x / TILE), ty: Math.floor(G.landing.y / TILE) }
          : (G.towns[0] ? { tx: G.towns[0].tx, ty: G.towns[0].ty + 3 } : { tx: World.w >> 1, ty: World.h >> 1 });
        const p = World.findWalkableNear(target.tx, target.ty);
        this.descend(p.tx, p.ty);
        break;
      }
      case 'castle': this.enterCastle(); break;
    }
  },

  talkTo(a) {
    const G = this.G;
    const t = G.towns.find((x) => x.id === a.town);
    const era = t ? t.era : 0;
    const line = a.child ? CHILD_LINES[Math.floor(Math.random() * CHILD_LINES.length)]
      : MOKO_LINES[era][Math.floor(Math.random() * MOKO_LINES[era].length)];
    UI.talk(a.name, [{ who: a.name, text: line }]);
    FX.rise(a.x, a.y - 10, 'rgba(255,224,138,.9)', 4, 1);
    G.faith += 2;
    if (t) t.happy = clamp(t.happy + 1.5, 0, 100);
    if (!G.flags.metMoko) {
      G.flags.metMoko = true;
      this.log('神さまが地上におりて、はじめてモコと言葉をかわした。');
    }
  },

  /* --------------------------- 行き来 --------------------------- */
  descend(tx, ty) {
    const G = this.G;
    G.scene = 'ground';
    G.god.gx = tx * TILE + 16; G.god.gy = ty * TILE + 16;
    G.landing = { x: G.god.gx + 62, y: G.god.gy - 34 };
    G.agents = [];
    FX.clear();
    R.snap(G.god.gx, G.god.gy, { w: World.pxW(), h: World.pxH() });
    FX.ring(G.god.gx, G.god.gy, 'rgba(255,236,170,.9)', 20, 160, 0.9);
    this.syncAgents();
    UI.refreshHUD(G);
    toast('地上へ降りた', 'holy');
    this.save();
  },

  ascend() {
    const G = this.G;
    G.scene = 'sky';
    const gate = SKY.spots.find((s) => s.id === 'gate');
    G.god.x = gate.x; G.god.y = gate.y + 80;
    FX.clear();
    R.snap(G.god.x, G.god.y);
    FX.ring(G.god.x, G.god.y, 'rgba(255,236,170,.9)', 20, 160, 0.9);
    UI.refreshHUD(G);
    toast('雲の上へもどった', 'holy');
    this.save();
  },

  /* =============================== 奇跡 =============================== */
  miracleCost(G, m) {
    if (m.id === 'life') return SPECIES[G.ui.species].cost;
    return m.cost;
  },

  castMiracle(tx, ty) {
    const G = this.G;
    const m = MIRACLES.find((k) => k.id === G.ui.miracle);
    if (!m) return;
    const cost = this.miracleCost(G, m);
    if (G.faith < cost) { toast('信仰がたりない', 'bad'); return; }
    if (!World.inside(tx, ty)) return;

    let ok = false, terrain = false;
    const r = m.r;

    const eachInR = (fn) => {
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (Math.hypot(x - tx, y - ty) > r + 0.2) continue;
        fn(x, y);
      }
    };

    switch (m.id) {
      case 'land': {
        eachInR((x, y) => {
          const t = World.get(x, y);
          if (isWater(t)) {
            const edge = [World.get(x + 1, y), World.get(x - 1, y), World.get(x, y + 1), World.get(x, y - 1)].some(isWater);
            if (World.edit(G, x, y, edge ? T.SAND : T.PLAIN)) { ok = true; terrain = true; }
          }
        });
        if (!ok) toast('ここは海ではない', 'bad');
        break;
      }
      case 'sea': {
        const tw = G.towns.find((t) => Math.hypot(t.tx - tx, t.ty - ty) < r + 2);
        if (tw) { toast(`${tw.name} がある。沈められない`, 'bad'); return; }
        eachInR((x, y) => {
          const t = World.get(x, y);
          if (isLand(t)) { if (World.edit(G, x, y, T.SHALLOW)) { ok = true; terrain = true; } }
        });
        if (!ok) toast('ここは陸ではない', 'bad');
        break;
      }
      case 'forest': {
        eachInR((x, y) => {
          const t = World.get(x, y);
          if ([T.PLAIN, T.GRASS, T.FLOWER, T.HILL, T.MARSH, T.SAND].includes(t)) {
            if (World.edit(G, x, y, T.FOREST)) { ok = true; terrain = true; }
          }
        });
        if (!ok) toast('木の育つ土がない', 'bad');
        break;
      }
      case 'rain': case 'sun': {
        const hit = G.towns.filter((t) => Math.hypot(t.tx - tx, t.ty - ty) <= r + 3);
        if (!hit.length) { toast('とどく街がない', 'bad'); return; }
        for (const t of hit) {
          if (m.id === 'rain') { t.rain = 5; t.happy = clamp(t.happy + 4, 0, 100); }
          else { t.sun = 5; t.happy = clamp(t.happy + 14, 0, 100); }
        }
        /* 畑をひろげる（実りの時代から） */
        if (m.id === 'rain') {
          for (const t of hit) {
            if (t.era < 2) continue;
            for (let k = 0; k < 6; k++) {
              const a = Math.random() * TAU, rr = 2 + Math.random() * 4;
              const x = Math.round(t.tx + Math.cos(a) * rr), y = Math.round(t.ty + Math.sin(a) * rr);
              if ([T.PLAIN, T.GRASS, T.FLOWER].includes(World.get(x, y))) { World.edit(G, x, y, T.FIELD); terrain = true; }
            }
          }
        }
        this.log(`${hit.map((t) => t.name).join('・')} に ${m.name} をおくった。`);
        ok = true;
        break;
      }
      case 'life': {
        const sp = G.ui.species, def = SPECIES[sp];
        const p = def.biome.includes(World.get(tx, ty)) ? { tx, ty } : null;
        if (!p) { toast(`${def.name} は「${def.biome.map((b) => TILE_DEF[b].name).join('・')}」にすむ`, 'bad'); return; }
        World.spawnHerd(G, tx, ty, sp, 4);
        this.log(`${def.name} が生まれた。`);
        toast(`${def.icon} ${def.name} が生まれた`, 'good');
        ok = true;
        break;
      }
      case 'town': {
        const c = World.canFoundAt(G, tx, ty);
        if (!c.ok) { toast(c.why, 'bad'); return; }
        const t = World.makeTown(G, tx, ty);
        this.log(`${t.name} がひらかれた。あたらしいモコたちが目をさました。`);
        toast(`🏠 ${t.name} をひらいた`, 'holy');
        ok = true;
        break;
      }
      case 'bless': {
        const t = G.towns.find((x) => Math.hypot(x.tx - tx, x.ty - ty) < 7);
        if (!t) { toast('近くに街がない', 'bad'); return; }
        t.blessed += 3; t.happy = clamp(t.happy + 12, 0, 100);
        this.log(`${t.name} に みちびきをさずけた。`);
        toast(`🕊 ${t.name} に みちびき`, 'holy');
        ok = true;
        break;
      }
      case 'light': {
        G.demon.power = Math.max(0, G.demon.power - 22);
        let cleared = 0;
        for (let i = G.herds.length - 1; i >= 0; i--) {
          const h = G.herds[i];
          if (SPECIES[h.sp].evil && Math.hypot(h.tx - tx, h.ty - ty) <= r + 2) { G.herds.splice(i, 1); cleared++; }
        }
        for (const t of G.towns) {
          if (Math.hypot(t.tx - tx, t.ty - ty) <= r + 3) {
            t.happy = clamp(t.happy + 10, 0, 100); t.event = null; t.eventLeft = 0;
          }
        }
        this.log(`奇跡の光がさし、影がしりぞいた。${cleared ? `かげむし ${cleared}群が消えた。` : ''}`);
        toast('💫 影がしりぞいた', 'holy');
        ok = true;
        break;
      }
      case 'bolt': {
        eachInR((x, y) => {
          const t = World.get(x, y);
          if (t === T.FOREST || t === T.FIELD || t === T.FLOWER) { World.edit(G, x, y, T.PLAIN); terrain = true; }
        });
        for (const t of G.towns) {
          if (Math.hypot(t.tx - tx, t.ty - ty) <= r + 2) {
            t.happy = clamp(t.happy - 20, 0, 100); t.pop *= 0.96; t.burnt = 3;
            this.log(`${t.name} に雷が落ちた。モコたちはふるえている。`);
          }
        }
        toast('⚡️ 雷が落ちた', 'bad');
        ok = true;
        break;
      }
    }

    if (!ok) return;
    G.faith -= cost;
    if (terrain) R.thumbDirty = true;

    /* 見た目のごほうび */
    const wx = tx * TILE + 16, wy = ty * TILE + 16;
    if (G.scene === 'ground') {
      const col = m.id === 'bolt' ? 'rgba(255,240,150,.95)' : 'rgba(255,236,170,.9)';
      FX.ring(wx, wy, col, 16, 90 + r * 20, 0.8);
      FX.burst(wx, wy, col, 14, 130, 0.9, -20);
      FX.text(wx, wy - 30, m.name, '#ffe08a');
      if (m.id === 'rain') for (let i = 0; i < 30; i++) {
        FX.list.push({ x: wx + (Math.random() - 0.5) * r * TILE, y: wy - 220 - Math.random() * 100, vx: 0, vy: 260, life: 1.1, max: 1.1, color: 'rgba(160,210,255,.9)', r: 1.6, g: 90 });
      }
      if (m.id === 'bolt') document.body.classList.add('shake');
      setTimeout(() => document.body.classList.remove('shake'), 200);
    } else {
      FX.ring(G.god.x, G.god.y, 'rgba(255,236,170,.9)', 14, 90, 0.7);
    }
    UI.refreshHUD(G);
  },

  /* =============================== 城 =============================== */
  enterCastle() {
    const G = this.G;
    if (!G.demon.alive) {
      UI.talk('', [{ who: 'モコの城', text: '門はかたく閉じている。中の気配は、いまはない。' }]);
      return;
    }
    const start = () => {
      G.scene = 'castle';
      G.god.cx = 0; G.god.cy = 300;
      G.castle = { orbs: [], shots: [], dx: 0, dy: -120, hurt: 0, face: 1, cool: 1.2, shotCool: 0, burst: 3 };
      G.demon.hp = G.demon.maxHp = 120 + Math.floor(G.demon.power * 1.2);
      FX.clear();
      UI.refreshHUD(G);
      if (!G.demon.met) {
        G.demon.met = true;
        this.log(`神さまが ${DEMON.name} と向かいあった。`);
      }
      UI.talk(DEMON.name, DEMON.lines.map((t) => ({ who: `${DEMON.name}（${DEMON.title}）`, text: t })).concat([
        { who: '', text: '光をなげてぶつける（クリック／画面右がわをタップ）。当たると信仰がへる。' },
      ]));
    };
    UI.talk('', [{ who: 'モコの城', text: '黒い門がひとりでに開いた。中から、なまぬるい風。' }], start);
  },

  updateCastle(dt) {
    const G = this.G, C = G.castle, g = G.god;
    UI.setPrompt('');
    const ax = Input.axis();
    const sp = GOD_SPEED_CASTLE * dt;
    let nx = g.cx + ax.x * sp, ny = g.cy + ax.y * sp;
    if (!CASTLE.inside(nx, g.cy)) nx = g.cx;
    if (!CASTLE.inside(g.cx, ny)) ny = g.cy;
    g.cx = nx; g.cy = ny;
    if (ax.x) g.face = ax.x > 0 ? 1 : -1;

    if (g.hurt > 0) g.hurt -= dt;
    if (C.hurt > 0) C.hurt -= dt;

    /* 光をなげる */
    C.shotCool -= dt;
    if (Input.mouse.down && C.shotCool <= 0) {
      C.shotCool = 0.22;
      const mx = Input.mouse.x - R.W / 2, my = Input.mouse.y - R.H / 2;
      const dx = mx - g.cx, dy = my - g.cy, d = Math.hypot(dx, dy) || 1;
      C.shots.push({ x: g.cx, y: g.cy, vx: (dx / d) * 480, vy: (dy / d) * 480, life: 1.6 });
      FX.burst(g.cx, g.cy, 'rgba(255,240,190,.9)', 3, 40, 0.3, 0);
    }

    for (let i = C.shots.length - 1; i >= 0; i--) {
      const s = C.shots[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || !CASTLE.inside(s.x, s.y)) { C.shots.splice(i, 1); continue; }
      if (G.demon.alive && dist(s.x, s.y, C.dx, C.dy) < 42) {
        C.shots.splice(i, 1);
        G.demon.hp -= 5;
        C.hurt = 0.12;
        FX.burst(s.x, s.y, 'rgba(255,240,190,.95)', 8, 90, 0.4, 0);
        if (G.demon.hp <= 0) { this.winCastle(); return; }
      }
    }

    if (!G.demon.alive) return;

    /* 悪魔のうごき */
    C.dx += Math.cos(R.t * 0.7) * 40 * dt;
    C.dy += Math.sin(R.t * 0.9) * 26 * dt;
    C.dx = clamp(C.dx, -260, 260); C.dy = clamp(C.dy, -230, 120);
    C.face = g.cx > C.dx ? 1 : -1;

    C.cool -= dt;
    if (C.cool <= 0) {
      C.cool = clamp(1.35 - G.demon.power * 0.002, 0.5, 1.35);
      const dx = g.cx - C.dx, dy = g.cy - C.dy, d = Math.hypot(dx, dy) || 1;
      C.orbs.push({ x: C.dx, y: C.dy, vx: (dx / d) * 190, vy: (dy / d) * 190, r: 11, life: 6 });
      C.burst -= 1;
      if (C.burst <= 0) {
        C.burst = 4;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + R.t;
          C.orbs.push({ x: C.dx, y: C.dy, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 9, life: 6 });
        }
      }
    }

    for (let i = C.orbs.length - 1; i >= 0; i--) {
      const o = C.orbs[i];
      o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt;
      if (o.life <= 0 || !CASTLE.inside(o.x, o.y)) { C.orbs.splice(i, 1); continue; }
      if (g.hurt <= 0 && dist(o.x, o.y, g.cx, g.cy) < 20 + o.r) {
        C.orbs.splice(i, 1);
        g.hurt = 0.9;
        G.faith = Math.max(0, G.faith - 12);
        FX.burst(g.cx, g.cy, 'rgba(255,90,140,.9)', 12, 120, 0.5, 0);
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('shake'), 200);
        if (G.faith <= 0) { this.loseCastle(); return; }
      }
    }
  },

  winCastle() {
    const G = this.G;
    G.demon.alive = false; G.demon.power = 0; G.demon.sealed = 0; G.demon.hp = 0;
    G.faith += 80;
    for (const t of G.towns) { t.happy = clamp(t.happy + 20, 0, 100); t.event = null; t.eventLeft = 0; }
    for (let i = G.herds.length - 1; i >= 0; i--) if (SPECIES[G.herds[i].sp].evil) G.herds.splice(i, 1);
    this.log(`${DEMON.name} を封じた。星から、こわい夢がしばらく消えた。`);
    FX.ring(G.castle.dx, G.castle.dy, 'rgba(255,240,190,.95)', 26, 200, 1.2);
    UI.talk('', [
      { who: DEMON.name, text: DEMON.defeat },
      { who: '', text: `${DEMON.name} は 城のおくに封じられた。地上のモコたちが、いっせいに空を見あげている。` },
    ], () => { G.scene = 'sky'; this.backToCastleGate(); });
  },

  loseCastle() {
    const G = this.G;
    this.log('神さまの光がつきて、城からはじき出された。');
    UI.talk('', [{ who: DEMON.name, text: 'ほら。信じられていないと、そんなものさ。' }],
      () => { G.scene = 'sky'; this.backToCastleGate(); toast('信仰をためて、また来よう', 'bad'); });
  },

  backToCastleGate() {
    const G = this.G;
    const c = SKY.spots.find((s) => s.id === 'castle');
    G.god.x = c.x; G.god.y = c.y + 140;
    FX.clear();
    R.snap(G.god.x, G.god.y);
    UI.refreshHUD(G);
    this.save();
  },

  /* ============================ すすみぐあい ============================ */
  updateQuest() {
    const G = this.G;
    let q;
    if (!G.towns.length) q = '祭壇で「街をひらく」をえらび、天窓の地図から陸をタップしよう。';
    else if (G.year < 6) q = `${G.towns[0].name} のモコたちを見まもろう。信仰は街から集まってくる。`;
    else if (G.demon.alive && G.demon.bridge) q = `雲のはしに黒い橋がかかっている。${DEMON.name} の城へ行ける。`;
    else if (G.towns.some((t) => t.era >= 5)) q = 'モコたちは星へ出ていこうとしている。最後まで見とどけよう。';
    else if (G.towns.length < 3) q = '「街をひらく」や「いのちを生む」で、星をにぎやかにしよう。';
    else q = `${G.planet} の時代がすすんでいく。街をのぞいたり、地上を歩いたりしてみよう。`;
    UI.setQuest(q);
  },

  checkEnding() {
    const G = this.G;
    if (G.flags.endShown) return;
    const t = G.towns.find((x) => x.era >= 5);
    if (!t) return;
    G.flags.endShown = true;
    const total = Math.round(G.towns.reduce((s, x) => s + x.pop, 0));
    document.getElementById('endTitle').textContent = '星の時代';
    document.getElementById('endBody').innerHTML = `
      <p>${G.year}年目。<b>${t.name}</b> の塔に光がともり、モコたちは空へのぼる舟をつくりあげた。</p>
      <p>この星の名は <b>${G.planet}</b>。街は <b>${G.towns.length}</b> つ、モコは <b>${total}</b> 人になった。
      ${G.demon.alive ? `黒い城にはまだ ${DEMON.name} がいる。` : `${DEMON.name} は、あなたが封じた。`}</p>
      <p>子どもたちは今夜も、まっしろなモコの話をきいて眠る。 ―― <b>${G.godName}</b> の話を。</p>
      <p class="note">このあとも、星は続きます。見まもりつづけることができます。</p>`;
    document.getElementById('endScreen').classList.remove('hidden');
    this.save();
  },
};

window.addEventListener('load', () => Game.boot());
