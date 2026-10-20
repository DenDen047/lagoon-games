/* =========================================================================
   SLIME AGE ― 共通基盤
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

/* ------------------------------ 共有の状態 ------------------------------ */
const G = {
  mode: 'title',
  W: 1280, H: 720, dpr: 1,
  time: 0,
};

/* ------------------------------- 入力 ------------------------------- */
/* キーは名前に置きかえて持つ。
   スマホでは画面の左がわを指でなぞるとスティック、右がわを押しているあいだは こうげき。 */
const KEYMAP = {
  w: 'up', W: 'up', ArrowUp: 'up',
  s: 'down', S: 'down', ArrowDown: 'down',
  a: 'left', A: 'left', ArrowLeft: 'left',
  d: 'right', D: 'right', ArrowRight: 'right',
  ' ': 'attack', j: 'attack', J: 'attack',
  e: 'merge', E: 'merge', k: 'merge', K: 'merge',
  x: 'split', X: 'split', l: 'split', L: 'split',
  q: 'switch', Q: 'switch', Tab: 'switch',
  Escape: 'pause', p: 'pause', P: 'pause',
};

const STICK_R = 56;

const Input = {
  held: {},
  hits: {},
  mouseAtk: false,
  touchAtk: new Set(),
  stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
  init(canvas) {
    addEventListener('keydown', (ev) => {
      const n = KEYMAP[ev.key];
      if (!n) return;
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
      /* メニューや 窓では Tab・スペースを ふつうの ボタン操作に のこす */
      const playing = G.mode === 'field' && document.getElementById('modal').classList.contains('hidden');
      if (!playing && n !== 'pause') return;
      if (ev.key === ' ' || ev.key === 'Tab' || ev.key.startsWith('Arrow')) ev.preventDefault();
      /* おしっぱなしの くりかえしは 「おした」に しない（ひとやすみが すぐ とじないように） */
      if (!this.held[n] && !ev.repeat) this.hits[n] = true;
      this.held[n] = true;
      Sfx.unlock();
    });
    addEventListener('keyup', (ev) => { const n = KEYMAP[ev.key]; if (n) this.held[n] = false; });
    addEventListener('blur', () => this.clear());

    const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (ev) => {
      Sfx.unlock();
      ev.preventDefault();
      if (ev.pointerType === 'mouse') {
        if (ev.button === 0) this.mouseAtk = true;
        return;
      }
      document.body.classList.add('touch');
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 古いブラウザは捕まえられなくてもよい */ }
      const [x, y] = pos(ev);
      if (x < G.W * 0.55 && this.stick.id === null) Object.assign(this.stick, { id: ev.pointerId, ox: x, oy: y, x, y });
      else this.touchAtk.add(ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (ev.pointerId !== this.stick.id) return;
      const [x, y] = pos(ev);
      this.stick.x = x; this.stick.y = y;
    });
    const up = (ev) => {
      if (ev.pointerType === 'mouse') { this.mouseAtk = false; return; }
      if (ev.pointerId === this.stick.id) this.stick.id = null;
      this.touchAtk.delete(ev.pointerId);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    addEventListener('pointerup', (ev) => { if (ev.pointerType === 'mouse') this.mouseAtk = false; });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  },
  /* 画面のボタンを、キーと同じ名前で押せるようにする */
  bindButton(btn, name) {
    const down = (ev) => {
      ev.preventDefault();
      Sfx.unlock();
      try { btn.setPointerCapture(ev.pointerId); } catch (e) { /* 捕まえられなくてもよい */ }
      if (!this.held[name]) this.hits[name] = true;
      this.held[name] = true;
      btn.classList.add('down');
    };
    const up = () => { this.held[name] = false; btn.classList.remove('down'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
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
  attacking() { return !!this.held.attack || this.mouseAtk || this.touchAtk.size > 0; },
  consume(n) { const v = !!this.hits[n]; this.hits[n] = false; return v; },
  endFrame() { this.hits = {}; },
  clear() {
    this.held = {}; this.hits = {}; this.mouseAtk = false; this.touchAtk.clear(); this.stick.id = null;
    document.querySelectorAll('.pb.down').forEach((b) => b.classList.remove('down'));
  },
};

/* ---------------------------- パーティクル ---------------------------- */
/* 座標はワールド座標。描くときはフィールドのカメラ変換の中で呼ぶ。 */
const FX = {
  list: [],
  texts: [],
  add(p) {
    if (this.list.length > 700) this.list.shift();
    this.list.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.6, t: 0, r: 3, col: '#fff', kind: 'dot', glow: 0, drag: 0.9, grow: 0, grav: 0 }, p));
  },
  burst(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.dir === undefined ? rand(TAU) : opt.dir + rand(-(opt.spread || 0.7), opt.spread || 0.7);
      const sp = rand(opt.spMin || 60, opt.spMax || 260);
      this.add(Object.assign({}, opt, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, life: rand(opt.lifeMin || 0.25, opt.lifeMax || 0.6), r: opt.r ? rand(opt.r * 0.6, opt.r * 1.3) : 3 }));
    }
  },
  ring(x, y, col, r0 = 10, grow = 240, life = 0.4) { this.add({ x, y, kind: 'ring', col, r: r0, grow, life, drag: 1 }); },
  text(x, y, s, col = '#ffffff', size = 20) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, s: String(s), col, size, t: 0, life: 0.9, vy: -70 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.r += p.grow * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t += dt; t.y += t.vy * dt; t.vy *= 0.92;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
  },
  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = clamp(k * (p.alpha === undefined ? 1 : p.alpha), 0, 1);
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.col;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.col; ctx.lineWidth = 5 * k + 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.62, 0, 0, TAU); ctx.stroke();
      } else if (p.kind === 'star') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 4);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const rr = i % 2 ? p.r * 0.45 : p.r; const a = i * TAU / 10; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, p.r * (p.shrink === false ? 1 : k)), 0, TAU); ctx.fill();
      }
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  },
  /* 文字は画面の大きさのまま読めるよう、画面座標で描く（toScreen を渡してもらう） */
  drawTexts(ctx, toScreen) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = 1 - t.t / t.life;
      const [sx, sy] = toScreen(t.x, t.y);
      const pop = t.t < 0.1 ? 0.6 + t.t / 0.1 * 0.5 : 1.1 - Math.min(0.1, (t.t - 0.1));
      ctx.globalAlpha = clamp(k * 2, 0, 1);
      ctx.font = `900 ${Math.round(t.size * pop)}px ${FONT}`;
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
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
};

/* ------------------------------ セーブ ------------------------------ */
const Save = {
  KEY: 'slime-age-v1',
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
