/* =========================================================================
   ORE TO ARMADA ― 共通基盤
   数学 / 乱数 / ノイズ / 入力 / 効果音 / トースト / DOM の小道具
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const angNorm = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const angTo = (from, to) => angNorm(to - from);
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');

/* 4方向。0=上(-y) 1=右 2=下 3=左。ブロックの向きもこの番号で持つ。 */
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

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
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* 値ノイズ。同じシードなら同じ形になる。 */
function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Float32Array(4096);
  for (let i = 0; i < perm.length; i++) perm[i] = rnd();
  const at = (xi, yi) => perm[(((xi * 73856093) ^ (yi * 19349663)) >>> 0) & 4095];
  const smooth = (t) => t * t * (3 - 2 * t);
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = smooth(x - xi), fy = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  };
}

/* ---------------- 入力 ---------------- */
const Input = {
  down: new Set(), pressed: new Set(), mx: 0, my: 0, mdown: [false, false, false], mclick: [false, false, false], wheel: 0,
  init(canvas) {
    const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
    addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); });
    addEventListener('blur', () => { this.down.clear(); this.mdown = [false, false, false]; });
    canvas.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; });
    canvas.addEventListener('mousedown', (e) => { this.mx = e.clientX; this.my = e.clientY; this.mdown[e.button] = true; this.mclick[e.button] = true; e.preventDefault(); });
    addEventListener('mouseup', (e) => { this.mdown[e.button] = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
  key(code) { return this.down.has(code); },
  hit(code) { return this.pressed.has(code); },
  endFrame() { this.pressed.clear(); this.mclick = [false, false, false]; this.wheel = 0; },
};

/* ---------------- DOM ---------------- */
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

const Toast = {
  show(text, kind = '') {
    const box = document.getElementById('toasts');
    if (!box) return;
    // 同じ文が出ているあいだは重ねない
    for (const c of box.children) if (c.dataset.t === text && !c.classList.contains('out')) { c.dataset.n = (+c.dataset.n || 1) + 1; c.textContent = text + ' ×' + c.dataset.n; return; }
    const t = el('div', { class: 'toast ' + kind }, text);
    t.dataset.t = text;
    box.append(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, kind === 'bad' ? 4200 : 2800);
  },
};

/* ---------------- 効果音 (WebAudio で合成。外部素材なし) ---------------- */
const Sfx = {
  ctx: null, master: null, muted: false, last: {},
  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  play(name, vol = 1) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.04) return;
    this.last[name] = now;
    const c = this.ctx, g = c.createGain(); g.connect(this.master);
    const tone = (type, f0, f1, dur, v) => {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
      const og = c.createGain(); og.gain.setValueAtTime(v * vol, now); og.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(og); og.connect(g); o.start(now); o.stop(now + dur + 0.02);
    };
    const noise = (dur, v, f = 800) => {
      const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(); s.buffer = buf;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f;
      const ng = c.createGain(); ng.gain.value = v * vol;
      s.connect(fl); fl.connect(ng); ng.connect(g); s.start(now);
    };
    switch (name) {
      case 'mg': noise(0.06, 0.25, 2400); tone('square', 180, 90, 0.05, 0.05); break;
      case 'cannon': noise(0.25, 0.5, 700); tone('sine', 120, 40, 0.25, 0.3); break;
      case 'laser': tone('sawtooth', 900, 500, 0.12, 0.06); break;
      case 'missile': noise(0.4, 0.25, 1200); tone('triangle', 300, 900, 0.3, 0.08); break;
      case 'rail': tone('sawtooth', 2000, 80, 0.5, 0.2); noise(0.3, 0.4, 3000); break;
      case 'boom': noise(0.7, 0.8, 500); tone('sine', 90, 30, 0.6, 0.4); break;
      case 'hit': noise(0.05, 0.15, 3000); break;
      case 'mine': tone('triangle', 520, 480, 0.05, 0.05); break;
      case 'ore': tone('sine', 880, 1320, 0.08, 0.08); break;
      case 'place': tone('square', 330, 440, 0.06, 0.06); break;
      case 'remove': tone('square', 440, 220, 0.08, 0.06); break;
      case 'ui': tone('sine', 660, 880, 0.05, 0.05); break;
      case 'coin': tone('sine', 988, 1318, 0.08, 0.08); setTimeout(() => this.play('ui', 0.6), 70); break;
      case 'bad': tone('square', 200, 140, 0.18, 0.08); break;
      case 'alarm': tone('square', 700, 500, 0.3, 0.1); break;
      case 'shield': tone('sine', 300, 1200, 0.15, 0.06); break;
      case 'jump': tone('sawtooth', 80, 1600, 1.2, 0.15); noise(1.2, 0.2, 400); break;
      case 'door': noise(0.12, 0.12, 900); break;
    }
  },
};
