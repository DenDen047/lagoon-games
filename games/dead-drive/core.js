/* =========================================================================
   DEAD DRIVE ― 共通基盤
   数学 / 乱数 / 色 / 入力 / パーティクル / 空間ハッシュ / 音 / セーブ
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
/* a から b へ回るときの最短の角度差（-π〜π） */
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turnToward = (a, b, step) => { const d = angDiff(a, b); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; };

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
  weighted(list, wKey = 'w') {
    let sum = 0; for (const o of list) sum += o[wKey];
    let r = this.f(sum);
    for (const o of list) { r -= o[wKey]; if (r <= 0) return o; }
    return list[list.length - 1];
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
  W: 1280, H: 720, dpr: 1, zoom: 1,
  cam: { x: 0, y: 0, shake: 0 },
  time: 0,
};

/* ------------------------------- 入力 ------------------------------- */
const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'nitro', Shift: 'nitro',
  Escape: 'pause', p: 'pause', P: 'pause',
  r: 'rotate', R: 'rotate',
  Enter: 'ok',
};

const Input = {
  held: {},
  hits: {},
  touch: {},
  stick: { x: 0, y: 0, on: false },
  isTouch: false,
  mouse: { x: 0, y: 0, down: false },
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
    addEventListener('blur', () => { this.held = {}; this.mouse.down = false; });

    document.querySelectorAll('.pb').forEach((b) => {
      const n = b.dataset.btn;
      const on = (ev) => { ev.preventDefault(); this.isTouch = true; if (!this.touch[n]) this.hits[n] = true; this.touch[n] = true; Sfx.unlock(); };
      const off = (ev) => { ev.preventDefault(); this.touch[n] = false; };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off, { passive: false });
      b.addEventListener('touchcancel', off, { passive: false });
    });

    /* 左のスティックは「進みたい向き」を指す。車はその向きへハンドルを切って走る。 */
    const stickEl = document.getElementById('padMove');
    const knob = stickEl ? stickEl.querySelector('i') : null;
    let id = null, ox = 0, oy = 0;
    const move = (t) => {
      const dx = (t.clientX - ox) / 52, dy = (t.clientY - oy) / 52;
      const m = Math.hypot(dx, dy), k = m > 1 ? 1 / m : 1;
      this.stick.x = dx * k; this.stick.y = dy * k;
      this.stick.on = m > 0.2;
      if (knob) knob.style.transform = `translate(${dx * k * 40}px, ${dy * k * 40}px)`;
    };
    const end = () => { id = null; this.stick.x = 0; this.stick.y = 0; this.stick.on = false; if (knob) knob.style.transform = ''; };
    if (stickEl) {
      stickEl.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        const t = ev.changedTouches[0]; id = t.identifier;
        const r = stickEl.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2;
        this.isTouch = true; Sfx.unlock(); move(t);
      }, { passive: false });
      stickEl.addEventListener('touchmove', (ev) => {
        ev.preventDefault();
        for (const t of ev.changedTouches) if (t.identifier === id) move(t);
      }, { passive: false });
      stickEl.addEventListener('touchend', (ev) => { ev.preventDefault(); end(); }, { passive: false });
      stickEl.addEventListener('touchcancel', end, { passive: false });
    }

    /* マウス。押しているあいだは武器がカーソルのあたりを狙う。 */
    canvas.addEventListener('mousemove', (ev) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ev.clientX - r.left; this.mouse.y = ev.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (ev) => {
      Sfx.unlock();
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ev.clientX - r.left; this.mouse.y = ev.clientY - r.top;
      if (ev.button === 0) this.mouse.down = true;
    });
    addEventListener('mouseup', (ev) => { if (ev.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

    addEventListener('touchstart', () => { document.body.classList.add('touch'); Input.isTouch = true; }, { once: true, passive: true });
  },
  down(n) { return !!(this.held[n] || this.touch[n]); },
  hit(n) { return !!this.hits[n]; },
  consume(n) { const v = !!this.hits[n]; this.hits[n] = false; return v; },
  endFrame() { this.hits = {}; },
  clear() { this.held = {}; this.touch = {}; this.hits = {}; this.mouse.down = false; this.stick.x = 0; this.stick.y = 0; this.stick.on = false; },
};

/* ---------------------------- パーティクル ---------------------------- */
const FX = {
  list: [],
  texts: [],
  add(p) {
    if (this.list.length > 1400) this.list.shift();
    this.list.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.6, t: 0, r: 3, col: '#fff', kind: 'dot', glow: 0, drag: 0.9, grow: 0 }, p));
  },
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.dir === undefined ? rand(TAU) : opt.dir + rand(-(opt.spread || 0.7), opt.spread || 0.7);
      const sp = rand(opt.spMin || 40, opt.spMax || 220);
      this.add(Object.assign({}, opt, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(opt.lifeMin || 0.25, opt.lifeMax || 0.7), r: opt.r ? rand(opt.r * 0.6, opt.r * 1.3) : 3 }));
    }
  },
  text(x, y, s, col = '#ffd28a', size = 15) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, s, col, size, t: 0, life: 0.9, vy: -50 });
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
      const t = this.texts[i]; t.t += dt; t.y += t.vy * dt; t.vy *= 0.92;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
  },
  draw(ctx, layer) {
    for (const p of this.list) {
      if ((p.layer || 'top') !== layer) continue;
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = clamp(k * (p.alpha === undefined ? 1 : p.alpha), 0, 1);
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.col;
      if (p.kind === 'line') {
        ctx.strokeStyle = p.col; ctx.lineWidth = p.r;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
      } else if (p.kind === 'rect') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 9 + p.r);
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); ctx.restore();
      } else if (p.kind === 'smoke') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.col; ctx.lineWidth = 3 * k + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, p.r * (p.shrink === false ? 1 : k)), 0, TAU); ctx.fill();
      }
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  },
  drawTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = 1 - t.t / t.life;
      ctx.globalAlpha = clamp(k * 1.6, 0, 1);
      ctx.font = `800 ${t.size}px ${FONT}`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(t.s, t.x, t.y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.s, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
  clear() { this.list.length = 0; this.texts.length = 0; },
};

