/* =========================================================================
   DEAD DRIVE ― 起動とメインループ
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

/* タイトルと基地の背景。夜の道路で、車がゾンビに囲まれている絵 */
const Backdrop = {
  zs: [],
  init() {
    this.zs = [];
    const types = ['walker', 'walker', 'walker', 'runner', 'fat', 'walker', 'spitter', 'walker', 'bomber', 'walker', 'armored', 'dog'];
    for (let i = 0; i < 26; i++) {
      const z = new Zombie(types[i % types.length], 0, 0, { hp: 1, speed: 1, dmg: 1 });
      z.a0 = rand(TAU); z.d0 = rand(230, 620); z.face = z.a0 + Math.PI;
      this.zs.push(z);
    }
  },
  draw(ctx, t) {
    const W = G.W, H = G.H;
    ctx.fillStyle = asphaltPattern(ctx); ctx.fillRect(0, 0, W, H);
    const cx = W * (W > 800 ? 0.68 : 0.5), cy = H * (W > 800 ? 0.56 : 0.27);
    const sc = clamp(Math.min(W, H) / 330, 1.3, 3.2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    /* 道路 */
    ctx.fillStyle = '#26282c'; ctx.fillRect(-90, -2000, 180, 4000);
    ctx.strokeStyle = 'rgba(240,200,80,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([34, 26]); ctx.lineDashOffset = -t * 80;
    ctx.beginPath(); ctx.moveTo(0, -2000); ctx.lineTo(0, 2000); ctx.stroke(); ctx.setLineDash([]);
    for (const z of this.zs) {
      const d = (z.d0 - ((t * 14 + z.d0) % 420) * 0.25) * 0.62;
      z.x = Math.cos(z.a0) * d; z.y = Math.sin(z.a0) * d * 0.8;
      z.anim = t * 5 + z.a0 * 10;
      z.face = Math.atan2(-z.y, -z.x);
      z.draw(ctx);
    }
    /* 車（はじめの車） */
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    const d = START_DESIGN;
    const cxr = 2, cyr = 3.1;
    for (const c of d) {
      ctx.save();
      ctx.translate((cyr - c.r) * CS, (c.c - cxr) * CS);
      const open = [[0, -1], [1, 0], [0, 1], [-1, 0]].reduce((o, [dc, dr], i) => (d.some((x) => x.c === c.c + dc && x.r === c.r + dr) ? o : o | (1 << i)), 0);
      drawPart(ctx, c.t, c.rot || 0, CS, { open, time: t, spin: (t * 3) % 1, aim: c.t === 'mg' ? Math.sin(t * 1.3) * 0.4 : undefined });
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
    /* 暗く、前照灯だけ明るく */
    const g = ctx.createRadialGradient(cx, cy - 70 * sc, 20 * sc, cx, cy - 70 * sc, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(5,8,18,0.05)'); g.addColorStop(0.35, 'rgba(5,8,18,0.55)'); g.addColorStop(1, 'rgba(5,8,18,0.93)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (Math.random() < 0.02) { ctx.fillStyle = 'rgba(255,230,160,0.05)'; ctx.fillRect(0, 0, W, H); }
  },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  if (G.mode === 'drive') {
    if (Input.consume('pause')) UI.pause();
    else sceneUpdate(dt);
  }
  const live = S && (G.mode === 'drive' || G.mode === 'perk' || G.mode === 'pause' || G.mode === 'result');
  if (S && (G.mode === 'drive' || (G.mode === 'result' && S.over))) FX.update(dt);
  if (live) {
    sceneDraw(ctx, G.mode === 'drive' || G.mode === 'result' ? dt : 0);
    UI.updateHud(dt);
  } else {
    Backdrop.draw(ctx, G.time);
    if (G.mode === 'base' && Input.consume('pause')) UI.pause();
    if (G.mode === 'base' && UI.tab === 'garage' && Input.consume('rotate')) Garage.rotate();
  }
  Input.endFrame();
  requestAnimationFrame(frame);
}

Input.init(canvas);
Run.loadMeta();
Backdrop.init();
UI.init();
UI.title();
requestAnimationFrame(frame);

/* テスト用のつまみ。?debug のときだけ window に出す */
if (location.search.includes('debug')) window.DD = { G, S: () => S, Run, UI, startExpedition, startRaid, Input };
