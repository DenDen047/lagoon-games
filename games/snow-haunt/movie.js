/* =========================================================================
   SNOW HAUNT ― オープニング ムービー
   ふるびた ゆうえんちに ゆきオバケたちが やってきて「ここで おかねを かせごう!」
   タップか スペースで つぎへ。「スキップ」で とばせる。
   ========================================================================= */
'use strict';

const Movie = {
  i: 0, lt: 0, t: 0, fade: 0, done: null, ending: false,
  LINES: [
    { who: '', text: 'むかし、ゆきやまの おくに、にぎやかな ゆうえんちが ありました。', scene: 'past' },
    { who: '', text: 'でも いつしか だれも こなくなって、すっかり ふるびて しまいました。', scene: 'ruin' },
    { who: '', text: 'ある ふぶきの よる…。', scene: 'ruin', ghosts: 'enter' },
    { who: 'ユキ', text: 'わあ! ふるい ゆうえんちだ!', scene: 'ruin', ghosts: 'look' },
    { who: 'チビ', text: 'だれも いないね…。ちょっと こわいかも…。', scene: 'ruin', ghosts: 'shy' },
    { who: 'ユキ', text: 'そうだ! ここを こわくて たのしい テーマパークに して、おかねを かせごう!', scene: 'ruin', ghosts: 'idea' },
    { who: 'みんな', text: 'さんせーい!', scene: 'ruin', ghosts: 'cheer' },
    { who: 'あなた', text: 'それなら わたしが オーナーに なるよ! いっしょに がんばろう!', scene: 'ruin', ghosts: 'cheer', owner: true },
    { who: '', text: 'こうして、ゆきオバケたちの テーマパークづくりが はじまりました。', scene: 'open', ghosts: 'cheer', owner: true },
  ],

  start(done) {
    this.done = done; this.i = 0; this.lt = 0; this.t = 0; this.fade = 1; this.ending = false;
    $('movie').classList.remove('hide');
    this.show();
  },
  show() {
    const L = this.LINES[this.i];
    $('mvWho').textContent = L.who;
    $('mvWho').classList.toggle('hide', !L.who);
    $('mvText').textContent = L.text;
  },
  next() {
    if (this.ending) return;
    if (this.i >= this.LINES.length - 1) { this.finish(); return; }
    this.i++; this.lt = 0; this.show(); Sound.pop();
  },
  finish() {
    if (this.ending) return;
    this.ending = true;
  },
  update(dt) {
    this.t += dt; this.lt += dt;
    if (this.ending) {
      this.fade = Math.min(1, this.fade + dt * 1.5);
      if (this.fade >= 1) { $('movie').classList.add('hide'); const f = this.done; this.done = null; if (f) f(); }
      return;
    }
    this.fade = Math.max(0, this.fade - dt * 1.2);
    const L = this.LINES[this.i];
    if (this.lt > Math.max(3.4, L.text.length * 0.13)) this.next();
  },

  draw(g, W, H) {
    const L = this.LINES[this.i], t = this.t, u = Math.min(W / 900, H / 620);
    const past = L.scene === 'past', open = L.scene === 'open';
    // そら
    const gr = g.createLinearGradient(0, 0, 0, H);
    if (past) { gr.addColorStop(0, '#ff9a7a'); gr.addColorStop(0.6, '#ffd2a0'); gr.addColorStop(1, '#fff0d8'); }
    else { gr.addColorStop(0, '#0c0a26'); gr.addColorStop(0.6, '#2c2a62'); gr.addColorStop(1, '#4a5a8a'); }
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (!past) {
      for (let i = 0; i < 60; i++) { g.globalAlpha = 0.4 + 0.4 * Math.sin(t * 1.5 + i); circ(g, hash2(i, 7) * W, hash2(i, 8) * H * 0.55, hash2(i, 9) + 0.4, '#fff'); }
      g.globalAlpha = 1; circ(g, W * 0.82, H * 0.15, 30 * u, '#fff6d8');
    }
    const gy = H * 0.6;
    // とおくの 雪山
    g.beginPath(); g.moveTo(0, gy);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, gy - 60 * u - Math.abs(Math.sin(x * 0.004) * 140 * u + Math.sin(x * 0.013) * 40 * u));
    g.lineTo(W, gy); g.closePath(); g.fillStyle = past ? '#c8a8c8' : '#2c3464'; g.fill();
    g.fillStyle = past ? '#fff8f0' : '#cdd8ee'; g.fillRect(0, gy, W, H - gy);

    const lit = past || open, cx = W / 2;
    this.wheel(g, cx - 270 * u, gy, 110 * u, !lit, lit, t);
    this.mansion(g, cx + 250 * u, gy, 170 * u, lit, t);
    this.gateArch(g, cx, gy + 10 * u, 230 * u, lit, t);
    if (past) for (let i = 0; i < 6; i++) { const px = (i * 160 + t * 30) % (W + 100) - 50; circ(g, px, gy + 34 * u, 7 * u, '#a87a6a'); circ(g, px, gy + 22 * u, 6 * u, '#a87a6a'); }

    // ゆきオバケたち
    if (L.ghosts) {
      const ts = 70 * u, enterK = L.ghosts === 'enter' ? Math.min(1, this.lt / 2.4) : 1, ease = 1 - (1 - enterK) * (1 - enterK);
      const crew = [['yuki', 0, 'ユキ'], ['chibi', -1, 'チビ'], ['kori', 1, ''], ['yozora', 2, '']];
      crew.forEach(([type, slot, name], k) => {
        const tx = cx + slot * 95 * u + 40 * u, x = lerp(W + 120 * u + k * 60 * u, tx, ease);
        let y = gy + 52 * u + (k % 2) * 14 * u;
        if (L.ghosts === 'cheer') y -= Math.abs(Math.sin(t * 6 + k)) * 22 * u;
        if (L.ghosts === 'shy' && type === 'chibi') y += Math.sin(t * 30) * 1.5;
        const scare = L.ghosts === 'idea' && type === 'yuki';
        drawGhost(g, x, y, ts, type, { t, seed: k, face: L.ghosts === 'enter' ? -1 : (x < cx ? 1 : -1), scare });
        if (name && L.who === name) poly(g, [x - 8 * u, y - 110 * u, x + 8 * u, y - 110 * u, x, y - 98 * u], '#ffe24a', INK, 1);
      });
      if (L.ghosts === 'idea') { const x = cx + 40 * u, y = gy - 70 * u + Math.sin(t * 4) * 4; circ(g, x, y, 16 * u, '#ffe680', INK, 2); rect(g, x - 6 * u, y + 13 * u, 12 * u, 8 * u, '#c8c8d8', INK, 1); }
    }
    if (L.owner) {
      const k = Math.min(1, (this.i === 7 ? this.lt : 9) / 1.8), x = lerp(-80 * u, cx - 170 * u, 1 - (1 - k) * (1 - k));
      drawOwner(g, x, gy + 52 * u, 70 * u, Sim.s && !Sim.demo ? Sim.ownerLook() : { color: 'pink', face: 'sparkle', wear: 'sheet' }, { t, face: 1, moving: k < 1, walk: t, pose: L.who === 'あなた' && k >= 1 ? 0.6 : 0 });
      if (L.who === 'あなた') poly(g, [x - 8 * u, gy - 52 * u, x + 8 * u, gy - 52 * u, x, gy - 40 * u], '#ffe24a', INK, 1);
    }
    if (open) for (let i = 0; i < 24; i++) { const a = t * 2 + i; g.globalAlpha = 0.5 + 0.5 * Math.sin(a * 3); circ(g, (hash2(i, 3) * W + t * 10) % W, hash2(i, 4) * gy, 2.5 * u, ['#ffe060', '#ff9ab8', '#8ad0ff'][i % 3]); }
    g.globalAlpha = 1;
    // ふぶき
    if (!past) {
      g.fillStyle = 'rgba(255,255,255,.85)';
      const n = L.ghosts === 'enter' ? 160 : 80;
      for (let i = 0; i < n; i++) { const x = (hash2(i, 1) * W + t * (60 + hash2(i, 2) * 80)) % W, y = (hash2(i, 5) * H + t * (50 + hash2(i, 6) * 60)) % H; g.beginPath(); g.arc(x, y, 1 + hash2(i, 3) * 2, 0, TAU); g.fill(); }
    }
    if (this.fade > 0) { g.fillStyle = `rgba(6,4,20,${this.fade})`; g.fillRect(0, 0, W, H); }
  },

  /* かんらんしゃ。こわれていると ゴンドラが ぬけて かたむく */
  wheel(g, x, gy, r, broken, lit, t) {
    const cy = gy - r * 1.15, a0 = broken ? 0.3 : t * 0.25, col = broken ? '#5a5470' : '#c8a0e0';
    line(g, x - r * 0.45, gy, x, cy, col, r * 0.05); line(g, x + r * 0.45, gy, x, cy, col, r * 0.05);
    g.save(); g.translate(x, cy); if (broken) g.rotate(0.12);
    circ(g, 0, 0, r, null, col, r * 0.04);
    for (let i = 0; i < 10; i++) {
      const a = a0 + i * TAU / 10;
      if (broken && i % 3 === 1) continue;
      line(g, 0, 0, Math.cos(a) * r, Math.sin(a) * r, col, r * 0.015);
      if (broken && i % 2) continue;
      rr(g, Math.cos(a) * r - r * 0.08, Math.sin(a) * r, r * 0.16, r * 0.13, r * 0.03);
      g.fillStyle = lit ? ['#ff9ab8', '#8ad0ff', '#ffe060', '#b48aff'][i % 4] : '#3e3a52'; g.fill();
    }
    g.restore();
  },
  mansion(g, x, gy, w, lit, t) {
    const h = w * 0.9;
    rect(g, x - w / 2, gy - h, w, h, lit ? '#6a5a8a' : '#2e2840', INK, 2);
    poly(g, [x - w * 0.6, gy - h, x + w * 0.6, gy - h, x, gy - h - w * 0.45], lit ? '#3e3258' : '#1e1a2c', INK, 2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const on = lit ? Math.sin(t + r + c) > -0.6 : (r === 1 && c === 2 && Math.sin(t * 7) > 0.7);
      rect(g, x - w * 0.36 + c * w * 0.27, gy - h * 0.88 + r * h * 0.28, w * 0.16, h * 0.16, on ? '#ffe680' : '#14101f', INK, 1);
      if (!lit && (r + c) % 3 === 0) line(g, x - w * 0.36 + c * w * 0.27, gy - h * 0.88 + r * h * 0.28, x - w * 0.2 + c * w * 0.27, gy - h * 0.72 + r * h * 0.28, '#4a4460', 1.2);
    }
    rect(g, x - w * 0.09, gy - h * 0.22, w * 0.18, h * 0.22, '#4a3020', INK, 1.5);
  },
  gateArch(g, x, gy, w, lit, t) {
    const h = w * 0.62, col = lit ? '#b48aff' : '#4a4460';
    for (const sx of [-1, 1]) { rect(g, x + sx * w / 2 - w * 0.04, gy - h, w * 0.08, h, col, INK, 2); circ(g, x + sx * w / 2, gy - h - w * 0.03, w * 0.05, lit ? '#ffd860' : '#5a5470', INK, 1.5); }
    g.save(); g.translate(x, gy - h - w * 0.02); if (!lit) g.rotate(-0.08);
    rr(g, -w * 0.46, -w * 0.11, w * 0.92, w * 0.18, w * 0.05); g.fillStyle = lit ? '#fff4fb' : '#6a6480'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    const word = lit && this.LINES[this.i].scene === 'open' ? Sim.s && !Sim.demo ? Sim.s.park : 'テーマパーク' : 'ゆうえんち';
    g.font = `900 ${w * 0.09}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...word].forEach((ch, i, a) => {
      const cx = (i - (a.length - 1) / 2) * w * 0.8 / Math.max(5, a.length);
      g.save(); g.translate(cx, -w * 0.02);
      if (!lit && i % 2) g.rotate(i === 1 ? 0.5 : -0.35);
      g.fillStyle = lit ? '#6a3aa8' : '#2e2a3c'; g.fillText(ch, 0, !lit && i === 3 ? w * 0.06 : 0); g.restore();
    });
    g.restore();
    if (!lit) { line(g, x - w * 0.6, gy - 6, x - w * 0.15, gy - 18, '#4a4460', 3); line(g, x + w * 0.2, gy - 8, x + w * 0.62, gy - 4, '#4a4460', 3); }
  },
};
