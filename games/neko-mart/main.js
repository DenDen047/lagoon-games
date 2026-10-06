/* =========================================================================
   NEKO MART ― 進行
   起動 / キーとタップ / ループ / タイトルの猫
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
  running: false, last: 0, down: null, titleCats: [],

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
    const walkers = [
      { sp: 'cat', coat: 'gray', eye: EYES[1], neck: 'scarf' },
      { sp: 'dog', coat: 0, body: 'tshirt', bodyCol: '#6cc3e8' },
      { sp: 'cat', coat: 'siam', eye: EYES[2], eye2: EYES[1], head: 'ribbon' },
      { sp: 'rabbit', coat: 0, body: 'dress', bodyCol: '#ffb3c8' },
      { sp: 'cat', coat: 'orange', eye: EYES[0], head: 'straw' },
      { sp: 'panda', coat: 0, neck: 'bowtie' },
    ];
    walkers.forEach((look, i) => this.titleCats.push({ x: i * 90 + rint(0, 30), look: { ...look, size: 1, seed: i } }));
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
    if (G.phase === 'summary') UI.showSummary();
    else Toast.show(`${G.day}日目 ${WEATHER[G.weather].icon} ${WEATHER[G.weather].name}`);
  },
  action() {
    if (!this.running || Editor.active || UI.modalOpen() || G.phase === 'summary') return;
    const t = Interact.target();
    if (t) Interact.use(t);
  },

  bindInput() {
    window.addEventListener('keydown', (e) => {
      const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (e.code === 'Escape') {
        if (Paint.el && !Paint.el.classList.contains('hide')) Paint.close();
        else if (UI.modalOpen()) UI.close();
        else if (Editor.active) {
          if (Editor.tool || Editor.sel) { Editor.sel = null; Editor.setTool(null); } else Editor.close();
        }
        return;
      }
      if (typing || !this.running) return;
      if (MOVE_KEYS.includes(e.code)) {
        if (!UI.modalOpen() && !Editor.active) { Input.keys.add(e.code); R.player.path = null; }
        e.preventDefault();
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        if (!e.repeat) this.action();
      }
    });
    window.addEventListener('keyup', (e) => Input.keys.delete(e.code));
    window.addEventListener('blur', () => Input.keys.clear());
    const cv = Render.cv;
    cv.addEventListener('pointerdown', (e) => {
      Sound.init();
      if (e.pointerType === 'touch') UI.touch = true;
      this.down = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('pointermove', (e) => {
      if (Editor.active && e.pointerType === 'mouse') Editor.hoverAt(Render.toWorld(e.clientX, e.clientY));
    });
    cv.addEventListener('pointerup', (e) => {
      if (!this.down || !this.running) return;
      const moved = dist(this.down.x, this.down.y, e.clientX, e.clientY);
      this.down = null;
      if (moved > 14) return;
      const w = Render.toWorld(e.clientX, e.clientY);
      if (Editor.active) Editor.tap(w, e.pointerType !== 'mouse');
      else this.tapPlay(w);
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerdown', () => Sound.init(), { once: true });
  },
  /* タップした所へ歩く。家具をタップしたら、その前まで歩いて使う */
  tapPlay(w) {
    if (!G || UI.modalOpen() || G.phase === 'summary') return;
    const p = R.player;
    const f = Editor.furnAtScreen(w);
    if (f) {
      const near = Interact.target();
      if (near && near.f === f) { Interact.use(near); return; }
      const tiles = (f.type === 'register' ? [Shop.cashTile(f)] : Shop.access(f))
        .filter((a) => Shop.walk(a.x, a.y))
        .sort((a, b) => dist(a.x + 0.5, a.y + 0.5, p.x, p.y) - dist(b.x + 0.5, b.y + 0.5, p.x, p.y));
      for (const a of tiles) if (p.walkTo(a.x, a.y, { f, kind: f.type })) return;
      Sound.play('error');
      return;
    }
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    if (Shop.walk(tx, ty)) p.walkTo(tx, ty);
  },

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    if (this.running && G) {
      const paused = UI.modalOpen() || Editor.active || G.phase === 'summary';
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

  /* タイトルの後ろを猫が歩く */
  drawTitle(t, dt) {
    const ctx = Render.ctx, d = Render.dpr, w = Render.cw, h = Render.ch;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffe9d6'); g.addColorStop(1, '#ffd0dc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 14; i++) {
      const x = (hash2(i, 1) * w + t * 8 * (0.5 + hash2(i, 2))) % (w + 60) - 30, y = hash2(i, 3) * h;
      ctx.font = `${16 + hash2(i, 4) * 18}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.globalAlpha = 0.35;
      ctx.fillText('🐾', x, y);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e9c7a8'; ctx.fillRect(0, h - 70, w, 70);
    ctx.fillStyle = '#dcb594'; ctx.fillRect(0, h - 70, w, 6);
    const sc = Math.max(1.4, Math.min(2.2, w / 500));
    for (const c of this.titleCats) {
      c.x += dt * 34;
      if (c.x > w / sc + 30) c.x = -30;
      ctx.save(); ctx.scale(sc, sc);
      drawAnimal(ctx, c.x, (h - 26) / sc, c.look, { dir: 'r', t, walk: t * 9 + c.look.seed, moving: true, basket: c.look.seed % 2 ? ['onigiri', 'milk'] : null });
      ctx.restore();
    }
  },
};

window.addEventListener('load', () => Main.boot());
