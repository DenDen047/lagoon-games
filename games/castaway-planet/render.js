/* =========================================================================
   CASTAWAY PLANET ― 描画
   地形 / 植物・鉱石・設備 / 宇宙人 / 人とロボット / 夜の光 / ミニマップ
   ========================================================================= */
'use strict';

const Render = {
  cam: { x: 0, y: 0, w: 0, h: 0 },
  lightCanvas: null,
  lights: [],

  /* --------------------------- カメラ --------------------------- */
  updateCam(game, canvas) {
    const f = game.focus();
    const w = canvas.width / game.zoom, h = canvas.height / game.zoom;
    this.cam.w = w; this.cam.h = h;
    const maxX = game.world.w * TILE - w, maxY = game.world.h * TILE - h;
    this.cam.x = clamp(f.x - w / 2, 0, Math.max(0, maxX));
    this.cam.y = clamp(f.y - h / 2, 0, Math.max(0, maxY));
  },

  /* --------------------------- 本体 --------------------------- */
  draw(game, canvas, ctx) {
    const W = game.world, P = W.planet;
    this.updateCam(game, canvas);
    const cam = this.cam;
    this.lights.length = 0;

    ctx.save();
    ctx.setTransform(game.zoom, 0, 0, game.zoom, 0, 0);
    ctx.imageSmoothingEnabled = false;

    /* 空 (地形の外側) */
    ctx.fillStyle = mixHex(P.sky, P.night, game.darkness());
    ctx.fillRect(0, 0, cam.w, cam.h);

    this.drawGround(game, ctx);
    this.drawAim(game, ctx);

    /* y 順に並べて重なりを自然にする */
    const drawables = [];
    const t0x = Math.max(0, Math.floor(cam.x / TILE) - 1), t1x = Math.min(W.w - 1, Math.ceil((cam.x + cam.w) / TILE));
    const t0y = Math.max(0, Math.floor(cam.y / TILE) - 2), t1y = Math.min(W.h - 1, Math.ceil((cam.y + cam.h) / TILE) + 2);
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const o = W.obj[ty * W.w + tx];
        if (!o || o.t === 'wall') continue;
        if (o.t === 'ship' && !o.anchor) continue;
        drawables.push({ y: ty * TILE + TILE, kind: 'obj', o, tx, ty });
      }
    }
    for (const a of W.aliens) drawables.push({ y: a.y, kind: 'alien', a });
    for (const r of game.robots) if (!r.ridden) drawables.push({ y: r.y, kind: 'robot', r });
    if (game.riding) drawables.push({ y: game.riding.y, kind: 'robot', r: game.riding });
    else if (!game.mount) drawables.push({ y: game.player.y, kind: 'player' });
    drawables.sort((a, b) => a.y - b.y);

    for (const d of drawables) {
      if (d.kind === 'obj') this.drawObject(game, ctx, d.o, d.tx, d.ty);
      else if (d.kind === 'alien') this.drawAlien(game, ctx, d.a);
      else if (d.kind === 'robot') this.drawRobot(game, ctx, d.r);
      else this.drawPlayer(game, ctx);
    }

    /* 弾 */
    for (const s of W.shots) {
      const x = s.x - cam.x, y = s.y - cam.y;
      ctx.fillStyle = s.c;
      ctx.shadowColor = s.c; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      this.lights.push({ x: s.x, y: s.y, r: 60, a: 0.5 });
    }

    FX.draw(ctx, cam);
    this.drawNight(game, ctx);
    ctx.restore();

    this.drawMinimap(game, canvas, ctx);
  },

  /* --------------------------- 地形 --------------------------- */
  drawGround(game, ctx) {
    const W = game.world, P = W.planet, cam = this.cam, t = game.clock;
    const t0x = Math.max(0, Math.floor(cam.x / TILE) - 1), t1x = Math.min(W.w - 1, Math.ceil((cam.x + cam.w) / TILE) + 1);
    const t0y = Math.max(0, Math.floor(cam.y / TILE) - 1), t1y = Math.min(W.h - 1, Math.ceil((cam.y + cam.h) / TILE) + 1);

    /* まず地面の基本色で塗る */
    ctx.fillStyle = P.ground;
    ctx.fillRect(Math.round(t0x * TILE - cam.x), Math.round(t0y * TILE - cam.y),
      (t1x - t0x + 1) * TILE + 2, (t1y - t0y + 1) * TILE + 2);

    /* 種類ごとに、隣と繋がった塊として重ねる */
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const i = ty * W.w + tx;
        const g = W.ground[i];
        const px = Math.round(tx * TILE - cam.x), py = Math.round(ty * TILE - cam.y);
        if (g !== GT.BASE) {
          const same = (x, y) => W.groundAt(x, y) === g;
          let col;
          switch (g) {
            case GT.WATER: {
              const wave = Math.sin((tx * 0.7 + ty * 0.5) + t * 1.4) * 0.5 + 0.5;
              col = mixHex(P.water, '#ffffff', 0.05 + wave * 0.09);
              break;
            }
            case GT.SAND: col = P.sand; break;
            case GT.ROCK: col = P.rock; break;
            case GT.SOIL: col = W.wet[i] > 0.05 ? '#4f3520' : '#7a5a3a'; break;
            default: col = P.ground2; break;
          }
          ctx.fillStyle = col;
          this.blobTile(ctx, px, py, same(tx, ty - 1), same(tx + 1, ty), same(tx, ty + 1), same(tx - 1, ty), g === GT.SOIL ? 5 : 11);
          ctx.fill();
        }

        /* 質感 */
        if (g === GT.BASE || g === GT.ALT) {
          const h = (tx * 31 + ty * 17) % 7;
          if (h < 3) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(px + (h * 7) % 20, py + (h * 11) % 22, 6, 3);
          }
        } else if (g === GT.ROCK) {
          ctx.fillStyle = 'rgba(0,0,0,0.10)';
          const h = (tx * 13 + ty * 7) % 5;
          ctx.fillRect(px + 5 + h * 4, py + 6 + ((tx + ty) % 3) * 7, 9, 4);
        } else if (g === GT.SOIL) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          for (let k = 0; k < 3; k++) ctx.fillRect(px + 3, py + 7 + k * 9, TILE - 6, 2);
          if (W.wet[i] > 0.05) {
            ctx.fillStyle = `rgba(80,150,215,${0.10 + W.wet[i] * 0.16})`;
            ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          }
        } else if (g === GT.WATER) {
          const shine = Math.sin(tx * 1.3 + ty * 0.9 + t * 1.1);
          if (shine > 0.75) {
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(px + 8, py + 12, 12, 3);
          }
        }
      }
    }
  },

  /* 隣が同じ種類でない角だけを丸めたタイル */
  blobTile(ctx, x, y, sT, sR, sB, sL, R) {
    const w = TILE + 0.7, h = TILE + 0.7;
    const tl = (!sT && !sL) ? R : 0, tr = (!sT && !sR) ? R : 0;
    const br = (!sB && !sR) ? R : 0, bl = (!sB && !sL) ? R : 0;
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    if (tl) ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  },

  /* 狙っているマスを光らせる */
  drawAim(game, ctx) {
    if (game.uiOpen) return;
    const cam = this.cam;
    const aim = game.aimTile();
    const arm = game.riding ? game.riding.armDef(game.activeSide) : null;
    const range = arm ? (arm.range || 0) : 0;
    const inReach = dist(game.focus().x, game.focus().y, (aim.tx + 0.5) * TILE, (aim.ty + 0.5) * TILE) <= TILE * (game.riding ? 3.6 : 2.4);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = inReach ? 'rgba(255,255,255,0.75)' : 'rgba(255,120,120,0.5)';
    ctx.fillStyle = inReach ? 'rgba(255,255,255,0.10)' : 'rgba(255,80,80,0.06)';
    const x = (aim.tx - range) * TILE - cam.x, y = (aim.ty - range) * TILE - cam.y;
    const s = (range * 2 + 1) * TILE;
    ctx.fillRect(x, y, s, s);
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    ctx.restore();
  },

  /* --------------------------- 物体 --------------------------- */
  drawObject(game, ctx, o, tx, ty) {
    const cam = this.cam;
    const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
    switch (o.t) {
      case 'ore': return this.drawOre(ctx, o, px, py);
      case 'plant': return this.drawPlant(game, ctx, o, px, py);
      case 'debris': return this.drawDebris(ctx, px, py);
      case 'station': return this.drawStation(game, ctx, o, px, py, tx, ty);
      case 'ship': return this.drawShip(game, ctx, px, py);
      default: return undefined;
    }
  },

  shadow(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
  },

  drawOre(ctx, o, px, py) {
    const d = ORES[o.ore];
    const cx = px + TILE / 2, cy = py + TILE / 2;
    this.shadow(ctx, cx, cy + 11, 12, 4);
    const damaged = 1 - o.hp / d.hp;
    ctx.fillStyle = d.c1;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 10); ctx.lineTo(cx - 9, cy - 8); ctx.lineTo(cx + 1, cy - 12);
    ctx.lineTo(cx + 11, cy - 5); ctx.lineTo(cx + 13, cy + 10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = d.c2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 2); ctx.lineTo(cx - 1, cy - 8); ctx.lineTo(cx + 6, cy - 2); ctx.lineTo(cx + 2, cy + 7);
    ctx.closePath(); ctx.fill();
    if (d.glow) {
      ctx.globalAlpha = 0.5; ctx.shadowColor = d.c2; ctx.shadowBlur = 14;
      ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      this.lights.push({ wx: px + this.cam.x + 16, wy: py + this.cam.y + 16, r: 70, a: 0.5 });
    }
    if (damaged > 0.2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx - 1, cy + 1); ctx.lineTo(cx + 5, cy - 3); ctx.stroke();
    }
    /* 硬さの目印 */
    if (d.hardness >= 2) {
      ctx.fillStyle = d.hardness >= 3 ? '#ff7ad8' : '#ffd86a';
      for (let k = 0; k < d.hardness; k++) { ctx.fillRect(cx - 6 + k * 5, cy + 12, 3, 3); }
    }
  },

  drawPlant(game, ctx, o, px, py) {
    const d = PLANTS[o.id];
    const cx = px + TILE / 2, cy = py + TILE / 2;
    const g = (o.stage + 1) / d.stages;
    const sway = Math.sin(game.clock * 1.6 + px * 0.05) * 1.6 * g;
    this.shadow(ctx, cx, cy + 11, 8 * g + 2, 3);
    ctx.save();
    ctx.translate(cx, cy + 12);
    switch (d.form) {
      case 'tree': {
        const h = 14 + 34 * g;
        const tw = 2.5 + 2.5 * g;
        ctx.fillStyle = '#5f4028';
        ctx.beginPath();
        ctx.moveTo(-tw, 0); ctx.lineTo(-tw * 0.6, -h * 0.55);
        ctx.lineTo(tw * 0.6, -h * 0.55); ctx.lineTo(tw, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(0, -h * 0.55, tw * 0.6, h * 0.55);
        const cr = 8 + 13 * g;
        ctx.fillStyle = shade(d.c1, -22);
        ctx.beginPath(); ctx.ellipse(sway, -h * 0.62, cr * 1.05, cr * 0.82, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(sway - cr * 0.35, -h * 0.72, cr * 0.7, cr * 0.62, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sway + cr * 0.4, -h * 0.68, cr * 0.62, cr * 0.55, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(sway - cr * 0.2, -h * 0.82, cr * 0.5, cr * 0.42, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'fungus': {
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(-2, -8 * g - 2, 4, 8 * g + 2);
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(sway, -8 * g - 2, 5 + 7 * g, 4 + 5 * g, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.arc(sway - 2, -9 * g - 3, 1.6, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(sway + 3, -8 * g - 5, 1.3, 0, TAU); ctx.fill();
        break;
      }
      case 'cactus': {
        const h = 8 + 18 * g;
        ctx.fillStyle = d.c1;
        ctx.fillRect(-5, -h, 10, h);
        if (g > 0.6) { ctx.fillRect(-11, -h * 0.7, 6, 5); ctx.fillRect(5, -h * 0.55, 6, 5); }
        ctx.fillStyle = d.c2;
        for (let k = 0; k < 4; k++) ctx.fillRect(-1, -h + 3 + k * 5, 2, 2);
        break;
      }
      case 'crystal': {
        const h = 8 + 18 * g;
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(6, -h * 0.3); ctx.lineTo(0, 0); ctx.lineTo(-6, -h * 0.3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(3, -h * 0.4); ctx.lineTo(0, -h * 0.15); ctx.closePath(); ctx.fill();
        break;
      }
      default: {
        const h = 6 + 14 * g;
        ctx.fillStyle = d.c1;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.ellipse(k * 6 + sway * (k + 1.4), -h * 0.55, 4.5, h * 0.55, k * 0.35, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(sway, -h * 0.8, 4, h * 0.35, 0, 0, TAU); ctx.fill();
        break;
      }
    }
    /* 実り */
    if (o.stage >= d.stages - 1 && !o.wild) {
      ctx.fillStyle = '#ffd86a';
      ctx.beginPath(); ctx.arc(6, -14, 2.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-5, -18, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (d.glow && o.stage >= d.stages - 2) {
      this.lights.push({ wx: px + this.cam.x + 16, wy: py + this.cam.y + 12, r: 36, a: 0.3 });
    }
  },

  drawDebris(ctx, px, py) {
    const cx = px + TILE / 2, cy = py + TILE / 2;
    this.shadow(ctx, cx, cy + 9, 11, 4);
    ctx.fillStyle = '#9aa4b0';
    ctx.beginPath(); ctx.moveTo(cx - 11, cy + 8); ctx.lineTo(cx - 6, cy - 6); ctx.lineTo(cx + 8, cy - 2); ctx.lineTo(cx + 11, cy + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8d0d8';
    ctx.fillRect(cx - 3, cy - 3, 8, 4);
    ctx.strokeStyle = '#5a636e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy + 3); ctx.lineTo(cx + 6, cy + 5); ctx.stroke();
  },

  drawStation(game, ctx, o, px, py, tx, ty) {
    const d = STATIONS[o.id];
    const cx = px + TILE / 2, cy = py + TILE / 2;
    this.shadow(ctx, cx, cy + 12, 13, 4.5);
    /* 台座 */
    ctx.fillStyle = shade(d.color, -34);
    this.roundRect(ctx, cx - 14, cy - 12, 28, 26, 5); ctx.fill();
    ctx.fillStyle = d.color;
    this.roundRect(ctx, cx - 12, cy - 14, 24, 24, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    this.roundRect(ctx, cx - 12, cy - 14, 24, 8, 4); ctx.fill();
    ctx.font = '15px system-ui, "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.icon, cx, cy - 1);
    if (o.id === 'st_smelter' && game.smelterHot) {
      ctx.fillStyle = 'rgba(255,150,60,0.55)';
      ctx.fillRect(cx - 7, cy + 4, 14, 5);
    }
    if (d.light) this.lights.push({ wx: px + this.cam.x + 16, wy: py + this.cam.y + 14, r: d.light, a: 0.85 });
    if (o.id === 'st_tank') {
      const lv = clamp((o.water || 0) / 40, 0, 1);
      ctx.fillStyle = '#7ec8ff';
      ctx.fillRect(cx - 9, cy + 6 - 10 * lv, 18, 10 * lv);
    }
  },

  drawShip(game, ctx, px, py) {
    const cx = px + TILE / 2, cy = py + TILE / 2;
    const done = game.world.shipRepaired;

    /* 墜落の跡 */
    ctx.fillStyle = 'rgba(40,28,20,0.30)';
    ctx.beginPath(); ctx.ellipse(cx - 6, cy + 16, 74, 34, -0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(20,14,10,0.22)';
    ctx.beginPath(); ctx.ellipse(cx + 18, cy + 22, 34, 15, -0.16, 0, TAU); ctx.fill();
    this.shadow(ctx, cx, cy + 20, 50, 16);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.17);

    /* ちぎれた主翼 (機体の手前に転がっている) */
    ctx.fillStyle = '#7d8a99';
    ctx.beginPath();
    ctx.moveTo(-34, 30); ctx.lineTo(-64, 16); ctx.lineTo(-58, 34); ctx.lineTo(-30, 40);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-58, 26, 22, 3);

    /* 機体 */
    ctx.fillStyle = '#aab6c4';
    ctx.beginPath();
    ctx.moveTo(62, 0);
    ctx.quadraticCurveTo(46, -22, 6, -26);
    ctx.quadraticCurveTo(-34, -29, -52, -18);
    ctx.lineTo(-56, 14);
    ctx.quadraticCurveTo(-30, 26, 8, 24);
    ctx.quadraticCurveTo(46, 20, 62, 0);
    ctx.closePath(); ctx.fill();
    /* 下面の影 */
    ctx.fillStyle = '#8996a6';
    ctx.beginPath();
    ctx.moveTo(-56, 6); ctx.quadraticCurveTo(-20, 22, 20, 20);
    ctx.quadraticCurveTo(46, 17, 60, 2); ctx.lineTo(62, 0);
    ctx.quadraticCurveTo(46, 20, 8, 24);
    ctx.quadraticCurveTo(-30, 26, -56, 14);
    ctx.closePath(); ctx.fill();
    /* 上面のハイライト */
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(40, -14); ctx.quadraticCurveTo(6, -22, -34, -22);
    ctx.quadraticCurveTo(-14, -16, 34, -9);
    ctx.closePath(); ctx.fill();
    /* 継ぎ目 */
    ctx.strokeStyle = 'rgba(50,62,76,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-30, -24); ctx.lineTo(-26, 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -26); ctx.lineTo(8, 24); ctx.stroke();

    /* 尾翼 */
    ctx.fillStyle = '#93a0af';
    ctx.beginPath(); ctx.moveTo(-40, -20); ctx.lineTo(-58, -40); ctx.lineTo(-30, -24); ctx.closePath(); ctx.fill();

    /* コックピット */
    ctx.fillStyle = '#22303f';
    ctx.beginPath(); ctx.ellipse(30, -4, 20, 13, -0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = done ? '#63e8cf' : '#3f6f8a';
    ctx.beginPath(); ctx.ellipse(30, -4, 17, 10.5, -0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.beginPath(); ctx.ellipse(25, -8, 7, 3.6, -0.35, 0, TAU); ctx.fill();

    /* エンジン */
    ctx.fillStyle = '#5f6c7a';
    this.roundRect(ctx, -60, -12, 12, 22, 4); ctx.fill();
    if (done) {
      ctx.fillStyle = '#7fe8d0';
      ctx.globalAlpha = 0.55 + Math.sin(game.clock * 5) * 0.25;
      ctx.beginPath(); ctx.ellipse(-64, 0, 10, 8, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* 破損部 */
    if (!done) {
      ctx.fillStyle = '#2b232c';
      ctx.beginPath();
      ctx.moveTo(-14, -22); ctx.lineTo(6, -18); ctx.lineTo(2, 6); ctx.lineTo(-20, 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7d8a99'; ctx.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(-16 + k * 6, -20); ctx.lineTo(-18 + k * 6, 3); ctx.stroke();
      }
      ctx.fillStyle = '#c8703a';
      ctx.beginPath(); ctx.arc(-6, -6, 2.6 + Math.sin(game.clock * 6) * 0.8, 0, TAU); ctx.fill();
    }
    ctx.restore();

    if (!done && Math.random() < 0.10) {
      FX.list.push({
        x: px + this.cam.x + 10, y: py + this.cam.y + 6,
        vx: (Math.random() - 0.5) * 14, vy: -26, life: 1.6, max: 1.6,
        color: 'rgba(96,96,108,0.65)', r: 4 + Math.random() * 3, g: -8,
      });
    }
    if (done) this.lights.push({ wx: px + this.cam.x + 16, wy: py + this.cam.y + 16, r: 170, a: 0.75 });
  },

  /* --------------------------- 宇宙人 --------------------------- */
  drawAlien(game, ctx, a) {
    const d = ALIENS[a.sp];
    if (d.form === 'gulpa') return this.drawGulpa(game, ctx, a, d);
    const cam = this.cam;
    const x = a.x - cam.x, y = a.y - cam.y;
    const bob = Math.sin(a.wob) * 2;
    this.shadow(ctx, x, y + 11, 11, 4);
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(a.face, 1);
    if (a.hurt > 0) { ctx.globalAlpha = 0.75; }
    switch (d.form) {
      case 'blob': {
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(0, -2, 11, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.eye || '#333';
        ctx.beginPath(); ctx.arc(-4, -3, 2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -3, 2, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.fillRect(-7, 9, 5, 4); ctx.fillRect(3, 9, 5, 4);
        break;
      }
      case 'bug': {
        ctx.strokeStyle = d.c1; ctx.lineWidth = 2.4;
        for (let k = -1; k <= 1; k++) {
          const p = Math.sin(a.wob * 1.6 + k) * 3;
          ctx.beginPath(); ctx.moveTo(k * 5, 2); ctx.lineTo(k * 5 - 9, 10 + p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(k * 5, 2); ctx.lineTo(k * 5 + 9, 10 - p); ctx.stroke();
        }
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(-3, 0, 12, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(8, -2, 7, 6, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = d.c2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(18, -9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, 1); ctx.lineTo(18, 4); ctx.stroke();
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath(); ctx.arc(10, -3, 1.8, 0, TAU); ctx.fill();
        break;
      }
      case 'tall': {
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.moveTo(-9, 13); ctx.lineTo(-5, -14); ctx.lineTo(5, -14); ctx.lineTo(9, 13); ctx.closePath(); ctx.fill();
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(0, -18, 7, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.eye || '#222';
        ctx.beginPath(); ctx.ellipse(0, -18, 4, 2.2, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = d.c1; ctx.lineWidth = 2.6;
        const sw = Math.sin(a.wob * 0.8) * 3;
        ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-11, 2 + sw); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(11, 2 - sw); ctx.stroke();
        break;
      }
      case 'beast': {
        ctx.strokeStyle = d.c1; ctx.lineWidth = 3;
        for (let k = 0; k < 4; k++) {
          const p = Math.sin(a.wob * 1.8 + k * 1.6) * 3;
          ctx.beginPath(); ctx.moveTo(-8 + k * 6, 4); ctx.lineTo(-9 + k * 6 + p, 13); ctx.stroke();
        }
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(12, -4, 8, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(20, 3); ctx.lineTo(15, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff6a5a';
        ctx.beginPath(); ctx.arc(14, -6, 2, 0, TAU); ctx.fill();
        break;
      }
      default: { /* drone */
        const hov = Math.sin(a.wob * 1.2) * 3;
        ctx.translate(0, hov);
        ctx.fillStyle = d.c1;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const ang = (k / 6) * TAU; const px = Math.cos(ang) * 13, py = Math.sin(ang) * 10; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -10, 14, 3, 0, 0, TAU); ctx.stroke();
        this.lights.push({ wx: a.x, wy: a.y, r: 70, a: 0.5 });
        break;
      }
    }
    ctx.restore();

    /* HP バー (敵だけ、傷ついているとき) */
    if (d.hostile && a.hp < a.maxhp) {
      const w = 26;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2, y - 24, w, 4);
      ctx.fillStyle = '#ff6a5a'; ctx.fillRect(x - w / 2, y - 24, w * (a.hp / a.maxhp), 4);
    }
    if (!d.hostile && game.nearAlien === a) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💬', x, y - 24);
    }
  },


  /* 一つ目・大あたま・大きな口・細い脚の四足獣を真上から見た姿 */
  drawGulpa(game, ctx, a, d) {
    const cam = this.cam;
    const x = a.x - cam.x, y = a.y - cam.y;
    const c1 = (a.skin && a.skin[0]) || d.c1;
    const c2 = (a.skin && a.skin[1]) || d.c2;

    /* 進む向きへゆっくり体を向ける */
    const moving = Math.hypot(a.vx, a.vy) > 6;
    const want = moving ? Math.atan2(a.vy, a.vx) : (a.ang !== undefined ? a.ang : (a.face > 0 ? 0 : Math.PI));
    if (a.ang === undefined) a.ang = want;
    let diff = ((want - a.ang + Math.PI * 3) % TAU) - Math.PI;
    a.ang += diff * 0.16;

    const step = Math.sin(a.wob * (moving ? 1.5 : 0.35));
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 6, 24, 15, 0, 0, TAU); ctx.fill();
    ctx.rotate(a.ang);
    ctx.scale(1.12, 1.12);
    if (a.hurt > 0) ctx.globalAlpha = 0.75;

    /* 細い四本脚 (前2・後2)。歩くと交互に前後する */
    const legs = [[9, -10, -1], [9, 10, 1], [-12, -10, 1], [-12, 10, -1]];
    ctx.strokeStyle = shade(c1, -38); ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [lx, ly, ph] of legs) {
      const sw = step * ph * 4;
      const sgn = Math.sign(ly);
      const kneeX = lx + sw * 0.5, kneeY = ly + sgn * 7;
      const footX = lx - 3 + sw, footY = ly + sgn * 14;
      ctx.beginPath(); ctx.moveTo(lx, ly * 0.45); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
      ctx.fillStyle = shade(c1, -55);
      ctx.beginPath(); ctx.ellipse(footX, footY + sgn * 1.2, 5, 3.4, 0, 0, TAU); ctx.fill();
    }

    /* 胴 (小さめ) */
    ctx.fillStyle = shade(c1, -18);
    ctx.beginPath(); ctx.ellipse(-8, 0, 15, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(-7, -1, 13, 10, 0, 0, TAU); ctx.fill();
    /* 背中のまだら */
    ctx.fillStyle = shade(c2, -40);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(-12, -4, 4, 2.6, 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-4, 4, 3.4, 2.2, -0.3, 0, TAU); ctx.fill();
    ctx.globalAlpha = a.hurt > 0 ? 0.75 : 1;

    /* 頭 ― 体より大きい */
    ctx.fillStyle = shade(c1, -10);
    ctx.beginPath(); ctx.ellipse(11, 0, 21, 18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(10, -1, 19, 16, 0, 0, TAU); ctx.fill();

    /* 大きな口 ― 頭の前ぜんぶ。噛むと大きく開く */
    const open = a.chew > 0 ? clamp(a.chew * 3.2, 0, 1) : (a.tame >= 100 ? 0.2 : 0.1);
    const jaw = 13 + open * 9;                     /* 口の縦幅 */
    ctx.fillStyle = d.mouth || '#3a1f38';
    ctx.beginPath();
    ctx.moveTo(15, -jaw);
    ctx.quadraticCurveTo(29 + open * 8, -jaw * 0.55, 29 + open * 10, 0);
    ctx.quadraticCurveTo(29 + open * 8, jaw * 0.55, 15, jaw);
    ctx.quadraticCurveTo(21, 0, 15, -jaw);
    ctx.closePath(); ctx.fill();
    /* 上下の牙 */
    ctx.fillStyle = '#f6f2e8';
    for (let k = 0; k < 5; k++) {
      const t0 = k / 4;
      const ux = 16 + t0 * (14 + open * 8), uy = -jaw + t0 * jaw * 0.42;
      ctx.beginPath(); ctx.moveTo(ux - 2.6, uy); ctx.lineTo(ux + 2.6, uy); ctx.lineTo(ux, uy + 5.2); ctx.closePath(); ctx.fill();
      const lx2 = 16 + t0 * (14 + open * 8), ly2 = jaw - t0 * jaw * 0.42;
      ctx.beginPath(); ctx.moveTo(lx2 - 2.6, ly2); ctx.lineTo(lx2 + 2.6, ly2); ctx.lineTo(lx2, ly2 - 5.2); ctx.closePath(); ctx.fill();
    }
    /* 舌 */
    if (open > 0.4) {
      ctx.fillStyle = '#c2647f';
      ctx.beginPath(); ctx.ellipse(24, 0, 6 * open, 4 * open, 0, 0, TAU); ctx.fill();
    }
    /* 口の縁 */
    ctx.strokeStyle = shade(c1, -45); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(15, -jaw); ctx.quadraticCurveTo(21, 0, 15, jaw); ctx.stroke();

    /* ひとつ目 ― 頭のまんなか。近くの人を見る */
    const cyc = (game.clock * 0.75 + (a.wob % 7)) % 5.5;
    const blinking = cyc > 5.36;                   /* 5.5 秒に一度、ぱちりと閉じる */
    const f = game.focus();
    const la = Math.atan2(f.y - a.y, f.x - a.x) - a.ang;
    const ex = 6, ey = 0, er = 9.5;
    ctx.fillStyle = shade(c1, -60);
    ctx.beginPath(); ctx.arc(ex, ey, er + 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = d.eye || '#f4ffd2';
    ctx.beginPath(); ctx.ellipse(ex, ey, er, blinking ? 1.5 : er, 0, 0, TAU); ctx.fill();
    if (!blinking) {
      ctx.fillStyle = d.pupil || '#2a1f3a';
      ctx.beginPath(); ctx.arc(ex + Math.cos(la) * 3.4, ey + Math.sin(la) * 3.4, 4.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(ex + Math.cos(la) * 3.4 - 1.6, ey + Math.sin(la) * 3.4 - 2, 1.6, 0, TAU); ctx.fill();
    }
    /* 尻尾 */
    ctx.strokeStyle = shade(c1, -12); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-19, 0);
    ctx.quadraticCurveTo(-26, step * 4, -31, step * 8);
    ctx.stroke();

    /* 鞍 */
    if (a.tame >= 100) {
      ctx.fillStyle = shade(c2, -28);
      ctx.beginPath(); ctx.ellipse(-13, 0, 9.5, 11.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(c2, -12);
      ctx.beginPath(); ctx.ellipse(-13, 0, 7, 9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = shade(c2, -55); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-13, -12.5); ctx.lineTo(-13, 12.5); ctx.stroke();
    }

    /* 乗り手 (鞍の上に真上から) */
    if (a.ridden) {
      ctx.translate(-13, 0);
      ctx.fillStyle = '#dfe7f0';
      this.roundRect(ctx, -7, -8.5, 15, 17, 6); ctx.fill();
      ctx.fillStyle = '#f26a4a';
      ctx.fillRect(-7, -2, 15, 4);
      ctx.fillStyle = '#aab6c4';
      ctx.fillRect(-9, -6, 3, 12);
      ctx.fillStyle = '#f6fafd';
      ctx.beginPath(); ctx.arc(1.5, 0, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2f4a6a';
      ctx.beginPath(); ctx.ellipse(3.4, 0, 2.2, 3, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (a.ridden) this.lights.push({ wx: a.x, wy: a.y, r: 110, a: 0.6 });

    /* なつき具合 */
    if (a.tame > 0 && a.tame < 100) {
      const w = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - w / 2, y - 34, w, 5);
      ctx.fillStyle = '#ff9ec4'; ctx.fillRect(x - w / 2 + 1, y - 33, (w - 2) * (a.tame / 100), 3);
    }
    if (game.nearAlien === a && !a.ridden) {
      ctx.font = 'bold 13px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(a.tame >= 100 ? '🏇' : '🍡', x, y - 36);
    }
    if (a.hp < a.maxhp) {
      const w = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2, y - 42, w, 4);
      ctx.fillStyle = '#ff6a5a'; ctx.fillRect(x - w / 2, y - 42, w * (a.hp / a.maxhp), 4);
    }
  },

  /* --------------------------- 主人公 --------------------------- */
  drawPlayer(game, ctx) {
    const p = game.player, cam = this.cam;
    const x = p.x - cam.x, y = p.y - cam.y;
    const moving = Math.hypot(p.vx, p.vy) > 8;
    const sw = moving ? Math.sin(p.walk * 2) * 3.5 : 0;
    this.shadow(ctx, x, y + 11, 9, 3.5);
    ctx.save();
    ctx.translate(x, y);
    if (p.hurt > 0) ctx.globalAlpha = 0.7;
    /* 脚 */
    ctx.fillStyle = '#3f4a5a';
    ctx.fillRect(-5, 4 + sw * 0.3, 4, 9 - sw * 0.3);
    ctx.fillRect(1, 4 - sw * 0.3, 4, 9 + sw * 0.3);
    /* 胴 (宇宙服) */
    ctx.fillStyle = '#e8eef4';
    this.roundRect(ctx, -7, -8, 14, 14, 4); ctx.fill();
    ctx.fillStyle = '#f26a4a';
    ctx.fillRect(-7, -3, 14, 3);
    /* 背中のタンク */
    ctx.fillStyle = '#9aa8b8';
    ctx.fillRect(p.face > 0 ? -10 : 6, -7, 4, 10);
    /* 腕 */
    ctx.strokeStyle = '#e8eef4'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-9 + sw * 0.5, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(9 - sw * 0.5, 2); ctx.stroke();
    /* ヘルメット */
    ctx.fillStyle = '#f4f8fc';
    ctx.beginPath(); ctx.arc(0, -14, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2f4a6a';
    ctx.beginPath(); ctx.ellipse(p.face * 1.6, -14, 5.5, 4.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(p.face * 1.6 - 1.6, -15.6, 2, 1.3, -0.4, 0, TAU); ctx.fill();
    /* 手に持った道具 */
    const held = game.heldItem();
    if (held && (ITEMS[held] && ITEMS[held].kind === 'tool')) {
      ctx.font = '13px system-ui, "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sway = game.swing > 0 ? -game.swing * 0.9 : 0;
      ctx.save(); ctx.translate(p.face * 11, -2); ctx.rotate(sway); ctx.fillText(ITEMS[held].icon, 0, 0); ctx.restore();
    }
    ctx.restore();
    this.lights.push({ wx: p.x, wy: p.y, r: 95, a: 0.6 });
  },

  /* --------------------------- ロボット --------------------------- */
  drawRobot(game, ctx, r) {
    const cam = this.cam;
    const x = r.x - cam.x, y = r.y - cam.y;
    const c = r.colors;
    const moving = Math.hypot(r.vx, r.vy) > 8;
    const sw = moving ? Math.sin(r.walk * 1.6) * 4 : Math.sin(r.walk) * 0.6;
    /* 乗っているときは狙っている方を向く */
    const face = r.ridden ? (Math.cos(r.aim) >= 0 ? 1 : -1) : (r.face || 1);
    const vert = r.ridden ? clamp(Math.sin(r.aim), -1, 1) : 0;

    this.shadow(ctx, x, y + 15, 16, 6);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    if (r.hurt > 0) ctx.globalAlpha = 0.75;

    /* 奥側のアーム: ふだんは体の後ろで外へ、使うときは前へ回す */
    const leftFront = r.swing.left > 0.02;
    if (!leftFront) this.drawArm(ctx, r, 'left', -13, -5, vert * 0.6, -sw, 0.84, true);

    /* 脚 */
    ctx.fillStyle = shade(c.arm, -25);
    ctx.fillRect(-10, 5 + sw * 0.35, 7, 13 - sw * 0.35);
    ctx.fillRect(3, 5 - sw * 0.35, 7, 13 + sw * 0.35);
    ctx.fillStyle = shade(c.arm, -55);
    this.roundRect(ctx, -12, 16, 10, 5, 2); ctx.fill();
    this.roundRect(ctx, 2, 16, 10, 5, 2); ctx.fill();

    /* 胴 */
    ctx.fillStyle = shade(c.body, -18);
    this.roundRect(ctx, -15, -13, 30, 22, 7); ctx.fill();
    ctx.fillStyle = c.body;
    this.roundRect(ctx, -15, -14, 30, 20, 7); ctx.fill();
    ctx.fillStyle = c.accent;
    this.roundRect(ctx, -15, -14, 30, 7, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(-15, 3, 30, 3);

    if (r.ridden) {
      /* 操縦席: 胸のキャノピーに乗り手が座っている */
      ctx.fillStyle = '#1d2833';
      this.roundRect(ctx, -10, -10, 20, 15, 5); ctx.fill();
      /* 座っている乗り手 */
      ctx.fillStyle = '#e8eef4';
      this.roundRect(ctx, -5, -2.5, 10, 7, 3); ctx.fill();
      ctx.fillStyle = '#f26a4a';
      ctx.fillRect(-5, -0.5, 10, 1.6);
      ctx.fillStyle = '#f4f8fc';
      ctx.beginPath(); ctx.arc(0, -5.5, 3.8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2f4a6a';
      ctx.beginPath(); ctx.ellipse(1.2, -5.5, 2.2, 1.7, 0, 0, TAU); ctx.fill();
      /* ガラスの映り込み */
      ctx.fillStyle = 'rgba(150,220,255,0.22)';
      ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(-2, -10); ctx.lineTo(4, -10); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(180,220,255,0.35)'; ctx.lineWidth = 1;
      this.roundRect(ctx, -10, -10, 20, 15, 5); ctx.stroke();
    } else {
      ctx.fillStyle = c.glow;
      ctx.shadowColor = c.glow; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, -1, 3.4, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }

    /* 頭 */
    ctx.fillStyle = shade(c.body, 14);
    this.roundRect(ctx, -10, -28, 20, 16, 6); ctx.fill();
    ctx.fillStyle = '#1e242c';
    this.roundRect(ctx, -8, -25, 16, 9, 4); ctx.fill();
    ctx.fillStyle = c.glow;
    ctx.shadowColor = c.glow; ctx.shadowBlur = 7;
    const blink = (Math.sin(game.clock * 0.7 + r.id) > 0.985) ? 0.2 : 1;
    ctx.fillRect(-5.5, -23 + (1 - blink) * 2.5, 4.5, 5 * blink);
    ctx.fillRect(1.5, -23 + (1 - blink) * 2.5, 4.5, 5 * blink);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(7, -28); ctx.lineTo(11, -35); ctx.stroke();
    ctx.fillStyle = c.glow;
    ctx.beginPath(); ctx.arc(11, -36, 2.2, 0, TAU); ctx.fill();

    /* 手前のアーム */
    this.drawArm(ctx, r, 'right', 12, -6, vert, sw, 1, false);
    if (leftFront) this.drawArm(ctx, r, 'left', 6, -4, vert, -sw, 0.9, false);
    ctx.restore();

    if (!r.ridden && !r.preview) {
      const w = 28;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      this.roundRect(ctx, x - w / 2, y - 42, w, 6, 3); ctx.fill();
      ctx.fillStyle = r.batt > 25 ? '#7fe8a0' : '#ff8a5a';
      ctx.fillRect(x - w / 2 + 1.5, y - 40.5, (w - 3) * (r.batt / r.maxbatt), 3);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, x, y - 46);
    }
    this.lights.push({ wx: r.x, wy: r.y - 8, r: r.ridden ? 130 : 70, a: 0.7 });
  },

  /* 肩から先。shape ごとに手先が変わる */
  drawArm(ctx, r, side, ox, oy, vert, sw, scale, mirror) {
    const c = r.colors;
    const armId = r.arms[side];
    const swing = r.swing[side];
    const ang = (side === 'left' ? 0.42 : 0.28) + vert * 0.85 + sw * 0.02 - swing * 0.55;
    ctx.save();
    ctx.translate(ox, oy);
    if (mirror) ctx.scale(-1, 1);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    ctx.globalAlpha = side === 'left' ? 0.92 : 1;
    /* 上腕 */
    ctx.fillStyle = side === 'left' ? shade(c.arm, -22) : c.arm;
    this.roundRect(ctx, -3, -4.5, 17, 9, 4); ctx.fill();
    ctx.translate(15, 0);
    if (!armId) {
      ctx.fillStyle = shade(c.arm, -35);
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill();
      ctx.restore(); return;
    }
    const shape = ARMS[armId].shape;
    switch (shape) {
      case 'drill': {
        ctx.fillStyle = shade(c.arm, -25);
        this.roundRect(ctx, -3, -5.5, 8, 11, 3); ctx.fill();
        ctx.fillStyle = '#ccd3dd';
        ctx.beginPath(); ctx.moveTo(4, -5.5); ctx.lineTo(20 + swing * 5, 0); ctx.lineTo(4, 5.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(6 + k * 4.5, -4 + k * 1.1); ctx.lineTo(6 + k * 4.5, 4 - k * 1.1); ctx.stroke(); }
        break;
      }
      case 'claw': {
        ctx.fillStyle = shade(c.arm, -25); this.roundRect(ctx, -3, -4.5, 9, 9, 3); ctx.fill();
        ctx.strokeStyle = '#ccd3dd'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        const open = 3 + swing * 4.5;
        ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(15, -open); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, 2); ctx.lineTo(15, open); ctx.stroke();
        break;
      }
      case 'nozzle': {
        ctx.fillStyle = shade(c.arm, -25); this.roundRect(ctx, -3, -4.5, 9, 9, 3); ctx.fill();
        ctx.fillStyle = '#78bde8';
        ctx.beginPath(); ctx.moveTo(6, -5.5); ctx.lineTo(16, -3.5); ctx.lineTo(16, 3.5); ctx.lineTo(6, 5.5); ctx.closePath(); ctx.fill();
        if (swing > 0.15) {
          ctx.fillStyle = `rgba(126,200,255,${swing * 0.75})`;
          ctx.beginPath(); ctx.moveTo(16, -3.5); ctx.lineTo(32, -12); ctx.lineTo(32, 12); ctx.lineTo(16, 3.5); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'tube': {
        ctx.fillStyle = shade(c.arm, -25); this.roundRect(ctx, -3, -5.5, 9, 11, 3); ctx.fill();
        ctx.fillStyle = '#8fd07a'; this.roundRect(ctx, 6, -3.5, 11, 7, 2); ctx.fill();
        ctx.fillStyle = '#4f8a3f'; ctx.fillRect(15, -4.5, 3, 9);
        if (swing > 0.15) {
          ctx.fillStyle = '#b6f08a';
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(20 + k * 6, (k - 1) * 5, 2, 0, TAU); ctx.fill(); }
        }
        break;
      }
      case 'blade': {
        ctx.fillStyle = shade(c.arm, -25); this.roundRect(ctx, -3, -4.5, 8, 9, 3); ctx.fill();
        ctx.fillStyle = '#b8c0cc';
        for (let k = 0; k < 3; k++) {
          ctx.save(); ctx.translate(11, 0); ctx.rotate(swing * 7 + k * 2.1);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9, -3.4); ctx.lineTo(9, 3.4); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        break;
      }
      default: { /* barrel */
        ctx.fillStyle = shade(c.arm, -25); this.roundRect(ctx, -3, -5.5, 9, 11, 3); ctx.fill();
        ctx.fillStyle = '#5f6a78'; this.roundRect(ctx, 6, -3.8, 14, 7.6, 2); ctx.fill();
        ctx.fillStyle = c.glow;
        ctx.shadowColor = c.glow; ctx.shadowBlur = swing > 0 ? 12 : 4;
        ctx.beginPath(); ctx.arc(20, 0, 2.8 + swing * 2.4, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
    }
    ctx.restore();
  },

  /* --------------------------- 夜と光 --------------------------- */
  drawNight(game, ctx) {
    const dark = game.darkness();
    if (dark < 0.04) return;
    const cam = this.cam;
    const w = Math.ceil(cam.w), h = Math.ceil(cam.h);
    if (!this.lightCanvas) this.lightCanvas = document.createElement('canvas');
    const lc = this.lightCanvas;
    if (lc.width !== w || lc.height !== h) { lc.width = w; lc.height = h; }
    const lx = lc.getContext('2d');
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, w, h);
    lx.fillStyle = mixHex(game.world.planet.night, '#000000', 0.25);
    lx.globalAlpha = dark * 0.86;
    lx.fillRect(0, 0, w, h);
    lx.globalAlpha = 1;
    lx.globalCompositeOperation = 'destination-out';
    for (const L of this.lights) {
      const x = (L.wx !== undefined ? L.wx : L.x) - cam.x;
      const y = (L.wy !== undefined ? L.wy : L.y) - cam.y;
      if (x < -200 || y < -200 || x > w + 200 || y > h + 200) continue;
      const g = lx.createRadialGradient(x, y, 0, x, y, L.r);
      g.addColorStop(0, `rgba(0,0,0,${L.a})`);
      g.addColorStop(0.6, `rgba(0,0,0,${L.a * 0.45})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = g;
      lx.beginPath(); lx.arc(x, y, L.r, 0, TAU); lx.fill();
    }
    ctx.drawImage(lc, 0, 0);
  },

  /* --------------------------- ミニマップ --------------------------- */
  drawMinimap(game, canvas, ctx) {
    const W = game.world;
    const dpr = game.dpr || 1;
    if (canvas.height / dpr < 470) return;   /* 画面が低いときは邪魔になるので出さない */
    const scale = 1.6 * dpr;
    const mw = Math.round(W.w * scale), mh = Math.round(W.h * scale);
    const x0 = canvas.width - mw - 14 * dpr, y0 = 96 * dpr;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = 'rgba(12,16,24,0.75)';
    this.roundRect(ctx, x0 - 5, y0 - 5, mw + 10, mh + 10, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = dpr; ctx.stroke();

    if (!this._mm || this._mm.width !== W.w) {
      this._mm = document.createElement('canvas');
      this._mm.width = W.w; this._mm.height = W.h;
      this._mmDirty = true;
    }
    if (this._mmDirty || (game.frame % 30 === 0)) {
      const m = this._mm.getContext('2d');
      const img = m.createImageData(W.w, W.h);
      const P = W.planet;
      const cols = {};
      const toRGB = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      cols[GT.BASE] = toRGB(P.ground); cols[GT.ALT] = toRGB(P.ground2); cols[GT.SAND] = toRGB(P.sand);
      cols[GT.ROCK] = toRGB(P.rock); cols[GT.WATER] = toRGB(P.water); cols[GT.SOIL] = [110, 78, 48];
      for (let i = 0; i < W.ground.length; i++) {
        let c = cols[W.ground[i]] || cols[GT.BASE];
        const o = W.obj[i];
        if (o) {
          if (o.t === 'ore') c = [200, 190, 120];
          else if (o.t === 'station') c = [120, 200, 255];
          else if (o.t === 'ship') c = [255, 240, 200];
          else if (o.t === 'plant') c = [c[0] * 0.7, c[1] * 1.05, c[2] * 0.7];
        }
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
      }
      m.putImageData(img, 0, 0);
      this._mmDirty = false;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._mm, x0, y0, mw, mh);

    /* 印 */
    const dot = (wx, wy, col, sz = 3) => {
      const s2 = sz * dpr;
      ctx.fillStyle = col;
      ctx.fillRect(x0 + (wx / TILE) * scale - s2 / 2, y0 + (wy / TILE) * scale - s2 / 2, s2, s2);
    };
    for (const a of W.aliens) dot(a.x, a.y, ALIENS[a.sp].hostile ? '#ff5a5a' : '#8affc8', 2);
    for (const r of game.robots) if (!r.ridden) dot(r.x, r.y, '#7fe8ff', 3);
    const f = game.focus();
    dot(f.x, f.y, '#ffffff', 4);
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
};
