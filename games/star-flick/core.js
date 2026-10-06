/* =========================================================================
   STAR FLICK ― 共通基盤
   数学 / 乱数 / 色 / 入力 / パーティクル / 音 / セーブ
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* --------------------------------- 色 --------------------------------- */
function hexRgb(h) {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + hex2(lerp(A[0], B[0], t)) + hex2(lerp(A[1], B[1], t)) + hex2(lerp(A[2], B[2], t));
}
function rgba(h, a) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function shade(h, amt) { return amt >= 0 ? mix(h, '#ffffff', amt) : mix(h, '#000000', -amt); }

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT = '"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

/* ------------------------------ 共有の状態 ------------------------------ */
const G = {
  mode: 'title',
  W: 1280, H: 720, dpr: 1,
  time: 0,
};

/* ------------------------------- 入力 ------------------------------- */
/* キーは名前に置きかえて持つ。指とマウスは pointer イベントで1本だけ追う。 */
const KEYMAP = {
  ' ': 'jet', Shift: 'jet',
  q: 'spinL', Q: 'spinL', a: 'spinL', A: 'spinL', ArrowLeft: 'spinL',
  e: 'spinR', E: 'spinR', d: 'spinR', D: 'spinR', ArrowRight: 'spinR',
  b: 'barrier', B: 'barrier',
  '1': 'ship1', '2': 'ship2', '3': 'ship3',
  Escape: 'pause', p: 'pause', P: 'pause',
  Enter: 'ok',
};

const Input = {
  held: {},
  hits: {},
  ptr: { x: 0, y: 0, down: false, id: null },
  onDown: null, onMove: null, onUp: null,
  init(canvas) {
    addEventListener('keydown', (ev) => {
      const n = KEYMAP[ev.key];
      if (!n) return;
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
      if (ev.key === ' ' || ev.key.startsWith('Arrow')) ev.preventDefault();
      if (!this.held[n]) this.hits[n] = true;
      this.held[n] = true;
      Sfx.unlock();
    });
    addEventListener('keyup', (ev) => { const n = KEYMAP[ev.key]; if (n) this.held[n] = false; });
    addEventListener('blur', () => { this.held = {}; });

    const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (ev) => {
      Sfx.unlock();
      if (ev.pointerType === 'touch') document.body.classList.add('touch');
      if (this.ptr.down) return;
      if (ev.button !== undefined && ev.button > 0) { if (this.onCancel) this.onCancel(); return; }
      ev.preventDefault();
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 古いブラウザは捕まえられなくてもよい */ }
      const [x, y] = pos(ev);
      Object.assign(this.ptr, { x, y, down: true, id: ev.pointerId });
      if (this.onDown) this.onDown(x, y);
    });
    canvas.addEventListener('pointermove', (ev) => {
      const [x, y] = pos(ev);
      if (this.ptr.down && ev.pointerId !== this.ptr.id) return;
      this.ptr.x = x; this.ptr.y = y;
      if (this.ptr.down && this.onMove) this.onMove(x, y);
    });
    const up = (ev) => {
      if (!this.ptr.down || ev.pointerId !== this.ptr.id) return;
      const [x, y] = pos(ev);
      this.ptr.down = false; this.ptr.id = null;
      if (this.onUp) this.onUp(x, y, ev.type === 'pointercancel');
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  },
  consume(n) { const v = !!this.hits[n]; this.hits[n] = false; return v; },
  endFrame() { this.hits = {}; },
  clear() { this.held = {}; this.hits = {}; this.ptr.down = false; this.ptr.id = null; },
};

/* ---------------------------- パーティクル ---------------------------- */
/* 座標はワールド座標。描くときはバトルのカメラ変換の中で呼ぶ。 */
const FX = {
  list: [],
  texts: [],
  add(p) {
    if (this.list.length > 900) this.list.shift();
    this.list.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.6, t: 0, r: 3, col: '#fff', kind: 'dot', glow: 1, drag: 0.92, grow: 0 }, p));
  },
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.dir === undefined ? rand(TAU) : opt.dir + rand(-(opt.spread || 0.7), opt.spread || 0.7);
      const sp = rand(opt.spMin || 60, opt.spMax || 300);
      this.add(Object.assign({}, opt, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(opt.lifeMin || 0.25, opt.lifeMax || 0.7), r: opt.r ? rand(opt.r * 0.6, opt.r * 1.3) : 3 }));
    }
  },
  ring(x, y, col, r0 = 10, grow = 260, life = 0.45) { this.add({ x, y, kind: 'ring', col, r: r0, grow, life, drag: 1 }); },
  text(x, y, s, col = '#ffe08a', size = 26) {
    if (this.texts.length > 30) this.texts.shift();
    this.texts.push({ x, y, s, col, size, t: 0, life: 1.1, vy: -60 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.r += p.grow * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t += dt; t.y += t.vy * dt; t.vy *= 0.93;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
  },
  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = clamp(k * (p.alpha === undefined ? 1 : p.alpha), 0, 1);
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.col;
      if (p.kind === 'line') {
        ctx.strokeStyle = p.col; ctx.lineWidth = p.r;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.col; ctx.lineWidth = 4 * k + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
      } else if (p.kind === 'hex') {
        ctx.strokeStyle = p.col; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + p.t * 3; ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r); }
        ctx.closePath(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, p.r * (p.shrink === false ? 1 : k)), 0, TAU); ctx.fill();
      }
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  },
  /* 文字だけは回転させずに読めるよう、画面座標で描く（toScreen を渡してもらう） */
  drawTexts(ctx, toScreen) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = 1 - t.t / t.life;
      const [sx, sy] = toScreen(t.x, t.y);
      const pop = t.t < 0.12 ? 0.6 + t.t / 0.12 * 0.5 : 1.1 - Math.min(0.1, (t.t - 0.12));
      ctx.globalAlpha = clamp(k * 1.8, 0, 1);
      ctx.font = `900 ${Math.round(t.size * pop)}px ${FONT}`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.s, sx, sy);
      ctx.fillStyle = t.col;
      ctx.fillText(t.s, sx, sy);
    }
    ctx.globalAlpha = 1;
  },
  clear() { this.list.length = 0; this.texts.length = 0; },
};

