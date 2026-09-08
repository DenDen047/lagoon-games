/* =========================================================================
   KAIJU CLASH ― ステージ
   空・遠景・地面・壊せる建物・天気。
   世界の座標は「地面が y = 0、上が +y」。View が画面座標へ直す。
   ========================================================================= */
'use strict';

const WORLD_W = 2600;       /* 戦える横幅 */

/** 何度読み込んでも同じ街になるように、種から乱数を作る */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 画面と世界の橋渡し。battle.js が毎フレーム更新する。 */
const View = {
  w: 960, h: 540, z: 1, cx: 0, cy: 0, dpr: 1, shakeX: 0, shakeY: 0,
  /* 地面を画面のどこに置くか。縦長の画面では上げて、空ばかりにならないようにする */
  gl: 0.82,
  x(wx) { return (wx - this.cx) * this.z + this.w / 2 + this.shakeX; },
  y(wy) { return (this.cy - wy) * this.z + this.h * this.gl + this.shakeY; },
  len(v) { return v * this.z; },
  /* 遠景用。par が小さいほど動かない */
  px(wx, par) { return (wx - this.cx * par) * this.z + this.w / 2 + this.shakeX * par; },
};

/* =========================================================================
   ステージを組み立てる
   ========================================================================= */
function buildStage(sd, seed) {
  const rnd = mulberry32(seed || 12345);
  const st = {
    data: sd, rnd, t: 0,
    buildings: [], far: [], mid: [], fore: [],
    particles: [], smoke: [], flash: 0, flashNext: 200 + rnd() * 300,
    destroyed: 0,
  };

  /* --- 遠景（動かない街並み・山） --- */
  const farN = Math.round(46 * (sd.far.density || 1));
  for (let i = 0; i < farN; i++) {
    st.far.push({
      x: -WORLD_W * 0.7 + rnd() * WORLD_W * 2.4,
      w: 40 + rnd() * 90,
      h: sd.far.style === 'mountain' ? 110 + rnd() * 240 : 70 + rnd() * 190,
      k: rnd(),
    });
  }
  const midN = Math.round(30 * (sd.mid.density || 1));
  for (let i = 0; i < midN; i++) {
    st.mid.push({
      x: -WORLD_W * 0.5 + rnd() * WORLD_W * 2,
      w: 56 + rnd() * 110,
      h: 90 + rnd() * 190,
      k: rnd(),
    });
  }

  /* --- 壊せる建物 --- */
  const kinds = sd.buildings.kinds;
  const n = sd.buildings.count;
  const margin = 220;
  for (let i = 0; i < n; i++) {
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const x = -WORLD_W / 2 + margin + (i + rnd() * 0.7) * ((WORLD_W - margin * 2) / n);
    const scale = 0.72 + rnd() * 0.5;
    const b = {
      x, kind, seed: Math.floor(rnd() * 9999),
      w: (kind === 'tank' ? 96 : kind === 'plane' ? 168 : kind === 'radio' ? 84 : 74) * scale,
      h: (kind === 'tower' ? 235 : kind === 'radio' ? 330 : kind === 'keep' ? 175
        : kind === 'tank' ? 84 : kind === 'plane' ? 62 : kind === 'machiya' ? 74
        : kind === 'hangar' ? 100 : kind === 'gate' ? 96 : kind === 'pylon' ? 285 : 128) * scale,
      color: sd.buildings.palette[Math.floor(rnd() * sd.buildings.palette.length)],
      state: 'up', hp: 0, maxHp: 0, tilt: 0, fallT: 0, dir: 1, sink: 0,
    };
    b.maxHp = b.hp = Math.round(60 + b.h * 0.55);
    st.buildings.push(b);
  }
  st.buildings.sort((a, b) => a.x - b.x);

  /* --- 手前の低い影 --- */
  for (let i = 0; i < 26; i++) {
    st.fore.push({ x: -WORLD_W + rnd() * WORLD_W * 3, w: 80 + rnd() * 170, h: 18 + rnd() * 46, k: rnd() });
  }
  return st;
}

/* =========================================================================
   建物を壊す
   ========================================================================= */
