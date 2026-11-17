/* =========================================================================
   SNOW HAUNT ― はじまり と まいフレームの しごと
   タイトル (うしろで お手本の パークが うごく) / なまえ / ムービー / ひる / よる / けっか
   ========================================================================= */
'use strict';

const Game = {
  mode: 'title',   // 'title' | 'movie' | 'day' | 'night' | 'result'
  speed: 1,
  t: 0, last: 0,

  boot() {
    View.init();
    UI.init();
    this.demo();
    $('btnCont').disabled = !Save.has();
    let warn = false;
    $('btnNew').onclick = () => {
      Sound.init();
      if (Save.has() && !warn) { warn = true; $('newWarn').classList.add('show'); return; }
      $('title').classList.add('hide'); $('setup').classList.remove('hide');
      $('inPark').focus();
    };
    $('btnBack').onclick = () => { $('setup').classList.add('hide'); $('title').classList.remove('hide'); };
    $('btnStart').onclick = () => this.newGame($('inPark').value.trim() || 'ゆきやま ゴーストランド');
    $('btnCont').onclick = () => { Sound.init(); this.continueGame(); };
    $('btnHow').onclick = () => { Sound.init(); UI.openHow(); };
    $('mvSkip').onclick = (e) => { e.stopPropagation(); Movie.finish(); };
    $('movie').addEventListener('pointerdown', () => Movie.next());
    requestAnimationFrame((ts) => this.loop(ts));
  },

  /* タイトルの うしろで うごく お手本の パーク */
  demo() {
    const s = newState();
    s.expand = 2; s.rep = 70; s.costume = 'vampire'; s.park = 'ゆきやま ゴーストランド';
    s.grid = s.grid.map(() => CELL.WALL);
    const fl = (x0, x1, y) => { for (let x = x0; x <= x1; x++) s.grid[idx(x, y)] = CELL.FLOOR; };
    fl(0, 12, 2); fl(12, 12, 3); fl(2, 12, 4); fl(2, 2, 5); fl(2, 12, 6); fl(12, 12, 7); fl(1, 12, 8); fl(0, 1, 7);
    s.props = [
      ['candle', 3, 3], ['candle', 8, 5], ['candle', 6, 7], ['icicle', 5, 1], ['snowman', 7, 3], ['portrait', 10, 1], ['mirror', 5, 5], ['coffin', 11, 5], ['musicbox', 10, 7], ['chandelier', 8, 9],
    ].map(([type, x, y]) => ({ type, x, y }));
    s.ghosts = [['yuki', 2, 3], ['kori', 11, 3], ['yozora', 4, 5], ['skull', 13, 6], ['ousama', 6, 9], ['fubuki', 3, 9], ['robo', 13, 4]]
      .map(([type, x, y]) => Sim.makeGhost(s, type, x, y));
    const desk = Sim.makeGhost(s, 'chibi'); desk.desk = true; s.ghosts.push(desk);
    s.deco = [['lantern', -3, 10], ['balloon', -3, 12], ['cocoa', 0, 10], ['lights', 1, 13], ['carousel', 9, 12], ['wheel', 12, 12], ['hotel', 13, 13], ['station', 3, 11], ['skelpop', 6, 10], ['spider', 4, 13], ['pumpkin', 0, 13], ['photo', 10, 10]]
      .map(([type, x, y]) => ({ type, x, y }));
    s.rails = [];
    for (let x = 4; x <= 7; x++) s.rails.push({ x, y: 11 });
    for (let x = 3; x <= 7; x++) s.rails.push({ x, y: 12 });
    s.rails.push({ x: 7, y: 11 });
    s.rails = s.rails.filter((r, i, a) => a.findIndex((q) => q.x === r.x && q.y === r.y) === i);
    Sim.s = s; Sim.demo = true;
    Sim.findPath(); Sim.findTrack();
    Sim.p = null; Sim.startNight();
    Sim.resetPlayer(true); Sim.p.x = 7.5; Sim.p.y = 4.5;
    if (Sim.n.coaster) Sim.n.coaster.pending = 999;
    this.mode = 'title';
  },

  newGame(name) {
    Sim.demo = false;
    Sim.s = newState();
    Sim.s.park = name;
    Sim.findPath(); Sim.findTrack(); Sim.resetPlayer(false);
    $('setup').classList.add('hide');
    this.save();
    this.playMovie(() => { this.enterDay(); UI.openHow(); });
  },
  continueGame() {
    const s = Save.load();
    if (!s || s.v !== 1) return this.newGame('ゆきやま ゴーストランド');
    // まえの はんの セーブに ない ものを たす
    const base = newState();
    for (const k of ['park', 'costume', 'wardrobe', 'deco', 'rails']) if (s[k] == null) s[k] = base[k];
    Sim.demo = false;
    Sim.s = s;
    this.enterDay();
  },
  save() { if (!Sim.demo && Sim.s) Save.save(Sim.s); },

  playMovie(done) {
    this.mode = 'movie';
    $('title').classList.add('hide'); $('hud').classList.add('hide');
    Movie.start(done);
  },
  replayMovie() { this.playMovie(() => this.enterDay()); },

  enterDay() {
    this.mode = 'day';
    Sim.n = null;
    Sim.findPath(); Sim.findTrack(); Sim.resetPlayer(false);
    for (const gh of Sim.s.ghosts) Object.assign(gh, { _st: 'idle', _ox: 0, _oy: 0, bub: null });
    for (const p of Sim.s.props) p._anim = 0;
    $('title').classList.add('hide');
    $('hud').classList.remove('hide');
    $('dayBar').classList.remove('hide');
    $('nightBar').classList.add('hide');
    $('ctrl').classList.add('hide');
    UI.setTool(null);
    UI.refresh();
    View.fit();
  },

  startNight() {
    const s = Sim.s;
    if (!Sim.path) { toast('いりぐちから でぐちまで ろうかが つながっていないよ', 'bad'); Sound.no(); UI.setTool('floor'); return; }
    const idle = s.ghosts.filter((g) => g.x < 0 && !g.desk).length;
    if (idle) toast(`まちあい中の なかまが ${idle}にん いるよ (よるは はたらかない)`);
    UI.setTool(null);
    this.mode = 'night'; this.speed = 1;
    Sim.startNight();
    Sim.resetPlayer(!!Sim.deskGhost());
    if (!Sim.deskGhost()) toast('カウンターに うけつけ係が いないよ。カウンターへ いって「うけつけ」ボタンで おかねを もらおう');
    Sound.gong();
    if (s.event) toast(`こんやは ${EVENTS[s.event].name}! ${EVENTS[s.event].desc}`);
    $('dayBar').classList.add('hide');
    $('nightBar').classList.remove('hide');
    $('ctrl').classList.remove('hide');
    UI.refresh();
    View.fit();
  },

  endNight() {
    this.mode = 'result';
    $('ctrl').classList.add('hide');
    const r = Sim.endNight();
    UI.refresh();
    UI.showResults(r);
    this.save();
  },

  nextDay() {
    Sim.nextDay();
    Sim.checkMission();
    this.enterDay();
    this.save();
    const ev = Sim.s.event;
    if (ev) toast(`こんやは <b>${EVENTS[ev].name}</b>。${EVENTS[ev].desc}`);
  },

  toTitle() {
    this.save();
    $('hud').classList.add('hide');
    $('title').classList.remove('hide');
    $('btnCont').disabled = !Save.has();
    this.demo();
    View.fit();
  },

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0);
    this.last = ts;
    this.t += dt;
    if (this.mode === 'movie') {
      Movie.update(dt);
      View.g.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
      Movie.draw(View.g, View.W, View.H);
    } else {
      if (this.mode === 'title') Sim.update(dt);
      else if (this.mode === 'night') {
        UI.readInput();
        for (let i = 0; i < this.speed; i++) if (Sim.update(dt)) { this.endNight(); break; }
        UI.refresh();
      }
      View.draw(this.t, dt);
    }
    Sound.music(dt, this.mode === 'night' && this.speed > 0);
    requestAnimationFrame((t2) => this.loop(t2));
  },
};

Game.boot();