/* ------------------------------- トースト ------------------------------- */
let toastBox = null;
function toast(msg, kind = '') {
  if (!toastBox) toastBox = document.getElementById('toasts');
  if (!toastBox) return;
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  const e = document.createElement('div');
  e.className = 'toast ' + kind;
  e.textContent = msg;
  toastBox.appendChild(e);
  setTimeout(() => e.remove(), 2600);
}

/* -------------------------------- 音 -------------------------------- */
/* 効果音はすべてその場で合成する。音声ファイルは使わない。 */
const Sfx = {
  ctx: null,
  on: true,
  last: {},
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  },
  ready() { return this.on && this.ctx && this.ctx.state === 'running'; },
  gate(name, gap) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < gap) return false;
    this.last[name] = now; return true;
  },
  tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.16, vol = 0.1, hp = 800, lp = 0) {
    if (!this.ready()) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    let tail = f;
    src.connect(f);
    if (lp) { const l = this.ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; f.connect(l); tail = l; }
    const g = this.ctx.createGain(); g.gain.value = vol;
    tail.connect(g); g.connect(this.ctx.destination);
    src.start();
  },
  launch(p) { this.noise(0.22, 0.05 + p * 0.06, 600, 3000); this.tone(220 + p * 260, 0.18, 'triangle', 0.06, 900 + p * 500); },
  hit(s) {
    if (!this.gate('hit', 40)) return;
    const k = clamp(s / 900, 0.15, 1);
    this.noise(0.12 + k * 0.1, 0.06 + k * 0.12, 200, 2600);
    this.tone(300 - k * 140, 0.14, 'square', 0.03 + k * 0.05, 80);
  },
  wall(s) { if (this.gate('wall', 60)) this.tone(160 + clamp(s / 8, 0, 120), 0.1, 'triangle', clamp(s / 2500, 0.02, 0.1), 90); },
  bumper() { if (this.gate('bump', 60)) { this.tone(880, 0.12, 'square', 0.05, 1500); this.tone(1320, 0.1, 'triangle', 0.04, 600, 0.04); } },
  barrierHit() { if (this.gate('bh', 60)) { this.tone(1200, 0.18, 'sine', 0.06, 700); this.noise(0.08, 0.03, 4000); } },
  barrier() { [660, 880, 1170, 1560].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.05, null, i * 0.05)); },
  jet() { this.noise(0.5, 0.12, 120, 1800); this.tone(110, 0.45, 'sawtooth', 0.05, 340); },
  fall() { this.tone(900, 0.8, 'sine', 0.06, 120); },
  ko() { this.noise(0.55, 0.18, 60, 1200); this.tone(110, 0.5, 'sine', 0.16, 35); },
  ui() { this.tone(660, 0.05, 'triangle', 0.05); },
  select() { this.tone(520, 0.06, 'triangle', 0.05, 780); },
  spin(dir) { this.tone(dir > 0 ? 700 : 600, 0.06, 'triangle', 0.04, dir > 0 ? 900 : 450); },
  bad() { this.tone(200, 0.28, 'sawtooth', 0.07, 80); },
  good() { this.tone(660, 0.1, 'triangle', 0.07); this.tone(990, 0.16, 'triangle', 0.07, null, 0.09); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, null, i * 0.11)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.06, null, i * 0.16)); },
  drum() { this.noise(0.08, 0.08, 300, 1600); this.tone(140, 0.08, 'sine', 0.08, 70); },
  reveal(rar) {
    const base = { N: 523, R: 659, SR: 784, UR: 1046 }[rar] || 523;
    this.tone(base, 0.25, 'triangle', 0.07);
    this.tone(base * 1.5, 0.3, 'triangle', 0.06, null, 0.08);
    if (rar === 'SR' || rar === 'UR') { this.tone(base * 2, 0.5, 'sine', 0.06, null, 0.18); this.noise(0.4, 0.05, 5000); }
  },
};

/* ------------------------------ セーブ ------------------------------ */
const Save = {
  KEY: 'star-flick-v1',
  read() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  write(o) { try { localStorage.setItem(this.KEY, JSON.stringify(o)); } catch (e) { /* 容量超過などは諦める */ } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* 読めない環境は諦める */ } },
};

function el(id) { return document.getElementById(id); }
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
