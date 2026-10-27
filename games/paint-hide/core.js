/* =========================================================================
   PAINT & HIDE ― 共通基盤
   数学 / 乱数 / 入力 / 音 / セーブ
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* 決まった並びの乱数。床の模様を毎回同じにするのに使う */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hx) {
  const s = hx.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + hex2(lerp(A[0], B[0], t)) + hex2(lerp(A[1], B[1], t)) + hex2(lerp(A[2], B[2], t));
}
function rgba(hx, a) { const c = hexRgb(hx); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function shade(hx, amt) { return amt >= 0 ? mix(hx, '#ffffff', amt) : mix(hx, '#000000', -amt); }

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

/* ------------------------------ 共有の状態 ------------------------------ */
const G = {
  mode: 'title',     // title / reveal / play / over
  W: 1280, H: 720, dpr: 1,
  time: 0,
};

function el(id) { return document.getElementById(id); }
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* ------------------------------- 入力 ------------------------------- */
/* キーは名前に置きかえて持つ。
   スマホでは画面の左がわを指でなぞるとスティック。オニは右がわを タップすると そこへ 撃つ。
   マウスは 向けた ところを ねらい、クリックで 撃つ。 */
const KEYMAP = {
  w: 'up', W: 'up', ArrowUp: 'up',
  s: 'down', S: 'down', ArrowDown: 'down',
  a: 'left', A: 'left', ArrowLeft: 'left',
  d: 'right', D: 'right', ArrowRight: 'right',
  e: 'hide', E: 'hide',
  q: 'paint', Q: 'paint',
  ' ': 'shoot',
  m: 'map', M: 'map', Tab: 'map',
  Escape: 'pause', p: 'pause', P: 'pause',
};

const STICK_R = 54;

const Input = {
  held: {},
  hits: {},
  stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
  aim: { x: 0, y: 0, has: false },
  init(canvas) {
    addEventListener('keydown', (ev) => {
      const n = KEYMAP[ev.key];
      if (!n) return;
      if (G.mode !== 'play') return;
      if (ev.key === ' ' || ev.key === 'Tab' || ev.key.startsWith('Arrow')) ev.preventDefault();
      /* おしっぱなしの くりかえしは「おした」に しない */
      if (!this.held[n] && !ev.repeat) this.hits[n] = true;
      this.held[n] = true;
      Sfx.unlock();
    });
    addEventListener('keyup', (ev) => { const n = KEYMAP[ev.key]; if (n) this.held[n] = false; });
    addEventListener('blur', () => this.clear());

    const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (ev) => {
      Sfx.unlock();
      const [x, y] = pos(ev);
      if (ev.pointerType === 'mouse') {
        if (ev.button === 0) { this.hits.shoot = true; Object.assign(this.aim, { x, y, has: true }); }
        return;
      }
      ev.preventDefault();
      this.setTouch();
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 古いブラウザは捕まえられなくてもよい */ }
      const shooter = G.mode === 'play' && Game.player && Game.player.role === 'oni' && Game.player.alive;
      if (this.stick.id === null && (!shooter || x < G.W * 0.5)) Object.assign(this.stick, { id: ev.pointerId, ox: x, oy: y, x, y });
      else { this.hits.shoot = true; Object.assign(this.aim, { x, y, has: true }); }
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (ev.pointerType === 'mouse') { const [x, y] = pos(ev); Object.assign(this.aim, { x, y, has: true }); return; }
      if (ev.pointerId !== this.stick.id) return;
      const [x, y] = pos(ev);
      this.stick.x = x; this.stick.y = y;
    });
    const up = (ev) => { if (ev.pointerId === this.stick.id) this.stick.id = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    addEventListener('touchstart', () => this.setTouch(), { passive: true, once: true });
  },
  setTouch() { document.body.classList.add('touch'); },
  /* 画面のボタンを、キーと同じ名前で押せるようにする */
  bindButton(btn, name) {
    const down = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      Sfx.unlock();
      if (btn.classList.contains('off')) return;
      if (!this.held[name]) this.hits[name] = true;
      this.held[name] = true;
      btn.classList.add('down');
    };
    const up = () => { this.held[name] = false; btn.classList.remove('down'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  },
  /* いどうの向き。長さは 0〜1 */
  move() {
    let x = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    let y = (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0);
    if (this.stick.id !== null) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) { this.stick.ox = this.stick.x - dx / d * STICK_R; this.stick.oy = this.stick.y - dy / d * STICK_R; }
      const k = Math.min(d, STICK_R) / STICK_R;
      if (k > 0.15) { x = dx / d * k; y = dy / d * k; }
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  },
  consume(n) { const v = !!this.hits[n]; this.hits[n] = false; return v; },
  endFrame() { this.hits = {}; },
  clear() {
    this.held = {}; this.hits = {}; this.stick.id = null;
    document.querySelectorAll('.down').forEach((b) => b.classList.remove('down'));
  },
};

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
  noise(dur = 0.16, vol = 0.1, hp = 800, lp = 0, delay = 0) {
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
    src.start(this.ctx.currentTime + delay);
  },
  ui() { if (this.gate('ui', 40)) this.tone(660, 0.05, 'triangle', 0.05); },
  tap() { if (this.gate('tap', 30)) this.tone(880, 0.04, 'sine', 0.05); },
  bad() { this.tone(200, 0.2, 'sawtooth', 0.04, 90); },
  step() { if (this.gate('step', 90)) this.noise(0.05, 0.015, 1800, 5000); },
  shoot() { if (this.gate('shoot', 40)) { this.noise(0.12, 0.12, 900, 6000); this.tone(520, 0.1, 'square', 0.04, 160); } },
  thud() { if (this.gate('thud', 40)) this.noise(0.1, 0.06, 200, 1400); },
  hit() { this.tone(660, 0.12, 'triangle', 0.08, 1320); [784, 988, 1318].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.05, null, 0.06 + i * 0.06)); },
  paint() { if (this.gate('paint', 120)) this.noise(0.15, 0.025, 2500, 7000); },
  hideIn() { this.tone(330, 0.12, 'triangle', 0.06, 220); },
  tick() { this.tone(1046, 0.06, 'square', 0.03); },
  whistle() { this.tone(1800, 0.35, 'sine', 0.07, 2300); this.tone(1800, 0.25, 'sine', 0.06, 2300, 0.4); },
  reveal(bad) {
    this.noise(0.5, 0.12, 40, 500);
    const ch = bad ? [196, 233, 294] : [262, 330, 392];
    ch.forEach((f) => this.tone(f, 1.2, 'triangle', 0.06, null, 0.1));
  },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.08, null, i * 0.11)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.06, null, i * 0.16)); },
};

/* ------------------------------ セーブ ------------------------------ */
/* 残すのは 設定と 自分で ぬった 見た目だけ。ゲームの 途中経過は 残さない。 */
const Save = {
  KEY: 'paint-hide-v1',
  read() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  write(o) { try { localStorage.setItem(this.KEY, JSON.stringify(o)); } catch (e) { /* 容量超過などは諦める */ } },
};
