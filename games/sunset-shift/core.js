/* =========================================================================
   SUNSET SHIFT ― 共通基盤
   数学 / 乱数 / 色 / 入力 / パーティクル / 画面ゆれ / 音 / セーブ
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) { this.next = mulberry32(seed); }
  f(a = 1, b) { const r = this.next(); return b === undefined ? r * a : a + r * (b - a); }
  i(a, b) { return Math.floor(this.f(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = this.i(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
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

/* ------------------------------ 共有の状態 ------------------------------ */
/* 各ファイルはここを読み書きする。中身は main.js が組み立てる。 */
const G = {
  mode: 'title',
  day: 1,
  hour: 7,
  peace: 70,
  rating: 50,
  money: 24000,
  seed: 1,
  hero: null,
  heroes: [],
  cam: { x: 0, y: 0, shake: 0 },
  paused: false,
  W: 1280, H: 720, dpr: 1,
};

/* ------------------------------- 入力 ------------------------------- */
const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'jump',
  j: 'light', J: 'light',
  k: 'heavy', K: 'heavy',
  l: 'skill1', L: 'skill1',
  u: 'skill2', U: 'skill2',
  Shift: 'dash',
  q: 'guard', Q: 'guard',
  e: 'interact', E: 'interact',
  Escape: 'pause',
  Enter: 'ok',
};

const Input = {
  held: {},
  hits: {},
  touch: {},
  axis: { x: 0, y: 0 },
  isTouch: false,
  mouse: { x: 0, y: 0 },
  mouseT: -1e9,
  get mouseActive() { return performance.now() - this.mouseT < 2500; },
  init(canvas) {
    addEventListener('keydown', (ev) => {
      const n = KEYMAP[ev.key];
      if (!n) return;
      if (ev.key === ' ' || ev.key.startsWith('Arrow')) ev.preventDefault();
      if (!this.held[n]) this.hits[n] = true;
      this.held[n] = true;
      Sfx.unlock();
    });
    addEventListener('keyup', (ev) => { const n = KEYMAP[ev.key]; if (n) this.held[n] = false; });
    addEventListener('blur', () => { this.held = {}; });

    document.querySelectorAll('.pb').forEach((b) => {
      const n = b.dataset.btn;
      const on = (ev) => { ev.preventDefault(); this.isTouch = true; if (!this.touch[n]) this.hits[n] = true; this.touch[n] = true; Sfx.unlock(); };
      const off = (ev) => { ev.preventDefault(); this.touch[n] = false; };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off, { passive: false });
      b.addEventListener('touchcancel', off, { passive: false });
      b.addEventListener('mousedown', on);
      addEventListener('mouseup', off);
    });

    const stick = document.getElementById('padMove');
    const knob = stick ? stick.querySelector('i') : null;
    let id = null, ox = 0, oy = 0;
    const start = (t) => { id = t.identifier; const r = stick.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; this.isTouch = true; Sfx.unlock(); };
    const move = (t) => {
      const dx = clamp((t.clientX - ox) / 46, -1, 1), dy = clamp((t.clientY - oy) / 46, -1, 1);
      this.axis.x = Math.abs(dx) > 0.24 ? dx : 0;
      this.axis.y = Math.abs(dy) > 0.34 ? dy : 0;
      if (knob) knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    const end = () => { id = null; this.axis.x = 0; this.axis.y = 0; if (knob) knob.style.transform = ''; };
    if (stick) {
      stick.addEventListener('touchstart', (ev) => { ev.preventDefault(); start(ev.changedTouches[0]); move(ev.changedTouches[0]); }, { passive: false });
      stick.addEventListener('touchmove', (ev) => {
        ev.preventDefault();
        for (const t of ev.changedTouches) if (t.identifier === id) move(t);
      }, { passive: false });
      stick.addEventListener('touchend', (ev) => { ev.preventDefault(); end(); }, { passive: false });
      stick.addEventListener('touchcancel', end, { passive: false });
    }

    /* マウス。動かしているあいだは、その向きを狙う。 */
    canvas.addEventListener('mousemove', (ev) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ev.clientX - r.left;
      this.mouse.y = ev.clientY - r.top;
      this.mouseT = performance.now();
    });
    canvas.addEventListener('mousedown', (ev) => {
      Sfx.unlock();
      this.mouseT = performance.now();
      if (ev.button === 0) { if (!this.held.light) this.hits.light = true; this.held.light = true; }
      if (ev.button === 2) this.held.guard = true;
    });
    addEventListener('mouseup', (ev) => {
      if (ev.button === 0) this.held.light = false;
      if (ev.button === 2) this.held.guard = false;
    });

    addEventListener('touchstart', () => { document.body.classList.add('touch'); Input.isTouch = true; }, { once: true, passive: true });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  },
  down(n) {
    if (this.held[n] || this.touch[n]) return true;
    if (n === 'left') return this.axis.x < -0.24;
    if (n === 'right') return this.axis.x > 0.24;
    if (n === 'up') return this.axis.y < -0.34;
    if (n === 'down') return this.axis.y > 0.34;
    return false;
  },
  hit(n) { return !!this.hits[n]; },
  consume(n) { const v = !!this.hits[n]; this.hits[n] = false; return v; },
  endFrame() { this.hits = {}; },
  clear() { this.held = {}; this.touch = {}; this.hits = {}; this.axis.x = 0; this.axis.y = 0; },
};

