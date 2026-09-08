/* =========================================================================
   PHANTOM DUEL ― 起動、入力、画面のつなぎ
   ========================================================================= */
'use strict';

const Main = {
  canvas: null, ctx: null,
  cw: 960, ch: 600, dpr: 1,
  last: 0,
  isTouch: false,
  mode: null,          /* null | 'rank' | 'practice' */
  foe: null,
  rematch: false,
  keys: {},
  mouse: { x: 0, y: 0, has: false, left: false, right: false },
  touch: { move: null, aim: null, abil: false, dodge: false },

  init() {
    this.canvas = $('game');
    this.ctx = this.canvas.getContext('2d');
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.bindInput();

    loadGame();
    screenTitle();
    requestAnimationFrame((t) => { this.last = t; this.loop(t); });
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = w; this.ch = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  },

  /* =============================== 入力 =============================== */
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && Battle.on) { this.quit(); return; }
      this.keys[e.key.toLowerCase()] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0 && Battle.on) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.left = false; this.mouse.right = false; });

    const cv = this.canvas;
    cv.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true;
    });
    cv.addEventListener('mousedown', (e) => {
      Sound.ensure();
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) { this.mouse.right = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    /* さわって遊ぶとき */
    const pads = { padMove: 'move', padAim: 'aim' };
    Object.keys(pads).forEach((id) => {
      const pad = $(id);
      const key = pads[id];
      const start = (e) => {
        const t = e.changedTouches ? e.changedTouches[0] : e;
        this.touch[key] = { id: t.identifier == null ? 'm' : t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
        Sound.ensure();
        e.preventDefault();
      };
      const move = (e) => {
        const cur = this.touch[key];
        if (!cur) return;
        const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
        const t = list.find((x) => (x.identifier == null ? 'm' : x.identifier) === cur.id);
        if (!t) return;
        cur.x = t.clientX; cur.y = t.clientY;
        e.preventDefault();
      };
      const end = (e) => {
        const cur = this.touch[key];
        if (!cur) return;
        const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
        if (list.some((x) => (x.identifier == null ? 'm' : x.identifier) === cur.id)) this.touch[key] = null;
      };
      pad.addEventListener('touchstart', start, { passive: false });
      pad.addEventListener('touchmove', move, { passive: false });
      pad.addEventListener('touchend', end);
      pad.addEventListener('touchcancel', end);
    });

    const hold = (id, key) => {
      const b = $(id);
      b.addEventListener('touchstart', (e) => { this.touch[key] = true; e.preventDefault(); }, { passive: false });
      b.addEventListener('touchend', () => { this.touch[key] = false; });
      b.addEventListener('mousedown', () => { this.touch[key] = true; });
      b.addEventListener('mouseup', () => { this.touch[key] = false; });
    };
    hold('btnAbil', 'abil');
    hold('btnDodge', 'dodge');
    $('btnQuit').addEventListener('click', () => this.quit());
  },

  worldFromScreen(px, py) {
    const cam = Battle.cam || { x: ARENA.w / 2, y: ARENA.h / 2, s: 1 };
    return { x: cam.x + (px - this.cw / 2) / cam.s, y: cam.y + (py - this.ch / 2) / cam.s };
  },

  readCommand() {
    const P = Battle.P;
    if (!P) return;
    const k = this.keys;
    const cmd = P.cmd;
    let mx = 0, my = 0;
    if (k['a'] || k['arrowleft']) mx -= 1;
    if (k['d'] || k['arrowright']) mx += 1;
    if (k['w'] || k['arrowup']) my -= 1;
    if (k['s'] || k['arrowdown']) my += 1;

    let atk = !!(k['j'] || this.mouse.left);
    const abil = !!(k['k'] || this.mouse.right || this.touch.abil);
    const dodge = !!(k[' '] || k['l'] || this.touch.dodge);

    /* 向き。マウスならその点、指ならなぞった向き。 */
    let aim = null;
    if (this.touch.move) {
      const t = this.touch.move;
      const dx = t.x - t.ox, dy = t.y - t.oy;
      const m = Math.hypot(dx, dy);
      if (m > 8) { mx = dx / m; my = dy / m; }
    }
    if (this.touch.aim) {
      const t = this.touch.aim;
      const dx = t.x - t.ox, dy = t.y - t.oy;
      const m = Math.hypot(dx, dy);
      if (m > 10) {
        aim = { x: P.x + (dx / m) * 140, y: P.y + (dy / m) * 140 };
        atk = true;
      }
    } else if (this.mouse.has) {
      aim = this.worldFromScreen(this.mouse.x, this.mouse.y);
    }
    if (!aim) {
      const E = Battle.E;
      const t = E ? { x: E.x, y: E.y } : nearestTarget(P, P.x, P.y);
      aim = t ? { x: t.x, y: t.y } : { x: P.x + Math.cos(P.dir) * 80, y: P.y + Math.sin(P.dir) * 80 };
    }

    cmd.mx = mx; cmd.my = my;
    cmd.ax = aim.x; cmd.ay = aim.y;
    cmd.atk = atk;
    /* 能力と回避は押した瞬間だけ拾う */
    cmd.abil = abil && !this.prevAbil;
    cmd.dodge = dodge && !this.prevDodge;
    this.prevAbil = abil;
    this.prevDodge = dodge;
  },

  /* =============================== ループ =============================== */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000) || 0;
    this.last = now;
    if (Battle.on) {
      this.readCommand();
      Battle.update(dt);
      Battle.draw(this.ctx2d(), this.cw, this.ch);
      this.updateHud();
    }
    requestAnimationFrame((t) => this.loop(t));
  },

  ctx2d() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return ctx;
  },

  /* =============================== HUD =============================== */
  updateHud() {
    const P = Battle.P, E = Battle.E;
    $('pName').textContent = P.c.name;
    $('pLv').textContent = 'Lv' + P.c.level;
    $('pHp').style.width = clamp(P.hp / P.maxHp, 0, 1) * 100 + '%';
    $('pGauge').style.width = P.gauge + '%';
    const right = $('hud').lastElementChild;
    if (E) {
      right.style.visibility = 'visible';
      $('eName').textContent = E.c.owner + '「' + E.c.name + '」';
      $('eLv').textContent = 'Lv' + E.c.level;
      $('eHp').style.width = clamp(E.hp / E.maxHp, 0, 1) * 100 + '%';
      $('eGauge').style.width = E.gauge + '%';
      $('hudTimer').textContent = String(Math.max(0, Math.ceil(TIME_LIMIT - Battle.time)));
      $('hudNote').textContent = Battle.stopT > 0 ? '時が止まっている'
        : (P.c.type === 'moot' && P.recharge > 0 ? '溜め中' : '');
    } else {
      right.style.visibility = 'hidden';
      const dmg = Battle.dpsHits.reduce((s, h) => s + h.d, 0);
      $('hudTimer').textContent = Math.round(dmg / 3) + ' DPS';
      $('hudNote').textContent = '経験値 +' + Battle.practiceExp + '　（Esc でやめる）';
    }
  },

  /* =============================== 出入り =============================== */
  enterBattle() {
    hideUI();
    this.canvas.hidden = false;
    $('hud').hidden = false;
    $('touch').hidden = !this.isTouch;
    this.keys = {};
    this.mouse.left = false; this.mouse.right = false; this.mouse.has = false;
    this.touch = { move: null, aim: null, abil: false, dodge: false };
    this.prevAbil = false; this.prevDodge = false;
    Sound.ensure();
  },

  leaveBattle() {
    this.canvas.hidden = true;
    $('hud').hidden = true;
    $('touch').hidden = true;
  },

  startRank(foe, isRematch) {
    this.mode = 'rank';
    this.foe = foe;
    this.rematch = !!isRematch;
    this.enterBattle();
    banner('START', 900);
    Battle.init({ mode: 'rank', char: activeChar(), foe: foe, onEnd: (r) => this.endRank(r) });
  },

  startFree(foe, stageId) {
    this.mode = 'free';
    this.foe = foe;
    this.enterBattle();
    banner('FREE BATTLE', 900);
    Battle.init({
      mode: 'rank', char: activeChar(), foe: foe, stage: stageId,
      onEnd: (r) => this.endFree(r),
    });
  },

  startPractice() {
    this.mode = 'practice';
    this.enterBattle();
    banner('練習場', 900);
    Battle.init({ mode: 'practice', char: activeChar(), onEnd: (r) => this.endPractice(r) });
  },

  endRank(result) {
    this.leaveBattle();
    const foe = this.foe;
    const c = activeChar();
    if (result === 'quit') { screenHome(); return; }
    let gained;
    if (result === 'win') {
      gained = this.rematch ? Math.round(foe.exp / 2) : foe.exp;
      G.wins++;
      const idx = FOES.indexOf(foe);
      if (idx === G.rank) G.rank++;
      Sound.win();
    } else {
      gained = Math.round(foe.exp * 0.25);
      G.losses++;
      Sound.lose();
    }
    c.exp += gained;
    saveGame();
    /* 章の切れ目に来ていたら、結果より先に話を見せる */
    const st = storyAt(G.rank);
    if (result === 'win' && st && G.seenStory.indexOf(st.id) < 0) {
      screenStory(st, () => screenResult(foe, result, gained));
      return;
    }
    screenResult(foe, result, gained);
  },

  /* フリー対戦は物語を進めない。経験値は半分。 */
  endFree(result) {
    this.leaveBattle();
    const foe = this.foe;
    if (result === 'quit') { screenFree(); return; }
    const c = activeChar();
    const gained = Math.round(foe.exp * (result === 'win' ? 0.5 : 0.15));
    if (result === 'win') { G.wins++; Sound.win(); } else { G.losses++; Sound.lose(); }
    c.exp += gained;
    saveGame();
    screenFreeResult(foe, result, gained);
  },

  endPractice() {
    this.leaveBattle();
    const c = activeChar();
    const gained = Battle.practiceExp;
    c.exp += gained;
    saveGame();
    screenPracticeEnd(gained);
  },

  /** バトルを中断する。あと片づけは onEnd 側でやる。 */
  quit() {
    if (Battle.on) Battle.quit();
  },
};

window.addEventListener('DOMContentLoaded', () => Main.init());