function shakeCam(v) { G.cam.shake = Math.min(24, G.cam.shake + v); }

/* ------------------------------ 空間ハッシュ ------------------------------ */
/* ゾンビのような動くものを、毎フレーム入れ直して近所だけ調べる。 */
class SpatialHash {
  constructor(size = 64) { this.size = size; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(ix, iy) { return ix * 73856093 ^ iy * 19349663; }
  insert(o) {
    const k = this.key(Math.floor(o.x / this.size), Math.floor(o.y / this.size));
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(o);
  }
  query(x, y, r, out = []) {
    out.length = 0;
    const s = this.size;
    const x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const b = this.map.get(this.key(ix, iy));
      if (b) for (const o of b) out.push(o);
    }
    return out;
  }
}

/* ------------------------------- トースト ------------------------------- */
let toastBox = null;
function toast(msg, kind = '') {
  if (!toastBox) toastBox = document.getElementById('toasts');
  if (!toastBox) return;
  while (toastBox.children.length > 4) toastBox.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* -------------------------------- 音 -------------------------------- */
const Sfx = {
  ctx: null,
  on: true,
  last: {},
  engine: null,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) this.ctx = new AC();
  },
  ready() { return this.on && this.ctx && this.ctx.state === 'running'; },
  /* 同じ音が1フレームに何十回も鳴らないように間引く */
  gate(name, gap) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < gap) return false;
    this.last[name] = now; return true;
  },
  tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!this.ready()) return;
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
  /* エンジン音は鳴らしっぱなしにして、速さで音程を変える */
  setEngine(on, speed = 0, boost = false) {
    if (!this.ready()) return;
    if (!this.engine) {
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      o.type = 'sawtooth'; o2.type = 'square';
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.ctx.destination);
      g.gain.value = 0; o.start(); o2.start();
      this.engine = { o, o2, g, f };
    }
    const t = this.ctx.currentTime, e = this.engine;
    const hz = 42 + speed * 0.16 + (boost ? 30 : 0);
    e.o.frequency.setTargetAtTime(hz, t, 0.06);
    e.o2.frequency.setTargetAtTime(hz * 0.5, t, 0.06);
    e.f.frequency.setTargetAtTime(300 + speed * 1.2 + (boost ? 400 : 0), t, 0.08);
    e.g.gain.setTargetAtTime(on ? 0.035 + Math.min(0.03, speed * 0.00008) : 0, t, 0.08);
  },
  shot() { if (this.gate('shot', 55)) { this.noise(0.06, 0.07, 1800); this.tone(520, 0.05, 'square', 0.03, 180); } },
  shotgun() { if (this.gate('sg', 90)) { this.noise(0.16, 0.13, 500); this.tone(160, 0.12, 'square', 0.05, 60); } },
  flame() { if (this.gate('fl', 120)) this.noise(0.14, 0.05, 300, 1400); },
  rocket() { if (this.gate('rk', 80)) { this.noise(0.25, 0.06, 900); this.tone(300, 0.25, 'sawtooth', 0.04, 900); } },
  boom() { if (this.gate('boom', 70)) { this.noise(0.5, 0.2, 60, 900); this.tone(90, 0.4, 'sine', 0.16, 30); } },
  zap() { if (this.gate('zap', 70)) { this.tone(1400, 0.08, 'square', 0.05, 300); this.noise(0.08, 0.05, 3000); } },
  splat() { if (this.gate('splat', 45)) { this.noise(0.1, 0.1, 200, 1200); this.tone(110, 0.08, 'triangle', 0.08, 55); } },
  thud() { if (this.gate('thud', 90)) { this.noise(0.14, 0.12, 80, 700); this.tone(70, 0.14, 'sine', 0.12, 40); } },
  crash() { if (this.gate('crash', 160)) { this.noise(0.3, 0.16, 300); this.tone(120, 0.2, 'sawtooth', 0.06, 50); } },
  hurt() { if (this.gate('hurt', 120)) { this.tone(180, 0.12, 'square', 0.06, 90); } },
  pickup() { if (this.gate('pk', 40)) this.tone(880 + rand(200), 0.07, 'triangle', 0.05, 1400); },
  load() { if (this.gate('ld', 250)) this.tone(520, 0.08, 'triangle', 0.05, 700); },
  ui() { this.tone(660, 0.05, 'triangle', 0.05); },
  bad() { this.tone(200, 0.28, 'sawtooth', 0.08, 80); },
  good() { this.tone(660, 0.1, 'triangle', 0.07); setTimeout(() => this.tone(990, 0.16, 'triangle', 0.07), 90); },
  level() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.07), i * 70)); },
  groan() { if (this.gate('groan', 900)) this.tone(90 + rand(40), 0.5, 'sawtooth', 0.025, 60); },
  alarm() { this.tone(700, 0.25, 'square', 0.05, 500); setTimeout(() => this.tone(700, 0.25, 'square', 0.05, 500), 320); },
};

/* ------------------------------ セーブ ------------------------------ */
/* ランの途中（朝の基地）と、ランをまたいで残る遺産を別の鍵に置く。 */
const Save = {
  RUN: 'dead-drive-run-v1',
  META: 'dead-drive-meta-v1',
  read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  write(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* 容量超過などは諦める */ } },
  clear(k) { try { localStorage.removeItem(k); } catch (e) { /* 読めない環境は諦める */ } },
};

function el(id) { return document.getElementById(id); }
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
