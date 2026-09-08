/* =========================================================================
   KAIJU CLASH ― コア
   小物、セーブデータ、画面づくりの共通部品、効果音
   ========================================================================= */
'use strict';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sign = (v) => (v < 0 ? -1 : 1);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;
const $ = (id) => document.getElementById(id);

/** '#rgb' '#rrggbb' 'rgb(r,g,b)' のどれでも受ける。shade() の戻りを重ねがけできるように。 */
function hexToRgb(color) {
  const str = String(color).trim();
  const m = /^rgba?\(([^)]+)\)$/i.exec(str);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0] | 0, p[1] | 0, p[2] | 0];
  }
  const h = str.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
/** amt > 0 で白に寄せ、amt < 0 で黒に寄せる */
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => clamp(Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt)), 0, 255);
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}
function rgba(color, a) { const [r, g, b] = hexToRgb(color); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
function mixColor(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a); const [r2, g2, b2] = hexToRgb(b);
  return 'rgb(' + Math.round(lerp(r1, r2, t)) + ',' + Math.round(lerp(g1, g2, t)) + ',' + Math.round(lerp(b1, b2, t)) + ')';
}

/* =========================================================================
   セーブデータ
   ========================================================================= */
const SAVE_KEY = 'kaiju-clash-v1';

const G = {
  cleared: [],     /* アーケードを勝ち抜いた怪獣の id */
  wins: 0,
  losses: 0,
  destroyed: 0,    /* 壊した建物の総数 */
  bestChain: 0,    /* 最大コンボ */
  lastKaiju: null,
  muted: false,
  rounds: 2,       /* 何本先取か */
  difficulty: 1,   /* 0=やさしい 1=ふつう 2=つよい */
};

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, cleared: G.cleared, wins: G.wins, losses: G.losses,
      destroyed: G.destroyed, bestChain: G.bestChain,
      lastKaiju: G.lastKaiju,
      muted: G.muted, rounds: G.rounds, difficulty: G.difficulty,
    }));
  } catch (e) { /* 保存できない設定のブラウザでも遊べるようにする */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d) return false;
    if (Array.isArray(d.cleared)) G.cleared = d.cleared;
    G.wins = d.wins | 0;
    G.losses = d.losses | 0;
    G.destroyed = d.destroyed | 0;
    G.bestChain = d.bestChain | 0;
    G.lastKaiju = d.lastKaiju || null;
    G.muted = !!d.muted;
    G.rounds = d.rounds || 2;
    G.difficulty = d.difficulty == null ? 1 : d.difficulty;
    return true;
  } catch (e) { return false; }
}

/* =========================================================================
   画面づくりの部品
   ========================================================================= */
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (typeof attrs === 'string') n.className = attrs;
  else if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style') {
        for (const sk in v) {
          if (sk.slice(0, 2) === '--') n.style.setProperty(sk, v[sk]);
          else n.style[sk] = v[sk];
        }
      } else if (k.length > 2 && k.slice(0, 2) === 'on' && typeof v === 'function') {
        n.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    }
  }
  if (kids != null) {
    (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
      if (c == null || c === false) return;
      if (typeof c === 'object') { if (c.nodeType) n.appendChild(c); return; }
      n.appendChild(document.createTextNode(String(c)));
    });
  }
  return n;
}

function btn(label, onClick, cls) {
  return el('button', {
    class: 'btn ' + (cls || ''), type: 'button',
    onClick: (e) => { Sound.ui(); onClick(e); },
  }, label);
}

function show(node) {
  const ui = $('ui');
  ui.hidden = false;
  ui.innerHTML = '';
  const wrap = el('div', 'screen', node);
  ui.appendChild(wrap);
  window.scrollTo(0, 0);
  return wrap;
}

function hideUI() { const ui = $('ui'); ui.innerHTML = ''; ui.hidden = true; }

function panel(opts) {
  return el('div', 'panel', [
    opts.eyebrow ? el('p', { class: 'eyebrow', text: opts.eyebrow }) : null,
    opts.title ? el('h2', { class: 'ptitle', text: opts.title }) : null,
    opts.lead ? el('p', { class: 'lead', text: opts.lead }) : null,
    opts.body || null,
    opts.foot ? el('div', 'pfoot', opts.foot) : null,
  ]);
}

function toast(msg) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1500);
  setTimeout(() => t.remove(), 2100);
}

/** 画面いっぱいの一言。ラウンド開始や KO で出す。 */
function banner(text, ms, cls) {
  const b = $('banner');
  b.hidden = false;
  b.className = cls || '';
  b.textContent = text;
  b.classList.remove('pop');
  void b.offsetWidth;
  b.classList.add('pop');
  clearTimeout(banner.timer);
  banner.timer = setTimeout(() => { b.hidden = true; b.classList.remove('pop'); }, ms || 900);
}
function clearBanner() {
  const b = $('banner');
  b.hidden = true;
  b.classList.remove('pop');
  clearTimeout(banner.timer);
}

/* =========================================================================
   効果音
   最初の操作のときに音の箱を用意する（勝手に鳴らせないブラウザ対策）
   ========================================================================= */
const Sound = {
  ctx: null,

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
    return this.ctx;
  },

  tone(freq, dur, type, vol, slideTo, delay) {
    if (G.muted) return;
    const c = this.ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(24, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(dur, vol, filterHz, delay) {
    if (G.muted) return;
    const c = this.ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + (delay || 0);
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterHz || 1200;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0);
  },

  ui() { this.tone(520, 0.05, 'triangle', 0.05); },
  step() { this.noise(0.13, 0.1, 240); this.tone(58, 0.14, 'sine', 0.09, 34); },
  swing() { this.noise(0.1, 0.06, 2600); },
  punch() { this.noise(0.1, 0.2, 800); this.tone(150, 0.09, 'square', 0.08, 70); },
  heavy() { this.noise(0.2, 0.28, 500); this.tone(110, 0.22, 'sawtooth', 0.11, 42); },
  guard() { this.noise(0.08, 0.14, 4200); this.tone(880, 0.06, 'square', 0.05, 620); },
  beam() { this.tone(180, 0.5, 'sawtooth', 0.09, 900); this.noise(0.5, 0.1, 2400); },
  shot() { this.tone(680, 0.08, 'square', 0.06, 240); },
  boom() { this.noise(0.45, 0.32, 380); this.tone(84, 0.4, 'sawtooth', 0.13, 36); },
  crumble() { this.noise(0.55, 0.22, 700); this.tone(70, 0.3, 'triangle', 0.07, 40); },
  roar() {
    this.tone(120, 0.7, 'sawtooth', 0.13, 60);
    this.tone(182, 0.66, 'square', 0.06, 92);
    this.noise(0.7, 0.12, 900);
  },
  charge() { this.tone(240, 0.42, 'sine', 0.07, 900); },
  ko() { this.tone(150, 0.6, 'sawtooth', 0.15, 46); this.noise(0.6, 0.24, 620); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.09, 0, i * 0.09)); },
  lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.09, 0, i * 0.14)); },
  bell() { [880, 1174].forEach((f, i) => this.tone(f, 0.2, 'square', 0.07, 0, i * 0.1)); },
};