function damageBuilding(st, b, dmg, dir) {
  if (b.state !== 'up') return false;
  b.hp -= dmg;
  b.shakeT = 8;
  if (b.hp <= 0) {
    b.state = 'falling';
    b.dir = dir || (Math.random() < 0.5 ? -1 : 1);
    b.fallT = 0;
    st.destroyed++;
    G.destroyed++;
    Sound.crumble();
    for (let i = 0; i < 16; i++) {
      st.smoke.push({
        x: b.x + rand(b.w, -b.w) * 0.5, y: rand(b.h * 0.8, 0),
        vx: rand(2.2, -2.2), vy: rand(2.4, 0.2),
        r: rand(40, 16), life: 1, decay: rand(0.022, 0.011), col: '#c8bcae',
      });
    }
    for (let i = 0; i < 16; i++) {
      st.particles.push({
        x: b.x + rand(b.w, -b.w) * 0.5, y: rand(b.h, 10),
        vx: rand(7, -7), vy: rand(9, 2), g: 0.42, life: 90,
        r: rand(11, 4), col: b.color, spin: rand(0.3, -0.3), a: rand(6.28, 0), kind: 'chunk',
      });
    }
    if (st.data.buildings.volatile) {
      Sound.boom();
      for (let i = 0; i < 20; i++) {
        st.smoke.push({
          x: b.x + rand(b.w, -b.w) * 0.4, y: b.h * 0.4 + rand(80, 0),
          vx: rand(3, -3), vy: rand(5, 1.5), r: rand(52, 22), life: 1,
          decay: rand(0.02, 0.01), col: '#ff9a3c', fire: 1,
        });
      }
    }
    return true;
  }
  /* まだ立っている。破片だけ飛ばす */
  for (let i = 0; i < 4; i++) {
    st.particles.push({
      x: b.x + rand(b.w, -b.w) * 0.5, y: rand(b.h, b.h * 0.3),
      vx: rand(5, -5) + (dir || 0) * 2, vy: rand(6, 1), g: 0.42, life: 60,
      r: rand(7, 3), col: b.color, spin: rand(0.4, -0.4), a: rand(6.28, 0), kind: 'chunk',
    });
  }
  return false;
}

/** 矩形が建物にかぶっているか */
function hitBuildings(st, x0, x1, y0, y1, dmg, dir) {
  let n = 0;
  for (const b of st.buildings) {
    if (b.state !== 'up') continue;
    if (x1 < b.x - b.w / 2 || x0 > b.x + b.w / 2) continue;
    if (y0 > b.h) continue;
    if (damageBuilding(st, b, dmg, dir)) n++;
  }
  return n;
}

/* =========================================================================
   更新
   ========================================================================= */
