/* =========================================================================
   NEKO MART ― 共通の道具
   数学 / 乱数 / 色 / お金の表示 / トースト / セーブ / 効果音
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const rfloat = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* 重みつき抽選。weights は {key: 重み} */
function pickWeighted(weights) {
  let sum = 0;
  for (const k in weights) sum += weights[k];
  let r = rnd() * sum;
  for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
  return Object.keys(weights)[0];
}

/* 座標から決まる疑似乱数 (描画の模様用) */
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* 色を明るく (f > 0) / 暗く (f < 0) する。f は -1〜1 */
const _shadeCache = new Map();
function shade(hex, f) {
  const key = hex + f;
  let s = _shadeCache.get(key);
  if (s) return s;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  s = `rgb(${r | 0},${g | 0},${b | 0})`;
  _shadeCache.set(key, s);
  return s;
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const yen = (n) => (n < 0 ? '-¥' : '¥') + Math.abs(Math.round(n)).toLocaleString('ja-JP');
const pad2 = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* -------------------------------- トースト -------------------------------- */
const Toast = {
  el: null,
  show(text, kind = '') {
    if (!this.el) this.el = document.getElementById('toasts');
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = text;
    this.el.appendChild(d);
    while (this.el.children.length > 3) this.el.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => d.remove(), 3100);
  },
};

/* -------------------------------- セーブ -------------------------------- */
const SAVE_KEY = 'neko-mart.save.v1';
const PREF_KEY = 'neko-mart.pref.v1';
const Save = {
  read() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  },
  write(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 保存できない環境 */ } },
  pref() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; }
  },
  setPref(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* 保存できない環境 */ } },
};

/* -------------------------------- 効果音と音楽 --------------------------------
   音声ファイルは使わず、その場で合成する。最初のタップまでは鳴らせない。 */
const Sound = {
  ctx: null, master: null, sfxOn: true, musicOn: true, musicGain: null, nextNote: 0, step: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
    this.musicGain.connect(this.master);
    this.nextNote = this.ctx.currentTime + 0.2;
  },
  tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slide = 0, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.2, freq = 1200) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  },
  play(name) {
    if (!this.sfxOn || !this.ctx) return;
    switch (name) {
      case 'scan': this.tone(1760, 0.07, 'square', 0.08); break;
      case 'coin': this.tone(1318, 0.09, 'triangle', 0.22); this.tone(1976, 0.25, 'triangle', 0.2, 0.08); break;
      case 'chime': this.tone(659, 0.5, 'sine', 0.2); this.tone(523, 0.7, 'sine', 0.2, 0.28); break;
      case 'pick': this.tone(520, 0.08, 'triangle', 0.2, 0, 300); break;
      case 'put': this.tone(700, 0.06, 'triangle', 0.18); this.tone(880, 0.08, 'triangle', 0.18, 0.06); break;
      case 'place': this.noise(0.12, 0.3, 500); this.tone(160, 0.12, 'sine', 0.25); break;
      case 'buy': this.tone(880, 0.08, 'triangle', 0.2); this.tone(1175, 0.14, 'triangle', 0.2, 0.07); break;
      case 'error': this.tone(180, 0.18, 'square', 0.1); break;
      case 'trash': this.noise(0.2, 0.25, 900); break;
      case 'mop': this.noise(0.15, 0.12, 2400); break;
      case 'slip': this.tone(900, 0.25, 'sine', 0.15, 0, -600); break;
      case 'meow': this.meow(1); break;
      case 'meowHi': this.meow(1.35); break;
      case 'sad': this.tone(500, 0.35, 'sine', 0.12, 0, -200); break;
      case 'mission':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.18, i * 0.09));
        break;
      case 'craft': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.16, i * 0.06)); break;
      case 'open': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, i * 0.12)); break;
      case 'close': [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, i * 0.12)); break;
      case 'click': this.tone(1200, 0.03, 'sine', 0.08); break;
    }
  },
  meow(p) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520 * p, t);
    o.frequency.linearRampToValueAtTime(820 * p, t + 0.12);
    o.frequency.linearRampToValueAtTime(480 * p, t + 0.38);
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(1100, t);
    f.frequency.linearRampToValueAtTime(1800, t + 0.12);
    f.frequency.linearRampToValueAtTime(900, t + 0.38);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.45);
  },
  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.2);
  },
  /* オルゴールふうの短いループ。毎フレーム呼んで少し先まで予約する */
  MELODY: [0, 4, 7, 9, 7, 4, 2, 4, 0, -1, 2, 4, 7, 4, 2, -1, 4, 7, 9, 12, 9, 7, 4, 2, 0, 2, 4, 7, 4, 2, 0, -1],
  BASS: [0, 0, 5, 5, -3, -3, 7, 7],
  tickMusic(fast) {
    if (!this.ctx || !this.musicOn) return;
    const beat = fast ? 0.2 : 0.26;
    if (this.nextNote < this.ctx.currentTime) this.nextNote = this.ctx.currentTime + 0.05;
    while (this.nextNote < this.ctx.currentTime + 0.3) {
      const i = this.step % this.MELODY.length;
      const n = this.MELODY[i];
      if (n >= 0 && (i % 4 !== 3 || this.step % 64 < 32)) {
        this.tone(523.25 * Math.pow(2, n / 12), beat * 1.6, 'triangle', 0.22, this.nextNote - this.ctx.currentTime, 0, this.musicGain);
      }
      if (i % 4 === 0) {
        const b = this.BASS[(i / 4) % this.BASS.length];
        this.tone(130.8 * Math.pow(2, b / 12), beat * 3.5, 'sine', 0.3, this.nextNote - this.ctx.currentTime, 0, this.musicGain);
      }
      this.nextNote += beat;
      this.step++;
    }
  },
};
