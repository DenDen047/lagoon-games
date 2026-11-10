/* =========================================================================
   SLIME FUSION ― 共通基盤
   数学 / 色 / トースト / 音 / セーブ / DOM の小道具
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

/* 決まった並びの乱数。地面の模様を毎回同じにするのに使う */
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

const FONT = '"Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

const G = { W: 1280, H: 720, dpr: 1, time: 0, mode: 'title' };

/* ------------------------------- トースト ------------------------------- */
let toastBox = document.getElementById('toasts');
function toast(msg, kind = '') {
  if (!toastBox) toastBox = document.getElementById('toasts');
  if (!toastBox) return;
  while (toastBox.children.length > 1) toastBox.firstChild.remove();
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
  swing(kind) {
    if (!this.gate('swing', 50)) return;
    if (kind === 'shoot') { this.tone(520, 0.08, 'triangle', 0.04, 260); this.noise(0.06, 0.03, 2500); }
    else if (kind === 'beam') { this.tone(300, 0.18, 'sawtooth', 0.035, 900); }
    else if (kind === 'laser') { this.tone(1500, 0.1, 'square', 0.025, 500); }
    else if (kind === 'gun') { this.noise(0.25, 0.14, 200, 3000); this.tone(140, 0.15, 'square', 0.05, 60); }
    else if (kind === 'drill') { this.tone(180, 0.25, 'sawtooth', 0.03, 220); }
    else this.noise(0.1, 0.05, 1600, 6000);
  },
  hit(big) {
    if (!this.gate('hit', 35)) return;
    this.noise(0.08, big ? 0.12 : 0.07, 300, 2400);
    this.tone(big ? 160 : 240, 0.1, 'square', 0.04, 70);
  },
  hurt() { if (this.gate('hurt', 90)) { this.tone(420, 0.14, 'square', 0.05, 180); } },
  pop() { if (this.gate('pop', 40)) { this.tone(500, 0.12, 'sine', 0.1, 1100); this.noise(0.08, 0.05, 1200); } },
  boom() { this.noise(0.6, 0.2, 40, 900); this.tone(90, 0.5, 'sine', 0.18, 30); },
  slam() { this.noise(0.4, 0.18, 40, 700); this.tone(70, 0.4, 'sine', 0.2, 30); },
  merge() { [330, 440, 587, 784].forEach((f, i) => this.tone(f, 0.14, 'sine', 0.09, f * 1.3, i * 0.05)); },
  split() { [784, 587, 440].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.08, f * 0.7, i * 0.05)); },
  pickup() { if (this.gate('pick', 60)) { this.tone(660, 0.07, 'triangle', 0.07); this.tone(990, 0.1, 'triangle', 0.06, null, 0.06); } },
  idea() { if (this.gate('idea', 45)) this.tone(1180 + rand(160), 0.07, 'sine', 0.05); },
  heal() { this.tone(523, 0.1, 'sine', 0.07, 784); this.tone(784, 0.14, 'sine', 0.06, 1046, 0.08); },
  recruit() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.07, null, i * 0.07)); },
  invent() {
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, null, i * 0.07));
    this.tone(1568, 0.6, 'sine', 0.05, null, 0.45);
  },
  warn() { [0, 0.22, 0.44].forEach((d) => this.tone(220, 0.16, 'square', 0.06, 180, d)); },
  ko() { this.tone(520, 0.5, 'triangle', 0.08, 120); },
  ui() { this.tone(660, 0.05, 'triangle', 0.05); },
  bad() { this.tone(200, 0.2, 'sawtooth', 0.05, 90); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.08, null, i * 0.11)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.06, null, i * 0.16)); },
  fuse() { [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.06, f * 1.5, i * 0.18)); },
  spin() { if (this.gate('spin', 60)) this.tone(900, 0.03, 'square', 0.025); },
  flash() { this.noise(0.5, 0.12, 2000); [523, 784, 1046, 1568].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.07, null, i * 0.06)); },
  place() { this.tone(700, 0.06, 'triangle', 0.07, 1000); },
  color() { this.tone(440, 0.08, 'sine', 0.06, 880); this.tone(660, 0.1, 'sine', 0.05, 1320, 0.05); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.04, null, i * 0.06)); },
};

/* ------------------------------ セーブ ------------------------------ */
const Save = {
  KEY: 'slime-fusion-v1',
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
