/* =========================================================================
   SKYDROP ROYALE ― そうさ と ループ
   PC: WASD + マウス / スマホ: 2本スティック + ボタン
   ========================================================================= */
'use strict';

/* 1フレームぶんの そうさを まとめる */
const Controls = {
  mx: 0, my: 0, aim: 0, fire: false, release: false, jump: false, slot: null, cycle: 0, reload: false,
  build: false, mat: null, shape: false, interact: false, drop: false, place: false, promptText: '',
  tap: {},   // スマホの ボタンが おされた
  aimWorld() {
    if (Input.touch) {
      const me = Game.me;
      const mag = Math.hypot(Input.aim.x, Input.aim.y) || 0.6;
      return { x: me.x + Math.cos(this.aim) * (120 + mag * 380), y: me.y + Math.sin(this.aim) * (120 + mag * 380) };
    }
    return Render.toWorld(Input.mx, Input.my);
  },
  read() {
    const t = this.tap;
    const me = Game.me;
    this.slot = null; this.cycle = 0; this.mat = null;
    let mx = 0, my = 0;
    if (Input.down('w') || Input.down('ArrowUp')) my -= 1;
    if (Input.down('s') || Input.down('ArrowDown')) my += 1;
    if (Input.down('a') || Input.down('ArrowLeft')) mx -= 1;
    if (Input.down('d') || Input.down('ArrowRight')) mx += 1;
    if (Input.move.on) { mx = Input.move.x; my = Input.move.y; }
    this.mx = mx; this.my = my;

    this.jump = Input.hit(' ') || !!t.jump;
    this.reload = Input.hit('r') || !!t.reload;
    this.build = Input.hit('q') || Input.hit('f') || !!t.build;
    this.shape = Input.hit('x') || !!t.shape;
    this.interact = Input.hit('e') || !!t.interact;
    this.drop = Input.hit('g');
    if (Input.hit('m') || Input.hit('Tab') || t.map) Render.bigMap = !Render.bigMap;
    if (t.slot !== undefined) this.slot = t.slot;
    if (t.mat !== undefined) this.mat = t.mat;

    if (me && me.buildMode) {
      for (let i = 1; i <= 3; i++) if (Input.hit(String(i))) this.mat = i - 1;
      if (Input.wheel) this.mat = ((me.matSel || 0) + (Input.wheel > 0 ? 1 : 2)) % 3;
    } else {
      for (let i = 1; i <= 6; i++) if (Input.hit(String(i))) this.slot = i - 1;
      if (Input.wheel) this.cycle = Input.wheel > 0 ? 1 : -1;
    }

    if (Input.touch) {
      const A = Input.aim;
      const mag = Math.hypot(A.x, A.y);
      if (A.on && mag > 0.15) this.aim = Math.atan2(A.y, A.x);
      else if (Math.hypot(mx, my) > 0.2 && !A.on) this.aim = Math.atan2(my, mx);
      // ねらいの おてつだい（スマホだけ）
      if (A.on && me && me.alive && !me.air) this.aim = this.assist(me, this.aim);
      const s = me ? curItem(me) : null;
      const w = s && s.kind === 'w' ? (s.id === 'pickaxe' ? PICKAXE : WEAPONS[s.id]) : null;
      const onRelease = w && (w.charge || w.cat === 'throw' || w.proj === 'grenade' || w.proj === 'deploy');
      if (onRelease && w.charge) { this.fire = A.on && mag > 0.3; this.release = A.released; }
      else if (onRelease) { this.fire = A.released && mag > 0.2; this.release = false; }
      else { this.fire = (A.on && mag > 0.45) || !!t.fireHold; this.release = A.released; }
      if (s && s.kind === 'h') this.fire = !!t.useHeal || (A.on && mag > 0.45);
      this.place = me && me.buildMode && (!!t.place || (A.on && mag > 0.5));
    } else {
      if (me && me.alive) { const a = Render.toWorld(Input.mx, Input.my); this.aim = Math.atan2(a.y - (me.y - 4), a.x - me.x); }
      this.fire = Input.mdown;
      this.release = Input.mrelease;
      this.place = me && me.buildMode && Input.mdown;
    }
    this.tap = {};
  },
  assist(me, a) {
    let best = null, bd = 0.22;
    for (const q of Game.near(me.x, me.y, 700)) {
      if (q === me || !q.alive || q.air) continue;
      const d = Math.abs(angDiff(a, Math.atan2(q.y - me.y, q.x - me.x)));
      if (d < bd && World.los(me.x, me.y, q.x, q.y)) { bd = d; best = q; }
    }
    return best ? a + angDiff(a, Math.atan2(best.y - me.y, best.x - me.x)) * 0.6 : a;
  },
};

