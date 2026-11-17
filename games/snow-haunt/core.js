/* =========================================================================
   SNOW HAUNT ― 共通の道具
   数学 / 乱数 / トースト / セーブ / 効果音と音楽
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

/* 座標から決まる疑似乱数 (描画の模様用) */
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const COIN = '<i class="coin"></i>';   // 画面の 文字に まぜる コインの しるし

/* ------------------------------ トースト ------------------------------ */
function toast(msg, kind = '') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

/* ------------------------------ セーブ ------------------------------ */
const Save = {
  KEY: 'snow-haunt-v1',
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { return null; } },
  /* 先頭が _ のキーは遊んでいる間だけの値なので残さない */
  save(d) { try { localStorage.setItem(this.KEY, JSON.stringify(d, (k, v) => (k[0] === '_' ? undefined : v))); } catch (e) { /* 保存できない環境では何もしない */ } },
  has() { return !!this.load(); },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* 同上 */ } },
};

/* ------------------------------ 音 ------------------------------ */
const Sound = {
  ctx: null, master: null, on: true, beat: 0, step: 0,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  boo() { this.tone(520, 0.4, 'sine', 0.18, -300); this.tone(780, 0.3, 'triangle', 0.06, -420); },
  pop() { this.tone(660, 0.12, 'square', 0.07, 300); },
  chill() { this.tone(1600, 0.35, 'sine', 0.06, -900); this.tone(2400, 0.25, 'sine', 0.04, -1400, 0.05); },
  scream() { this.tone(900, 0.5, 'sawtooth', 0.07, 700); this.tone(1100, 0.4, 'square', 0.04, 500, 0.06); },
  coin() { this.tone(988, 0.08, 'square', 0.06); this.tone(1319, 0.16, 'square', 0.06, 0, 0.07); },
  place() { this.tone(240, 0.08, 'triangle', 0.12, -80); },
  no() { this.tone(180, 0.18, 'square', 0.06, -40); },
  great() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, 0, i * 0.07)); },
  gong() { this.tone(110, 1.6, 'sine', 0.25, -20); this.tone(220, 1.2, 'triangle', 0.08, -30); },
  /* 夜のあいだ流れる、オルゴールみたいな短調の曲 */
  MELODY: [57, 60, 64, 69, 67, 64, 60, 64, 55, 59, 62, 67, 65, 62, 59, 62, 53, 57, 60, 65, 64, 60, 57, 60, 52, 56, 59, 64, 62, 59, 56, 59],
  music(dt, playing) {
    if (!playing || !this.on || !this.ctx) { this.beat = 0; return; }
    this.beat -= dt;
    if (this.beat > 0) return;
    this.beat = 0.36;
    const n = this.MELODY[this.step % this.MELODY.length];
    this.tone(440 * Math.pow(2, (n + 12 - 69) / 12), 0.9, 'triangle', 0.035);
    if (this.step % 8 === 0) this.tone(440 * Math.pow(2, (n - 12 - 69) / 12), 2.4, 'sine', 0.05);
    this.step++;
  },
};
