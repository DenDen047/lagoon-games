/* =========================================================================
   SLIME AGE ― 起動とメインループ
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

/* タイトルと メニューの うしろ。時代の 武器を もった スライムたちが 行進している */
const Backdrop = {
  parade: ['branch', 'stoneaxe', 'bronzesword', 'ironsword', 'greatsword', 'katana', 'drill', 'beamsword'],
  cols: ['blue', 'green', 'yellow', 'red', 'purple', 'blue', 'yellow', 'red'],
  draw(ctx, t) {
    const W = G.W, H = G.H;
    const gr = groundFor(0);
    const sc = Math.max(W / (WORLD_W * 0.5), H / (WORLD_H * 0.5));
    ctx.save();
    ctx.scale(sc, sc);
    ctx.drawImage(gr, -WORLD_W * 0.25, -WORLD_H * 0.25);
    ctx.restore();
    const wide = W > 820;
    const k = wide ? clamp(Math.min(W, H) / 620, 0.8, 1.5) : clamp(Math.min(W, H) / 520, 0.8, 1.7);
    /* ひろい 画面では タイトルの 文字に かからない よう みぎがわだけを、2れつに ずらして ぜんいんが 見えるように あるく */
    const step = (wide ? 58 : 92) * k;
    const rowH = wide ? 40 * k : 0;
    const y0 = wide ? H * 0.76 : H * 0.3;
    const x0 = wide ? Math.max(W * 0.45, 600) : 0;
    const count = this.parade.length + 1;   // さいごの 1ぴきは キングスライム
    const span = Math.max(step * (count + 2), W - x0 + step * 3);
    /* 地面の 道 */
    ctx.fillStyle = 'rgba(120,90,50,0.35)';
    ctx.fillRect(x0 - step, y0 - rowH + 10 * k, W - x0 + step, 36 * k + rowH);
    const row = [];
    for (let i = 0; i < count; i++) {
      const x = x0 + (i * step + t * 36 * k) % span - step * (wide ? 0.2 : 1);
      if (x > -80 && x < W + 80) row.push({ i, x, y: y0 - (i % 2 ? rowH : 0) });
    }
    row.sort((a, b) => a.y - b.y);
    for (const { i, x, y } of row) {
      ctx.globalAlpha = wide ? clamp((x - x0 + step) / step, 0, 1) : 1;
      const king = i === this.parade.length;
      const r = bodyRadius(king ? MAX_MEMBERS : 1) * k * (king ? 0.75 : 1);
      const members = king ? ['blue', 'red', 'green', 'yellow', 'purple', 'blue', 'red', 'green'] : [this.cols[i]];
      const wp = king ? ['beamsword', 'laser', 'dynamite', 'katana'] : [this.parade[i]];
      const hop = Math.abs(Math.sin(t * 5 + i)) * r * 0.3;
      ctx.save();
      ctx.translate(x, y - hop);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.62 + hop, r * 1.05, r * 0.3, 0, 0, TAU); ctx.fill();
      const b = { id: i, r, aim: 0.15, wpns: wp.map((id) => ({ id, anim: 0, dur: 1 })) };
      drawHeldWeapons(ctx, b, false, t);
      drawSlime(ctx, { r, col: bodyColor(members), members, look: 0.2, mood: 'happy', sq: Math.cos(t * 10 + i * 2) * 0.06, crown: king, t });
      drawHeldWeapons(ctx, b, true, t);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (wide) {
      const g = ctx.createLinearGradient(0, 0, W * 0.55, 0);
      g.addColorStop(0, 'rgba(10,28,24,0.78)'); g.addColorStop(1, 'rgba(10,28,24,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
  if (G.mode === 'field' && Field.def) {
    if (!UI.modalOpen()) {
      if (Input.consume('pause')) UI.pause();
      else Field.update(dt);
    } else if (UI.pausing && Input.consume('pause')) UI.closeModal();
    Field.draw(ctx);
  } else {
    Backdrop.draw(ctx, G.time);
  }
  UI.tick();
  Input.endFrame();
}

/* ほかの タブに うつったら ひとやすみ */
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'field') UI.pause(); });

Prof.load();
Input.init(canvas);
UI.init();
UI.title();
requestAnimationFrame(frame);

/* テスト用の つまみ。?debug の ときだけ window に 出す */
if (location.search.includes('debug')) window.SA = { G, Field, UI, Prof, Input, P: () => P };
