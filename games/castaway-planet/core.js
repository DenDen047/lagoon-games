/* =========================================================================
   CASTAWAY PLANET ― 共通基盤
   数学 / 乱数 / ノイズ / 入力 / パーティクル / トースト / セーブ
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };

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
}

/* 値ノイズ (地形生成用)。同じシードなら同じ惑星になる。 */
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

function fbm(noise, x, y, octaves = 4, lac = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm;
}

/* --------------------------------- 色 --------------------------------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
function mixHex(a, b, t) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((na >> 16) & 255, (nb >> 16) & 255, t));
  const g = Math.round(lerp((na >> 8) & 255, (nb >> 8) & 255, t));
  const bl = Math.round(lerp(na & 255, nb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

/* -------------------------------- 入力 -------------------------------- */
const Input = {
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0, down: false, rdown: false, clicked: false, rclicked: false, wheel: 0 },
  touch: { active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0 },

  init(canvas) {
    const typing = (e) => {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!e.repeat) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    });
    window.addEventListener('blur', () => { this.keys.clear(); });

    const setPos = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    };
    canvas.addEventListener('mousemove', setPos);
    canvas.addEventListener('mousedown', (e) => {
      setPos(e);
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouse.rclicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* タッチ: 画面左半分でスティック、右半分でタップ操作 */
    canvas.addEventListener('touchstart', (e) => {
      const r = canvas.getBoundingClientRect();
      for (const t of e.changedTouches) {
        const x = t.clientX - r.left, y = t.clientY - r.top;
        if (x < r.width * 0.45 && this.touch.id === null) {
          this.touch.id = t.identifier; this.touch.active = true;
          this.touch.ox = x; this.touch.oy = y; this.touch.dx = 0; this.touch.dy = 0;
        } else {
          this.mouse.x = x; this.mouse.y = y; this.mouse.down = true; this.mouse.clicked = true;
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      const r = canvas.getBoundingClientRect();
      for (const t of e.changedTouches) {
        const x = t.clientX - r.left, y = t.clientY - r.top;
        if (t.identifier === this.touch.id) {
          const dx = x - this.touch.ox, dy = y - this.touch.oy, d = Math.hypot(dx, dy) || 1;
          const m = Math.min(d, 60) / 60;
          this.touch.dx = (dx / d) * m; this.touch.dy = (dy / d) * m;
        } else { this.mouse.x = x; this.mouse.y = y; }
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          this.touch.id = null; this.touch.active = false; this.touch.dx = 0; this.touch.dy = 0;
        } else this.mouse.down = false;
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  },

  hit(k) { return this.pressed.has(k); },
  held(k) { return this.keys.has(k); },
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; this.mouse.rclicked = false; this.mouse.wheel = 0; },
};

/* ----------------------------- パーティクル ----------------------------- */
const FX = {
  list: [],
  burst(x, y, color, n = 8, spread = 60, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = spread * (0.3 + Math.random() * 0.9);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life, max: life, color, r: 1.5 + Math.random() * 2.5, g: 140 });
    }
  },
  drip(x, y, color = '#7ec8ff', n = 5) {
    for (let i = 0; i < n; i++) {
      this.list.push({ x: x + (Math.random() - 0.5) * 20, y: y - 8, vx: (Math.random() - 0.5) * 20, vy: 30 + Math.random() * 40, life: 0.6, max: 0.6, color, r: 1.5, g: 220 });
    }
  },
  text(x, y, str, color = '#fff') {
    this.list.push({ x, y, vx: 0, vy: -26, life: 1.1, max: 1.1, color, str, g: 0 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    }
  },
  draw(ctx, cam) {
    for (const p of this.list) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (p.str) {
        ctx.font = 'bold 13px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)';
        ctx.strokeText(p.str, sx, sy); ctx.fillStyle = p.color; ctx.fillText(p.str, sx, sy);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
};

/* ------------------------------ トースト ------------------------------ */
function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
  while (box.children.length > 5) box.firstChild.remove();
}

/* -------------------------------- セーブ -------------------------------- */
const SAVE_KEY = 'castaway-planet-save-v1';
const Save = {
  write(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  },
  read() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ } },
};
