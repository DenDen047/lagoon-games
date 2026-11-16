/* =========================================================================
   SKYDROP ROYALE ― 共通の道具
   数学 / 乱数 / ノイズ / 色 / 入力 / 音 / セーブ
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const deg = (d) => (d * Math.PI) / 180;

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
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function weightedPick(list, wf, rnd = Math.random) {
  let tot = 0;
  for (const it of list) tot += wf(it);
  let r = rnd() * tot;
  for (const it of list) { r -= wf(it); if (r <= 0) return it; }
  return list[list.length - 1];
}

/* なめらかなノイズ（値ノイズ + fBm）。地図づくりに使う */
function makeNoise(seed) {
  const rnd = seeded(seed);
  const P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = rnd();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
  };
  return (x, y, oct = 4) => {
    let v = 0, amp = 1, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) { v += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
    return v / tot;
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
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const FONT = '"Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

/* -------------------------------- 入力 -------------------------------- */
const Input = {
  keys: new Set(),
  pressed: new Set(),
  mx: 0, my: 0, mdown: false, mright: false, mclick: false, mrelease: false, wheel: 0,
  touch: false,
  // スマホの2本スティック
  move: { id: null, ox: 0, oy: 0, x: 0, y: 0, on: false },
  aim: { id: null, ox: 0, oy: 0, x: 0, y: 0, on: false, released: false },
  down(k) { return this.keys.has(k); },
  hit(k) { return this.pressed.has(k); },
  endFrame() { this.pressed.clear(); this.mclick = false; this.mrelease = false; this.wheel = 0; this.aim.released = false; },
};
addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!Input.keys.has(k)) Input.pressed.add(k);
  Input.keys.add(k);
  if ([' ', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.key) && G.mode === 'match') e.preventDefault();
});
addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; Input.keys.delete(k); });
addEventListener('blur', () => { Input.keys.clear(); Input.mdown = false; Input.mright = false; });

/* -------------------------------- 音 -------------------------------- */
/* 効果音はすべてその場で合成する。音声ファイルは使わない */
const Sfx = {
  ctx: null, on: true, master: null, noiseBuf: null, last: {},
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.6;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  noise(dur, freq, vol, type = 'bandpass', q = 1) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur);
  },
  tone(f0, f1, dur, vol, type = 'square') {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  },
  play(name, vol = 1) {
    if (!this.on || !this.ctx || vol < 0.03) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 35) return;
    this.last[name] = now;
    const v = Math.min(1, vol);
    switch (name) {
      case 'shot': this.noise(0.09, 1800, 0.5 * v); this.tone(320, 90, 0.06, 0.12 * v); break;
      case 'shotS': this.noise(0.06, 3200, 0.18 * v, 'highpass'); break;
      case 'shotH': this.noise(0.25, 700, 0.8 * v, 'lowpass'); this.tone(160, 40, 0.18, 0.3 * v); break;
      case 'shotG': this.noise(0.2, 900, 0.75 * v, 'lowpass'); break;
      case 'laser': this.tone(1400, 300, 0.12, 0.16 * v, 'sawtooth'); break;
      case 'zap': this.tone(2400, 600, 0.08, 0.1 * v, 'square'); this.noise(0.08, 4000, 0.15 * v); break;
      case 'flame': this.noise(0.12, 500, 0.18 * v, 'lowpass'); break;
      case 'bow': this.tone(500, 900, 0.08, 0.1 * v, 'triangle'); this.noise(0.08, 2500, 0.12 * v); break;
      case 'swing': this.noise(0.12, 1200, 0.25 * v, 'bandpass', 3); break;
      case 'throw': this.noise(0.12, 900, 0.18 * v, 'bandpass', 2); break;
      case 'boom': this.noise(0.6, 300, 1.0 * v, 'lowpass'); this.tone(120, 30, 0.5, 0.5 * v, 'sine'); break;
      case 'hit': this.tone(900, 500, 0.05, 0.12 * v, 'square'); break;
      case 'shieldhit': this.tone(1500, 1100, 0.05, 0.1 * v, 'triangle'); break;
      case 'harvest': this.noise(0.07, 600, 0.3 * v, 'bandpass', 2); this.tone(220, 180, 0.05, 0.1 * v, 'triangle'); break;
      case 'build': this.tone(300, 500, 0.06, 0.15 * v, 'triangle'); this.noise(0.05, 1000, 0.15 * v); break;
      case 'break': this.noise(0.25, 500, 0.4 * v, 'bandpass', 1); break;
      case 'pickup': this.tone(700, 1200, 0.08, 0.12 * v, 'triangle'); break;
      case 'chest': this.tone(500, 1000, 0.1, 0.12 * v, 'triangle'); setTimeout(() => this.tone(800, 1600, 0.15, 0.12 * v, 'triangle'), 90); break;
      case 'reload': this.noise(0.05, 2400, 0.15 * v); setTimeout(() => this.noise(0.05, 1800, 0.15 * v), 120); break;
      case 'empty': this.tone(1200, 1000, 0.03, 0.06 * v); break;
      case 'heal': this.tone(500, 900, 0.25, 0.1 * v, 'sine'); break;
      case 'kill': this.tone(600, 1200, 0.12, 0.18 * v, 'triangle'); setTimeout(() => this.tone(900, 1800, 0.18, 0.18 * v, 'triangle'), 80); break;
      case 'ui': this.tone(800, 900, 0.04, 0.08 * v, 'triangle'); break;
      case 'zone': this.tone(200, 180, 0.6, 0.15 * v, 'sawtooth'); break;
      case 'jump': this.tone(300, 900, 0.2, 0.12 * v, 'sine'); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.25, 0.18, 'triangle'), i * 140)); break;
      case 'lose': [400, 300, 200].forEach((f, i) => setTimeout(() => this.tone(f, f * 0.95, 0.3, 0.15, 'triangle'), i * 180)); break;
    }
  },
};

/* ------------------------------- セーブ ------------------------------- */
const SAVE_KEY = 'skydrop-royale-v1';
const Save = {
  d: null,
  fresh() {
    return {
      coins: 500, owned: [], skin: 'rookie', glider: 'umbrella',
      custom: [null, null, null], seen: [], wins: 0, games: 0, kills: 0, best: 0,
      opt: { players: 50, diff: 1, sound: true },
    };
  },
  load() {
    try { this.d = Object.assign(this.fresh(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
    catch { this.d = this.fresh(); }
    return this.d;
  },
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.d)); } catch { /* 保存できない環境でも遊べる */ } },
};

const G = { W: 1280, H: 720, dpr: 1, time: 0, mode: 'lobby' };