/* ------------------------------ 画面サイズ ------------------------------ */
function resize() {
  G.dpr = Math.min(window.devicePixelRatio || 1, 2);
  G.W = window.innerWidth; G.H = window.innerHeight;
  canvas.width = Math.round(G.W * G.dpr); canvas.height = Math.round(G.H * G.dpr);
}

/* ------------------------------ マウス / タッチ ------------------------------ */
function setupInput() {
  canvas.addEventListener('mousemove', (e) => { Input.mx = e.clientX; Input.my = e.clientY; });
  canvas.addEventListener('mousedown', (e) => {
    Sfx.unlock();
    if (e.button === 2) { Input.mright = true; return; }
    if (G.mode === 'match' && Render.bigMap) { Render.bigMap = false; return; }
    if (G.mode === 'match' && HUD.mapRect && inRect(e.clientX, e.clientY, HUD.mapRect)) { Render.bigMap = true; return; }
    if (G.mode === 'match') {
      for (const r of HUD.slotRects) if (inRect(e.clientX, e.clientY, r)) { Controls.tap.slot = r.i; return; }
      for (const r of HUD.matRects) if (inRect(e.clientX, e.clientY, r)) { Controls.tap.mat = r.i; return; }
    }
    Input.mdown = true; Input.mclick = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 2) Input.mright = false; else { if (Input.mdown) Input.mrelease = true; Input.mdown = false; } });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { Input.wheel = Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

  const R = () => 60 * HUD.u;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    Sfx.unlock();
    if (!Input.touch) { Input.touch = true; document.body.classList.add('touch'); }
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (G.mode !== 'match') continue;
      if (Render.bigMap) { Render.bigMap = false; continue; }
      if (HUD.mapRect && inRect(x, y, HUD.mapRect)) { Render.bigMap = true; continue; }
      let hit = false;
      for (const r of HUD.slotRects) if (inRect(x, y, r)) { Controls.tap.slot = r.i; hit = true; }
      for (const r of HUD.matRects) if (inRect(x, y, r)) { Controls.tap.mat = r.i; hit = true; }
      if (hit) continue;
      if (x < G.W * 0.45 && Input.move.id === null) Object.assign(Input.move, { id: t.identifier, ox: x, oy: y, x: 0, y: 0, on: true });
      else if (x >= G.W * 0.45 && Input.aim.id === null) Object.assign(Input.aim, { id: t.identifier, ox: x, oy: y, x: 0, y: 0, on: true });
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      for (const S of [Input.move, Input.aim]) {
        if (S.id !== t.identifier) continue;
        let dx = (t.clientX - S.ox) / R(), dy = (t.clientY - S.oy) / R();
        const m = Math.hypot(dx, dy);
        if (m > 1) { S.ox += (dx / m) * (m - 1) * R(); S.oy += (dy / m) * (m - 1) * R(); dx /= m; dy /= m; }
        S.x = dx; S.y = dy;
      }
    }
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (Input.move.id === t.identifier) Object.assign(Input.move, { id: null, on: false, x: 0, y: 0 });
      if (Input.aim.id === t.identifier) Object.assign(Input.aim, { id: null, on: false, released: true });
    }
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);

  // スマホの ボタン
  const btn = (id, f) => { const el = document.getElementById(id); if (!el) return; el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); Sfx.unlock(); f(); }, { passive: false }); el.addEventListener('click', f); };
  btn('tJump', () => (Controls.tap.jump = true));
  btn('tBuild', () => (Controls.tap.build = true));
  btn('tReload', () => (Controls.tap.reload = true));
  btn('tUse', () => (Controls.tap.interact = true));
  btn('tShape', () => (Controls.tap.shape = true));
  btn('tPlace', () => (Controls.tap.place = true));
  btn('tHeal', () => (Controls.tap.useHeal = true));
  document.getElementById('btnPause').addEventListener('click', () => UI.pause());
}
function inRect(x, y, r) { return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h; }

