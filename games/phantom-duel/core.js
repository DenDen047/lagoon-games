/* =========================================================================
   PHANTOM DUEL ― コア
   小物、セーブ、画面づくりの共通部品、効果音
   ========================================================================= */
'use strict';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
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
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

/* =========================================================================
   セーブデータ
   ========================================================================= */
const SAVE_KEY = 'phantom-duel-v1';

const G = {
  chars: [],      /* 作った幻影たち */
  active: 0,      /* いま連れているキャラの番号 */
  rank: 0,        /* 倒した挑戦者の数 */
  wins: 0,
  losses: 0,
  seenStory: [],  /* 読んだ章の id */
  muted: false,
};

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, chars: G.chars, active: G.active, rank: G.rank,
      wins: G.wins, losses: G.losses, seenStory: G.seenStory, muted: G.muted,
    }));
  } catch (e) { /* 保存できない設定のブラウザでも遊べるようにする */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.chars) || d.chars.length === 0) return false;
    G.chars = d.chars;
    /* 前の名前でセーブされている子を拾って直す */
    G.chars.forEach((c) => {
      if (c.kit !== 'cat') return;
      if (c.name === 'ザ・ワールド') c.name = 'ニャワールド';
      if (c.cry === 'ムダムダ') c.cry = 'ニャニャニャニャ';
    });
    G.active = clamp(d.active | 0, 0, d.chars.length - 1);
    G.rank = d.rank | 0;
    G.wins = d.wins | 0;
    G.losses = d.losses | 0;
    G.seenStory = Array.isArray(d.seenStory) ? d.seenStory : [];
    G.muted = !!d.muted;
    return true;
  } catch (e) { return false; }
}

function activeChar() { return G.chars[G.active] || null; }

/* =========================================================================
   画面づくり
   el('div', {class:'card', onClick:fn}, [子, '文字'])
   ========================================================================= */
function el(tag, opts, kids) {
  const n = document.createElement(tag);
  if (typeof opts === 'string') {
    n.className = opts;
  } else if (Array.isArray(opts)) {
    kids = opts;
  } else if (opts) {
    for (const k in opts) {
      const v = opts[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
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
      n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
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
  ui.scrollTop = 0;
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

/** 画面いっぱいの一言。バトル開始やKOで出す。 */
function banner(text, ms, cls) {
  const b = $('banner');
  b.hidden = false;
  b.className = cls || '';
  b.textContent = text;
  b.classList.add('pop');
  clearTimeout(banner.timer);
  banner.timer = setTimeout(() => { b.hidden = true; b.classList.remove('pop'); }, ms || 900);
}

function textInput(placeholder, value, maxlen) {
  const input = el('input', {
    class: 'tin', type: 'text', placeholder: placeholder || '',
    maxlength: String(maxlen || 10), value: value || '',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
  });
  const box = el('div', 'tin-wrap', input);
  box.input = input;
  return box;
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

  tone(freq, dur, type, vol, slideTo) {
    if (G.muted) return;
    const c = this.ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, c.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  },

  noise(dur, vol, filterHz) {
    if (G.muted) return;
    const c = this.ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const n = Math.floor(c.sampleRate * dur);
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
    src.start();
  },

  ui() { this.tone(560, 0.05, 'triangle', 0.05); },
  punch() { this.noise(0.09, 0.16, 900); this.tone(180, 0.07, 'square', 0.06, 90); },
  hit() { this.noise(0.06, 0.1, 2000); },
  shot() { this.tone(720, 0.07, 'square', 0.05, 320); },
  boom() { this.noise(0.4, 0.3, 420); this.tone(90, 0.35, 'sawtooth', 0.12, 40); },
  charge() { this.tone(300, 0.18, 'sine', 0.05, 640); },
  ko() { this.tone(160, 0.5, 'sawtooth', 0.14, 60); this.noise(0.5, 0.2, 700); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.09), i * 90)); },
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.24, 'triangle', 0.09), i * 140)); },
  levelup() { [660, 880, 1180].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'square', 0.07), i * 80)); },
};