function updateStage(st, dt) {
  st.t += 1;
  const sd = st.data;

  for (const b of st.buildings) {
    if (b.shakeT > 0) b.shakeT--;
    if (b.state === 'falling') {
      b.fallT += 1;
      b.tilt = easeIn(clamp(b.fallT / 40, 0, 1)) * 1.5 * b.dir;
      if (b.fallT === 18) {
        for (let i = 0; i < 10; i++) {
          st.smoke.push({
            x: b.x + b.dir * b.h * 0.4 + rand(70, -70), y: rand(30, 0),
            vx: b.dir * rand(3, 0.5), vy: rand(2.4, 0.4), r: rand(52, 24),
            life: 1, decay: rand(0.012, 0.006), col: '#bcb0a2',
          });
        }
      }
      if (b.fallT > 44) { b.state = 'rubble'; b.sink = 0; }
    } else if (b.state === 'rubble') {
      b.sink = Math.min(1, b.sink + 0.03);
    }
  }

  /* 煙 */
  for (let i = st.smoke.length - 1; i >= 0; i--) {
    const s = st.smoke[i];
    s.x += s.vx; s.y += s.vy; s.vy *= 0.97; s.vx *= 0.98;
    s.r += 0.55; s.life -= s.decay;
    if (s.life <= 0) st.smoke.splice(i, 1);
  }
  /* 瓦礫 */
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const p = st.particles[i];
    p.x += p.vx; p.y += p.vy; p.vy -= p.g; p.a += p.spin;
    if (p.y <= 0) { p.y = 0; p.vy *= -0.32; p.vx *= 0.7; p.spin *= 0.5; }
    p.life--;
    if (p.life <= 0) st.particles.splice(i, 1);
  }

  /* 天気 */
  const wx = View.cx;
  if (sd.weather === 'rain') {
    for (let i = 0; i < 6; i++) {
      st.particles.push({ kind: 'rain', x: wx + rand(1500, -1500), y: 900, vx: -7, vy: -26, g: 0, life: 60, r: 2, col: '#9fc4e8', spin: 0, a: 0 });
    }
    if (sd.lightning) {
      st.flashNext -= 1;
      if (st.flashNext <= 0) { st.flash = 1; st.flashNext = 260 + Math.random() * 420; Sound.boom(); }
    }
  } else if (sd.weather === 'ash') {
    for (let i = 0; i < 2; i++) {
      st.particles.push({ kind: 'ash', x: wx + rand(1500, -1500), y: 900, vx: rand(0.6, -1.4), vy: rand(-1.6, -0.6), g: 0, life: 420, r: rand(4, 1.5), col: '#e6ae7a', spin: 0, a: 0 });
    }
  } else if (sd.weather === 'sakura') {
    for (let i = 0; i < 2; i++) {
      st.particles.push({ kind: 'petal', x: wx + rand(1500, -1500), y: 900, vx: rand(-0.4, -2), vy: rand(-1.4, -0.5), g: 0, life: 460, r: rand(7, 4), col: '#ffd0e0', spin: rand(0.12, -0.12), a: rand(6.28, 0) });
    }
  }
  if (st.flash > 0) st.flash -= 0.06;
}

/* =========================================================================
   描画
   ========================================================================= */
