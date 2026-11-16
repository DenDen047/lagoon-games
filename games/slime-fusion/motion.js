/* =========================================================================
   SLIME FUSION ― わざの うごき
   act() から よばれて、あてる まえの えんしゅつを する。ダメージは そのあと act() / hit() が つける。
   たいあたり … うしろに ためて いっきに ぶつかる      いわなだれ … あいての うえから いわが ふってくる
   ひっかき   … ツメの あとが のこる                    はばたき   … かぜの かたまりが とんでいく
   ========================================================================= */
'use strict';

Object.assign(Battle, {
  /* ms の あいだ まいフレーム draw(ctx, k) を よぶ。k は 0→1。おわると resolve */
  anim(ms, draw) {
    return new Promise((res) => this.anims.push({ t: 0, dur: ms / 1000 / this.mul(), draw, done: res }));
  },
  later(ms, fn) { return wait(ms).then(fn); },
  quake(s) { this.quakeT = Math.max(this.quakeT, s); },

  async motion(u, targets, m) {
    const t0 = targets[0];
    const big = !!m.sig || m.pow >= 80;
    switch (m.id) {
      case 'tackle': return this.mTackle(u, t0);
      case 'horn': return this.mTackle(u, t0, true);
      case 'tail': return this.mTail(u, t0);
      case 'claw': return this.mDash(u, t0);
      case 'wing': return this.mWind(u, targets);
      case 'spike': return this.mSpikes(u, targets);
      case 'gem': return this.mBeam(u, targets, COLORS[m.el].c);
    }
    /* いろわざ と ひっさつわざ は 色で うごきが かわる。ひっさつは 大きく */
    const sc = big ? 1.5 : 1;
    if (big) this.quake(0.3);
    await Promise.all(targets.map((t, i) => this.later(i * 90, () => {
      switch (m.el) {
        case 'earth': return m.pow >= 70 ? this.mFall(u, t, sc, false) : this.mSpray(u, t, '#c9a26a');
        case 'ice': return m.pow >= 70 ? this.mFall(u, t, sc, true) : this.mSpray(u, t, '#e8fbff');
        case 'fire': return this.mFire(u, t, sc);
        case 'water': return this.mWater(u, t, sc);
        case 'grass': return this.mLeaves(u, t, sc);
        case 'thunder': return this.mBolt(u, t, sc);
        case 'dark': return this.mDark(u, t, sc);
        case 'light': return this.mLight(u, t, sc);
        default: Sfx.swing('shoot'); return this.shoot(u, t, mainHex(u.s, u.color), big);
      }
    })));
  },

  /* ------------------------------ からだを つかう わざ ------------------------------ */
  /* うしろに さがって ぺたんと つぶれてから、のびながら いっきに ぶつかる */
  async mTackle(u, t, horn) {
    const dx = t.x - u.x, dy = t.y - u.y, dir = Math.sign(dx) || 1;
    await this.tween(u, (k) => { u.ox = -dir * 28 * k; u.sq = 0.2 * k; }, 220);
    Sfx.swing();
    await this.tween(u, (k) => { u.ox = lerp(-dir * 28, dx * 0.8, k); u.oy = dy * 0.8 * k; u.sq = lerp(0.2, -0.16, k); }, 120);
    u.sq = 0.12;
    this.impact(t.x - dir * t.r * 0.5, t.y - t.r * 0.1, horn ? '#fff2a0' : '#ffffff', horn);
  },
  /* ぶつかった ところに ほしと わっか */
  impact(x, y, col, sharp) {
    this.quake(0.12);
    this.anim(300, (ctx, k) => {
      ctx.save(); ctx.translate(x, y);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = col; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(0, 0, 10 + k * 46, 0, TAU); ctx.stroke();
      ctx.lineWidth = sharp ? 4 : 5; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2, r0 = 12 + k * 26, r1 = r0 + (sharp ? 26 : 14) * (1 - k);
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
      }
      ctx.restore();
    });
  },
  /* とびついて くるっと まわり、しっぽで ビシッ */
  async mTail(u, t) {
    const dx = t.x - u.x, dy = t.y - u.y, dir = Math.sign(dx) || 1;
    await this.tween(u, (k) => { u.ox = dx * 0.55 * k; u.oy = dy * 0.55 * k - Math.sin(k * Math.PI) * 40; }, 220);
    Sfx.swing();
    this.anim(300, (ctx, k) => {
      ctx.save(); ctx.translate(t.x, t.y);
      ctx.globalAlpha = 1 - k * k;
      ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = 10 * (1 - k) + 2;
      const a0 = dir > 0 ? Math.PI * 0.85 : Math.PI * 0.15;
      ctx.beginPath(); ctx.arc(0, 0, t.r * 1.15, a0 - dir * 0.3, a0 + dir * Math.PI * 0.9 * Math.min(1, k * 1.6), dir < 0); ctx.stroke();
      ctx.restore();
    });
    await this.tween(u, (k) => { u.rot = dir * TAU * k; }, 260);
    u.rot = 0;
  },
  /* ひっかく まえに ちかづく。ツメの あとは hit() の slash() が かく */
  async mDash(u, t) {
    const dx = t.x - u.x, dy = t.y - u.y;
    await this.tween(u, (k) => { u.ox = dx * 0.62 * k; u.oy = dy * 0.62 * k - Math.sin(k * Math.PI) * 24; u.sq = -0.1 * k; }, 180);
  },
  slash(t, h) {
    const s = h % 2 ? -1 : 1, R = t.r;
    Sfx.swing();
    this.anim(320, (ctx, k) => {
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(s, 1); ctx.rotate(-0.7);
      ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      ctx.lineCap = 'round';
      const L = R * 1.7, g = Math.min(1, k / 0.35);
      for (let i = -1; i <= 1; i++) {
        const x = i * R * 0.3, y0 = -L / 2 + Math.abs(i) * R * 0.15, y1 = y0 + (L - Math.abs(i) * R * 0.3) * g;
        for (const [c, w] of [['#ff3a5a', 10], ['#ffffff', 4]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
        }
      }
      ctx.restore();
    });
  },
  /* ぶつかった あいてが うしろに ゆれる */
  knock(t, dir) {
    this.tween(t, (k) => { t.ox = dir * 26 * Math.sin(k * Math.PI); }, 320);
  },

  /* ------------------------------ パーツの わざ ------------------------------ */
  /* はねを パタパタ させて、かぜの かたまりを 3つ とばす */
  async mWind(u, targets) {
    await this.tween(u, (k) => { u.oy = -24 * Math.sin(k * Math.PI); u.sq = Math.sin(k * Math.PI * 4) * 0.14; }, 320);
    u.sq = 0;
    const ps = [];
    targets.forEach((t, ti) => { for (let i = 0; i < 3; i++) ps.push(this.later(i * 90 + ti * 60, () => this.gust(u, t, i))); });
    await Promise.all(ps);
  },
  gust(u, t, i) {
    Sfx.swing();
    const x0 = u.x, y0 = u.y - u.r * 0.3 + (i - 1) * u.r * 0.35, x1 = t.x, y1 = t.y + (i - 1) * t.r * 0.3;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    return this.anim(360, (ctx, k) => {
      const x = lerp(x0, x1, k), y = lerp(y0, y1, k) + Math.sin(k * TAU) * 10;
      const R = t.r * (0.45 + 0.35 * k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.globalAlpha = k < 0.8 ? 0.9 : (1 - k) * 4.5;
      ctx.strokeStyle = '#e8ffff'; ctx.lineCap = 'round';
      ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(-R, 0, R, -0.9, 0.9); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-R * 1.5, 0, R * 0.8, -0.8, 0.8); ctx.stroke();
      ctx.lineWidth = 2;
      for (const yy of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(-R * 1.4, yy * R); ctx.lineTo(-R * 2.4, yy * R); ctx.stroke(); }
      ctx.restore();
    });
  },
  /* トゲを なんぼんも とばす */
  async mSpikes(u, targets) {
    const col = shade(mainHex(u.s, u.color), -0.35);
    const ps = [];
    targets.forEach((t) => {
      for (let i = 0; i < 4; i++) ps.push(this.later(i * 70, () => {
        Sfx.swing('shoot');
        const x0 = u.x, y0 = u.y - u.r * 0.6, x1 = t.x + rand(-t.r, t.r) * 0.5, y1 = t.y + rand(-t.r, t.r) * 0.4, arc = rand(50, 110);
        return this.anim(340, (ctx, k) => {
          const x = lerp(x0, x1, k), y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * arc;
          const nx = lerp(x0, x1, k + 0.02), ny = lerp(y0, y1, k + 0.02) - Math.sin((k + 0.02) * Math.PI) * arc;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ny - y, nx - x));
          ctx.fillStyle = col; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -6); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        });
      }));
    });
    await Promise.all(ps);
  },
  /* ほうせきが ひかって、まっすぐな ビーム */
  async mBeam(u, targets, col) {
    await this.anim(240, (ctx, k) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(u.x, u.y, 0, u.x, u.y, u.r * (0.4 + k));
      g.addColorStop(0, rgba(col, 0.9)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(u.x, u.y, u.r * (0.4 + k), 0, TAU); ctx.fill();
      ctx.restore();
    });
    Sfx.swing('beam');
    this.quake(0.15);
    await Promise.all(targets.map((t) => this.anim(380, (ctx, k) => {
      const w = (k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75) * 22;
      ctx.save(); ctx.lineCap = 'round';
      ctx.shadowColor = col; ctx.shadowBlur = 24;
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w * 0.4; ctx.stroke();
      ctx.restore();
    })));
  },

  /* ------------------------------ 色の わざ ------------------------------ */
  /* いわなだれ / つららおとし: あいての うえから ななめに ふってくる */
  mFall(u, t, sc, ice) {
    const dir = Math.sign(t.x - u.x) || 1;
    const n = Math.round(6 * sc), FALL = 0.32, GAP = 0.075, STAY = 0.25;
    const top = -40;
    const rocks = [];
    for (let i = 0; i < n; i++) {
      const s = t.r * rand(0.32, 0.48) * Math.sqrt(sc);
      const pts = [];
      for (let j = 0; j < 7; j++) pts.push([Math.cos((j / 7) * TAU) * s * rand(0.75, 1.15), Math.sin((j / 7) * TAU) * s * rand(0.75, 1.15)]);
      const x1 = t.x + rand(-0.8, 0.8) * t.r, y1 = t.y + rand(-0.4, 0.5) * t.r;
      rocks.push({ s, pts, x0: x1 - dir * rand(80, 160), x1, y1, at: i * GAP, rot: rand(TAU), land: false });
    }
    const total = (n - 1) * GAP + FALL + STAY;
    Sfx.swing();
    return this.anim(total * 1000, (ctx, k) => {
      const T = k * total;
      for (const r of rocks) {
        const lt = (T - r.at) / FALL;
        if (lt < 0) continue;
        const f = Math.min(1, lt);
        if (f >= 1 && !r.land) {
          r.land = true; this.quake(0.12); Sfx.hit(true);
          this.burst(r.x1, r.y1, ice ? '#e8fbff' : '#b08a5a', 6);
        }
        const x = lerp(r.x0, r.x1, f), y = lerp(top, r.y1, f * f);
        ctx.save(); ctx.translate(x, y);
        ctx.globalAlpha = lt <= 1 ? 1 : clamp(1 - (T - r.at - FALL) / STAY, 0, 1);
        if (ice) {
          ctx.rotate(-dir * 0.35);
          const g = ctx.createLinearGradient(0, -r.s * 2, 0, r.s * 1.6);
          g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9fd8f0');
          ctx.fillStyle = g; ctx.strokeStyle = '#5a9ac0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-r.s * 0.6, -r.s * 1.6); ctx.lineTo(r.s * 0.6, -r.s * 1.6); ctx.lineTo(0, r.s * 1.8); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else {
          ctx.rotate(r.rot + f * dir * 3);
          ctx.fillStyle = '#9a6a3a'; ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2.5;
          ctx.beginPath(); r.pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,230,190,0.35)';
          ctx.beginPath(); ctx.arc(-r.s * 0.3, -r.s * 0.3, r.s * 0.3, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    });
  },
  /* すなかけ / こおりのいき: こまかい つぶを ふきつける */
  mSpray(u, t, col) {
    Sfx.swing();
    const dots = [];
    for (let i = 0; i < 40; i++) dots.push({ at: rand(0, 0.35), dy: rand(-1, 1) * t.r * 0.7, s: rand(2, 5), arc: rand(10, 40) });
    return this.anim(520, (ctx, k) => {
      ctx.fillStyle = col;
      for (const d of dots) {
        const f = (k - d.at) / 0.6;
        if (f < 0 || f > 1) continue;
        const x = lerp(u.x, t.x, f), y = lerp(u.y - u.r * 0.2, t.y + d.dy, f) - Math.sin(f * Math.PI) * d.arc;
        ctx.globalAlpha = 1 - f * 0.4;
        ctx.beginPath(); ctx.arc(x, y, d.s, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  },
  /* ひのこ (小さい ひのたま 3つ) / かえんだん (大きい ひのたま) */
  async mFire(u, t, sc) {
    const big = sc > 1, n = big ? 1 : 3, R = big ? t.r * 0.6 : t.r * 0.3;
    await Promise.all(Array.from({ length: n }, (_, i) => this.later(i * 90, () => {
      Sfx.swing('shoot');
      const x0 = u.x, y0 = u.y - u.r * 0.2, x1 = t.x + (i - (n - 1) / 2) * t.r * 0.4, y1 = t.y;
      const pos = (k) => [lerp(x0, x1, k), lerp(y0, y1, k) - Math.sin(k * Math.PI) * 50];
      return this.anim(400, (ctx, k) => {
        ctx.save();
        for (let j = 6; j >= 0; j--) {
          const [x, y] = pos(Math.max(0, k - j * 0.035));
          ctx.fillStyle = j > 3 ? 'rgba(230,50,20,0.55)' : j > 1 ? '#ff7a1a' : '#ffd23a';
          ctx.beginPath(); ctx.arc(x, y + Math.sin(G.time * 30 + j) * 2, R * (1 - j * 0.11), 0, TAU); ctx.fill();
        }
        ctx.restore();
      }).then(() => this.blast(x1, y1, R * 2.4, ['#ffe27a', '#ff8a2a', '#ff3a1a']));
    })));
  },
  /* もえあがる ばくはつ */
  blast(x, y, R, cols) {
    return this.anim(300, (ctx, k) => {
      ctx.save();
      cols.slice().reverse().forEach((c, i) => {
        i = cols.length - 1 - i;
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, R * (0.4 + k * (1 - i * 0.2)), 0, TAU); ctx.fill();
      });
      ctx.restore();
    });
  },
  /* みずでっぽう: なみうつ みずの すじが のびて、さきで しぶきが あがる */
  mWater(u, t, sc) {
    Sfx.swing('beam');
    const x0 = u.x, y0 = u.y - u.r * 0.15;
    let splashed = false;
    return this.anim(520, (ctx, k) => {
      const head = Math.min(1, k / 0.45), tail = Math.max(0, (k - 0.55) / 0.45);
      if (head >= 1 && !splashed) { splashed = true; this.burst(t.x, t.y, '#bfe6ff', 16); }
      const N = 24, w = 15 * sc;
      for (const [c, lw] of [['#1a6ad8', w + 4], ['#3a9cff', w], ['#d6f0ff', w * 0.35]]) {
        ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const f = lerp(tail, head, i / N);
          const x = lerp(x0, t.x, f), y = lerp(y0, t.y, f) + Math.sin(f * 14 - G.time * 30) * 5 * sc;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    });
  },
  /* はっぱカッター / リーフストーム: くるくる まわる はっぱが まがりながら とぶ */
  async mLeaves(u, t, sc) {
    const n = Math.round(4 * sc);
    await Promise.all(Array.from({ length: n }, (_, i) => this.later(i * 60, () => {
      Sfx.swing();
      const x0 = u.x, y0 = u.y - u.r * 0.3, x1 = t.x + rand(-0.4, 0.4) * t.r, y1 = t.y + rand(-0.4, 0.4) * t.r;
      const cx = (x0 + x1) / 2 + rand(-60, 60), cy = Math.min(y0, y1) - rand(40, 140), spin = rand(10, 18), s = t.r * 0.36;
      return this.anim(440, (ctx, k) => {
        const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
        ctx.save(); ctx.translate(a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1); ctx.rotate(k * spin);
        ctx.fillStyle = '#5ad34e'; ctx.strokeStyle = '#1d7424'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.7, s, 0); ctx.quadraticCurveTo(0, s * 0.7, -s, 0); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0); ctx.stroke();
        ctx.restore();
      });
    })));
  },
  /* でんげき: そらから ギザギザの かみなりが おちる */
  mBolt(u, t, sc) {
    Sfx.noise(0.3, 0.1, 1500);
    this.flashA = 0.35 * sc;
    this.quake(0.2);
    return this.anim(380, (ctx, k) => {
      ctx.save();
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      ctx.shadowColor = '#ffe85a'; ctx.shadowBlur = 20; ctx.lineJoin = 'round';
      const pts = [];
      let x = t.x + rand(-30, 30), y = -10;
      const step = (t.y + 10) / 8;
      pts.push([x, y]);
      for (let i = 0; i < 8; i++) { x += rand(-24, 24); y += step; pts.push([i === 7 ? t.x : x, y]); }
      for (const [c, w] of [['#ffe85a', 8 * sc], ['#ffffff', 3 * sc]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
      }
      ctx.restore();
    });
  },
  /* やみのたま: うずを まいた くろい たまが とんで、あいてを つつむ */
  async mDark(u, t, sc) {
    Sfx.swing('beam');
    const R = t.r * 0.32 * sc;
    await this.anim(420, (ctx, k) => {
      const x = lerp(u.x, t.x, k), y = lerp(u.y, t.y, k) - Math.sin(k * Math.PI) * 30;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = '#2a1840'; ctx.shadowColor = '#b06aff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#c08aff';
      for (let i = 0; i < 5; i++) { const a = G.time * 9 + (i / 5) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 1.4, Math.sin(a) * R * 1.4, 3, 0, TAU); ctx.fill(); }
      ctx.restore();
    });
    this.anim(320, (ctx, k) => {
      ctx.save(); ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#8a4aff'; ctx.lineWidth = 8 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (0.4 + k), 0, TAU); ctx.stroke();
      ctx.restore();
    });
  },
  /* ひかりのや: うえから ひかりの すじが なんぼんも ふりそそぐ */
  mLight(u, t, sc) {
    Sfx.swing('laser');
    const rays = Array.from({ length: Math.round(5 * sc) }, () => ({ dx: rand(-0.7, 0.7) * t.r, at: rand(0, 0.3) }));
    return this.anim(480, (ctx, k) => {
      ctx.save(); ctx.lineCap = 'round';
      for (const r of rays) {
        const f = (k - r.at) / 0.5;
        if (f < 0 || f > 1.4) continue;
        const yEnd = lerp(-20, t.y, Math.min(1, f)), yStart = yEnd - 120;
        ctx.globalAlpha = f > 1 ? 1.4 - f : 0.9;
        ctx.strokeStyle = '#ff6ac8'; ctx.lineWidth = 11 * sc;
        ctx.beginPath(); ctx.moveTo(t.x + r.dx, yStart); ctx.lineTo(t.x + r.dx, yEnd); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * sc; ctx.stroke();
      }
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.fillStyle = '#ff9ae0';
      for (let i = 0; i < 4; i++) star(ctx, t.x + Math.cos(i * 1.7 + k * 4) * t.r, t.y + Math.sin(i * 2.3 + k * 4) * t.r * 0.6, 7, 4);
      ctx.restore();
    });
  },
  /* おうえんのうた: おんぷが うかぶ */
  notes(a) {
    this.anim(700, (ctx, k) => {
      ctx.save(); ctx.font = `900 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 3; i++) ctx.fillText(i % 2 ? '♫' : '♪', a.x + (i - 1) * a.r * 0.6 + Math.sin(k * 8 + i) * 8, a.y - a.r * 0.8 - k * 50 - i * 10);
      ctx.restore();
    });
  },
});
