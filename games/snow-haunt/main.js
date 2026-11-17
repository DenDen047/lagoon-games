/* =========================================================================
   SNOW HAUNT ― はじまり と まいフレームの しごと
   タイトル (うしろで お手本の やしきが うごく) / ひる / よる / けっか
   ========================================================================= */
'use strict';

const Game = {
  mode: 'title',   // 'title' | 'day' | 'night' | 'result'
  speed: 1,
  t: 0, last: 0,

  boot() {
    View.init();
    UI.init();
    this.demo();
    const cont = $('btnCont');
    cont.disabled = !Save.has();
    let warn = false;
    $('btnNew').onclick = () => {
      Sound.init();
      if (Save.has() && !warn) { warn = true; $('newWarn').classList.add('show'); return; }
      this.newGame();
    };
    $('btnCont').onclick = () => { Sound.init(); this.continueGame(); };
    $('btnHow').onclick = () => { Sound.init(); UI.openHow(); };
    requestAnimationFrame((ts) => this.loop(ts));
  },

  /* タイトルの うしろで うごく お手本の やしき */
  demo() {
    const s = newState();
    s.expand = 2; s.rep = 70;
    s.grid = s.grid.map(() => CELL.WALL);
    const fl = (x0, x1, y) => { for (let x = x0; x <= x1; x++) s.grid[idx(x, y)] = CELL.FLOOR; };
    fl(0, 12, 2); fl(12, 12, 3); fl(2, 12, 4); fl(2, 2, 5); fl(2, 12, 6); fl(12, 12, 7); fl(1, 12, 8); fl(0, 1, 7);
    s.props = [
      ['candle', 3, 3], ['candle', 8, 5], ['candle', 6, 7], ['icicle', 5, 1], ['snowman', 7, 3], ['portrait', 10, 1], ['mirror', 5, 5], ['coffin', 11, 5], ['musicbox', 10, 7], ['chandelier', 8, 9], ['blizzard', 13, 4],
    ].map(([type, x, y]) => ({ type, x, y }));
    s.ghosts = [['yuki', 2, 3], ['kori', 11, 3], ['yozora', 4, 5], ['oo', 13, 6], ['ousama', 6, 9], ['fubuki', 3, 9]]
      .map(([type, x, y]) => Sim.makeGhost(s, type, x, y));
    Sim.s = s; Sim.demo = true;
    Sim.findPath(); Sim.startNight();
    this.mode = 'title';
  },

  newGame() {
    Sim.demo = false;
    Sim.s = newState();
    this.enterDay();
    this.save();
    UI.openHow();
  },
  continueGame() {
    const s = Save.load();
    if (!s || s.v !== 1) return this.newGame();
    Sim.demo = false;
    Sim.s = s;
    this.enterDay();
  },
  save() { if (!Sim.demo && Sim.s) Save.save(Sim.s); },

  enterDay() {
    this.mode = 'day';
    Sim.n = null;
    Sim.findPath();
    for (const gh of Sim.s.ghosts) Object.assign(gh, { _st: 'idle', _ox: 0, _oy: 0, bub: null });
    for (const p of Sim.s.props) p._anim = 0;
    $('title').classList.add('hide');
    $('hud').classList.remove('hide');
    $('dayBar').classList.remove('hide');
    $('nightBar').classList.add('hide');
    UI.setTool(null);
    UI.refresh();
    View.fit();
  },

  startNight() {
    const s = Sim.s;
    if (!Sim.path) { toast('いりぐちから でぐちまで ろうかが つながっていないよ', 'bad'); Sound.no(); UI.setTool('floor'); return; }
    const idle = s.ghosts.filter((g) => g.x < 0).length;
    if (idle) toast(`まちあい中の オバケが ${idle}にん いるよ (よるは はたらかない)`);
    UI.setTool(null);
    this.mode = 'night'; this.speed = 1;
    Sim.startNight();
    Sound.gong();
    if (s.event) toast(`${EVENTS[s.event].icon} こんやは ${EVENTS[s.event].name}! ${EVENTS[s.event].desc}`);
    $('dayBar').classList.add('hide');
    $('nightBar').classList.remove('hide');
    UI.refresh();
    View.fit();
  },

  endNight() {
    this.mode = 'result';
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
    if (ev) toast(`${EVENTS[ev].icon} こんやは <b>${EVENTS[ev].name}</b>。${EVENTS[ev].desc}`);
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
    if (this.mode === 'title') Sim.update(dt);
    else if (this.mode === 'night') {
      for (let i = 0; i < this.speed; i++) if (Sim.update(dt)) { this.endNight(); break; }
      UI.refresh();
    }
    View.draw(this.t, dt);
    Sound.music(dt, this.mode === 'night' && this.speed > 0);
    requestAnimationFrame((t2) => this.loop(t2));
  },
};

Game.boot();