/* スマホの スティックを かく */
function drawSticks() {
  if (!Input.touch || G.mode !== 'match') return;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  const R = 60 * HUD.u;
  for (const [S, col] of [[Input.move, '#ffffff'], [Input.aim, '#ff7a5a']]) {
    if (!S.on) continue;
    ctx.globalAlpha = 0.35; circle(ctx, S.ox, S.oy, R, 'rgba(255,255,255,0.15)', '#ffffff', 2);
    ctx.globalAlpha = 0.7; circle(ctx, S.ox + S.x * R, S.oy + S.y * R, R * 0.42, col, null);
    ctx.globalAlpha = 1;
  }
  if (!Input.move.on && !Input.aim.on && Game.me.alive && !Game.me.air) {
    ctx.globalAlpha = 0.5;
    HUD.text('ひだりで いどう', G.W * 0.2, G.H * 0.62, 13 * HUD.u, '#ffffff');
    HUD.text('みぎで ねらって うつ', G.W * 0.78, G.H * 0.62, 13 * HUD.u, '#ffffff');
    ctx.globalAlpha = 1;
  }
}

/* スマホの ボタンの みえかた */
function syncTouchButtons() {
  if (!Input.touch) return;
  const me = Game.me;
  const inMatch = G.mode === 'match' && me && me.alive;
  const show = (id, on) => document.getElementById(id).classList.toggle('hidden', !on);
  show('tJump', inMatch && (me.air === 'bus' || me.air === 'fall'));
  const ground = inMatch && !me.air;
  show('tBuild', ground); show('tReload', ground && !me.buildMode); show('tShape', ground && me.buildMode); show('tPlace', ground && me.buildMode);
  show('tUse', ground && !!Controls.promptText);
  const s = ground ? curItem(me) : null;
  show('tHeal', ground && s && s.kind === 'h');
  document.getElementById('tUse').textContent = Controls.promptText ? '✋ ' + Controls.promptText.replace('ひろう: ', '').replace('いれかえる: ', '⇄ ').slice(0, 14) : '✋';
  document.getElementById('tBuild').classList.toggle('on', ground && me.buildMode);
  document.getElementById('tJump').textContent = me && me.air === 'fall' ? '🪂 ひらく' : '⬇ とびおりる';
}

/* ------------------------------ ループ ------------------------------ */
let last = 0, accum = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  if (G.mode === 'match') {
    if (!G.paused) {
      Controls.read();
      Game.update(dt);
      Render.updateCam(dt);
    }
    Render.draw();
    drawSticks();
    syncTouchButtons();
  } else if (G.mode === 'lobby') {
    G.time += dt;
    UI.drawLobby(dt);
  }
  Input.endFrame();
}

function boot() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  Save.load();
  Sfx.on = Save.d.opt.sound !== false;
  resize();
  addEventListener('resize', resize);
  setupInput();
  UI.init();
  if (matchMedia('(pointer: coarse)').matches) { Input.touch = true; document.body.classList.add('touch'); }
  requestAnimationFrame(frame);
}
boot();
