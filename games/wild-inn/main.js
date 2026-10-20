/* =========================================================================
   WILD INN ― 進行
   起動 / キーとタップ / ループ / タイトルの動物たち
   ========================================================================= */
'use strict';

const Input = {
  keys: new Set(),
  axis() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
    return { x, y };
  },
};
const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];

const Main = {
  running: false, last: 0, down: null, parade: [],

  boot() {
    Render.init();
    UI.init();
    const pref = Save.pref();
    if (pref.sfx === false) Sound.sfxOn = false;
    if (pref.music === false) Sound.musicOn = false;
    this.bindInput();
    window.addEventListener('resize', () => Render.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.running) saveGame(); });
    window.addEventListener('pagehide', () => { if (this.running) saveGame(); });
    ['giraffe', 'dog', 'penguin', 'lion', 'rabbit', 'camel', 'macaw', 'cat', 'zebra', 'fennec', 'polarbear', 'hamster'].forEach((sp, i) => {
      this.parade.push({ k: i / 12, look: { sp, c: 0 }, seed: i });
    });
    requestAnimationFrame((t) => this.loop(t));
  },
  begin() {
    this.running = true;
    R.speed = 1;
    $('title').classList.add('hide');
    UI.showHud();
    Render.cam.cx = 0;
    UI.refresh();
  },
  continueGame() {
    if (!loadGame()) { Toast.show('セーブデータが読めなかった', 'bad'); return; }
    this.begin();
    if (G.phase === 'night') UI.showSummary();
    else Toast.show(`${G.day}日目 ${clockText(G.clock)}`);
  },
  canAct() { return this.running && G && G.phase === 'day' && !Editor.active && !UI.modalOpen(); },
  /* キーで使う。E はいちばん上のボタン */
  key(id) {
    if (!this.canAct()) return;
    const t = Interact.target();
    const acts = Interact.actions(t);
    if (id === 'E' && acts[0]) Interact.use(acts[0].id);
    else {
      const a = acts.find((x) => x.key === id);
      if (a) Interact.use(a.id);
    }
  },

  bindInput() {
    window.addEventListener('keydown', (e) => {
      const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (e.code === 'Escape') {
        if (UI.modalOpen()) UI.close();
        else if (Editor.active) {
          if (Editor.tool || Editor.sel || Editor.pending) { Editor.pending = null; Editor.setTool(null); } else Editor.close();
        }
        return;
      }
      if (typing || !this.running) return;
      if (!this.canAct()) return;
      if (MOVE_KEYS.includes(e.code)) {
        Input.keys.add(e.code); R.player.stop();
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); this.key('E'); }
      else if (e.code === 'KeyF') this.key('F');
      else if (e.code === 'KeyQ') this.key('Q');
      else if (e.code === 'KeyT') UI.answer();
      else if (/^Digit[1-3]$/.test(e.code)) this.key(e.code.slice(5));
    });
    window.addEventListener('keyup', (e) => Input.keys.delete(e.code));
    window.addEventListener('blur', () => Input.keys.clear());
    const cv = Render.cv;
    cv.addEventListener('pointerdown', (e) => {
      Sound.init();
      if (e.pointerType === 'touch') UI.touch = true;
      this.down = { x: e.clientX, y: e.clientY };
      if (this.running && Editor.active) {
        cv.setPointerCapture(e.pointerId);
        Editor.down(Render.toWorld(e.clientX, e.clientY), e.clientX, e.clientY, e.pointerType !== 'mouse');
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.running && Editor.active) Editor.move(Render.toWorld(e.clientX, e.clientY), e.clientX, e.clientY, e.pointerType !== 'mouse');
    });
    const up = (e) => {
      if (!this.down || !this.running) return;
      const moved = dist(this.down.x, this.down.y, e.clientX, e.clientY);
      this.down = null;
      const w = Render.toWorld(e.clientX, e.clientY);
      if (Editor.active) { Editor.up(w, e.clientX, e.clientY, e.pointerType !== 'mouse'); return; }
      if (moved > 14) return;
      this.tapPlay(w);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { this.down = null; if (Editor.active) Editor.drag = null; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerdown', () => Sound.init(), { once: true });
  },
  /* タップした所へ歩く。ペット・受付・階段なら、そこまで行って使う */
  tapPlay(w) {
    if (!this.canAct()) return;
    const p = R.player, f = R.viewFloor;
    let pet = null, bd = 9;
    for (const q of R.pets) {
      if (!q.g || q.floor !== f || q.mode !== 'room') continue;
      const h = SPECIES[q.sp].h / T;
      if (Math.abs(w.x - q.x) < 0.6 && w.y > q.y - h - 0.2 && w.y < q.y + 0.3) {
        const d = dist(w.x, w.y, q.x, q.y - h / 2);
        if (d < bd) { bd = d; pet = q; }
      }
    }
    if (pet) {
      const t = Interact.target();
      if (t && t.pet === pet) { UI.openPet(pet); return; }
      p.goTo(f, Math.floor(pet.x), Math.floor(pet.y));
      return;
    }
    const c = Hotel.counter(), st = Hotel.staffSpot();
    if (f === 0 && w.x >= c.x - 0.5 && w.x < c.x + c.w + 0.5 && w.y >= c.y - 1.2 && w.y < c.y + 2) {
      const open = () => { const v = Desk.front(); if (v) UI.openDesk(v); };
      const t = Interact.target();
      if (t && t.kind === 'desk') { open(); return; }
      if (p.goTo(0, st.x, st.y, open)) return;
    }
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    if (G.floors > 1 && Hotel.isStairs(tx, ty)) {
      p.goTo(f, tx, ty, () => { if (G.floors === 2) p.useStairs(1 - p.floor); });
      return;
    }
    if (Hotel.walk(f, tx, ty)) p.goTo(f, tx, ty);
  },

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    if (this.running && G) {
      const paused = UI.modalOpen() || Editor.active || G.phase !== 'day';
      if (!paused) for (let i = 0; i < R.speed; i++) simUpdate(dt);
      else R.t += dt;
      Render.fit(dt);
      Render.draw();
      UI.tick();
      R.saveT += dt;
      if (R.saveT > 20) { R.saveT = 0; saveGame(); }
    } else {
      this.drawTitle(now / 1000, dt);
      UI.tickSetup(now / 1000);
    }
    Sound.tickMusic(R.speed > 1);
    requestAnimationFrame((t) => this.loop(t));
  },

  /* タイトルの後ろを動物たちが歩く */
  drawTitle(t, dt) {
    const ctx = Render.ctx, d = Render.dpr, w = Render.cw, h = Render.ch;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#bfe8f2'); g.addColorStop(0.55, '#e6f5d8'); g.addColorStop(1, '#f6e2a8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 6; i++) {
      const cx = ((hash2(i, 1) * w + t * 6 * (0.5 + hash2(i, 2))) % (w + 200)) - 100, cy = hash2(i, 3) * h * 0.35 + 20;
      for (const [dx, dy, r] of [[0, 0, 26], [26, 6, 20], [-24, 8, 18]]) { ellipse(ctx, cx + dx, cy + dy, r, r * 0.7); ctx.fill(); }
    }
    const gy = h - 64;
    ctx.fillStyle = '#9fd27e'; ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = '#86c26a'; ctx.fillRect(0, gy, w, 5);
    ctx.save();
    for (let x = 30; x < w; x += 260) {
      ctx.save(); ctx.translate(x, gy - 74); ctx.scale(0.9, 0.9);
      FurnArt.draw(ctx, x % 520 < 260 ? 'acacia' : 'jtree', 0, 0, t);
      ctx.restore();
    }
    ctx.restore();
    const sc = Math.max(1.3, Math.min(2, w / 560));
    const span = Math.max(w / sc + 160, 12 * 90);
    for (const a of this.parade) {
      const x = ((a.k * span + t * 30) % span) - 80;
      ctx.save(); ctx.scale(sc, sc);
      drawPet(ctx, x, (gy + 30) / sc, a.look, { dir: 'r', t: t + a.seed, walk: t * 8 + a.seed, moving: true });
      ctx.restore();
    }
  },
};

window.addEventListener('load', () => Main.boot());
