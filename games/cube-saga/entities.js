/* 生きもの: 種類ごとの形・動き・当たり判定 */
'use strict';
(function () {
  const CS = window.CS;
  const X = CS.X;
  const c = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

  // ---------- 動きと当たり判定 ----------
  function solidAt(w, x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return w.dim !== 'sky';
    if (x < 0 || z < 0 || x >= w.W || z >= w.D) return true; // 世界のはしは見えないかべ
    if (y >= w.H) return false;
    return CS.SOLID[w.b[(y * w.D + z) * w.W + x]] === 1;
  }
  function collides(w, e) {
    const x0 = e.x - e.w / 2, x1 = e.x + e.w / 2, y0 = e.y, y1 = e.y + e.h, z0 = e.z - e.w / 2, z1 = e.z + e.w / 2;
    for (let y = Math.floor(y0); y <= Math.floor(y1 - 1e-4); y++)
      for (let z = Math.floor(z0); z <= Math.floor(z1 - 1e-4); z++)
        for (let x = Math.floor(x0); x <= Math.floor(x1 - 1e-4); x++) if (solidAt(w, x, y, z)) return true;
    return false;
  }
  // 軸ごとに動かして、ぶつかったら戻す
  function move(w, e, dx, dy, dz) {
    e.hitH = false;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4) || 1;
    dx /= steps; dy /= steps; dz /= steps;
    e.onGround = false;
    for (let s = 0; s < steps; s++) {
      e.y += dy;
      if (collides(w, e)) {
        if (dy < 0) { e.y = Math.floor(e.y) + 1; e.onGround = true; } else e.y = Math.ceil(e.y + e.h) - e.h - 1e-3;
        while (collides(w, e) && dy < 0) e.y += 1; // めりこみ防止
        e.vy = 0; dy = 0;
      }
      for (const ax of ['x', 'z']) {
        const d = ax === 'x' ? dx : dz;
        if (!d) continue;
        e[ax] += d;
        if (collides(w, e)) {
          // 半ブロックの段差は自動でのぼる (エンティティだけ)
          if (e.autoStep && e.onGround) {
            e.y += 1.01;
            if (!collides(w, e)) { e.vy = 0; continue; }
            e.y -= 1.01;
          }
          e[ax] -= d; e['v' + ax] = 0; e.hitH = true;
          if (ax === 'x') dx = 0; else dz = 0;
        }
      }
    }
    if (!e.onGround && dy === 0 && e.vy <= 0) {
      e.y -= 0.01; if (collides(w, e)) e.onGround = true; e.y += 0.01;
    }
  }
  function inWater(w, e) { return w.get(e.x, e.y + 0.4, e.z) === CS.B.water; }

  // ---------- 形 ----------
  // 1/16 ブロック単位の箱。p: 回転の中心, rx/rz: 回転
  const L = (x0, y0, z0, x1, y1, z1, col, extra) => Object.assign({ b: [x0, y0, z0, x1, y1, z1], col: typeof col === 'string' ? c(col) : col }, extra || {});
  function legs4(e, x, z, w, h, col, swing) {
    const a = Math.sin(e.anim) * swing * e.walkAmt;
    return [
      L(-x - w, 0, z - w, -x + w, h, z + w, col, { p: [0, h, z], rx: a }),
      L(x - w, 0, z - w, x + w, h, z + w, col, { p: [0, h, z], rx: -a }),
      L(-x - w, 0, -z - w, -x + w, h, -z + w, col, { p: [0, h, -z], rx: -a }),
      L(x - w, 0, -z - w, x + w, h, -z + w, col, { p: [0, h, -z], rx: a }),
    ];
  }
  function biped(e, col, w, h, swing) {
    const a = Math.sin(e.anim) * swing * e.walkAmt;
    return [L(-w - 1, 0, -w, -1, h, w, col, { p: [0, h, 0], rx: a }), L(1, 0, -w, w + 1, h, w, col, { p: [0, h, 0], rx: -a })];
  }
  const MODELS = {
    cow(e) { return [L(-6, 10, -9, 6, 20, 9, '#5a3a24'), L(-6.1, 13, -4, 6.1, 19, 2, '#f0f0f0'), L(-4, 14, 9, 4, 22, 15, '#5a3a24', { p: [0, 18, 9], rx: e.headRx }), L(-3, 14, 14.5, 3, 17, 15.5, '#e8b0a0', { p: [0, 18, 9], rx: e.headRx }), L(-5, 20, 11, -4, 23, 12, '#eee'), L(4, 20, 11, 5, 23, 12, '#eee'), ...legs4(e, 4, 6, 2, 10, '#4a2e1c', 0.6)]; },
    pig(e) { return [L(-5, 6, -7, 5, 14, 7, '#f0a0a8'), L(-4, 7, 7, 4, 15, 13, '#f0a0a8', { p: [0, 11, 7], rx: e.headRx }), L(-2, 8, 13, 2, 11, 14, '#d07880', { p: [0, 11, 7], rx: e.headRx }), L(-3, 12, 12.9, -1, 13, 13.1, '#222'), L(1, 12, 12.9, 3, 13, 13.1, '#222'), ...legs4(e, 3, 4, 1.5, 6, '#e090a0', 0.7)]; },
    sheep(e) { return [L(-6, 8, -8, 6, 18, 8, e.sheared ? '#d8d0c0' : '#f4f4f4'), L(-3, 12, 8, 3, 19, 13, '#6a6a6a', { p: [0, 15, 8], rx: e.headRx }), ...legs4(e, 3.5, 5, 1.5, 8, '#6a6a6a', 0.6)]; },
    chicken(e) { return [L(-3, 4, -4, 3, 10, 4, '#fafafa'), L(-2, 9, 2, 2, 15, 6, '#fafafa'), L(-1, 11, 6, 1, 13, 8, '#f0a020'), L(-1, 9, 5, 1, 11, 6, '#d02020'), L(-3.5, 5, -3, -3, 9, 3, '#eee'), L(3, 5, -3, 3.5, 9, 3, '#eee'), ...biped(e, '#e0b020', 0.5, 4, 0.8)]; },
    zombie(e) { return humanoidBoxes(e, '#5aa050', '#3a6aa8', '#3a3a6a', -Math.PI / 2); },
    skeleton(e) { return humanoidBoxes(e, '#e0e0d8', '#c8c8c0', '#c8c8c0', -Math.PI / 2.4, 2); },
    slime(e) { const sq = 1 + Math.max(0, -e.vy) * 0.03; return [L(-6, 0, -6, 6, 12 / sq, 6, '#60d070'), L(-3, 7 / sq, 6, -1, 9 / sq, 6.3, '#103010'), L(1, 7 / sq, 6, 3, 9 / sq, 6.3, '#103010')]; },
    guardian(e) {
      const a = Math.sin(e.anim) * 0.5 * e.walkAmt;
      return [L(-7, 14, -4, 7, 30, 4, '#6a7a60'), L(-4, 30, -4, 4, 38, 4, '#7a8a70'), L(-3, 33, 4, -1, 35, 4.3, '#80ffd0'), L(1, 33, 4, 3, 35, 4.3, '#80ffd0'),
        L(-11, 6, -2, -7, 28, 2, '#5a6a50', { p: [-9, 27, 0], rx: -a }), L(7, 6, -2, 11, 28, 2, '#5a6a50', { p: [9, 27, 0], rx: a }),
        L(-6, 0, -3, -1, 14, 3, '#5a6a50', { p: [0, 14, 0], rx: a }), L(1, 0, -3, 6, 14, 3, '#5a6a50', { p: [0, 14, 0], rx: -a }),
        L(-7.2, 20, -4.2, 7.2, 22, 4.2, '#4a8a3a')];
    },
    mammoth(e) {
      return [L(-9, 16, -12, 9, 34, 12, '#7a4e2c'), L(-9.2, 30, -12, 9.2, 35, 10, '#6a4024'), L(-6, 20, 12, 6, 34, 20, '#7a4e2c', { p: [0, 27, 12], rx: e.headRx }),
        L(-1.5, 6, 18, 1.5, 22, 21, '#6a4024', { p: [0, 27, 12], rx: e.headRx }), L(-5, 14, 17, -3, 22, 26, '#f4eee0', { p: [0, 27, 12], rx: e.headRx }), L(3, 14, 17, 5, 22, 26, '#f4eee0', { p: [0, 27, 12], rx: e.headRx }),
        L(-9, 22, 13, -6, 32, 16, '#6a4024'), L(6, 22, 13, 9, 32, 16, '#6a4024'), L(-4, 28, 19.9, -2, 30, 20.2, '#111'), L(2, 28, 19.9, 4, 30, 20.2, '#111'), ...legs4(e, 5.5, 8, 3, 16, '#6a4024', 0.4)];
    },
    dodo(e) { return [L(-4, 4, -5, 4, 12, 5, '#8a8a96'), L(-2, 10, 3, 2, 17, 7, '#9a9aa6'), L(-1.5, 12, 7, 1.5, 15, 11, '#e0c040'), L(-1, 11, 9, 1, 12, 11.5, '#c09020'), L(-2.1, 14, 5, -1.9, 15, 6, '#111'), L(1.9, 14, 5, 2.1, 15, 6, '#111'), L(-2, 8, -7, 2, 11, -5, '#f0f0f0'), ...biped(e, '#e0c040', 0.6, 4, 0.8)]; },
    trike(e) {
      return [L(-8, 10, -12, 8, 24, 12, '#6a8a50'), L(-6, 10, 12, 6, 22, 20, '#6a8a50', { p: [0, 16, 12], rx: e.headRx }), L(-10, 16, 10, 10, 30, 12, '#a0703a', { p: [0, 16, 12], rx: e.headRx }),
        L(-5, 20, 17, -4, 22, 25, '#f4eee0', { p: [0, 16, 12], rx: e.headRx }), L(4, 20, 17, 5, 22, 25, '#f4eee0', { p: [0, 16, 12], rx: e.headRx }), L(-0.5, 14, 19, 0.5, 16, 23, '#f4eee0', { p: [0, 16, 12], rx: e.headRx }),
        L(-3, 14, -20, 3, 19, -12, '#5a7a44'), ...legs4(e, 5, 8, 2.5, 10, '#5a7a44', 0.5)];
    },
    stego(e) {
      const plates = [];
      for (let i = -3; i <= 3; i++) plates.push(L(-0.8, 24, i * 3.2 - 1.5, 0.8, 30 - Math.abs(i), i * 3.2 + 1.5, '#d0703a'));
      return [L(-6, 10, -12, 6, 24, 12, '#7a9a50'), L(-2, 10, 12, 2, 15, 18, '#7a9a50'), L(-1.5, 12, 18, 1.5, 15, 22, '#7a9a50', { p: [0, 13, 18], rx: e.headRx }),
        L(-2.5, 14, -22, 2.5, 19, -12, '#6a8a44'), L(-5, 17, -22, -2.5, 18, -21, '#eee'), L(2.5, 17, -22, 5, 18, -21, '#eee'), ...plates, ...legs4(e, 4, 8, 2, 10, '#6a8a44', 0.5)];
    },
    saber(e) {
      return [L(-5, 10, -10, 5, 20, 10, '#d4943a'), L(-5.1, 12, -6, 5.1, 19, -5, '#3a2a1a'), L(-5.1, 12, 0, 5.1, 19, 1, '#3a2a1a'), L(-5.1, 12, 5, 5.1, 19, 6, '#3a2a1a'),
        L(-4, 12, 10, 4, 20, 17, '#d4943a', { p: [0, 16, 10], rx: e.headRx }), L(-2.5, 8, 15, -1.5, 13, 16, '#fff', { p: [0, 16, 10], rx: e.headRx }), L(1.5, 8, 15, 2.5, 13, 16, '#fff', { p: [0, 16, 10], rx: e.headRx }),
        L(-3, 17, 16.9, -1, 18, 17.2, '#e0e030'), L(1, 17, 16.9, 3, 18, 17.2, '#e0e030'), L(-1, 15, -16, 1, 17, -10, '#d4943a'), ...legs4(e, 3.5, 6.5, 1.8, 10, '#c4842a', 0.7)];
    },
    raptor(e) {
      return [L(-3, 12, -6, 3, 20, 6, '#9a7a4a'), L(-2, 16, 5, 2, 22, 9, '#9a7a4a'), L(-2, 18, 8, 2, 22, 14, '#9a7a4a', { p: [0, 20, 8], rx: e.headRx }), L(-2.1, 20, 11, -1.9, 21, 12, '#d02020'), L(1.9, 20, 11, 2.1, 21, 12, '#d02020'),
        L(-1.5, 14, -16, 1.5, 18, -6, '#8a6a3a'), L(-3.5, 14, 4, -2.5, 16, 8, '#8a6a3a'), L(2.5, 14, 4, 3.5, 16, 8, '#8a6a3a'), ...biped(e, '#8a6a3a', 1.5, 12, 0.9)];
    },
    ptera(e) {
      const f = Math.sin(e.anim * 2) * 0.5;
      return [L(-2, 8, -4, 2, 12, 5, '#b46e5a'), L(-1.5, 9, 5, 1.5, 12, 14, '#b46e5a'), L(-1, 11, 2, 1, 16, 4, '#d08070'),
        L(-18, 10, -2, -2, 11, 4, '#c88070', { p: [-2, 10, 0], rz: f }), L(2, 10, -2, 18, 11, 4, '#c88070', { p: [2, 10, 0], rz: -f }), ...biped(e, '#8a5040', 0.5, 8, 0.5)];
    },
    trex(e) {
      const a = Math.sin(e.anim) * 0.5 * e.walkAmt, jaw = e.attackT > 0 ? 0.5 : 0.1;
      return [L(-7, 22, -10, 7, 40, 10, '#5a7044'), L(-5, 30, 6, 5, 42, 12, '#5a7044'), L(-6, 36, 10, 6, 46, 24, '#5a7044', { p: [0, 40, 10], rx: e.headRx }),
        L(-5.5, 31, 12, 5.5, 36, 23, '#4a6034', { p: [0, 36, 12], rx: jaw }), L(-5, 36, 22, 5, 37, 23, '#fff', { p: [0, 40, 10], rx: e.headRx }),
        L(-6.1, 42, 18, -5.9, 44, 20, '#e0b020'), L(5.9, 42, 18, 6.1, 44, 20, '#e0b020'),
        L(-4, 22, -28, 4, 32, -10, '#4a6034'), L(-2, 25, -38, 2, 30, -28, '#4a6034'), L(-6, 28, 9, -4, 30, 14, '#4a6034'), L(4, 28, 9, 6, 30, 14, '#4a6034'),
        L(-8, 0, -4, -2, 24, 4, '#4a6034', { p: [0, 24, 0], rx: a }), L(2, 0, -4, 8, 24, 4, '#4a6034', { p: [0, 24, 0], rx: -a })];
    },
    dragon(e) {
      const f = Math.sin(e.anim * 1.5) * 0.6, jaw = e.attackT > 0 ? 0.45 : 0.08;
      const body = '#3a2a7a', belly = '#8a7ad0', gold = '#f0c040', wing = '#5a3aa0';
      const parts = [
        L(-12, 0, -24, 12, 20, 24, body), L(-10, -1, -20, 10, 2, 20, belly),
        L(-6, 6, 22, 6, 18, 40, body), L(-8, 4, 38, 8, 18, 56, body, { p: [0, 10, 38], rx: e.headRx }),
        L(-7, -2, 40, 7, 4, 58, '#2a1a5a', { p: [0, 4, 40], rx: jaw + e.headRx }),
        L(-6, 18, 40, -4, 28, 44, gold, { p: [0, 10, 38], rx: e.headRx }), L(4, 18, 40, 6, 28, 44, gold, { p: [0, 10, 38], rx: e.headRx }),
        L(-8.2, 12, 50, -7.9, 15, 53, '#ff4040'), L(7.9, 12, 50, 8.2, 15, 53, '#ff4040'),
        L(-6, 6, -44, 6, 16, -24, body), L(-4, 8, -64, 4, 14, -44, body), L(-2, 9, -80, 2, 13, -64, body), L(-6, 10, -86, 6, 12, -78, gold),
        L(-60, 16, -10, -12, 18, 20, wing, { p: [-12, 17, 0], rz: f }), L(12, 16, -10, 60, 18, 20, wing, { p: [12, 17, 0], rz: -f }),
        L(-60, 14, 16, -12, 20, 20, body, { p: [-12, 17, 0], rz: f }), L(12, 14, 16, 60, 20, 20, body, { p: [12, 17, 0], rz: -f }),
        L(-12, -12, 8, -6, 0, 14, body), L(6, -12, 8, 12, 0, 14, body), L(-12, -12, -16, -6, 0, -10, body), L(6, -12, -16, 12, 0, -10, body),
      ];
      for (let i = -2; i <= 2; i++) parts.push(L(-1, 20, i * 8 - 2, 1, 25, i * 8 + 2, gold));
      return parts;
    },
  };
  function humanoidBoxes(e, skin, shirt, pants, armRx, thin) {
    const a = Math.sin(e.anim) * 0.7 * e.walkAmt, t = thin || 4, o = (4 - t) / 2;
    return [
      L(-4, 24, -4, 4, 32, 4, skin, { p: [0, 24, 0], rx: e.headRx }),
      L(-2, 26, 4, -1, 28, 4.2, '#200'), L(1, 26, 4, 2, 28, 4.2, '#200'),
      L(-4 + o, 12, -2 + o, 4 - o, 24, 2 - o, shirt),
      L(-4 - t, 12, -t / 2, -4, 24, t / 2, skin, { p: [-6, 22, 0], rx: armRx + a * 0.3 }),
      L(4, 12, -t / 2, 4 + t, 24, t / 2, skin, { p: [6, 22, 0], rx: armRx - a * 0.3 }),
      L(-4 + o, 0, -2 + o, -o, 12, 2 - o, pants, { p: [0, 12, 0], rx: a }),
      L(o, 0, -2 + o, 4 - o, 12, 2 - o, pants, { p: [0, 12, 0], rx: -a }),
    ];
  }

  // ---------- 種類 ----------
  // ai: passive / hostile / neutral / npc / boss
  const TYPES = {
    cow: { w: 0.9, h: 1.4, hp: 10, speed: 1.6, ai: 'passive', drops: [['rawMeat', 1, 2]] },
    pig: { w: 0.9, h: 0.9, hp: 10, speed: 1.6, ai: 'passive', drops: [['rawMeat', 1, 2]] },
    sheep: { w: 0.9, h: 1.3, hp: 8, speed: 1.5, ai: 'passive', drops: [['woolWhite', 1, 2], ['rawMeat', 0, 1]] },
    chicken: { w: 0.5, h: 0.8, hp: 4, speed: 1.6, ai: 'passive', drops: [['rawMeat', 1, 1]] },
    zombie: { w: 0.6, h: 1.95, hp: 20, speed: 2.3, ai: 'hostile', dmg: 3, drops: [['rawMeat', 0, 2]], night: true },
    skeleton: { w: 0.6, h: 1.95, hp: 16, speed: 2.2, ai: 'hostile', ranged: true, dmg: 3, drops: [['arrow', 1, 3], ['stick', 0, 2]], night: true },
    slime: { w: 0.8, h: 0.8, hp: 10, speed: 2.0, ai: 'hostile', dmg: 2, hop: true, drops: [['woolWhite', 0, 1]] },
    guardian: { w: 1.1, h: 2.4, hp: 40, speed: 2.4, ai: 'hostile', dmg: 5, drops: [['crystal', 1, 2]], name: 'もりのばんにん' },
    mammoth: { w: 1.6, h: 2.3, hp: 30, speed: 1.5, ai: 'passive', species: 'mammoth' },
    dodo: { w: 0.6, h: 1.0, hp: 8, speed: 1.4, ai: 'passive', species: 'dodo' },
    trike: { w: 1.5, h: 1.9, hp: 36, speed: 1.8, ai: 'neutral', dmg: 5, species: 'trike' },
    stego: { w: 1.3, h: 1.9, hp: 30, speed: 1.4, ai: 'passive', species: 'stego' },
    saber: { w: 0.9, h: 1.3, hp: 24, speed: 3.6, ai: 'hostile', dmg: 4, species: 'saber' },
    raptor: { w: 0.6, h: 1.4, hp: 16, speed: 4.0, ai: 'hostile', dmg: 3, species: 'raptor' },
    ptera: { w: 0.8, h: 0.9, hp: 12, speed: 3.0, ai: 'passive', fly: true, species: 'ptera' },
    trex: { w: 1.8, h: 3.0, hp: 60, speed: 3.0, ai: 'hostile', dmg: 7, species: 'trex' },
    dragon: { w: 6, h: 3.5, hp: 300, speed: 12, ai: 'boss', scale: 3, name: 'てんくうりゅう ゼフィロス' },
    king: { w: 0.6, h: 1.8, hp: 999, ai: 'npc', skin: 'king', name: 'おうさま' },
    guard: { w: 0.6, h: 1.8, hp: 999, ai: 'npc', skin: 'guard', name: 'へいたい' },
    shop: { w: 0.6, h: 1.8, hp: 999, ai: 'npc', skin: 'shop', name: 'どうぐや' },
    mage: { w: 0.6, h: 1.8, hp: 999, ai: 'npc', skin: 'mage', name: 'まほうつかい' },
    curator: { w: 0.6, h: 1.8, hp: 999, ai: 'npc', skin: 'curator', name: 'はくぶつかんの かんちょう' },
    villager: { w: 0.6, h: 1.8, hp: 999, ai: 'npc', skin: 'villager', name: 'まちの ひと', wander: true },
  };
  for (const k in TYPES) { TYPES[k].key = k; if (!TYPES[k].scale) TYPES[k].scale = 1; }

  let nextId = 1;
  class Ent {
    constructor(type, x, y, z) {
      const T = TYPES[type];
      this.id = nextId++; this.type = type; this.T = T;
      this.x = x; this.y = y; this.z = z; this.vx = 0; this.vy = 0; this.vz = 0;
      this.w = T.w; this.h = T.h; this.hp = T.hp; this.maxHp = T.hp;
      this.yaw = Math.random() * Math.PI * 2; this.headRx = 0;
      this.anim = 0; this.walkAmt = 0; this.hurt = 0; this.attackCd = 0; this.attackT = 0;
      this.state = 'idle'; this.timer = 0; this.dir = 0; this.autoStep = true;
      this.home = null; this.angry = 0; this.slow = 0; this.flee = 0; this.dead = false;
      this.scale = T.scale; this.age = 0;
      if (T.skin) this.slot = CS.Skin.NPC_SLOT[T.skin === 'villager' && this.id % 2 ? 'villager2' : T.skin];
    }
  }

  // ---------- 考えて動く ----------
  // g: ゲームの状態 (world, player, emit など)
  function think(e, g, dt) {
    const w = g.world, p = g.player, T = e.T;
    e.age += dt;
    if (e.hurt > 0) e.hurt -= dt;
    if (e.attackCd > 0) e.attackCd -= dt;
    if (e.attackT > 0) e.attackT -= dt;
    if (e.slow > 0) e.slow -= dt;
    if (e.flee > 0) e.flee -= dt;
    if (e.angry > 0) e.angry -= dt;
    if (T.ai === 'boss') return CS.dragonThink(e, g, dt);
    if (e.exhibit) { e.walkAmt = 0; e.anim += dt; e.headRx = Math.sin(e.age) * 0.2; return; }
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz), dy = p.y - e.y;
    let want = 0, wantYaw = e.yaw;
    const sp = T.speed * (e.slow > 0 ? 0.4 : 1);
    const hostile = (T.ai === 'hostile' || (T.ai === 'neutral' && e.angry > 0)) && !e.tame && !g.creative && !p.dead;
    let chase = hostile && dist < (e.type === 'guardian' ? 12 : 18) && Math.abs(dy) < 8;
    if (e.type === 'guardian' && e.home && Math.hypot(e.x - e.home.x, e.z - e.home.z) > 14) chase = false;
    if (chase) {
      wantYaw = Math.atan2(dx, -dz);
      if (T.ranged) {
        want = dist > 9 ? sp : dist < 5 ? -sp * 0.7 : 0;
        if (e.attackCd <= 0 && dist < 16) {
          e.attackCd = 2.4;
          const tx = p.x - e.x, ty = p.y + 1.4 - (e.y + 1.5), tz = p.z - e.z, l = Math.hypot(tx, ty, tz);
          g.shoot({ kind: 'arrow', owner: 'mob', x: e.x, y: e.y + 1.5, z: e.z, vx: tx / l * 22, vy: ty / l * 22 + l * 0.12, vz: tz / l * 22, dmg: T.dmg });
        }
      } else {
        want = sp;
        const reach = e.w / 2 + 0.9;
        if (dist < reach && Math.abs(dy) < e.h && e.attackCd <= 0) {
          e.attackCd = 1.0; e.attackT = 0.3;
          g.hurtPlayer(T.dmg, e.x, e.z);
        }
      }
    } else if (T.ai === 'npc') {
      if (!T.wander) { want = 0; if (dist < 5) wantYaw = Math.atan2(dx, -dz); }
      else {
        e.timer -= dt;
        if (e.timer <= 0) { e.timer = 2 + Math.random() * 4; e.state = Math.random() < 0.5 ? 'walk' : 'idle'; e.dir = Math.random() * Math.PI * 2; }
        if (e.home && Math.hypot(e.x - e.home.x, e.z - e.home.z) > 6) { e.dir = Math.atan2(e.home.x - e.x, -(e.home.z - e.z)); e.state = 'walk'; }
        if (dist < 3) { e.state = 'idle'; wantYaw = Math.atan2(dx, -dz); }
        if (e.state === 'walk') { want = 1.2; wantYaw = e.dir; }
      }
    } else {
      if (e.flee > 0) { want = sp * 1.6; wantYaw = Math.atan2(-dx, dz); }
      else {
        e.timer -= dt;
        if (e.timer <= 0) { e.timer = 2 + Math.random() * 5; e.state = Math.random() < 0.55 ? 'walk' : 'idle'; e.dir = Math.random() * Math.PI * 2; }
        if (e.state === 'walk') { want = sp * 0.6; wantYaw = e.dir; }
        if (e.home && Math.hypot(e.x - e.home.x, e.z - e.home.z) > 10) { want = sp; wantYaw = Math.atan2(e.home.x - e.x, -(e.home.z - e.z)); }
      }
    }
    // 向きをなめらかに変える
    let dyaw = wantYaw - e.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    e.yaw += dyaw * Math.min(1, dt * 6);
    let mvx = Math.sin(e.yaw) * want, mvz = -Math.cos(e.yaw) * want;
    if (T.hop) { if (!e.onGround) { mvx *= 1.4; mvz *= 1.4; } else if (want) { e.vy = 7; } else { mvx = mvz = 0; } }
    // ノックバックは速度にのせて、だんだん弱める
    e.vx = e.vx * Math.pow(0.02, dt) + mvx * (1 - Math.pow(0.02, dt));
    e.vz = e.vz * Math.pow(0.02, dt) + mvz * (1 - Math.pow(0.02, dt));
    if (T.fly) {
      const gy = groundY(w, e.x, e.z);
      const target = gy + 3 + Math.sin(e.age * 0.7) * 1.5;
      e.vy += (target - e.y) * dt * 2 - e.vy * dt;
    } else if (inWater(w, e)) { e.vy = Math.min(e.vy + 20 * dt, 2.5); }
    else e.vy -= 28 * dt;
    if (e.hitH && e.onGround && want && !T.hop) e.vy = 7.6;
    move(w, e, e.vx * dt, e.vy * dt, e.vz * dt);
    const spd = Math.hypot(e.vx, e.vz);
    e.walkAmt = Math.min(1, spd / 1.5);
    e.anim += spd * dt * 3;
    e.headRx = chase ? -0.1 : Math.sin(e.age * 0.8 + e.id) * 0.15;
  }
  function groundY(w, x, z) {
    for (let y = Math.min(w.H - 1, 60); y >= 0; y--) if (CS.SOLID[w.get(x, y, z)] || w.get(x, y, z) === CS.B.water) return y + 1;
    return 0;
  }

  // ---------- 竜 ----------
  CS.dragonThink = function (e, g, dt) {
    const p = g.player, C = g.world.info.center;
    e.timer -= dt; e.anim += dt * 3;
    const enraged = e.hp < e.maxHp / 2;
    if (!e.state || e.state === 'idle') { e.state = 'circle'; e.timer = 10; e.ang = 0; }
    let tx, ty, tz, spd = enraged ? 14 : 11;
    if (e.state === 'circle') {
      e.ang += dt * (enraged ? 0.45 : 0.35);
      tx = C.x + Math.cos(e.ang) * 30; tz = C.z + Math.sin(e.ang) * 30; ty = C.y + 16;
      e.fireCd = (e.fireCd || 3) - dt;
      if (e.fireCd <= 0 && !p.dead) {
        e.fireCd = enraged ? 1.8 : 3;
        const n = enraged ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const ax = p.x + (i - 1) * 2.5 - e.x, ay = p.y + 1 - (e.y + 2), az = p.z - e.z, l = Math.hypot(ax, ay, az);
          g.shoot({ kind: 'dfire', owner: 'mob', x: e.x, y: e.y + 2, z: e.z, vx: ax / l * 16, vy: ay / l * 16, vz: az / l * 16, dmg: 5 });
        }
        e.attackT = 0.5;
      }
      if (e.timer <= 0) { e.state = 'dive'; e.timer = 5; e.target = { x: p.x, y: p.y + 1, z: p.z }; CS.sfx.roar(); g.toast('ゼフィロスが つっこんでくる！'); }
    } else if (e.state === 'dive') {
      tx = e.target.x; ty = e.target.y; tz = e.target.z; spd = enraged ? 20 : 16;
      const d = Math.hypot(e.x - p.x, e.y + 1.5 - p.y - 1, e.z - p.z);
      if (d < 4.5 && e.attackCd <= 0) { e.attackCd = 1.5; e.attackT = 0.4; g.hurtPlayer(6, e.x, e.z, 14); }
      if (Math.hypot(e.x - tx, e.y - ty, e.z - tz) < 3 || e.timer <= 0) {
        if (Math.random() < 0.6) { e.state = 'perch'; e.timer = 7; g.toast('ゼフィロスが 島に おりた！ いまが チャンス！'); }
        else { e.state = 'circle'; e.timer = 8 + Math.random() * 4; }
      }
    } else if (e.state === 'perch') {
      tx = C.x; tz = C.z; ty = C.y + 0.5; spd = 8;
      e.fireCd = (e.fireCd || 2) - dt;
      if (Math.hypot(e.x - tx, e.z - tz) < 2) {
        const want = Math.atan2(p.x - e.x, -(p.z - e.z));
        e.yaw += Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw)) * dt * 2;
        if (e.fireCd <= 0 && !p.dead) {
          e.fireCd = 2.2; e.attackT = 0.6;
          const hx = e.x + Math.sin(e.yaw) * 9, hz = e.z - Math.cos(e.yaw) * 9;
          const ax = p.x - hx, ay = p.y + 1 - (e.y + 2), az = p.z - hz, l = Math.hypot(ax, ay, az);
          g.shoot({ kind: 'dfire', owner: 'mob', x: hx, y: e.y + 2, z: hz, vx: ax / l * 14, vy: ay / l * 14, vz: az / l * 14, dmg: 5 });
        }
      }
      if (e.timer <= 0) { e.state = 'circle'; e.timer = 9; }
    }
    const ddx = tx - e.x, ddy = ty - e.y, ddz = tz - e.z, l = Math.hypot(ddx, ddy, ddz) || 1;
    const k = Math.min(1, dt * 2);
    e.vx += (ddx / l * spd - e.vx) * k; e.vy += (ddy / l * spd - e.vy) * k; e.vz += (ddz / l * spd - e.vz) * k;
    if (l < 1) { e.vx *= 0.5; e.vy *= 0.5; e.vz *= 0.5; }
    e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
    if (e.state !== 'perch' || Math.hypot(e.x - tx, e.z - tz) >= 2) {
      const want = Math.atan2(e.vx, -e.vz);
      e.yaw += Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw)) * Math.min(1, dt * 3);
    }
    e.headRx = Math.sin(e.anim * 0.5) * 0.1;
  };

  // ---------- 描く ----------
  function drawParts(ren, e, parts, light, tint) {
    const base = X.entity(e.x, e.y, e.z, e.yaw, e.scale * (e.exhibit ? 0.6 : 1));
    for (const pt of parts) {
      let m = base;
      if (pt.p && (pt.rx || pt.rz)) {
        m = X.t(m, pt.p[0], pt.p[1], pt.p[2]);
        if (pt.rx) m = X.rx(m, pt.rx);
        if (pt.rz) m = X.rz(m, pt.rz);
        m = X.t(m, -pt.p[0], -pt.p[1], -pt.p[2]);
      }
      let col = pt.col;
      if (tint) col = [Math.min(1, col[0] * 0.6 + 0.5), col[1] * 0.45, col[2] * 0.45];
      ren.colorBox(m, pt.b, col, light);
    }
  }
  // スキンを使う人型 (プレイヤー・NPC)
  const uvCache = {};
  function drawHumanoid(ren, o) {
    const uv = uvCache[o.slot] || (uvCache[o.slot] = CS.Skin.slotUV(o.slot));
    const base = X.entity(o.x, o.y, o.z, o.yaw, (o.scale || 1) * 1.8 / 2);
    const a = o.walk || 0;
    const tint = o.hurt ? [1, 0.45, 0.45] : null;
    for (const p of CS.Skin.PARTS) {
      let rx = 0;
      if (p.key === 'head') rx = -(o.pitch || 0);
      else if (p.key === 'armR') rx = a + (o.swing ? -o.swing * 1.6 : 0);
      else if (p.key === 'armL') rx = -a;
      else if (p.key === 'legR') rx = -a;
      else if (p.key === 'legL') rx = a;
      let m = base;
      if (rx) { m = X.t(m, p.pivot[0], p.pivot[1], p.pivot[2]); m = X.rx(m, rx); m = X.t(m, -p.pivot[0], -p.pivot[1], -p.pivot[2]); }
      const bx = p.key === 'head' ? [-4.2, 23.8, -4.2, 4.2, 32.2, 4.2] : p.box;
      ren.skinBox(m, bx, uv[p.key], o.light, tint);
    }
    if (o.cape) {
      let m = X.t(base, 0, 24, -2.2);
      m = X.rx(m, -0.12 - Math.abs(a) * 0.5);
      ren.colorBox(m, [-5, -16, -1, 5, 0, 0], [0.75, 0.1, 0.12], o.light);
      ren.colorBox(m, [-5.1, -16.1, -0.9, 5.1, -15, 0.1], [0.95, 0.78, 0.2], o.light);
    }
    if (o.crown) {
      ren.colorBox(base, [-4.5, 32, -4.5, 4.5, 34, 4.5], [0.98, 0.8, 0.2], o.light);
      for (const [x, z] of [[-4, -4], [3, -4], [-4, 3], [3, 3], [-0.5, 3.5]]) ren.colorBox(base, [x, 34, z, x + 1, 36, z + 1], [0.98, 0.8, 0.2], o.light);
    }
    if (o.hat) {
      ren.colorBox(base, [-6, 32, -6, 6, 33, 6], [0.4, 0.22, 0.65], o.light);
      ren.colorBox(base, [-3.5, 33, -3.5, 3.5, 37, 3.5], [0.4, 0.22, 0.65], o.light);
      ren.colorBox(base, [-2, 37, -2, 2, 40, 2], [0.4, 0.22, 0.65], o.light);
    }
    if (o.helmet) ren.colorBox(base, [-4.6, 29, -4.6, 4.6, 33, 4.6], [0.62, 0.65, 0.7], o.light);
  }
  function draw(ren, e, light) {
    if (e.T.ai === 'npc') {
      drawHumanoid(ren, { x: e.x, y: e.y, z: e.z, yaw: e.yaw, walk: Math.sin(e.anim) * 0.6 * e.walkAmt, slot: e.slot, light, crown: e.type === 'king', hat: e.type === 'mage', helmet: e.type === 'guard' });
      return;
    }
    const parts = MODELS[e.type](e);
    drawParts(ren, e, parts, e.T.ai === 'boss' ? Math.max(light, 0.75) : light, e.hurt > 0);
  }

  CS.TYPES = TYPES;
  CS.Ent = Ent;
  CS.think = think;
  CS.move = move;
  CS.collides = collides;
  CS.solidAt = solidAt;
  CS.inWater = inWater;
  CS.drawEnt = draw;
  CS.drawHumanoid = drawHumanoid;
  CS.groundY = groundY;
})();
