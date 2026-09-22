/* =========================================================================
   ORE TO ARMADA ― 起動とゲームループ
   新しいゲーム / 1ティックの順番 / 操作 / カメラ / 倒れたとき / 曳航 / 保存
   ========================================================================= */
'use strict';

let G = null;
const DT = 1 / 60;

function newGameState(seed, diff) {
  const unlocked = {};
  for (const d of BLOCK_LIST) if (d.tier === 1) unlocked[d.id] = true;
  return {
    v: 1, seed, diff, time: 0, day: 1, dayT: TUNE.dayLength * 0.3, credits: TUNE.startCredits, sysId: 0, sysState: {}, visited: {},
    unlocked, blueprints: [], rep: 0, quest: 0, questN: 0, missions: [], doneMissions: [], bossDead: [false, false, false, false],
    loanOut: false, respawn: null, nextId: 1, stats: { mined: 0, kills: 0, earned: 0 }, crew: [], player: null, hiredOffers: [],
    lastStationSys: 0, opt: { rotate: true, mute: false }, galaxy: null,
  };
}

const Game = {
  running: false, paused: false, acc: 0, last: 0, t: 0, saveT: 0, deathT: 0, towT: 0,

  init() {
    Render.init($('game'));
    Input.init($('game'));
    UI.init();
    $('btnNew').onclick = () => { $('diffPick').classList.remove('hidden'); };
    $('btnSurvival').onclick = () => this.start('survival');
    $('btnRelaxed').onclick = () => this.start('relaxed');
    $('btnContinue').onclick = () => { const d = Save.read(); if (d) this.load(d); };
    $('btnImport').onclick = () => $('fileIn').click();
    $('btnHelp').onclick = () => { $('titleScreen').classList.add('hidden'); this.previewHelp = true; UI.open('help'); };
    $('fileIn').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!d.seed) throw 0; this.load(d); } catch (err) { Toast.show('読み込めないファイルだった', 'bad'); } }; r.readAsText(f); e.target.value = ''; };
    const has = Save.read();
    $('btnContinue').disabled = !has;
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) { $('saveWarn').textContent = 'このゲームはキーボードとマウスで遊ぶ。パソコンで開いてね。'; $('saveWarn').classList.remove('hidden'); }
    if (!Save.works()) { $('saveWarn').textContent = 'このブラウザでは自動で保存できない (シークレットウィンドウなど)。遊んだあとはメニューから「ファイルに書き出す」で保存しよう。'; $('saveWarn').classList.remove('hidden'); }
    addEventListener('keydown', () => Sfx.ensure(), { once: true });
    addEventListener('mousedown', () => Sfx.ensure(), { once: true });
    // タイトルの背景に星と小惑星を見せる
    this.titleBg();
    requestAnimationFrame((t) => this.frame(t));
  },
  titleBg() {
    G = newGameState(7, 'survival');
    G.galaxy = makeGalaxy(7);
    Sector.build(0, 'start');
    G.player = makePerson('player', { name: 'あなた', x: S.station ? S.station.x : 0, y: S.station ? S.station.y + 30 : 0, hidden: true });
    // 背景に船を並べる (動かさない飾り)
    const st = S.station, cx = st.x, cy = st.y + 34;
    const deco = [['carrier', -44, 16, -0.35], ['frigate', 40, 20, 0.3], ['gunboat', -20, 34, -0.1], ['gunboat', 58, 42, 0.5], ['miner2', 18, 44, 0.2]];
    for (const [k, dx, dy, a] of deco) {
      const g = makeShip(k); g.faction = 'player'; g.x = cx + dx; g.y = cy + dy; g.a = a;
      g.updateSys(); for (const b of g.sys.turrets) b.ta = -Math.PI / 2 + a * 0.5;
      S.grids.push(g);
    }
    Render.cam.x = cx; Render.cam.y = cy; Render.cam.zoom = 0.62;
    this.title = true;
  },
  start(diff) {
    const seed = (Math.random() * 1e9) | 0;
    G = newGameState(seed, diff);
    G.galaxy = makeGalaxy(seed);
    Grid.seq = 0;
    Sector.build(0, 'start');
    const ap = arrivalPoint(S.sys, G.galaxy, null, 'start');
    const ship = makeShip('starter');
    ship.faction = 'player';
    // ステーションを背にして、いちばん近い小惑星帯を向く
    const home = S.layout.clusters[0], st = S.station;
    const dirA = st && home ? Math.atan2(home.y - st.y, home.x - st.x) : 0;
    ship.x = (st ? st.x : ap.x) + Math.cos(dirA) * 26; ship.y = (st ? st.y : ap.y) + Math.sin(dirA) * 26; ship.a = dirA + Math.PI / 2;
    ship.updateSys();
    for (const b of ship.sys.batteries) b.charge = b.def.cap;
    ship.invAdd('p_steel', 4);
    S.grids.push(ship);
    G.player = makePerson('player', { name: 'あなた', color: '#e8864a' });
    G.player.inv.o2_bottle = 1;
    sitDown(G.player, ship, ship.sys.pilotSeats[0]);
    Sfx.muted = false;
    this.begin();
    Toast.show('まずは近くの小惑星を掘ろう。マウスを小惑星に向けて左クリック', 'good');
    Save.write(true);
  },
  load(d) {
    G = Object.assign(newGameState(d.seed, d.diff), d);
    G.galaxy = makeGalaxy(G.seed);
    Grid.seq = d.gridSeq || 1000;
    const pd = d.player;
    G.crew = (d.crew || []).map((c) => makePerson('crew', Object.assign({}, c, { mode: c.mode || 'walk', grid: null, seat: null })));
    Sector.build(G.sysId, 'load');
    Fleet.relink();
    G.player = makePerson('player', { name: 'あなた', color: '#e8864a', hp: pd.hp, o2: pd.o2, suit: pd.suit, inv: pd.inv || {}, tool: pd.tool || 1 });
    const g = pd.station ? S.station : S.grids.find((o) => o.id === pd.gridId);
    if (g && pd.mode === 'seat' && pd.seat) { const b = g.at(pd.seat[0], pd.seat[1]); if (b && b.def.seat) sitDown(G.player, g, b); else { G.player.mode = 'walk'; G.player.grid = g; G.player.lx = pd.lx; G.player.ly = pd.ly; } }
    else if (g && pd.mode === 'walk') { G.player.mode = 'walk'; G.player.grid = g; G.player.lx = pd.lx; G.player.ly = pd.ly; }
    else { G.player.mode = 'eva'; G.player.x = pd.x; G.player.y = pd.y; G.player.vx = pd.vx || 0; G.player.vy = pd.vy || 0; }
    Sfx.muted = !!(G.opt && G.opt.mute);
    this.begin();
    Toast.show(`${G.day}日目 / ${S.sys.name} 星系から再開`, 'good');
  },
  begin() {
    this.title = false; this.running = true; this.paused = false;
    $('titleScreen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    const w = personWorld(G.player);
    Render.cam.x = w.x; Render.cam.y = w.y; Render.cam.zoom = 1.1;
    Quest.checkState();
  },
  pause() { this.paused = true; },
  resume() { if (this.previewHelp) { this.previewHelp = false; $('titleScreen').classList.remove('hidden'); return; } this.paused = false; },

  /* ---------- ボタンとキーの動作 ---------- */
  action(act) {
    if (!this.running) return;
    if (act === 'build') { if (UI.isOpen) UI.close(); Build.toggle(); return; }
    if (UI.isOpen && UI.kind === act) { UI.close(); return; }
    const map = { inv: 'inv', crew: 'crew', fleet: 'fleet', map: 'map', bp: 'bp', menu: 'menu' };
    if (map[act]) { if (Build.on) Build.exit(); UI.open(map[act]); this.pause(); }
  },
  keys() {
    if (Input.hit('Escape')) {
      if (!$('confirm').classList.contains('hidden')) { const no = $('confirmNo'); if (no) no.click(); return; }
      if (UI.choiceOpen) { UI.closeChoice(); return; }
      if (UI.isOpen) { UI.close(); return; }
      if (Build.on) { Build.exit(); return; }
      this.action('menu'); return;
    }
    if (UI.isOpen) {
      const k = { Tab: 'inv', KeyC: 'crew', KeyV: 'fleet', KeyM: 'map', KeyP: 'bp' };
      for (const code in k) if (Input.hit(code) && UI.kind === k[code]) { UI.close(); return; }
      return;
    }
    if (Input.hit('KeyB')) this.action('build');
    if (Input.hit('Tab')) this.action('inv');
    if (Input.hit('KeyC')) this.action('crew');
    if (Input.hit('KeyV')) this.action('fleet');
    if (Input.hit('KeyM')) this.action('map');
    if (Input.hit('KeyP')) this.action('bp');
  },

  /* ---------- 1フレーム ---------- */
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const raw = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += raw;
    if (this.title) { Render.cam.x += raw * 0.6; this.draw(); return; }
    if (!this.running) return;
    this.keys();
    if (!this.paused && !UI.isOpen) {
      this.acc += raw;
      let n = 0;
      this.edge = true;
      while (this.acc >= DT && n < 4) { this.step(DT); this.acc -= DT; n++; this.edge = false; }
      if (n >= 4) this.acc = 0;
    }
    this.camera(raw);
    this.draw();
    UI.hud(raw);
    if (Build.on) { UI.buildStatsT = (UI.buildStatsT || 0) - raw; if (UI.buildStatsT <= 0) { UI.buildStatsT = 0.25; UI.buildStats(); UI.buildInfo(); } }
    Input.endFrame();
  },

  step(dt) {
    G.time += dt;
    const p = G.player;
    S.beams.length = 0;
    // 1. 入力
    this.control(dt);
    // 2. 敵と艦隊の動き
    const ship = playerShip();
    let fleetN = 0;
    for (const g of S.grids) {
      if (g.dead || g.terrain || g.static || g === ship || g.kind === 'station' || g.kind === 'gate') continue;
      // 同時に動かせる持ち船は TUNE.maxFleet 隻まで
      if (g.faction === 'player') { if (Fleet.canAct(g) && ++fleetN > TUNE.maxFleet) { g.ctrl.mx = g.ctrl.my = g.ctrl.rot = 0; g.ctrl.face = null; continue; } Fleet.ai(g, dt); }
      else if (g.faction === 'pirate' || g.faction === 'swarm' || g.faction === 'union') AI.ship(g, dt);
      else { g.ctrl.mx = 0; g.ctrl.my = 0; g.ctrl.rot = 0; g.ctrl.face = null; g.ctrl.assist = false; }
    }
    // 3. 船の中の仕組み
    const env = { star: S.star, onBreach: (g, r) => this.onBreach(g, r), damageBlock, dropNear: (g, id, n) => { const w = g.toWorld(g.comX, g.comY); dropPickup(w.x, w.y, { [id]: n }, 'salvage', g); } };
    for (const g of S.grids) {
      if (g.dead || g.terrain) continue;
      Ship.update(g, dt, env);
      if (S.stormT > 0 && Math.hypot(g.x, g.y) < 750 && Math.sin(G.time * 1.3 + g.id) > 0.6 && g.power.cat) { for (const k in g.power.cat) g.power.cat[k] = 0; g.power.thrRatio = 0; }
    }
    // 4. 物理
    for (const g of S.grids) if (!g.dead && !g.terrain) Phys.control(g, dt);
    for (const g of S.grids) if (!g.dead) Phys.integrate(g, dt);
    Phys.collideAll(S.grids, (A, ai, aj, B, bi, bj, v) => this.impact(A, ai, aj, B, bi, bj, v));
    // 5. 武器
    const gs = p.mode === 'seat' && p.seat && p.seat.def.seat === 'gunner' ? p.grid : null;
    for (const g of S.grids) {
      if (g.dead || g.terrain) continue;
      if (g === ship || g === gs) continue;
      Combat.weapons(g, dt, null);
    }
    if (ship) Combat.weapons(ship, dt, this.shipCtl);
    if (gs) Combat.weapons(gs, dt, Object.assign({}, this.shipCtl, { fixed: false }));
    Combat.bullets(dt);
    updateDrones(dt);
    // 6. 人
    Crew.tick(dt);
    // 7. 分かれた船・消えた船
    this.cleanup();
    // 8. 回収物・粒
    updatePickups(dt);
    updateParticles(dt);
    // 9. できごと・1日
    Sector.events(dt);
    const dayBefore = G.day;
    Econ.tick(dt);
    if (G.day !== dayBefore) Sector.remoteDay();
    Missions.tick(dt);
    Fleet.tickJump(dt);
    Fleet.tickSelfDestruct(dt);
    this.tickTow(dt);
    // 自動保存
    this.saveT += dt;
    if (this.saveT > 60) { this.saveT = 0; Save.write(true); }
    // 状態で決まる依頼
    this.qT = (this.qT || 0) + dt; if (this.qT > 1) { this.qT = 0; Quest.checkState(); }
  },

  /* ---------- 操作 ---------- */
  control(dt) {
    const p = G.player;
    this.shipCtl = null;
    if (p.dead) { this.deathT -= dt; if (this.deathT <= 0) this.respawn(); return; }
    const mw = Render.toWorld(Input.mx, Input.my);
    const k = (c) => Input.key(c);
    const onUI = false;
    // 画面の向きのまま動く (上 = 画面の上)
    const sx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), sy = (k('KeyS') ? 1 : 0) - (k('KeyW') ? 1 : 0);
    const ca = Render.cam.a, co = Math.cos(ca), si = Math.sin(ca);
    let wx = co * sx - si * sy, wy = si * sx + co * sy;
    const l = Math.hypot(wx, wy); if (l > 1) { wx /= l; wy /= l; }
    // 押した瞬間に1回だけ起きる動作は、フレームの最初のティックだけで受ける
    const edge = this.edge;
    if (edge) for (let n = 1; n <= 4; n++) if (Input.hit('Digit' + n)) { p.tool = n; UI.hbKey = null; }
    const ship = playerShip();
    if (Build.on && edge) Build.input(mw, dt);
    if (edge && Input.hit('KeyF')) this.pressF();
    if (edge && Input.hit('KeyG')) this.pressG();
    if (edge && Input.hit('KeyJ') && ship) { if (ship.jump) Toast.show('ジャンプの充電中'); else { ship.updateSys(); if (!ship.sys.jumps.length) Toast.show('この船にはジャンプドライブがない', 'bad'); else { UI.open('map', 'galaxy', { jump: true }); this.pause(); } } }
    if (p.mode === 'seat' && p.seat.def.seat === 'pilot' && ship) {
      const c = ship.ctrl;
      // 船の向きでの前後左右 (画面が船に合わせて回っていれば、画面の上 = 前)
      c.mx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
      c.my = (k('KeyS') ? 1 : 0) - (k('KeyW') ? 1 : 0);
      c.rot = (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0);
      c.face = null;
      if (edge && Input.hit('KeyZ')) { c.assist = !c.assist; Toast.show(c.assist ? '飛行アシスト オン (手を離すと止まる)' : '飛行アシスト オフ (慣性のまま流れる)'); }
      const fire = Input.mdown[0] && !Build.on;
      this.shipCtl = { aim: mw, fire };
      // 前向きの武器しかない船は、撃つあいだマウスの方を向く
      ship.updateSys();
      if (fire && !c.rot && ship.sys.fixed.length && !ship.sys.turrets.length) c.face = Math.atan2(mw.y - ship.y, mw.x - ship.x) + Math.PI / 2;
      if (edge && Input.mclick[2] && !Build.on) this.pickTarget(ship, mw);
      if (ship.dockedTo && (c.mx || c.my)) { /* つながっている間は動かない */ c.mx = 0; c.my = 0; }
      movePerson(p, dt, { x: 0, y: 0 });
      return;
    }
    if (p.mode === 'seat') {
      // 砲手席: 砲塔を手で狙う
      this.shipCtl = { aim: mw, fire: Input.mdown[0] };
      movePerson(p, dt, { x: 0, y: 0 });
      return;
    }
    movePerson(p, dt, { x: wx, y: wy, brake: k('Space') });
    if (Input.mdown[0] && !Build.on && !onUI) useTool(p, dt, mw);
    // 溶接機で予定図を建てる
    if (Input.mdown[0] && !Build.on && p.tool === 2) {
      p.planT = (p.planT || 0) - dt;
      if (p.planT <= 0) {
        const g = Build.gridAt(mw.x, mw.y);
        const w = personWorld(p);
        if (g && g.plan && dist(mw.x, mw.y, w.x, w.y) < 7) { const q = g.toLocal(mw.x, mw.y); if (Blueprints.buildPlanAt(g, Math.floor(q.x), Math.floor(q.y), p)) { p.planT = 0.3; Sfx.play('place', 0.5); } }
      }
    }
    // 基地・漂流船での発見
    if (p.mode === 'walk' && p.grid && p.grid.bpLoot) {
      const id = p.grid.bpLoot; p.grid.bpLoot = null;
      if (!G.unlocked[id]) { G.unlocked[id] = true; UI.buildPalette && Build.on && UI.buildPalette(); Toast.show(`漂流船の中で設計図「${BLOCKS[id].name}」を見つけた！`, 'good'); Sfx.play('coin'); }
      else { Econ.earn(200, '漂流船の中で古いデータを見つけて売った'); }
    }
  },
  pickTarget(ship, mw) {
    let best = null, bd = 1e9;
    for (const g of S.grids) {
      if (g.dead || g.terrain || g.faction === 'player' || g.kind === 'gate') continue;
      const d = dist(g.x, g.y, mw.x, mw.y) - g.radius;
      if (d < 6 && d < bd) { bd = d; best = g; }
    }
    ship.target = best;
    UI.hbKey = null;
    if (best) { Toast.show(`目標: ${best.name}`); Sfx.play('ui'); }
  },
  pressF() {
    const p = G.player;
    if (p.mode === 'seat') {
      const g = p.grid;
      standUp(p);
      if (p.mode === 'eva') Toast.show('宇宙服で船外に出た。酸素は3分もつ');
      if (Build.on) Build.exit();
      return;
    }
    const t = interactTarget(p);
    if (!t) return;
    const d = t.b.def;
    if (d.seat) {
      if (t.g.faction !== 'player' && t.g.kind !== 'station') {
        // 拿捕
        if (t.g.sys.bioCores.length) { Toast.show('生きた船は奪えない', 'bad'); return; }
        const left = S.persons.filter((o) => o.kind === 'hostile' && o.grid === t.g && !o.dead).length;
        if (left > 0) { Toast.show(`まだ敵の乗員が ${left}人 残っている`, 'bad'); return; }
        this.capture(t.g);
      }
      if (t.g.abandoned) { t.g.abandoned = false; Toast.show(`${t.g.name} に戻った`); }
      sitDown(p, t.g, t.b);
      return;
    }
    if (d.kiosk) {
      const map = { k_market: 'market', k_parts: 'parts', k_bp: 'bp', k_hire: 'hire', k_mission: 'mission', k_med: 'med', k_yard: 'yard', k_repair: 'repair' };
      this.openStation(map[d.kiosk], null);
      return;
    }
    if (d.medbay) { G.respawn = { sys: S.sys.id, gridId: t.g.id, i: t.b.x, j: t.b.y }; Toast.show('この医療室を蘇生地点にした', 'good'); return; }
    if (d.cargo || d.refine || d.assemble) { UI.open('inv', null, { grid: t.g }); this.pause(); return; }
    if (d.shipyard) { this.openShipyard(t.g); return; }
    if (d.jump) { Toast.show('ジャンプは操縦席で J'); return; }
  },
  pressG() {
    const ship = playerShip();
    if (!ship) return;
    const ctx = this.gContext(ship);
    if (!ctx) return;
    ctx.fn();
  },
  /* 操縦中に G でできること */
  gContext(ship) {
    if (ship.dockedTo) return { text: ship.landed ? '発進する' : '切り離す', fn: () => Fleet.undock(ship, true) };
    const carrier = Fleet.landingCarrier(ship);
    if (carrier) return { text: `${carrier.name} に着艦する`, fn: () => Fleet.dock(ship, carrier, true) };
    const pair = Fleet.connectorPair(ship);
    if (pair && pair.o.kind !== 'station') return { text: `${pair.o.name} とつなぐ`, fn: () => { const [c, par] = ship.mass <= pair.o.mass ? [ship, pair.o] : [pair.o, ship]; Fleet.dock(c, par, false); } };
    if (S.station && dist(ship.x, ship.y, S.station.x, S.station.y) < S.station.radius + ship.radius + 40) {
      const v = Math.hypot(ship.vx, ship.vy);
      return { text: v < 12 ? '入港する' : '入港するには速度を落とす', fn: () => { if (v < 12) this.openStation('market', ship); else Toast.show('速すぎる。止まってから G', 'bad'); } };
    }
    for (const gt of S.gates) if (dist(ship.x, ship.y, gt.x, gt.y) < 30) {
      const to = G.galaxy.systems[gt.gateTo];
      return { text: `ゲートで ${to.name} へ (通行料 50 ₵〜)`, fn: () => { UI.confirm(`${to.name} (${RINGS[to.ring].name}) へゲートで移る？ 通行料は1隻 50 ₵。「ついてこい」の船も一緒に移る。`, () => Fleet.travel(to.id, 'gate')); } };
    }
    return null;
  },
  openStation(tab, ship) {
    Econ.dockShip = ship || null;
    if (ship) { ship.vx = 0; ship.vy = 0; ship.va = 0; Missions.checkAtStation(S.sys); }
    else { const near = nearestGridTo(S.station.x, S.station.y, 60, (g) => g.faction === 'player' && g.kind === 'ship'); Econ.dockShip = near; Missions.checkAtStation(S.sys); }
    G.lastStationSys = S.sys.id;
    Crew.onDock();
    Fleet.rejoinPods && ship && Fleet.rejoinPods(ship);
    UI.open('station', tab);
    this.pause();
    Save.write(true);
  },
  openShipyard(base) {
    if (!G.blueprints.length) { Toast.show('設計図がない。P の画面で船を設計図に保存しよう', 'bad'); return; }
    const list = G.blueprints.slice(-6).reverse();
    UI.choice('造船台で組み上げる設計図を選ぶ (材料は基地の貨物から使う)', list.map((bp) => [bp.name, () => this.buildAtYard(base, bp)]).concat([['やめる', null]]));
  },
  buildAtYard(base, bp) {
    const cost = blueprintCost(bp);
    if (bp.blocks.some(([id]) => !G.unlocked[id])) { Toast.show('持っていない設計図のブロックがある', 'bad'); return; }
    const lack = Object.keys(cost).filter((k) => base.invTotal(k) < cost[k]);
    if (lack.length) { Toast.show('基地の貨物に材料が足りない: ' + lack.map((k) => `${ITEMS[k].name} ${cost[k] - base.invTotal(k)}`).join('、'), 'bad'); return; }
    for (const k in cost) base.invTake(k, cost[k]);
    const g = gridFromBlueprint(bp, { faction: 'player' });
    const sy = base.sys.shipyards[0], w = base.blockWorld(sy);
    g.x = w.x + g.radius + 6; g.y = w.y; g.a = base.a;
    for (let k = 0; k < 20 && S.grids.some((o) => !o.dead && o !== g && dist(o.x, o.y, g.x, g.y) < o.radius + g.radius); k++) g.x += 8;
    S.grids.push(g);
    Toast.show(`造船台で ${g.name} が完成した`, 'good');
    Quest.checkState();
  },
  capture(g) {
    g.faction = 'player'; g.disabled = false; g.transient = false; g.name = '拿捕した ' + g.name.replace(/^漂流船 \(|\)$/g, '');
    g.derelict = false; g.target = null; g.order = null; g.fleeing = false;
    g.eachBlock((b) => { if (b.def.door) b.lock = false; });
    Toast.show(`${g.name} を手に入れた！`, 'good'); Sfx.play('coin');
    Quest.checkState();
  },
  remoteTo(g) {
    const p = G.player;
    g.updateSys();
    const seat = g.sys.pilotSeats.find((b) => !b.occ || b.occ.kind === 'crew');
    if (!seat) { Toast.show('空いている操縦席がない', 'bad'); return; }
    if (seat.occ) standUp(seat.occ);
    p.remoteFrom = { gridId: p.grid ? p.grid.id : null };
    if (p.seat) { p.seat.occ = null; p.seat = null; }
    sitDown(p, g, seat);
    Toast.show(`遠隔操縦で ${g.name} に乗り移った`);
  },

  /* ---------- 衝突のダメージ ---------- */
  impact(A, ai, aj, B, bi, bj, v) {
    if (v < 4) return;
    const dmg = (v - 3) * (v - 3) * 0.5;
    const hit = (g, i, j) => {
      if (g.invuln) return;
      if (g.terrain) { const t = g.digTerrain(i, j, dmg * 0.3); if (t) onDug(g, i, j, t, null); return; }
      const b = g.at(i, j); if (b) damageBlock(g, b, dmg, 'kinetic', null);
    };
    hit(A, ai, aj); hit(B, bi, bj);
    if (A.terrain && !A.static) A.moved = true;
    if (B.terrain && !B.static) B.moved = true;
    if ((A === playerShip() || B === playerShip()) && v > 6) { shake(Math.min(1, v / 20)); Sfx.play('hit', 0.8); }
  },
  onBreach(g, r) {
    if (g.faction !== 'player') return;
    if (g.breachMsgT > G.time) return;
    g.breachMsgT = G.time + 8;
    if (g.onScreen || g === playerShip() || G.player.grid === g) { Toast.show(`${g.name} の部屋に穴があいた！空気が抜けていく`, 'bad'); Sfx.play('alarm', 0.6); }
  },
  /* 分かれた船・小さな破片・消えた船の片づけ */
  cleanup() {
    const add = [];
    for (const g of S.grids) {
      if (g.dead || !g.dirtySplit) continue;
      const pieces = splitGrid(g);
      for (const pc of pieces) {
        pc.faction = g.faction === 'player' ? 'player' : null;
        pc.kind = g.faction === 'player' && pc.hasControl() ? 'ship' : 'debris';
        if (pc.count < TUNE.fragmentMin && !pc.hasControl()) {
          // 小さな破片は回収物にする (借り物は何も残さない)
          if (!pc.loan) { const items = {}; pc.eachBlock((b) => { for (const k in b.def.cost) items[k] = (items[k] || 0) + Math.floor(b.def.cost[k] * 0.5); if (b.inv) for (const k in b.inv) items[k] = (items[k] || 0) + b.inv[k]; }); for (const k in items) if (!items[k]) delete items[k]; if (Object.keys(items).length) dropPickup(pc.x, pc.y, items, 'salvage', pc); }
          debrisBurst(pc.x, pc.y, '#9aa4b2', 1);
          continue;
        }
        pc.name = g.name + ' の破片';
        add.push(pc);
        // 乗っていた人・張りついていた人を新しい塊へ
        for (const p of allPersons()) {
          if (p.grid === g && p.mode === 'walk' && pc.at(Math.floor(p.lx), Math.floor(p.ly))) { p.grid = pc; p.path = null; p.jobKey = null; if (p.kind === 'crew' && p.gridId === g.id && pc.hasControl()) p.gridId = pc.id; }
          if (p.att && p.att.g === g) { const i = Math.floor(p.att.lx), j = Math.floor(p.att.ly); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (pc.occupied(i + di, j + dj)) p.att.g = pc; }
        }
      }
      if (g.count === 0) g.dead = true;
      checkDisabled(g, g.lastHitBy);
    }
    for (const pc of add) S.grids.push(pc);
    // 破片が多すぎたら古いものから回収物にする
    const debris = S.grids.filter((g) => !g.dead && g.kind === 'debris');
    if (debris.length > 25) for (const g of debris.slice(0, debris.length - 25)) { g.dead = true; dropPickup(g.x, g.y, { p_steel: Math.ceil(g.count / 3) }, 'salvage', g); }
    for (const g of S.grids) if (g.dead) for (const c of S.grids) if (c.dockedTo === g && !c.dead) { c.dockedTo = null; c.dockRel = null; c.landed = false; }
    for (const g of S.grids) if (g.dead) { Render.dropGrid(g); if (g.base === undefined && g.rockGrid) g.rockGrid.base = null; for (const p of allPersons()) if (p.grid === g) { const w = personWorld(p); p.mode = 'eva'; p.grid = null; p.seat = null; p.x = w.x; p.y = w.y; } }
    S.grids = S.grids.filter((g) => !g.dead);
  },

  /* ---------- 倒れたとき ---------- */
  respawn() {
    UI.undeath();
    const p = G.player;
    p.dead = false; p.hp = p.maxhp; p.o2 = TUNE.suitO2; p.suit = TUNE.suitPower; p.hurtT = 0;
    let placed = false;
    const r = G.respawn;
    if (r && r.gridId && r.sys === S.sys.id) {
      const g = S.grids.find((o) => o.id === r.gridId && !o.dead);
      const b = g && g.at(r.i, r.j);
      if (b && b.def.medbay && g.faction === 'player' && g.pressureAt(r.i, r.j) > 0.5 && (g.power.cat ? g.power.cat.life > 0.3 : true)) { p.mode = 'walk'; p.grid = g; p.lx = b.x + 1; p.ly = b.y + 1; placed = true; }
    }
    if (!placed) {
      if (!S.station) {
        // ステーションのある星系へ運ばれる
        const to = G.lastStationSys || 0;
        Sector.save();
        Sector.build(to, 'respawn', null);
      }
      const st = S.station;
      st.updateSys();
      const k = st.sys.kiosks.find((b) => b.def.kiosk === 'k_med') || st.sys.kiosks[0];
      const cells = cellsBeside(st, k, p);
      p.mode = 'walk'; p.grid = st; p.lx = cells[0][0] + 0.5; p.ly = cells[0][1] + 0.5;
    }
    if (G.diff !== 'relaxed') { const fine = Math.floor(G.credits * TUNE.deathFine); if (fine) { G.credits -= fine; Toast.show(`治療費 ${fine} ₵ を払った`); } }
    if (!Fleet.ownsShip() && G.credits < 300 && S.station) { Yard.loan(); }
    Toast.show(G.diff === 'relaxed' ? '目を覚ました' : '目を覚ました。遺品の箱は倒れた場所に残っている', 'good');
  },
  callTow() {
    if (this.towT > 0) { Toast.show('曳航船はもう向かっている'); return; }
    this.towT = 20;
    Toast.show('救難信号を出した。20秒ほどで曳航船が来る');
  },
  tickTow(dt) {
    if (this.towT <= 0) return;
    this.towT -= dt;
    if (this.towT > 0) return;
    const p = G.player, ship = playerShip() || (p.grid && p.grid.faction === 'player' && p.grid.kind === 'ship' ? p.grid : null);
    const fee = G.diff === 'relaxed' ? 0 : Math.min(G.credits, Math.floor(G.credits * TUNE.towFine));
    G.credits -= fee;
    if (!S.station) {
      if (ship && playerShip()) { Fleet.travel(G.lastStationSys || 0, 'tow'); }
      else { Sector.save(); Sector.build(G.lastStationSys || 0, 'tow', null); this.placeNearStation(); }
    } else if (ship) {
      if (ship.dockedTo) Fleet.undock(ship, false);
      ship.x = S.station.x + S.station.radius + ship.radius + 8; ship.y = S.station.y; ship.vx = ship.vy = ship.va = 0;
      Ship.addH2(ship, 30);
      for (const b of ship.sys.batteries) b.charge = Math.max(b.charge, b.def.cap * 0.5);
    } else this.placeNearStation();
    Toast.show(`曳航船がステーションまで運んでくれた` + (fee ? ` (-${fee} ₵)` : ''), 'good');
  },
  placeNearStation() {
    const p = G.player, st = S.station;
    if (p.seat) standUp(p);
    p.mode = 'eva'; p.grid = null; p.att = null; p.x = st.x - st.radius - 3; p.y = st.y; p.vx = p.vy = 0;
    p.o2 = TUNE.suitO2; p.suit = TUNE.suitPower;
  },

  /* ---------- カメラ ---------- */
  camera(dt) {
    const p = G.player, cam = Render.cam;
    if (Input.wheel && !UI.isOpen) cam.zoom = clamp(cam.zoom * Math.pow(0.88, Input.wheel), 0.12, 2.6);
    const w = personWorld(p);
    let ref = null;
    if (p.mode === 'seat' || p.mode === 'walk') ref = p.grid;
    else if (p.att) ref = p.att.g;
    const ship = playerShip();
    const tx = ship ? ship.x : w.x, ty = ship ? ship.y : w.y;
    cam.x = lerp(cam.x, tx, Math.min(1, dt * 12)); cam.y = lerp(cam.y, ty, Math.min(1, dt * 12));
    if (G.opt.rotate && ref && !ref.terrain && ref.kind !== 'station') cam.a += angNorm(ref.a - cam.a) * Math.min(1, dt * 6);
    else if (G.opt.rotate && ref && ref.kind === 'station') cam.a += angNorm(0 - cam.a) * Math.min(1, dt * 4);
    if (!G.opt.rotate) cam.a += angNorm(0 - cam.a) * Math.min(1, dt * 4);
    if (shakeAmt > 0) { cam.x += (Math.random() - 0.5) * shakeAmt; cam.y += (Math.random() - 0.5) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt * 2); }
    // 近くの案内
    let text = '';
    if (!p.dead && !UI.isOpen) {
      if (ship) { const c = this.gContext(ship); if (c) text = `<span class="key">G</span> ${c.text}`; if (ship.jump) text = `ジャンプまで ${Math.ceil(ship.jump.t)} 秒`; }
      else { const t = interactTarget(p); if (t) text = `<span class="key">F</span> ${interactLabel(t)}`; }
      if (p.mode === 'eva' && !text && p.suit <= 0) text = 'スーツ電力が切れた。救難信号はメニュー (Esc) から';
    }
    UI.prompt(text);
  },

  /* ---------- 描画 ---------- */
  draw() {
    const R = Render, t = this.t;
    R.frame++;
    R.background(S ? { bg: S.sys.bg, nebulae: S.layout.nebulae } : null, t);
    if (!S) return;
    R.sun({ star: S.star });
    R.worldTransform();
    const vr = R.viewRadius(), cam = R.cam;
    for (const g of S.grids) {
      g.onScreen = dist2(g.x, g.y, cam.x, cam.y) < (vr + g.radius) ** 2;
      if (!g.onScreen) continue;
      R.drawGrid(g, t);
    }
    for (const g of S.grids) if (g.onScreen && !g.terrain) R.gridDynamic(g, t);
    R.pickups(t);
    for (const p of S.persons) if (!p.dead) R.person(p, t);
    if (G.player && !G.player.dead && !G.player.hidden) R.person(G.player, t);
    R.drones();
    R.bullets();
    R.particles();
    // 目標の枠
    const ship = playerShip();
    if (ship && ship.target && !ship.target.dead) { const tg = ship.target; R.ctx.strokeStyle = '#ff5a5a'; R.ctx.lineWidth = 0.2; R.ctx.setLineDash([1, 1]); R.ctx.beginPath(); R.ctx.arc(tg.x, tg.y, tg.radius + 2, 0, TAU); R.ctx.stroke(); R.ctx.setLineDash([]); }
    // 依頼や救難信号の方向
    R.buildGhost(t);
    R.fog(G.player);
    this.offscreenArrows();
    R.trimCache(S.grids);
    if (!this.title) UI.minimap();
  },
  /* 画面の外にある目印 (ボス・依頼・救難信号) の方向を矢印で出す */
  offscreenArrows() {
    const R = Render, ctx = R.ctx;
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const pts = [];
    for (const m of S.markers) pts.push({ x: m.x, y: m.y, c: '#ffe35a' });
    for (const m of G.missions) if (m.pos && m.sys === S.sys.id && !m.rescued) pts.push({ x: m.pos.x, y: m.pos.y, c: '#ffe35a' });
    const ship = playerShip();
    if (ship && ship.target && !ship.target.dead) pts.push({ x: ship.target.x, y: ship.target.y, c: '#ff5a5a' });
    for (const p of pts) {
      const s = R.toScreen(p.x, p.y);
      if (s.x > 20 && s.y > 20 && s.x < R.W - 20 && s.y < R.H - 20) continue;
      const a = Math.atan2(s.y - R.H / 2, s.x - R.W / 2);
      const r = Math.min(R.W, R.H) / 2 - 40;
      const x = R.W / 2 + Math.cos(a) * r, y = R.H / 2 + Math.sin(a) * r;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, 8); ctx.lineTo(-6, -8); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  },
};

