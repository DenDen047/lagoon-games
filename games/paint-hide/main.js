/* =========================================================================
   PAINT & HIDE ― 起動とメインループ
   ========================================================================= */
'use strict';

const canvas = el('game');
const ctx = canvas.getContext('2d');

function resize() {
  G.dpr = Math.min(2, window.devicePixelRatio || 1);
  G.W = innerWidth; G.H = innerHeight;
  canvas.width = Math.floor(G.W * G.dpr); canvas.height = Math.floor(G.H * G.dpr);
  if (Game.player) Game.resize();
  if (Editor.isOpen()) Editor.fit();
}
addEventListener('resize', resize);
resize();

/* タイトルの うしろ。まるい キャラクターたちが 歩いていて、1人は ゆかに とけこんで かくれている */
const Backdrop = {
  skins: null,
  draw(ctx, t, dt) {
    const W = G.W, H = G.H;
    if (!this.skins) this.skins = Array.from({ length: 7 }, () => randomSkin());
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0d1d3a'); sky.addColorStop(1, '#23406a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    /* ゆかの もよう (ホールの 板) */
    const short = H < 520;
    const gy = short ? H * 0.82 : H * 0.7;
    ctx.fillStyle = '#b5814f'; ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = '#a87444';
    for (let y = gy; y < H; y += 18) if (Math.floor((y - gy) / 18) % 2) ctx.fillRect(0, y, W, 18);
    ctx.strokeStyle = 'rgba(60,30,10,0.25)'; ctx.lineWidth = 1;
    for (let y = gy; y < H; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (const [x, c, r] of [[0.12, '#e8403f', 26], [0.3, '#f5c932', 20], [0.55, '#3a7bf0', 24], [0.8, '#34b86a', 22]]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(W * x, gy + 60, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(W * x - r * 0.35, gy + 60 - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
    }
    const sc = short ? 1.1 : clamp(Math.min(W, H) / 300, 1.6, 3);
    const step = 70 * sc, span = step * 9 + W;
    for (let i = 0; i < this.skins.length; i++) {
      const x = ((i * step + t * 50 * sc) % span) - step;
      drawChar(ctx, this.skins[i], x, short ? H - 6 : gy + 40 * sc, { moving: true, walk: t * 10 + i, scale: sc, gun: i === 3 ? 0 : null, ring: i === 3 ? '#e8403f' : null });
    }
  },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  /* 1フレームで 何か 失敗しても、ループだけは 止めない */
  requestAnimationFrame(frame);
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  if (Game.player && (G.mode === 'play' || G.mode === 'over')) { Game.update(dt); Game.draw(ctx); }
  else Backdrop.draw(ctx, G.time, dt);
  UI.tick();
  Input.endFrame();
}

/* ほかの タブに うつったら ひとやすみ */
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') UI.pause(); });

G.auto = /[?&]auto/.test(location.search);
Input.init(canvas);
UI.init();
UI.title();
requestAnimationFrame(frame);

/* テスト用の つまみ。?debug の ときだけ window に 出す */
if (/[?&]debug/.test(location.search)) {
  window.WF = {
    G, Game, UI, Editor, Input,
    /* 画面を描かずに 1ゲームを 最後まで 進める (全員コンピューター) */
    sim(opts = {}) {
      G.auto = true;
      Game.start(Object.assign({ role: 'random', oni: 1, auto: true }, opts));
      G.mode = 'play';
      let n = 0;
      while (!Game.winner && n < 30 * 200) { Game.update(1 / 30); G.time += 1 / 30; n++; }
      G.auto = false;
      const hs = Game.agents.filter((a) => a.role === 'hider');
      const r = { winner: Game.winner && Game.winner.team, t: Math.round(Game.clock), caught: hs.filter((a) => !a.alive).length, of: hs.length,
        spotSafe: hs.filter((a) => a.alive && a.inSpot).length, camoSafe: hs.filter((a) => a.alive && !a.inSpot).length };
      G.mode = 'title';
      return r;
    },
  };
}