function drawSky(ctx, st) {
  const sd = st.data, W = View.w, H = View.h;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sd.sky[0]);
  g.addColorStop(0.55, sd.sky[1]);
  g.addColorStop(1, sd.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* 太陽か月 */
  const orb = sd.sun || sd.moon;
  if (orb) {
    const ox = W * orb.x - View.cx * 0.04 * View.z, oy = H * orb.y;
    const rg = ctx.createRadialGradient(ox, oy, orb.r * 0.4, ox, oy, orb.r * 3.4);
    rg.addColorStop(0, rgba(orb.color, 0.5));
    rg.addColorStop(0.25, rgba(orb.color, 0.16));
    rg.addColorStop(1, rgba(orb.color, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(ox - orb.r * 3.4, oy - orb.r * 3.4, orb.r * 6.8, orb.r * 6.8);
    ctx.beginPath(); ctx.arc(ox, oy, orb.r, 0, Math.PI * 2);
    ctx.fillStyle = orb.color; ctx.fill();
    if (sd.moon) {
      ctx.beginPath(); ctx.arc(ox + orb.r * 0.42, oy - orb.r * 0.26, orb.r * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = sd.sky[0]; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  /* 星（夜のステージだけ） */
  if (sd.when === '夜' || sd.when === '深夜') {
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 137.5) % W + W) % W - View.cx * 0.02 * View.z;
      const sy = ((i * 71.3) % (H * 0.5));
      const a = 0.25 + ((i * 37) % 10) / 20;
      ctx.globalAlpha = a * (0.6 + Math.sin(st.t * 0.03 + i) * 0.4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(((sx % W) + W) % W, sy, 2, 2);
    }
    ctx.restore();
  }

  /* 雷 */
  if (st.flash > 0) {
    ctx.fillStyle = 'rgba(200,225,255,' + (st.flash * 0.5) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawParallax(ctx, st) {
  const sd = st.data, H = View.h;
  const gy = View.y(0);

  /* 遠景 */
  ctx.save();
  ctx.globalAlpha = 0.75;
  for (const b of st.far) {
    const x = View.px(b.x, 0.16), w = View.len(b.w), h = View.len(b.h) * 0.55;
    if (x + w < -50 || x > View.w + 50) continue;
    drawSkylineBox(ctx, sd.far.style, x, gy, w, h, sd.far.color, sd.far.lit, b.k, st, 0.35);
  }
  ctx.restore();

  /* もや */
  const hz = ctx.createLinearGradient(0, gy - View.len(340), 0, gy + 20);
  hz.addColorStop(0, rgba(sd.haze, 0));
  hz.addColorStop(1, rgba(sd.haze, 0.75));
  ctx.fillStyle = hz;
  ctx.fillRect(0, gy - View.len(340), View.w, View.len(360));

  /* 中景 */
  ctx.save();
  ctx.globalAlpha = 0.92;
  for (const b of st.mid) {
    const x = View.px(b.x, 0.42), w = View.len(b.w), h = View.len(b.h) * 0.8;
    if (x + w < -80 || x > View.w + 80) continue;
    drawSkylineBox(ctx, sd.mid.style, x, gy, w, h, sd.mid.color, sd.mid.lit, b.k, st, 0.6);
  }
  ctx.restore();

  /* 海のあるステージ */
  if (sd.sea) {
    const top = gy - View.len(78);
    const g2 = ctx.createLinearGradient(0, top, 0, gy);
    g2.addColorStop(0, rgba(sd.sea, 0.55));
    g2.addColorStop(1, sd.sea);
    ctx.fillStyle = g2;
    ctx.fillRect(0, top, View.w, gy - top + 2);
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.strokeStyle = '#ffe3bc'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const yy = top + View.len(12) + i * View.len(13);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      for (let x = 0; x <= View.w; x += 40) ctx.lineTo(x, yy + Math.sin(st.t * 0.03 + i + x * 0.01) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** 遠景の 1 棟。スタイルで輪郭を変える。 */
function drawSkylineBox(ctx, style, x, gy, w, h, color, lit, k, st, litRate) {
  ctx.fillStyle = color;
  if (style === 'mountain') {
    ctx.beginPath();
    ctx.moveTo(x - w * 1.4, gy);
    ctx.lineTo(x + w * 0.4, gy - h * 0.72);
    ctx.lineTo(x + w * 2.2, gy);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (style === 'stacks') {
    /* 煙突とタンクの並び */
    ctx.fillRect(x + w * 0.1, gy - h, w * 0.3, h);
    ctx.fillRect(x + w * 0.55, gy - h * 0.42, w * 0.42, h * 0.42);
    if (k > 0.55) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(st.t * 0.09 + k * 6) * 0.18;
      ctx.fillStyle = lit || '#ff9a4a';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.25, gy - h - w * 0.09, w * 0.07, w * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = color;
    }
    return;
  }
  if (style === 'bridge') {
    /* 桁と、たまに立つ主塔 */
    ctx.fillRect(x - w * 0.2, gy - h * 0.16, w * 1.4, h * 0.16);
    if (k > 0.62) {
      ctx.fillRect(x + w * 0.44, gy - h, w * 0.12, h);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, w * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - w * 1.6, gy - h * 0.2);
      ctx.quadraticCurveTo(x + w * 0.5, gy - h * 1.02, x + w * 2.6, gy - h * 0.2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  if (style === 'castle') {
    const bh = h * 0.6;
    for (let i = 0; i < 3; i++) {
      const ww = w * (1 - i * 0.22), hh = bh * 0.36;
      ctx.fillRect(x + (w - ww) / 2, gy - bh * 0.2 - i * hh, ww, hh);
      ctx.beginPath();
      ctx.moveTo(x + (w - ww) / 2 - ww * 0.14, gy - bh * 0.2 - i * hh);
      ctx.lineTo(x + w / 2, gy - bh * 0.2 - i * hh - hh * 0.5);
      ctx.lineTo(x + (w + ww) / 2 + ww * 0.14, gy - bh * 0.2 - i * hh);
      ctx.closePath(); ctx.fill();
    }
    return;
  }
  if (style === 'radio') {
    ctx.fillRect(x + w * 0.35, gy - h, w * 0.3, h);
    ctx.beginPath();
    ctx.moveTo(x, gy); ctx.lineTo(x + w * 0.5, gy - h * 1.25); ctx.lineTo(x + w, gy);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(st.t * 0.09) * 0.4;
    ctx.fillStyle = lit || '#ff6b6b';
    ctx.beginPath(); ctx.arc(x + w * 0.5, gy - h * 1.27, Math.max(2, w * 0.05), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (style === 'hangar') {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy - h * 0.45);
    ctx.quadraticCurveTo(x + w * 0.5, gy - h * 0.95, x + w, gy - h * 0.45);
    ctx.lineTo(x + w, gy);
    ctx.closePath(); ctx.fill();
    return;
  }
  /* city */
  ctx.fillRect(x, gy - h, w, h);
  if (lit) {
    ctx.save();
    ctx.fillStyle = lit;
    const cols = Math.max(2, Math.floor(w / 12));
    const rows = Math.max(2, Math.floor(h / 16));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const s = Math.sin((i * 12.9 + j * 78.2 + k * 41) * 43758.5453);
      if ((s * 0.5 + 0.5) > litRate) continue;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x + 4 + i * 12, gy - h + 6 + j * 16, 5, 7);
    }
    ctx.restore();
  }
}

/* ------------------------------ 地面 ------------------------------ */
function drawGround(ctx, st) {
  const sd = st.data, W = View.w, H = View.h;
  const gy = View.y(0);
  ctx.fillStyle = sd.ground.body;
  ctx.fillRect(0, gy, W, H - gy + 2);
  ctx.fillStyle = sd.ground.top;
  ctx.fillRect(0, gy, W, Math.max(3, View.len(14)));

  /* 路面の模様 */
  ctx.save();
  ctx.strokeStyle = sd.ground.line;
  ctx.globalAlpha = 0.55;
  const style = sd.ground.style;
  if (style === 'runway') {
    ctx.lineWidth = Math.max(2, View.len(6));
    ctx.setLineDash([View.len(70), View.len(60)]);
    ctx.beginPath();
    ctx.moveTo(0, gy + View.len(46)); ctx.lineTo(W, gy + View.len(46));
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (style === 'deck') {
    ctx.lineWidth = Math.max(1, View.len(3));
    for (let i = -20; i < 40; i++) {
      const x = View.x(i * 120);
      if (x < -20 || x > W + 20) continue;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, H); ctx.stroke();
    }
  } else if (style === 'stone') {
    ctx.lineWidth = 1.5;
    for (let i = -24; i < 48; i++) {
      const x = View.x(i * 90);
      if (x < -20 || x > W + 20) continue;
      ctx.beginPath(); ctx.moveTo(x, gy + View.len(16)); ctx.lineTo(x + View.len(24), H); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, gy + View.len(52)); ctx.lineTo(W, gy + View.len(52)); ctx.stroke();
  } else {
    ctx.lineWidth = Math.max(1, View.len(4));
    ctx.setLineDash([View.len(52), View.len(46)]);
    ctx.beginPath();
    ctx.moveTo(0, gy + View.len(62)); ctx.lineTo(W, gy + View.len(62));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  /* 濡れた路面の照り返し */
  if (style === 'wet') {
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, 'rgba(160,200,255,.18)');
    g.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy);
  }

  /* 世界の端 */
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  const lx = View.x(-WORLD_W / 2), rx = View.x(WORLD_W / 2);
  if (lx > 0) ctx.fillRect(0, 0, lx, H);
  if (rx < W) ctx.fillRect(rx, 0, W - rx, H);
  ctx.restore();
}

/* ------------------------------ 建物 ------------------------------ */
function drawBuildings(ctx, st) {
  for (const b of st.buildings) {
    if (b.state === 'rubble') { drawRubble(ctx, st, b); continue; }
    const x = View.x(b.x), gy = View.y(0);
    const w = View.len(b.w), h = View.len(b.h);
    if (x + h + w < -60 || x - h - w > View.w + 60) continue;
    ctx.save();
    ctx.translate(x, gy);
    if (b.shakeT > 0) ctx.translate(rand(3, -3) * (b.shakeT / 8), 0);
    if (b.tilt) ctx.rotate(b.tilt);
    ctx.translate(-w / 2, 0);
    drawBuildingBody(ctx, st, b, w, h);
    /* 傷 */
    const dmg = 1 - b.hp / b.maxHp;
    if (dmg > 0.15) {
      ctx.save();
      ctx.globalAlpha = clamp(dmg, 0, 1) * 0.85;
      ctx.strokeStyle = 'rgba(20,14,12,.9)';
      ctx.lineWidth = Math.max(1.5, w * 0.03);
      const r = mulberry32(b.seed);
      const cracks = Math.floor(dmg * 6) + 1;
      for (let i = 0; i < cracks; i++) {
        let cx = r() * w, cy = -r() * h;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        for (let j = 0; j < 4; j++) {
          cx += (r() - 0.5) * w * 0.4; cy += (r() - 0.3) * h * 0.16;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawBuildingBody(ctx, st, b, w, h) {
  const sd = st.data;
  const lit = sd.buildings.lit;
  const col = b.color;
  const dark = shade(col, -0.35);
  const r = mulberry32(b.seed);

  switch (b.kind) {
    case 'tower':
    case 'office':
    case 'block': {
      const bh = b.kind === 'block' ? h * 0.7 : h;
      ctx.fillStyle = col;
      ctx.fillRect(0, -bh, w, bh);
      ctx.fillStyle = dark;
      ctx.fillRect(w * 0.82, -bh, w * 0.18, bh);
      /* 窓 */
      ctx.save();
      const cols = Math.max(2, Math.floor(w / 16));
      const rows = Math.max(2, Math.floor(bh / 22));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const on = r() > 0.42;
        ctx.globalAlpha = on ? 0.75 : 0.16;
        ctx.fillStyle = on ? lit : '#0d1220';
        ctx.fillRect(w * 0.1 + i * (w * 0.8 / cols), -bh + 10 + j * ((bh - 16) / rows), w * 0.8 / cols * 0.6, (bh - 16) / rows * 0.55);
      }
      ctx.restore();
      /* 屋上 */
      ctx.fillStyle = dark;
      ctx.fillRect(-w * 0.04, -bh - h * 0.02, w * 1.08, h * 0.025);
      if (b.kind === 'tower') {
        ctx.fillRect(w * 0.44, -bh - h * 0.14, w * 0.1, h * 0.12);
        ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(st.t * 0.08 + b.seed) * 0.4;
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath(); ctx.arc(w * 0.49, -bh - h * 0.15, Math.max(2, w * 0.05), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'tank': {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(w / 2, -h, w / 2, w * 0.18, 0, Math.PI, 0);
      ctx.rect(0, -h, w, h);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.globalAlpha = 0.5;
      for (let i = 1; i < 4; i++) { ctx.fillRect(0, -h + (h / 4) * i, w, 3); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade(col, 0.12);
      ctx.beginPath(); ctx.ellipse(w / 2, -h, w / 2, w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      /* 手すり */
      ctx.strokeStyle = dark; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * 0.1, -h - w * 0.1); ctx.lineTo(w * 0.9, -h - w * 0.1); ctx.stroke();
      break;
    }
    case 'stack': {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(w * 0.28, 0); ctx.lineTo(w * 0.38, -h); ctx.lineTo(w * 0.62, -h); ctx.lineTo(w * 0.72, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark;
      for (let i = 0; i < 4; i++) ctx.fillRect(w * 0.3, -h * (0.25 + i * 0.2), w * 0.4, 4);
      ctx.save(); ctx.globalAlpha = 0.75;
      ctx.fillStyle = sd.buildings.lit;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, -h - w * 0.16, w * 0.12, w * 0.22 + Math.sin(st.t * 0.12 + b.seed) * w * 0.06, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
      break;
    }
    case 'hangar': {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.5);
      ctx.quadraticCurveTo(w * 0.5, -h * 1.15, w, -h * 0.5);
      ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark;
      ctx.fillRect(w * 0.24, -h * 0.62, w * 0.52, h * 0.62);
      ctx.fillStyle = shade(col, 0.15);
      for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.24 + i * w * 0.104, -h * 0.62, 3, h * 0.62);
      break;
    }
    case 'plane': {
      /* 駐機中の旅客機 */
      ctx.fillStyle = shade(col, 0.3);
      ctx.beginPath();
      ctx.ellipse(w * 0.5, -h * 0.5, w * 0.5, h * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.05, -h * 0.5); ctx.lineTo(-w * 0.06, -h * 0.75); ctx.lineTo(w * 0.2, -h * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(w * 0.42, -h * 0.42); ctx.lineTo(w * 0.62, -h * 0.05); ctx.lineTo(w * 0.78, -h * 0.08); ctx.lineTo(w * 0.62, -h * 0.44);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark;
      for (let i = 0; i < 7; i++) ctx.fillRect(w * 0.2 + i * w * 0.08, -h * 0.56, w * 0.03, h * 0.07);
      break;
    }
    case 'machiya': {
      /* 町家 */
      ctx.fillStyle = col;
      ctx.fillRect(0, -h * 0.62, w, h * 0.62);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-w * 0.12, -h * 0.62); ctx.lineTo(w * 0.5, -h);
      ctx.lineTo(w * 1.12, -h * 0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(col, 0.2);
      ctx.fillRect(w * 0.14, -h * 0.44, w * 0.3, h * 0.3);
      ctx.fillStyle = sd.buildings.lit;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(w * 0.56, -h * 0.44, w * 0.26, h * 0.26);
      ctx.globalAlpha = 1;
      break;
    }
    case 'keep': {
      /* 天守 */
      const floors = 3;
      for (let i = 0; i < floors; i++) {
        const fw = w * (1 - i * 0.2), fh = h / (floors + 0.6);
        const fx = (w - fw) / 2, fy = -fh * (i + 1) - h * 0.06;
        ctx.fillStyle = shade(col, 0.12);
        ctx.fillRect(fx, fy, fw, fh);
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(fx - fw * 0.16, fy); ctx.lineTo(fx + fw * 0.5, fy - fh * 0.42);
        ctx.lineTo(fx + fw * 1.16, fy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = sd.buildings.lit;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(fx + fw * 0.2, fy + fh * 0.3, fw * 0.18, fh * 0.35);
        ctx.fillRect(fx + fw * 0.6, fy + fh * 0.3, fw * 0.18, fh * 0.35);
        ctx.globalAlpha = 1;
      }
      /* 石垣 */
      ctx.fillStyle = shade(col, -0.2);
      ctx.beginPath();
      ctx.moveTo(-w * 0.14, 0); ctx.lineTo(w * 0.04, -h * 0.06);
      ctx.lineTo(w * 0.96, -h * 0.06); ctx.lineTo(w * 1.14, 0);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'gate': {
      /* 鳥居のような門 */
      ctx.fillStyle = col;
      ctx.fillRect(w * 0.1, -h * 0.9, w * 0.12, h * 0.9);
      ctx.fillRect(w * 0.78, -h * 0.9, w * 0.12, h * 0.9);
      ctx.fillStyle = dark;
      ctx.fillRect(-w * 0.06, -h, w * 1.12, h * 0.1);
      ctx.fillRect(w * 0.04, -h * 0.76, w * 0.92, h * 0.07);
      break;
    }
    case 'pylon': {
      /* 吊り橋の主塔 */
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(3, w * 0.16);
      ctx.beginPath();
      ctx.moveTo(w * 0.1, 0); ctx.lineTo(w * 0.36, -h);
      ctx.moveTo(w * 0.9, 0); ctx.lineTo(w * 0.64, -h);
      ctx.stroke();
      ctx.lineWidth = Math.max(2, w * 0.09);
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        ctx.beginPath();
        ctx.moveTo(lerp(w * 0.1, w * 0.36, t), -h * t);
        ctx.lineTo(lerp(w * 0.9, w * 0.64, t), -h * t);
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(1.5, w * 0.05);
      ctx.beginPath();
      ctx.moveTo(-w * 2.4, -h * 0.2);
      ctx.quadraticCurveTo(w * 0.5, -h * 1.05, w * 3.4, -h * 0.2);
      ctx.stroke();
      break;
    }
    case 'radio': {
      /* 電波塔 */
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(3, w * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(w * 0.4, -h);
      ctx.moveTo(w, 0); ctx.lineTo(w * 0.6, -h);
      ctx.stroke();
      ctx.lineWidth = Math.max(1.5, w * 0.05);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        ctx.beginPath();
        ctx.moveTo(lerp(0, w * 0.4, t), -h * t);
        ctx.lineTo(lerp(w, w * 0.6, t), -h * t);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lerp(0, w * 0.4, t), -h * t);
        ctx.lineTo(lerp(w, w * 0.6, (i + 1) / 8), -h * (i + 1) / 8);
        ctx.stroke();
      }
      ctx.fillStyle = shade(col, 0.2);
      ctx.beginPath(); ctx.ellipse(w * 0.5, -h * 0.55, w * 0.42, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(st.t * 0.08 + b.seed) * 0.45;
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(w * 0.5, -h - 4, Math.max(2.5, w * 0.06), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    }
    default:
      ctx.fillStyle = col;
      ctx.fillRect(0, -h, w, h);
  }
}

function drawRubble(ctx, st, b) {
  const x = View.x(b.x), gy = View.y(0);
  const w = View.len(b.w), h = View.len(b.h);
  if (x + w * 2 < -40 || x - w * 2 > View.w + 40) return;
  const r = mulberry32(b.seed + 7);
  ctx.save();
  ctx.translate(x, gy - View.len(b.sink * 4));
  ctx.fillStyle = shade(b.color, -0.3);
  for (let i = 0; i < 12; i++) {
    const cx = (r() - 0.5) * w * 2.2;
    const cw = w * (0.12 + r() * 0.25);
    const ch = h * (0.03 + r() * 0.1);
    ctx.save();
    ctx.translate(cx, -ch * 0.5);
    ctx.rotate((r() - 0.5) * 0.8);
    ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }
  /* 折れた鉄骨 */
  ctx.strokeStyle = shade(b.color, -0.5);
  ctx.lineWidth = Math.max(1.5, w * 0.04);
  for (let i = 0; i < 4; i++) {
    const cx = (r() - 0.5) * w * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx + (r() - 0.5) * w * 0.6, -h * (0.06 + r() * 0.14));
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------ 粒 ------------------------------ */
function drawStageParticles(ctx, st) {
  for (const p of st.particles) {
    const x = View.x(p.x), y = View.y(p.y);
    if (x < -40 || x > View.w + 40) continue;
    if (p.kind === 'rain') {
      ctx.strokeStyle = rgba(p.col, 0.45);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 16); ctx.stroke();
    } else if (p.kind === 'petal') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(p.a);
      ctx.fillStyle = p.col; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(0, 0, View.len(p.r), View.len(p.r) * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      p.a += p.spin;
    } else if (p.kind === 'ash') {
      ctx.fillStyle = rgba(p.col, 0.4);
      ctx.beginPath(); ctx.arc(x, y, View.len(p.r), 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(p.a);
      ctx.fillStyle = p.col;
      const s = View.len(p.r);
      ctx.fillRect(-s / 2, -s / 2, s, s * 0.8);
      ctx.restore();
    }
  }
}

function drawSmoke(ctx, st) {
  ctx.save();
  for (const s of st.smoke) {
    const x = View.x(s.x), y = View.y(s.y), r = View.len(s.r);
    if (x + r < -20 || x - r > View.w + 20) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = clamp(s.life, 0, 1) * (s.fire ? 0.7 : 0.5);
    g.addColorStop(0, rgba(s.col, a));
    g.addColorStop(1, rgba(s.col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** 画面手前の暗い影。奥行きを出すためだけの飾り。 */
function drawForeground(ctx, st) {
  const gy = View.y(0);
  const base = View.h;
  ctx.save();
  ctx.fillStyle = shade(st.data.ground.body, -0.7);
  ctx.fillRect(0, base - Math.max(10, View.len(16)), View.w, 30);
  for (const f of st.fore) {
    const x = View.px(f.x, 1.55), w = View.len(f.w) * 1.5, h = View.len(f.h) * 1.2;
    if (x + w < -40 || x > View.w + 40) continue;
    ctx.fillRect(x, base - h, w, h + 20);
  }
  ctx.restore();
}