/* ---------------------------- パーティクル ---------------------------- */
const FONT = '"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

const FX = {
  list: [],
  texts: [],
  add(p) {
    if (this.list.length > 900) this.list.shift();
    this.list.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 400, life: 0.6, t: 0, r: 3, col: '#fff', kind: 'dot', glow: 0, drag: 0.99 }, p));
  },
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.dir === undefined ? rand(TAU) : opt.dir + rand(-(opt.spread || 0.7), opt.spread || 0.7);
      const sp = rand(opt.spMin || 60, opt.spMax || 260);
      this.add(Object.assign({}, opt, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(opt.lifeMin || 0.25, opt.lifeMax || 0.7) }));
    }
  },
  text(x, y, s, col = '#ffd28a', size = 16) {
    this.texts.push({ x, y, s, col, size, t: 0, life: 0.9, vy: -46 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vy *= -0.34; p.vx *= 0.7; }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t += dt; t.y += t.vy * dt; t.vy *= 0.92;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
  },
  draw(ctx, cam) {
    ctx.save();
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      const x = p.x - cam.x, y = p.y - cam.y;
      ctx.globalAlpha = clamp(k, 0, 1) * (p.alpha === undefined ? 1 : p.alpha);
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 4);
        g.addColorStop(0, rgba(p.col, 0.9)); g.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, p.r * 4, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = p.col;
      if (p.kind === 'line') {
        ctx.strokeStyle = p.col; ctx.lineWidth = p.r;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); ctx.stroke();
      } else if (p.kind === 'rect') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.t * 8 + p.x);
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.4, p.r * (p.shrink === false ? 1 : k)), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = 1 - t.t / t.life;
      ctx.globalAlpha = clamp(k * 1.6, 0, 1);
      ctx.font = `800 ${t.size}px ${FONT}`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(t.s, t.x - cam.x, t.y - cam.y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.s, t.x - cam.x, t.y - cam.y);
    }
    ctx.restore();
  },
  clear() { this.list.length = 0; this.texts.length = 0; },
};

function shakeCam(v) { G.cam.shake = Math.min(28, G.cam.shake + v); }

/* ------------------------------- トースト ------------------------------- */
let toastBox = null;
function toast(msg, kind = '') {
  if (!toastBox) toastBox = document.getElementById('toasts');
  if (!toastBox) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

/* -------------------------------- 音 -------------------------------- */
const Sfx = {
  ctx: null,
  on: true,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  },
  tone(freq, dur, type = 'sine', vol = 0.14, slideTo = null) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.16, vol = 0.12, hp = 800) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start();
  },
  hit() { this.tone(220, 0.09, 'square', 0.09, 90); this.noise(0.1, 0.09, 1200); },
  heavy() { this.tone(120, 0.2, 'sawtooth', 0.11, 50); this.noise(0.2, 0.11, 400); },
  jump() { this.tone(420, 0.12, 'sine', 0.07, 780); },
  shot() { this.tone(880, 0.09, 'square', 0.06, 300); },
  power() { this.tone(300, 0.28, 'sine', 0.1, 900); },
  ui() { this.tone(660, 0.06, 'triangle', 0.06); },
  bad() { this.tone(200, 0.3, 'sawtooth', 0.1, 80); },
  good() { this.tone(660, 0.1, 'triangle', 0.08); setTimeout(() => this.tone(990, 0.16, 'triangle', 0.08), 90); },
  car() { this.tone(70, 0.5, 'sawtooth', 0.05, 55); },
};

/* ------------------------------ セーブ ------------------------------ */
const SAVE_KEY = 'sunset-shift-v1';
const Save = {
  read() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  },
  write(o) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { /* 容量超過などは諦める */ }
  },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} },
};

function hhmm(h) {
  const t = ((h % 24) + 24) % 24;
  const hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
const WEEK = ['月', '火', '水', '木', '金', '土', '日'];
const yen = (n) => Math.round(n).toLocaleString('ja-JP');
