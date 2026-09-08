/* =========================================================================
   SUNSET SHIFT ― 会社（見下ろし）
   伝票をルールどおりに 承認 / 差戻し / 上長へ に振り分ける。
   西向きの窓から差す光は、昼を過ぎると床を伸びてきて、机の影を長くする。
   ========================================================================= */
'use strict';

const Work = {
  active: false,
  docs: [], cur: null, idx: 0, total: 0,
  ok: 0, miss: 0, combo: 0, best: 0,
  rule: null, t: 0, docT: 0, docLimit: 2.6, curMax: 2.6,
  flash: 0, flashCol: '#7ee39b',
  done: false, result: null,
  hero: null,
  prevAxis: 0, prevAxisY: 0,
  h0: 9, h1: 18,
  desks: null,

  initInput(canvas) {
    const hit = (ev) => {
      if (!this.active || !this.cur) return;
      const r = canvas.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      const y0 = G.H * 0.64;
      if (py < y0 - 20 || py > y0 + 74) return;
      const cx = G.W / 2;
      for (const [dx, ans] of [[-210, 'ok'], [0, 'up'], [210, 'back']]) {
        if (Math.abs(px - (cx + dx)) < 62) { ev.preventDefault(); this.judge(ans); return; }
      }
    };
    canvas.addEventListener('pointerdown', hit);
  },

  start(hero, day) {
    this.active = true; this.done = false; this.result = null;
    this.hero = hero;
    this.rule = DOC_RULES[(day - 1) % DOC_RULES.length];
    this.total = 15 + Math.min(6, day);
    this.docs = [];
    for (let i = 0; i < this.total; i++) this.docs.push(this.makeDoc(day));
    this.idx = 0; this.ok = 0; this.miss = 0; this.combo = 0; this.best = 0;
    this.t = 0; this.flash = 0;
    this.docLimit = 2.9 - Math.min(0.7, day * 0.06);
    if (hero.def.id === 'bio' && hero.def.side.id === 'smell') this.docLimit -= 0.3;
    this.buildRoom();
    this.next();
    G.hour = this.h0;
  },

  buildRoom() {
    const rng = new RNG(1234 + G.day);
    this.desks = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        this.desks.push({
          x: 0.3 + c * 0.22, y: 0.2 + r * 0.24,
          who: rng.i(0, 3), mug: rng.chance(0.6), stack: rng.chance(0.7),
        });
      }
    }
  },

  makeDoc(day) {
    const amount = pick([
      randi(2, 9) * 10000, randi(10, 49) * 10000, randi(50, 99) * 10000,
      randi(100, 240) * 10000, randi(1, 9) * 100000,
    ]);
    return {
      client: pick(CLIENTS), kind: pick(DOC_KINDS), amount,
      isNew: chance(0.38), rush: chance(0.3), urgent: chance(0.14 + day * 0.01),
      no: 'T-' + randi(1000, 9999),
    };
  },

  next() {
    if (this.idx >= this.docs.length) { this.finish(); return; }
    this.cur = this.docs[this.idx++];
    this.docT = this.cur.urgent ? this.docLimit * 0.6 : this.docLimit;
    this.curMax = this.docT;
  },

  judge(ans) {
    if (!this.cur) return;
    const want = this.rule.judge(this.cur);
    if (ans === want) {
      this.ok++; this.combo++; this.best = Math.max(this.best, this.combo);
      this.flash = 0.35; this.flashCol = '#7ee39b';
      Sfx.tone(720 + Math.min(6, this.combo) * 60, 0.07, 'triangle', 0.06);
      if (this.combo > 0 && this.combo % 5 === 0) FX.text(G.W / 2, G.H * 0.44, this.combo + '連続', '#ffd28a', 22);
    } else {
      this.miss++; this.combo = 0;
      this.flash = 0.4; this.flashCol = '#ff5f6d';
      Sfx.bad();
      const label = { ok: '承認', back: '差戻し', up: '上長へ' };
      FX.text(G.W / 2, G.H * 0.42, '正しくは ' + label[want], '#ff8a7a', 18);
    }
    this.next();
  },

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    G.hour = lerp(this.h0, this.h1, clamp(this.idx / this.total, 0, 1));

    const ax = Input.axis.x, ay = Input.axis.y;
    let l = Input.consume('left'), r = Input.consume('right'), u = Input.consume('up');
    if (ax < -0.5 && this.prevAxis >= -0.5) l = true;
    if (ax > 0.5 && this.prevAxis <= 0.5) r = true;
    if (ay < -0.5 && this.prevAxisY >= -0.5) u = true;
    this.prevAxis = ax; this.prevAxisY = ay;
    Input.consume('down');

    if (this.cur) {
      if (l) this.judge('ok');
      else if (r) this.judge('back');
      else if (u) this.judge('up');
      else {
        this.docT -= dt;
        if (this.docT <= 0) {
          this.miss++; this.combo = 0;
          this.flash = 0.4; this.flashCol = '#ff5f6d';
          FX.text(G.W / 2, G.H * 0.42, '時間切れ', '#ff8a7a', 18);
          Sfx.bad();
          this.next();
        }
      }
    }
    FX.update(dt);
  },

  finish() {
    this.cur = null;
    this.active = false;
    this.done = true;
    const rate = this.ok / this.total;
    let dRating = rate >= 0.9 ? 6 : rate >= 0.75 ? 3 : rate >= 0.6 ? 0 : -5;
    if (this.miss === 0) dRating += 2;
    const pay = Math.round(COMPANY.pay + this.ok * 260 + this.best * 120);
    this.result = { ok: this.ok, miss: this.miss, total: this.total, rate, pay, dRating, best: this.best };
  },

  /* ------------------------------ 描画 ------------------------------ */
  draw(ctx, W, H) {
    const L = Sky.light(G.hour);
    const p = L.pal;
    if (!this.desks) this.buildRoom();

    /* 床。 */
    const fg = ctx.createLinearGradient(0, 0, W, H);
    fg.addColorStop(0, mix('#5a5f6b', L.ambC, 0.16));
    fg.addColorStop(1, mix('#464b56', L.ambC, 0.1));
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
    /* タイルカーペット。 */
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    /* 壁。西（左）に窓。 */
    const wallW = 34;
    const winY0 = H * 0.16, winY1 = H * 0.74;
    ctx.fillStyle = mix('#2e333d', L.ambC, 0.12);
    ctx.fillRect(0, 0, wallW, H);
    ctx.fillRect(0, 0, W, wallW * 0.7);
    ctx.fillStyle = mix('#3a404c', L.ambC, 0.1);
    ctx.fillRect(wallW - 5, 0, 5, H);

    /* 窓のガラス。外の光の色をそのまま出す。 */
    const wg = ctx.createLinearGradient(0, winY0, wallW, winY1);
    wg.addColorStop(0, mix(p.hor, '#ffffff', 0.25));
    wg.addColorStop(1, p.mid);
    ctx.fillStyle = wg;
    ctx.fillRect(2, winY0, wallW - 6, winY1 - winY0);
    ctx.strokeStyle = '#1b2029'; ctx.lineWidth = 4;
    ctx.strokeRect(2, winY0, wallW - 6, winY1 - winY0);
    for (let i = 1; i < 4; i++) {
      const y = winY0 + (winY1 - winY0) * i / 4;
      ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(wallW - 4, y); ctx.stroke();
    }

    /* 差しこむ光。太陽が西へ回ってから、床を伸びてくる。 */
    const beam = clamp(L.dir.x, 0, 1) * clamp(L.direct, 0, 1);
    if (beam > 0.03) {
      const len = (260 + 900 * beam) * (0.6 + L.golden);
      const dx = L.dir.x, dy = L.dir.y;
      const col = mix(L.warm, '#ff8a3c', clamp(0.2 + L.golden * 0.7, 0, 0.85));
      const a = clamp(0.16 + beam * 0.34 + L.golden * 0.3, 0, 0.62);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(wallW, (winY0 + winY1) / 2, wallW + dx * len, (winY0 + winY1) / 2 + dy * len);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.7, rgba(col, a * 0.35));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(wallW, winY0);
      ctx.lineTo(wallW, winY1);
      ctx.lineTo(wallW + dx * len + dy * 40, winY1 + dy * len + 60);
      ctx.lineTo(wallW + dx * len - dy * 40, winY0 + dy * len - 60);
      ctx.closePath(); ctx.fill();
      /* 窓枠の影。 */
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba('#000000', 0.16 * beam);
      ctx.lineWidth = 7;
      for (let i = 1; i < 4; i++) {
        const y = winY0 + (winY1 - winY0) * i / 4;
        ctx.beginPath();
        ctx.moveTo(wallW, y);
        ctx.lineTo(wallW + dx * len, y + dy * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 机。影は太陽の向きへ。 */
    for (const d of this.desks) this.desk(ctx, W, H, d, L, false);
    this.desk(ctx, W, H, { x: 0.5, y: 0.86, who: -1, mug: true, stack: true, mine: true }, L, true);

    /* ルールと成績。 */
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.beginPath(); ctx.roundRect(W * 0.4, 104, W * 0.56, 74, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffd28a';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('今日のさばき方', W * 0.42, 114);
    ctx.fillStyle = '#eef2ff';
    ctx.font = `600 15px ${FONT}`;
    this.wrap(ctx, this.rule.text, W * 0.42, 136, W * 0.52, 20);

    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.beginPath(); ctx.roundRect(18, 104, 230, 74, 12); ctx.fill();
    ctx.fillStyle = '#9aa6c4'; ctx.font = `600 12px ${FONT}`;
    ctx.fillText(`${COMPANY.name} ${COMPANY.dept}`, 30, 112);
    ctx.fillStyle = '#eef2ff'; ctx.font = `800 20px ${FONT}`;
    ctx.fillText(`${this.idx} / ${this.total} 件`, 30, 130);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = '#7ee39b'; ctx.fillText(`○ ${this.ok}`, 30, 156);
    ctx.fillStyle = '#ff8a7a'; ctx.fillText(`× ${this.miss}`, 84, 156);
    ctx.fillStyle = '#ffd28a'; ctx.fillText(`${this.combo} 連続`, 140, 156);

    if (this.cur) this.drawDoc(ctx, W, H, this.cur, L);
    for (let i = 0; i < 3; i++) {
      const d = this.docs[this.idx + i];
      if (!d) break;
      ctx.save();
      ctx.globalAlpha = 0.22 - i * 0.055;
      ctx.fillStyle = '#f2ece0';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 130 + (i + 1) * 26, H * 0.28 - (i + 1) * 8, 260, 150, 10);
      ctx.fill();
      ctx.restore();
    }

    this.hint(ctx, W / 2 - 210, H * 0.64, '←', '承認', '#7ee39b');
    this.hint(ctx, W / 2, H * 0.64, '↑', '上長へ', '#ffd05c');
    this.hint(ctx, W / 2 + 210, H * 0.64, '→', '差戻し', '#ff8a7a');

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.45;
      ctx.fillStyle = this.flashCol;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    FX.draw(ctx, { x: 0, y: 0 });
    Sky.ambientPass(ctx, W, H, L);
    Sky.grade(ctx, W, H, L);
  },

  /* 机ひとつ。上から見た形。 */
  desk(ctx, W, H, d, L, mine) {
    const x = d.x * W, y = d.y * H;
    const dw = mine ? 240 : 150, dh = mine ? 96 : 74;
    const sx = L.dir.x * 26 * L.len, sy = L.dir.y * 26 * L.len;

    /* 影。 */
    ctx.save();
    ctx.globalAlpha = clamp(L.alpha * 1.1, 0.08, 0.5);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(x - dw / 2 + sx, y - dh / 2 + sy, dw, dh, 8);
    ctx.fill();
    ctx.restore();

    /* 天板。 */
    const g = ctx.createLinearGradient(x - dw / 2, y - dh / 2, x + dw / 2, y + dh / 2);
    g.addColorStop(0, mix('#8d7f6a', L.warm, clamp(L.golden * 0.3, 0, 0.35)));
    g.addColorStop(1, mix('#6f6455', L.ambC, 0.12));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x - dw / 2, y - dh / 2, dw, dh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(30,26,20,0.4)'; ctx.lineWidth = 2; ctx.stroke();

    /* モニタとキーボード。 */
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.roundRect(x - dw * 0.3, y - dh / 2 + 6, dw * 0.6, 14, 3); ctx.fill();
    ctx.fillStyle = rgba('#6fd3ff', 0.45);
    ctx.fillRect(x - dw * 0.28, y - dh / 2 + 8, dw * 0.56, 10);
    ctx.fillStyle = '#2b303a';
    ctx.beginPath(); ctx.roundRect(x - dw * 0.22, y + 2, dw * 0.44, 16, 3); ctx.fill();
    if (d.mug) {
      ctx.fillStyle = '#e8e2d6';
      ctx.beginPath(); ctx.arc(x + dw * 0.38, y - 6, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a1c';
      ctx.beginPath(); ctx.arc(x + dw * 0.38, y - 6, 4.4, 0, TAU); ctx.fill();
    }
    if (d.stack) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = mix(i % 2 ? '#f2ece0' : '#e0d8c8', L.warm, clamp(L.golden * 0.3, 0, 0.35));
        ctx.fillRect(x - dw * 0.44 + i, y - 4 - i * 1.5, 30, 22);
      }
    }
    /* 椅子と人。 */
    if (d.who >= 0) {
      const cols = ['#5a6274', '#6b5a52', '#4a5a6b', '#6b5a6b'];
      const cy = y + dh / 2 + 26;
      ctx.save();
      ctx.globalAlpha = clamp(L.alpha, 0.08, 0.45);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x + sx * 0.7, cy + sy * 0.7, 20, 16, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2a3040';
      ctx.beginPath(); ctx.arc(x, cy + 6, 19, 0, TAU); ctx.fill();
      ctx.fillStyle = cols[d.who];
      ctx.beginPath(); ctx.ellipse(x, cy, 15, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = mix('#e9b189', L.warm, clamp(L.golden * 0.3, 0, 0.3));
      ctx.beginPath(); ctx.arc(x, cy - 4, 9.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(20,22,30,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#2b2e3c';
      ctx.beginPath(); ctx.arc(x, cy - 7, 8, 0, TAU); ctx.fill();
    }
  },

  drawDoc(ctx, W, H, d, L) {
    const x = W / 2, y = H * 0.28;
    const w = 300, h = 168;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + L.dir.x * 14, y + 10 + L.dir.y * 8, w, h, 10);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    const pg = ctx.createLinearGradient(0, 0, 0, h);
    pg.addColorStop(0, mix('#fbf7ef', L.warm, clamp(L.golden * 0.3, 0, 0.34)));
    pg.addColorStop(1, mix('#e4dccc', L.ambC, 0.1));
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#6b6255';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(d.no, -w / 2 + 18, 16);
    ctx.textAlign = 'right';
    ctx.fillText(d.kind, w / 2 - 18, 16);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1c1f28';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(d.client, -w / 2 + 18, 42);
    ctx.fillStyle = d.amount >= 500000 ? '#a8321c' : '#2a2f3a';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText('¥' + yen(d.amount), -w / 2 + 18, 76);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = d.isNew ? '#1c5fa8' : '#5a6270';
    ctx.fillText(d.isNew ? '● 新規の取引先' : '○ 継続の取引先', -w / 2 + 18, 120);
    ctx.fillStyle = d.rush ? '#a8321c' : '#5a6270';
    ctx.fillText(d.rush ? '● 納期は今週' : '○ 納期は来月以降', -w / 2 + 18, 140);

    if (d.urgent) {
      ctx.save();
      ctx.translate(w / 2 - 62, 118);
      ctx.rotate(-0.22);
      ctx.strokeStyle = '#c8321c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-34, -16, 68, 32, 5); ctx.stroke();
      ctx.fillStyle = '#c8321c';
      ctx.font = `800 19px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('至急', 0, 1);
      ctx.restore();
    }

    const k = clamp(this.docT / this.curMax, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-w / 2 + 10, h - 14, w - 20, 5);
    ctx.fillStyle = k > 0.4 ? '#4a8f5c' : '#c8321c';
    ctx.fillRect(-w / 2 + 10, h - 14, (w - 20) * k, 5);
    ctx.restore();

    /* 頭脳派は並列見積りで、正しい先が薄く光って見える。 */
    if (this.hero && this.hero.def.id === 'tech' && this.curMax - this.docT > 0.9) {
      const want = this.rule.judge(d);
      const px = want === 'ok' ? W / 2 - 210 : want === 'up' ? W / 2 : W / 2 + 210;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(px, H * 0.64 + 26, 0, px, H * 0.64 + 26, 70);
      g.addColorStop(0, 'rgba(255,180,84,0.35)');
      g.addColorStop(1, 'rgba(255,180,84,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, H * 0.64 + 26, 70, 0, TAU); ctx.fill();
      ctx.restore();
    }
  },

  hint(ctx, x, y, key, label, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-62, 0, 124, 54, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(key, 0, 18);
    ctx.fillStyle = '#eef2ff';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(label, 0, 40);
    ctx.restore();
  },

  wrap(ctx, text, x, y, maxW, lh) {
    let line = '', yy = y;
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); yy += lh; line = ch; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  },
};
