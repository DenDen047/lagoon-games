/* =========================================================================
   STAR FLICK ― 起動とメインループ
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

/* タイトルとメニューの背景。宇宙ステーションのまわりを船が回っている絵 */
const Backdrop = {
  ships: [
    { hull: 'nova', col: '#4fd1ff', parts: { core: 'core_ur', jet: 'jet_sr', gyro: 'gyro_sr' }, side: 0, r0: 0.34, sp: 0.35, ph: 0 },
    { hull: 'claw', col: '#ff5a4a', parts: { core: 'core_r' }, side: 1, r0: 0.34, sp: 0.35, ph: Math.PI },
    { hull: 'ring', col: '#57e39b', parts: { gyro: 'gyro_r' }, side: 0, r0: 0.22, sp: -0.5, ph: 1 },
    { hull: 'manta', col: '#ff5ab0', parts: { jet: 'jet_n' }, side: 1, r0: 0.22, sp: -0.5, ph: 1 + Math.PI },
    { hull: 'sting', col: '#ffd84a', parts: { barrier: 'bar_r' }, side: 0, r0: 0.44, sp: 0.22, ph: 2.2 },
  ],
  draw(ctx, t) {
    const W = G.W, H = G.H;
    drawBackground(ctx, 'station', t, W, H);
    const cx = W * (W > 820 ? 0.72 : 0.5), cy = H * (W > 820 ? 0.5 : 0.2);
    const R = Math.min(W, H) * (W > 820 ? 1 : 0.8);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(120,200,255,0.12)'; ctx.lineWidth = 2;
    for (const k of [0.22, 0.34, 0.44]) { ctx.beginPath(); ctx.ellipse(0, 0, R * k, R * k * 0.55, 0, 0, TAU); ctx.stroke(); }
    const sc = clamp(R / 900, 0.55, 1.2);
    const list = this.ships.map((s) => {
      const a = s.ph + t * s.sp;
      return { s, a, x: Math.cos(a) * R * s.r0, y: Math.sin(a) * R * s.r0 * 0.55 };
    }).sort((p, q) => p.y - q.y);
    for (const { s, a, x, y } of list) {
      const vx = -Math.sin(a) * s.sp, vy = Math.cos(a) * s.sp * 0.55;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc * 1.4, sc * 1.4);
      for (let i = 1; i < 8; i++) {
        ctx.fillStyle = rgba(TEAM[s.side], 0.12 - i * 0.012);
        ctx.beginPath(); ctx.arc(-vx * i * 26, -vy * i * 26, 18 - i, 0, TAU); ctx.fill();
      }
      teamRing(ctx, HULLS[s.hull].r, s.side, t);
      ctx.rotate(Math.atan2(vy, vx) + (s.hull === 'ring' ? t * 3 : 0));
      drawShip(ctx, s, { t, jet: Math.sin(t * 1.3 + s.ph) > 0.7 });
      ctx.restore();
    }
    ctx.restore();
    const g = ctx.createLinearGradient(0, 0, W * 0.6, 0);
    g.addColorStop(0, 'rgba(4,8,20,0.75)'); g.addColorStop(1, 'rgba(4,8,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  /* 1フレームで何か失敗しても、ループだけは止めない */
  requestAnimationFrame(frame);
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  if (G.mode === 'battle' && Battle.W) {
    const paused = !el('modal').classList.contains('hidden');
    if (!paused) Battle.update(dt);
    Battle.draw(ctx);
  } else {
    Backdrop.draw(ctx, G.time);
  }
  UI.tick();
  Input.endFrame();
}

Prof.load();
Input.init(canvas);
UI.init();
UI.title();
requestAnimationFrame(frame);

/* テスト用のつまみ。?debug のときだけ window に出す */
if (location.search.includes('debug')) window.SF = { G, Battle, UI, Prof, P: () => P, STAGES, CAMPAIGN };
