/* CUBE SAGA の土台: 乱数・ノイズ・行列・保存・効果音 */
'use strict';
window.CS = window.CS || {};
(function () {
  const CS = window.CS;

  // ---------- 乱数とノイズ ----------
  CS.rng = function (a) {
    a = a | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  CS.hash = function (x, y, z, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(s | 0, 974634023)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  CS.noise2 = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = CS.hash(xi, yi, 0, s), b = CS.hash(xi + 1, yi, 0, s);
    const c = CS.hash(xi, yi + 1, 0, s), d = CS.hash(xi + 1, yi + 1, 0, s);
    const u = sm(xf), v = sm(yf);
    const ab = a + (b - a) * u, cd = c + (d - c) * u;
    return ab + (cd - ab) * v;
  };
  CS.fbm2 = function (x, y, s, oct) {
    oct = oct || 4;
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += CS.noise2(x * f, y * f, s + i * 101) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };
  CS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  CS.lerp = (a, b, t) => a + (b - a) * t;
  CS.smooth = (t) => { t = CS.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // ---------- 行列 (列優先, WebGL 用) ----------
  const M = CS.mat4 = {};
  M.perspective = function (fov, asp, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  };
  M.mul = function (a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  };
  // 目の位置と前方向から view 行列を作る
  M.look = function (ex, ey, ez, fx, fy, fz) {
    let ux = 0, uy = 1, uz = 0;
    // 右 = 前 × 上
    let rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
    let rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    // 上 = 右 × 前
    ux = ry * fz - rz * fy; uy = rz * fx - rx * fz; uz = rx * fy - ry * fx;
    return new Float32Array([
      rx, ux, -fx, 0,
      ry, uy, -fy, 0,
      rz, uz, -fz, 0,
      -(rx * ex + ry * ey + rz * ez), -(ux * ex + uy * ey + uz * ez), (fx * ex + fy * ey + fz * ez), 1,
    ]);
  };

  // ---------- 保存 (localStorage が使えない環境でも落ちない) ----------
  CS.store = {
    get(k, def) {
      try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* なし */ } },
  };

  // ---------- 効果音 (その場で合成) ----------
  let ac = null, master = null, noiseBuf = null;
  function audio() {
    if (ac) return ac;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  }
  CS.unlockAudio = function () { const a = audio(); if (a && a.state === 'suspended') a.resume(); };
  function tone(type, f0, f1, dur, vol, delay) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(freq, dur, vol, q) {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    const s = a.createBufferSource(); s.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  CS.sfx = {
    dig(h) { noise(h ? 2200 : 700, 0.08, 0.5, 1.5); },
    brk(h) { noise(h ? 1800 : 500, 0.18, 0.8, 0.8); },
    place() { noise(400, 0.09, 0.7, 2); },
    hit() { tone('square', 220, 90, 0.12, 0.25); noise(900, 0.06, 0.4); },
    hurt() { tone('sawtooth', 300, 120, 0.2, 0.25); },
    pop() { tone('sine', 600, 1200, 0.08, 0.25); },
    eat() { noise(1200, 0.06, 0.4, 3); noise(1000, 0.06, 0.4, 3); },
    coin() { tone('square', 988, 0, 0.08, 0.15); tone('square', 1319, 0, 0.25, 0.15, 0.08); },
    magic() { tone('sine', 400, 1600, 0.3, 0.2); tone('triangle', 800, 2400, 0.25, 0.1, 0.05); },
    fire() { noise(300, 0.35, 0.6, 0.6); tone('sawtooth', 160, 60, 0.3, 0.15); },
    thunder() { noise(120, 0.9, 1.0, 0.4); tone('sawtooth', 80, 30, 0.8, 0.3); },
    portal() { tone('sine', 200, 900, 1.0, 0.2); tone('sine', 300, 1300, 1.0, 0.15, 0.1); },
    roar() { tone('sawtooth', 110, 55, 1.1, 0.35); noise(200, 1.0, 0.5, 0.5); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, 0, 0.3, 0.12, i * 0.14)); },
    bow() { tone('triangle', 500, 200, 0.12, 0.2); },
    click() { tone('square', 700, 0, 0.04, 0.08); },
  };
})();
