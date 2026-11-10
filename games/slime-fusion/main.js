/* =========================================================================
   SLIME FUSION ― 起動と メインループ
   ========================================================================= */
'use strict';

const canvas = el('game');
const ctx = canvas.getContext('2d');

function resize() {
  G.dpr = Math.min(2, window.devicePixelRatio || 1);
  G.W = innerWidth; G.H = innerHeight;
  canvas.width = Math.floor(G.W * G.dpr); canvas.height = Math.floor(G.H * G.dpr);
}
addEventListener('resize', resize);
resize();

/* タイトルの うしろを あるく スライムたち */
const Parade = {
  list: null,
  draw(ctx, t) {
    if (!this.list) {
      this.list = ['plain', 'fire3', 'water_grass_a', 'dragon', 'cat', 'robo', 'rainbow', 'thunder4', 'devil', 'daiou'].map((id) => {
        const s = sampleOf(id);
        if (id === 'plain') s.parts = autoParts(['horn']);
        if (id === 'water_grass_a') s.parts = autoParts(['spike', 'spike', 'spike', 'spike', 'spike']);
        if (id === 'dragon') s.parts = autoParts(['horn', 'horn', 'wing', 'wing']);
        return s;
      });
    }
    drawRanch(ctx, G.W, G.H, t);
    const k = clamp(Math.min(G.W, G.H) / 700, 0.6, 1.4);
    const step = 120 * k, n = this.list.length, span = step * n;
    for (let i = 0; i < n; i++) {
      const x = ((i * step + t * 40 * k) % span) - step * 0.5;
      const y = G.H * (i % 2 ? 0.86 : 0.93);
      const s = this.list[i];
      const r = slimeR(s, 46 * k);
      const hop = Math.abs(Math.sin(t * 6 + i)) * r * 0.3;
      ctx.save(); ctx.translate(x, y - hop);
      drawSlime(ctx, s, { r, t: t + i, sq: Math.cos(t * 12 + i * 2) * 0.06, look: 0.4, mood: 'happy' });
      ctx.restore();
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
  if (G.mode === 'battle' && Battle.def) { Battle.update(dt); Battle.draw(ctx); }
  else if (G.mode === 'fusion' && Movie.st) { Movie.update(dt); if (Movie.st) Movie.draw(ctx); }
  else if (G.mode === 'editor') { drawRanch(ctx, G.W, G.H, G.time); Editor.draw(); }
  else if (G.mode === 'title' || !P) Parade.draw(ctx, G.time);
  else { Ranch.update(dt); Ranch.draw(ctx); }
}

UI.init();
UI.title();
requestAnimationFrame(frame);

/* テスト用の つまみ。?debug の ときだけ window に 出す */
if (location.search.includes('debug')) window.SF = { G, P: () => P, Battle, Movie, Editor, Lab, UI, Ranch, fusionPlan, performFusion, makeSlime, makeEnemy, calcStats, SP, SPECIES };