/* ---------- 主人公の出来事 ---------- */
function onPlayerPilot(g) {
  if (g.faction === 'player') { Fleet.rejoinPods(g); if (Build.on) Build.target = g; }
}
function onPlayerDeath(w) {
  const p = G.player;
  if (G.diff !== 'relaxed' && Object.keys(p.inv).length) { dropPickup(w.x, w.y, Object.assign({}, p.inv), 'grave'); p.inv = {}; }
  p.mode = 'eva'; p.grid = null; p.seat = null; p.att = null; p.x = w.x; p.y = w.y;
  Game.deathT = 2.8;
  if (Build.on) Build.exit();
  UI.death(p.o2 <= 0 ? '酸素が尽きた。' : '体力が尽きた。');
  Sfx.play('bad');
}

/* ---------- 保存 ---------- */
const Save = {
  KEYS: ['ore-to-armada-v1-a', 'ore-to-armada-v1-b'],
  works() { try { localStorage.setItem('oa-test', '1'); localStorage.removeItem('oa-test'); return true; } catch (e) { return false; } },
  data() {
    Sector.save();
    const p = G.player;
    const w = personWorld(p), v = personVel(p);
    const pd = { hp: p.hp, o2: p.o2, suit: p.suit, inv: p.inv, tool: p.tool, mode: p.dead ? 'eva' : p.mode, gridId: p.grid ? p.grid.id : null, station: !!(p.grid && p.grid.kind === 'station'), lx: p.lx, ly: p.ly, x: w.x, y: w.y, vx: v.x, vy: v.y, seat: p.seat ? [p.seat.x, p.seat.y] : null };
    const crew = G.crew.map((c) => { const cw = personWorld(c); return { id: c.id, name: c.name, skills: c.skills, trait: c.trait, wage: c.wage, morale: c.morale, role: c.role, gridId: c.grid ? c.grid.id : c.gridId, sysId: c.sysId, mode: c.mode === 'eva' ? 'eva' : 'walk', lx: c.lx, ly: c.ly, x: cw.x, y: cw.y, vx: c.mode === 'eva' ? c.vx : 0, vy: c.mode === 'eva' ? c.vy : 0, hp: c.hp, o2: c.o2, suit: c.suit, color: c.color, xp: c.xp, inPod: c.inPod, quitting: c.quitting, injuredUntil: c.injuredUntil }; });
    const out = {};
    for (const k in G) if (!['galaxy', 'player', 'crew'].includes(k)) out[k] = G[k];
    out.player = pd; out.crew = crew; out.gridSeq = Grid.seq; out.savedAt = Date.now();
    return out;
  },
  write(auto) {
    if (!G || !G.player || Game.title) return false;
    let json;
    try { json = JSON.stringify(this.data()); } catch (e) { console.error(e); return false; }
    if (json.length > 2e6 && !this.bigWarned) { this.bigWarned = true; Toast.show('セーブデータが大きくなってきた (2MB 超え)。ときどきファイルに書き出しておこう', 'bad'); }
    const last = localStorage.getItem('ore-to-armada-last');
    const key = last === this.KEYS[0] ? this.KEYS[1] : this.KEYS[0];
    try { localStorage.setItem(key, json); localStorage.setItem('ore-to-armada-last', key); return true; }
    catch (e) { if (!this.failWarned) { this.failWarned = true; Toast.show('保存できなかった。前のセーブは残っている。メニューから「ファイルに書き出す」をしよう', 'bad'); } return false; }
  },
  read() {
    try {
      const last = localStorage.getItem('ore-to-armada-last');
      for (const k of [last, ...this.KEYS]) { if (!k) continue; const s = localStorage.getItem(k); if (s) return JSON.parse(s); }
    } catch (e) { /* 読めない */ }
    return null;
  },
  exportFile() {
    const blob = new Blob([JSON.stringify(this.data())], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `ore-to-armada-${G.day}日目.json` });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    Toast.show('セーブをファイルに書き出した', 'good');
  },
};

window.addEventListener('load', () => Game.init());
