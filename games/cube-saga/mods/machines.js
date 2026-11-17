/* きかい MOD: でんきの しかけ・ピストン・かいてんする きかい (CUBE SAGA に ついてくる さいしょの MOD) */
'use strict';
CS.mod({
  id: 'machines',
  name: 'きかい MOD',
  desc: 'でんきの せん・ピストン・はぐるま・ベルトコンベア・ドリルなどの しかけが つかえる',
  version: '1.0',
  setup(api) {
    const { CS, DIRS } = api;
    const { BLOCKS, X } = CS;
    const PUSH = 12, ANIM = 6; // ピストンが おせる かず / うごく じかん (tick)

    // ================= テクスチャ =================
    const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    const nz = (c, r, a, b) => mul(c, a + r() * (b - a));
    const STEEL = [92, 108, 128], DARK = [44, 50, 62], BRASS = [212, 168, 74], ORANGE = [236, 128, 40], WOOD = [158, 116, 66];
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    const rivet = (x, y) => (x === 2 || x === 13) && (y === 2 || y === 13);
    const panel = (x, y, r) => (edge(x, y) ? DARK : rivet(x, y) ? [190, 200, 214] : nz(STEEL, r, 0.9, 1.06));
    const T = {};
    T.frame = api.tile('frame', panel);
    T.pFace = api.tile('pFace', (x, y, r) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.6) return [70, 120, 130];
      if (d < 1.6) return [230, 240, 240];
      return Math.floor(d) % 3 === 0 ? [80, 150, 160] : nz([110, 186, 190], r, 0.94, 1.05);
    });
    T.pSticky = api.tile('pSticky', (x, y, r) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.6) return [70, 120, 130];
      const bub = Math.hypot(x - 5, y - 5) < 1.6 || Math.hypot(x - 10, y - 9) < 2 || Math.hypot(x - 6, y - 11) < 1.1;
      return bub ? [255, 200, 240] : nz([220, 90, 190], r, 0.92, 1.06);
    });
    T.pSide = api.tile('pSide', (x, y, r) => {
      if (y < 4) return y === 3 ? [60, 110, 120] : nz([110, 186, 190], r, 0.94, 1.05);
      if (x === 0 || x === 15 || y === 15) return DARK;
      return x % 5 === 2 ? mul(STEEL, 0.75) : nz(STEEL, r, 0.9, 1.06);
    });
    T.pBack = api.tile('pBack', (x, y, r) => (edge(x, y) ? DARK : (Math.abs(x - 7.5) < 2 && Math.abs(y - 7.5) < 5) || (Math.abs(y - 7.5) < 2 && Math.abs(x - 7.5) < 5) ? [70, 82, 98] : panel(x, y, r)));
    T.pInner = api.tile('pInner', (x, y) => (Math.abs(x - 7.5) < 2.2 && Math.abs(y - 7.5) < 2.2 ? [20, 22, 28] : edge(x, y) ? DARK : [58, 66, 80]));
    T.rod = api.tile('rod', (x, y) => [200 - (x % 4) * 14, 205 - (x % 4) * 14, 215 - (x % 4) * 10]);
    T.wireOff = api.tile('wireOff', (x, y, r) => nz([120, 64, 40], r, 0.85, 1.1));
    T.wireOn = api.tile('wireOn', (x, y, r) => (r() < 0.12 ? [255, 255, 230] : nz([255, 214, 60], r, 0.9, 1.05)));
    T.stoneBase = api.tile('stoneBase', (x, y, r) => (edge(x, y) ? [80, 80, 86] : nz([138, 138, 144], r, 0.88, 1.08)));
    T.stick = api.tile('stick', (x, y, r) => nz(WOOD, r, 0.85, 1.1));
    T.knobOn = api.tile('knobOn', (x, y, r) => nz([90, 240, 120], r, 0.92, 1.05));
    T.knobOff = api.tile('knobOff', (x, y, r) => nz([220, 60, 60], r, 0.92, 1.05));
    T.plate = api.tile('plate', (x, y, r) => (edge(x, y) ? [120, 100, 70] : (x + y) % 6 === 0 || (x - y + 16) % 6 === 0 ? [176, 150, 104] : nz([204, 178, 128], r, 0.94, 1.05)));
    T.lampOff = api.tile('lampOff', (x, y, r) => (edge(x, y) || x === 7 || y === 7 ? DARK : nz([96, 88, 70], r, 0.9, 1.08)));
    T.lampOn = api.tile('lampOn', (x, y, r) => (edge(x, y) || x === 7 || y === 7 ? [150, 110, 40] : Math.hypot((x % 8) - 3.5, (y % 8) - 3.5) < 1.6 ? [255, 255, 240] : nz([255, 220, 120], r, 0.95, 1.04)));
    // さかさ ブロックの うえ: したむき (+z) の やじるし
    T.notTop = api.tile('notTop', (x, y, r) => {
      const ax = Math.abs(x - 7.5);
      if ((y >= 1 && y <= 6 && ax < 1.5) || (y >= 6 && y <= 10 && ax < 10.5 - y)) return [240, 240, 250];
      return edge(x, y) ? DARK : nz([150, 70, 70], r, 0.9, 1.06);
    });
    T.slabSide = api.tile('slabSide', (x, y, r) => (y < 12 ? [60, 60, 68] : y === 12 ? ORANGE : nz([120, 120, 128], r, 0.9, 1.06)));
    T.indOn = api.tile('indOn', (x, y, r) => nz([255, 120, 60], r, 0.95, 1.05));
    T.indOff = api.tile('indOff', (x, y, r) => nz([90, 40, 40], r, 0.9, 1.05));
    T.clockTop = api.tile('clockTop', (x, y, r) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 6.5 && ((Math.abs(x - 7.5) < 0.8 && y <= 7.5 && y > 2) || (Math.abs(y - 7.5) < 0.8 && x >= 7.5 && x < 12))) return [40, 40, 50];
      if (d < 6.5) return d > 5.6 ? [200, 160, 60] : [240, 236, 220];
      return edge(x, y) ? DARK : nz([70, 90, 150], r, 0.9, 1.06);
    });
    T.crate = api.tile('crate', (x, y, r) => (edge(x, y) || x === y || x === 15 - y ? mul(WOOD, 0.6) : nz(WOOD, r, 0.88, 1.08)));
    T.crateTop = api.tile('crateTop', (x, y, r) => (edge(x, y) ? mul(WOOD, 0.6) : Math.hypot(x - 7.5, y - 7.5) < 4 ? nz([150, 156, 168], r, 0.9, 1.05) : nz(WOOD, r, 0.88, 1.08)));
    T.shaft = api.tile('shaft', (x, y, r) => (y % 5 === 0 ? [90, 96, 108] : nz([176, 182, 194], r, 0.94, 1.04)));
    T.gear = api.tile('gear', (x, y, r) => ((x + y) % 5 === 0 ? mul(BRASS, 0.78) : nz(BRASS, r, 0.92, 1.06)));
    T.wood = api.tile('wood', (x, y, r) => (y % 5 === 4 ? mul(WOOD, 0.62) : nz(WOOD, r, 0.88, 1.08)));
    T.sail = api.tile('sail', (x, y, r) => (x % 5 === 0 || y % 5 === 0 ? [200, 190, 170] : nz([246, 240, 226], r, 0.97, 1.02)));
    T.windFront = api.tile('windFront', (x, y, r) => (Math.hypot(x - 7.5, y - 7.5) < 3 ? [70, 50, 30] : x % 4 === 0 ? mul(WOOD, 0.7) : nz(WOOD, r, 0.88, 1.08)));
    // ベルトの うえ: よこじま (うごくと よこじまが ながれる)
    T.beltTop = api.tile('beltTop', (x, y, r) => (x < 2 || x > 13 ? [70, 76, 88] : y % 4 === 0 ? [92, 92, 100] : nz([40, 40, 46], r, 0.85, 1.15)));
    T.beltSide = api.tile('beltSide', (x, y, r) => {
      if (y < 3) return [40, 40, 46];
      const rx = (x % 8) - 3.5, ry = y - 8.5;
      if (Math.hypot(rx, ry) < 3) return Math.hypot(rx, ry) < 1 ? [40, 40, 46] : [170, 176, 188];
      return y === 15 ? DARK : nz(STEEL, r, 0.9, 1.06);
    });
    T.crushSide = api.tile('crushSide', (x, y, r) => (edge(x, y) ? DARK : y > 11 ? (((x + y) >> 1) % 2 ? [250, 200, 40] : [40, 40, 40]) : panel(x, y, r)));
    T.crushFront = api.tile('crushFront', (x, y, r) => (y > 7 && y < 14 && x > 3 && x < 12 ? (y === 8 ? [20, 20, 24] : [34, 34, 40]) : panel(x, y, r)));
    T.crushIn = api.tile('crushIn', (x, y) => (edge(x, y) ? DARK : [30, 30, 36]));
    T.roller = api.tile('roller', (x, y, r) => (y % 3 === 0 ? [80, 84, 96] : nz([150, 156, 170], r, 0.9, 1.06)));
    T.drillSide = api.tile('drillSide', (x, y, r) => (edge(x, y) ? DARK : y < 4 ? (((x + y) >> 1) % 2 ? [250, 200, 40] : [40, 40, 40]) : panel(x, y, r)));
    T.drillTop = api.tile('drillTop', (x, y, r) => (Math.hypot(x - 7.5, y - 7.5) < 4.5 ? [36, 36, 42] : panel(x, y, r)));
    T.bit = api.tile('bit', (x, y, r) => ((x + y * 2) % 6 < 2 ? [120, 128, 140] : nz([214, 220, 230], r, 0.95, 1.04)));

    // もちものの アイコン (うすい ぶひん)
    const seg = (x, y, x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0, t = CS.clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - x0 - dx * t, y - y0 - dy * t); };
    const I = {};
    I.wire = (x, y) => (Math.abs(y - 8 - Math.sin(x * 0.75) * 3.2) < 1.3 ? (x % 4 === 0 ? [255, 250, 200] : [255, 200, 50]) : null);
    I.lever = (x, y) => (Math.hypot(x - 11, y - 3.5) < 2 ? [90, 240, 120] : seg(x, y, 7.5, 12, 11, 4) < 1 ? WOOD : y >= 12 && y <= 14 && x >= 3 && x <= 12 ? [140, 140, 148] : null);
    I.button = (x, y) => (y >= 11 && y <= 13 && x >= 2 && x <= 13 ? [140, 140, 148] : y <= 11 && Math.hypot(x - 7.5, y - 11) < 4.2 ? (x < 7 && y < 9 ? [255, 140, 140] : [220, 50, 50]) : null);
    I.shaft = (x, y) => { const d = seg(x, y, 2.5, 13, 13, 2.5); return d < 1.8 ? ((x + y) % 4 === 0 ? [90, 96, 108] : d < 0.8 ? [210, 216, 226] : [160, 166, 178]) : null; };
    I.gear = (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5);
      if (d < 1.6) return null;
      if (d < 5.2) return d < 2.6 ? [150, 110, 40] : [222, 178, 84];
      return d < 7.4 && Math.cos(a * 8) > 0.2 ? [190, 146, 60] : null;
    };
    I.wheel = (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5);
      if (d < 1.5) return [90, 96, 108];
      if (Math.abs(d - 5) < 0.8) return WOOD;
      if (d < 5 && Math.abs(Math.sin(a * 2)) < 0.15) return mul(WOOD, 0.8);
      return d < 7.6 && d > 5 && Math.abs(Math.sin(a * 4)) < 0.3 ? [190, 140, 80] : null;
    };

    // ================= ブロック =================
    const KIND = {}; // ブロックの ばんごう → しゅるい
    const SIGK = new Set(['wire', 'lever', 'button', 'plate', 'lamp', 'not', 'clock', 'piston']);
    const KINK = new Set(['crank', 'wheel', 'windmill', 'shaft', 'gear', 'belt', 'crusher', 'drill']);
    const ALLK = [...SIGK, ...KINK, 'head', 'mover'];
    const RT = new WeakMap();
    function rt(w) {
      let r = RT.get(w);
      if (!r) { r = { k: {}, sig: true, kin: true, wire: new Map(), lit: new Set(), spd: new Map(), ang: new Map() }; for (const k of ALLK) r.k[k] = new Set(); RT.set(w, r); }
      return r;
    }
    const S = (w, i) => { let s = w.st.get(i); if (!s) { s = {}; w.st.set(i, s); } return s; };
    const posI = (w, i) => api.pos(w, i);
    function nbi(w, i, f) {
      const [x, y, z] = posI(w, i), d = DIRS[f], nx = x + d[0], ny = y + d[1], nz2 = z + d[2];
      return w.inside(nx, ny, nz2) ? w.idx(nx, ny, nz2) : -1;
    }
    const redrawI = (w, i) => { const [x, y, z] = posI(w, i); api.redraw(w, x, y, z); };
    function mark(w, kind) { const r = rt(w); if (SIGK.has(kind)) r.sig = true; if (KINK.has(kind)) r.kin = true; }
    function mach(key, kind, o) {
      const id = api.block(key, Object.assign({}, o, {
        onAdd(w, x, y, z, loading) { rt(w).k[kind].add(w.idx(x, y, z)); mark(w, kind); if (o.onAdd) o.onAdd(w, x, y, z, loading); },
        onRemove(w, x, y, z, st) { rt(w).k[kind].delete(w.idx(x, y, z)); mark(w, kind); if (o.onRemove) o.onRemove(w, x, y, z, st); },
      }));
      KIND[id] = kind;
      return id;
    }
    const tickNo = () => api.tickNo();

    // ---- むきを かえる ----
    // ローカル (うえ = むき f) の ドットの ざひょうを せかいの むきに うつす
    const OR = [
      (p) => [p[0], 16 - p[2], p[1]],
      (p) => [p[0], p[2], 16 - p[1]],
      (p) => [p[1], 16 - p[0], p[2]],
      (p) => [16 - p[1], p[0], p[2]],
      null,
      (p) => [p[0], 16 - p[1], 16 - p[2]],
    ];
    // ローカルの まえ (+z) を よこむき f に する
    const YR = [null, (p) => [16 - p[0], p[1], 16 - p[2]], (p) => [p[2], p[1], 16 - p[0]], (p) => [16 - p[2], p[1], p[0]]];
    function orientM(m, f) {
      if (f === 0) return X.rx(m, Math.PI / 2);
      if (f === 1) return X.rx(m, -Math.PI / 2);
      if (f === 2) return X.rz(m, -Math.PI / 2);
      if (f === 3) return X.rz(m, Math.PI / 2);
      if (f === 5) return X.rx(m, Math.PI);
      return m;
    }
    const yawM = (m, f) => (f === 1 ? X.ry(m, Math.PI) : f === 2 ? X.ry(m, Math.PI / 2) : f === 3 ? X.ry(m, -Math.PI / 2) : m);
    const M0 = (x, y, z) => X.t(X.id(), x + 0.5, y + 0.5, z + 0.5);
    const fin = (m) => X.t(X.s(m, 1 / 16), -8, -8, -8);
    const rotX = (a, cy, cz) => { const c = Math.cos(a), s = Math.sin(a); return (p) => [p[0], cy + (p[1] - cy) * c - (p[2] - cz) * s, cz + (p[1] - cy) * s + (p[2] - cz) * c]; };
    const H4 = [0, 2, 1, 3]; // よこむきを じゅんに まわす (みなみ→ひがし→きた→にし)

    // ---- でんき ----
    const conn = (w, x, y, z) => { const k = KIND[w.get(x, y, z)]; return k && SIGK.has(k); };
    const WIRE = mach('wire', 'wire', {
      name: 'でんきの せん', tex: T.wireOff, flatIcon: I.wire, render: 'model', solid: false, hard: 0.1,
      model(m, w, x, y, z) {
        const on = rt(w).lit.has(w.idx(x, y, z)), t = on ? T.wireOn : T.wireOff, o = on ? { glow: 1 } : null;
        const arms = [];
        for (const f of [0, 1, 2, 3]) {
          const d = DIRS[f], up = KIND[w.get(x + d[0], y + 1, z + d[2])] === 'wire' && !CS.OPAQUE[w.get(x, y + 1, z)];
          const c = conn(w, x + d[0], y, z + d[2]) || up || KIND[w.get(x + d[0], y - 1, z + d[2])] === 'wire';
          arms[f] = c ? (up ? 2 : 1) : 0;
        }
        const zs = arms[0] || arms[1], xs = arms[2] || arms[3];
        m.box(6.5, 0, 6.5, 9.5, 1, 9.5, t, o);
        if (arms[0] || (zs && !xs)) m.box(7, 0, 9.5, 9, 1, 16, t, o);
        if (arms[1] || (zs && !xs)) m.box(7, 0, 0, 9, 1, 6.5, t, o);
        if (arms[2] || (xs && !zs) || (!xs && !zs)) m.box(9.5, 0, 7, 16, 1, 9, t, o);
        if (arms[3] || (xs && !zs) || (!xs && !zs)) m.box(0, 0, 7, 6.5, 1, 9, t, o);
        if (!xs && !zs) { m.box(7, 0, 9.5, 9, 1, 16, t, o); m.box(7, 0, 0, 9, 1, 6.5, t, o); }
        // かべを のぼる せん
        if (arms[0] === 2) m.box(7, 0, 15, 9, 16, 16, t, o);
        if (arms[1] === 2) m.box(7, 0, 0, 9, 16, 1, t, o);
        if (arms[2] === 2) m.box(15, 0, 7, 16, 16, 9, t, o);
        if (arms[3] === 2) m.box(0, 0, 7, 1, 16, 9, t, o);
      },
      onNeighbor: needFloor,
    });
    // ゆかが なくなったら とれる
    function needFloor(w, x, y, z) {
      if (CS.SOLID[w.get(x, y - 1, z)]) return;
      const id = w.get(x, y, z);
      w.set(x, y, z, 0);
      if (!api.G.creative) api.drop(id, 1, x + 0.5, y + 0.3, z + 0.5);
    }
    const LEVER = mach('lever', 'lever', {
      name: 'レバー', tex: T.stoneBase, flatIcon: I.lever, render: 'model', solid: false, hard: 0.3,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {}, on = !!s.on, tf = rotX(on ? 0.55 : -0.55, 1.5, 8);
        m.box(5, 0, 4, 11, 2, 12, T.stoneBase);
        m.box(7.2, 1, 7.2, 8.8, 11, 8.8, T.stick, { tf });
        m.box(6.6, 10, 6.6, 9.4, 12.6, 9.4, on ? T.knobOn : T.knobOff, { tf, glow: on });
      },
      onUse(w, x, y, z) { const s = S(w, w.idx(x, y, z)); s.on = s.on ? 0 : 1; rt(w).sig = true; api.redraw(w, x, y, z); api.sfx('click'); return true; },
      onNeighbor: needFloor,
    });
    const BUTTON = mach('button', 'button', {
      name: 'ボタン', tex: T.stoneBase, flatIcon: I.button, render: 'model', solid: false, hard: 0.3,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {}, on = s.t > 0;
        m.box(4.5, 0, 4.5, 11.5, 2, 11.5, T.stoneBase);
        m.box(5.5, 2, 5.5, 10.5, on ? 2.7 : 4.5, 10.5, T.knobOff, on ? { glow: 1 } : null);
      },
      onUse(w, x, y, z) { const s = S(w, w.idx(x, y, z)); if (!(s.t > 0)) { rt(w).sig = true; api.redraw(w, x, y, z); } s.t = 20; api.sfx('click'); return true; },
      onNeighbor: needFloor,
    });
    const PLATE = mach('plate', 'plate', {
      name: 'ふみいた スイッチ', tex: T.plate, flatIcon: T.plate, render: 'model', solid: false, hard: 0.4,
      model(m, w, x, y, z) { const s = api.state(w, x, y, z) || {}; m.box(1, 0, 1, 15, s.on ? 0.6 : 1.5, 15, T.plate); },
      onNeighbor: needFloor,
    });
    const LAMP = mach('lamp', 'lamp', { name: 'でんきランプ', tex: T.lampOff, hard: 0.6, hardSound: 1 });
    const LAMP_ON = mach('lampOn', 'lamp', { name: 'でんきランプ (ひかっている)', tex: T.lampOn, hard: 0.6, light: 15, drop: 'lamp', hidden: true, hardSound: 1 });
    const slabTex = (top) => ({ top, side: T.slabSide, bottom: T.slabSide });
    mach('not', 'not', {
      name: 'さかさ ブロック', tex: slabTex(T.notTop), render: 'model', solid: false, hard: 0.4, flatIcon: T.notTop,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {}, tf = YR[s.f | 0];
        m.box(0, 0, 0, 16, 3, 16, slabTex(T.notTop), { tf });
        m.box(6.5, 3, 11, 9.5, 5.5, 14, s.on ? T.indOn : T.indOff, { tf, glow: !!s.on });
        m.box(7, 3, 2, 9, 4, 4, T.stoneBase, { tf });
      },
      onPlace(w, x, y, z, p) { S(w, w.idx(x, y, z)).f = api.facing(p, false); rt(w).sig = true; },
    });
    mach('clock', 'clock', {
      name: 'チカチカ タイマー', tex: slabTex(T.clockTop), render: 'model', solid: false, hard: 0.4, flatIcon: T.clockTop,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {};
        m.box(0, 0, 0, 16, 3, 16, slabTex(T.clockTop));
        m.box(12, 3, 12, 15, 5, 15, s.out ? T.indOn : T.indOff, { glow: !!s.out });
      },
      onUse(w, x, y, z) { const s = S(w, w.idx(x, y, z)); s.off = s.off ? 0 : 1; if (s.off && s.out) { s.out = 0; rt(w).sig = true; api.redraw(w, x, y, z); } api.toast(s.off ? 'タイマーを とめた' : 'タイマーを うごかした'); api.sfx('click'); return true; },
    });

    // ---- ピストン ----
    const pistonDef = (sticky) => ({
      name: sticky ? 'ねばねば ピストン' : 'おしだし ピストン', tex: { top: sticky ? T.pSticky : T.pFace, bottom: T.pBack, side: T.pSide },
      render: 'model', opaque: true, hard: 1.5, hardSound: 1,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {}, tf = OR[s.f === undefined ? 4 : s.f], o = tf ? { tf } : null;
        if (!s.ext && !s.anim) m.box(0, 0, 0, 16, 16, 16, { top: sticky ? T.pSticky : T.pFace, bottom: T.pBack, side: T.pSide }, o);
        else m.box(0, 0, 0, 16, 12, 16, { top: T.pInner, bottom: T.pBack, side: T.pSide }, o);
      },
      onPlace(w, x, y, z, p) { const s = S(w, w.idx(x, y, z)); s.f = api.facing(p, true); s.ext = 0; rt(w).sig = true; },
      onAdd(w, x, y, z, loading) { if (loading) { const s = api.state(w, x, y, z); if (s && s.anim) s.anim = 0; } },
      onRemove(w, x, y, z, st) {
        if (!st || !st.ext) return;
        const d = DIRS[st.f === undefined ? 4 : st.f], hx = x + d[0], hy = y + d[1], hz = z + d[2];
        if (KIND[w.get(hx, hy, hz)] === 'head') w.set(hx, hy, hz, 0);
      },
    });
    const PISTON = mach('piston', 'piston', pistonDef(false));
    const STICKY = mach('stickyPiston', 'piston', pistonDef(true));
    const HEAD = mach('pistonHead', 'head', {
      name: 'ピストンの さき', tex: T.pFace, render: 'model', hidden: true, drop: null, hard: 1.5, hardSound: 1,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {};
        if (s.t0 != null && tickNo() < s.t0 + ANIM) return;
        const tf = OR[s.f === undefined ? 4 : s.f], o = tf ? { tf } : null;
        m.box(0, 12, 0, 16, 16, 16, { top: s.sticky ? T.pSticky : T.pFace, bottom: T.pInner, side: T.pSide }, o);
        m.box(6, -4, 6, 10, 12, 10, T.rod, o);
      },
      onAdd(w, x, y, z, loading) { if (loading) { const s = api.state(w, x, y, z); if (s) s.t0 = null; } },
      // さきを こわしたら ピストンごと とれる
      onRemove(w, x, y, z, st) {
        const d = DIRS[st && st.f !== undefined ? st.f : 4], bx = x - d[0], by = y - d[1], bz = z - d[2];
        const bid = w.get(bx, by, bz), bs = api.state(w, bx, by, bz);
        if (KIND[bid] === 'piston' && bs && bs.ext) {
          w.set(bx, by, bz, 0);
          if (!api.G.creative) api.drop(bid, 1, bx + 0.5, by + 0.5, bz + 0.5);
        }
      },
    });
    const MOVER = mach('mover', 'mover', {
      name: 'うごいている ブロック', tex: T.frame, render: 'custom', solid: false, opaque: false, unbreak: true, hidden: true, drop: null,
      onAdd(w, x, y, z, loading) { if (loading) { const s = api.state(w, x, y, z); if (s) s.t0 = -999; } },
    });
    function movable(w, x, y, z) {
      if (!w.inside(x, y, z)) return 'block';
      const i = w.idx(x, y, z), id = w.b[i];
      if (id === 0 || CS.LIQ[id]) return 'air';
      const d = BLOCKS[id];
      if (d.unbreak || d.portal || d.ph) return 'block';
      const k = KIND[id];
      if (k === 'head' || k === 'mover') return 'block';
      if (k === 'piston') { const s = w.st.get(i); if (s && (s.ext || s.anim)) return 'block'; }
      if (!CS.SOLID[id]) return 'break';
      return 'move';
    }
    function breakDrop(w, x, y, z) {
      const id = w.get(x, y, z);
      w.set(x, y, z, 0);
      const d = CS.rollDrop(id, Math.random());
      if (d && !api.G.creative) api.G.dropItem(d[0], d[1], x + 0.5, y + 0.4, z + 0.5);
    }
    function extend(w, i) {
      const [x, y, z] = posI(w, i), s = S(w, i), f = s.f === undefined ? 4 : s.f, d = DIRS[f];
      const line = [];
      let cx = x + d[0], cy = y + d[1], cz = z + d[2], mv;
      while ((mv = movable(w, cx, cy, cz)) === 'move') {
        line.push([cx, cy, cz]);
        if (line.length > PUSH) return false;
        cx += d[0]; cy += d[1]; cz += d[2];
      }
      if (mv === 'block') return false;
      const t0 = tickNo();
      w.beginBatch();
      if (mv === 'break') breakDrop(w, cx, cy, cz);
      for (let k = line.length - 1; k >= 0; k--) {
        const [px, py, pz] = line[k], pi = w.idx(px, py, pz), id = w.b[pi], pst = w.st.get(pi);
        const tx = px + d[0], ty = py + d[1], tz = pz + d[2];
        w.set(tx, ty, tz, MOVER);
        w.st.set(w.idx(tx, ty, tz), { id, st: pst || null, f, t0 });
      }
      s.ext = 1; s.anim = 1; s.t0 = t0;
      w.set(x + d[0], y + d[1], z + d[2], HEAD);
      w.st.set(w.idx(x + d[0], y + d[1], z + d[2]), { f, sticky: w.b[i] === STICKY ? 1 : 0, t0 });
      w.endBatch();
      api.redraw(w, x, y, z);
      CS.sfx.dig(1);
      return true;
    }
    function retract(w, i) {
      const [x, y, z] = posI(w, i), s = S(w, i), f = s.f === undefined ? 4 : s.f, d = DIRS[f];
      const t0 = tickNo(), hx = x + d[0], hy = y + d[1], hz = z + d[2];
      s.ext = 0; s.anim = 2; s.t0 = t0;
      if (KIND[w.get(hx, hy, hz)] === 'head') {
        w.beginBatch();
        w.set(hx, hy, hz, 0);
        const bx = hx + d[0], by = hy + d[1], bz = hz + d[2];
        if (w.b[i] === STICKY && movable(w, bx, by, bz) === 'move') {
          const bi = w.idx(bx, by, bz), id = w.b[bi], pst = w.st.get(bi);
          w.set(bx, by, bz, 0);
          w.set(hx, hy, hz, MOVER);
          w.st.set(w.idx(hx, hy, hz), { id, st: pst || null, f: f ^ 1, t0 });
        }
        w.endBatch();
      }
      api.redraw(w, x, y, z);
      CS.sfx.dig(0);
    }
    // うごく ブロックに あたった いきもの・おちている もの・プレイヤーを いっしょに おす
    function pushEnts(w, bx, by, bz, d, amt) {
      const G = api.G;
      for (const e of [G.player, ...G.ents, ...G.drops]) {
        if (!e || e.dead || e.exhibit) continue;
        const hw = e.w / 2;
        if (e.x + hw > bx && e.x - hw < bx + 1 && e.y + e.h > by && e.y < by + 1 && e.z + hw > bz && e.z - hw < bz + 1) {
          CS.move(w, e, d[0] * amt, d[1] * amt, d[2] * amt);
          if (d[1] > 0) { e.vy = Math.max(e.vy || 0, 0); e.onGround = true; if (e === G.player) e.airTop = e.y; }
        }
      }
    }
    function unstick(w) {
      const G = api.G;
      for (const e of [G.player, ...G.ents]) { let k = 0; while (e && CS.collides(w, e) && k++ < 24) e.y += 0.1; }
    }
    function anims(w, r, T0) {
      for (const i of [...r.k.mover]) {
        const s = w.st.get(i);
        const [x, y, z] = posI(w, i);
        if (!s) { w.set(x, y, z, 0); continue; }
        const t = (T0 - s.t0) / ANIM, d = DIRS[s.f];
        if (t < 1) { pushEnts(w, x - d[0] * (1 - t), y - d[1] * (1 - t), z - d[2] * (1 - t), d, 1 / ANIM); continue; }
        const id = BLOCKS[s.id] && !BLOCKS[s.id].ph ? s.id : 0;
        w.set(x, y, z, id);
        if (s.st && id >= 128) w.st.set(i, s.st);
        unstick(w);
        r.sig = r.kin = true;
      }
      for (const i of r.k.head) {
        const s = w.st.get(i);
        if (!s || s.t0 == null) continue;
        const [x, y, z] = posI(w, i), t = (T0 - s.t0) / ANIM, d = DIRS[s.f];
        if (t < 1) pushEnts(w, x - d[0] * (1 - t), y - d[1] * (1 - t), z - d[2] * (1 - t), d, 1 / ANIM);
        else { s.t0 = null; api.redraw(w, x, y, z); }
      }
      for (const i of r.k.piston) {
        const s = w.st.get(i);
        if (s && s.anim && T0 - s.t0 >= ANIM) { s.anim = 0; redrawI(w, i); r.sig = true; }
      }
    }

    // ---- でんきの けいさん (かわった ときだけ) ----
    function srcOn(w, n) {
      const k = KIND[w.b[n]];
      if (!k) return false;
      const s = w.st.get(n);
      if (!s) return false;
      return (k === 'lever' && !!s.on) || (k === 'button' && s.t > 0) || (k === 'plate' && !!s.on) || (k === 'clock' && !!s.out);
    }
    function wireNbrs(w, n, cb) {
      const [x, y, z] = posI(w, n);
      for (let f = 0; f < 6; f++) { const m = nbi(w, n, f); if (m >= 0 && KIND[w.b[m]] === 'wire') cb(m); }
      for (const f of [0, 1, 2, 3]) {
        const d = DIRS[f];
        for (const dy of [-1, 1]) {
          const nx = x + d[0], ny = y + dy, nz2 = z + d[2];
          if (w.inside(nx, ny, nz2) && KIND[w.get(nx, ny, nz2)] === 'wire') cb(w.idx(nx, ny, nz2));
        }
      }
    }
    function signals(w, r, T0) {
      const wire = new Map(), buckets = Array.from({ length: 16 }, () => []);
      const seed = (n, l) => { if ((wire.get(n) || 0) < l) { wire.set(n, l); buckets[l].push(n); } };
      const isWire = (n) => n >= 0 && KIND[w.b[n]] === 'wire';
      for (const k of ['lever', 'button', 'plate', 'clock']) for (const i of r.k[k]) if (srcOn(w, i)) for (let f = 0; f < 6; f++) { const n = nbi(w, i, f); if (isWire(n)) seed(n, 15); }
      for (const i of r.k.not) { const s = w.st.get(i); if (s && s.on) { const n = nbi(w, i, s.f | 0); if (isWire(n)) seed(n, 15); } }
      for (let l = 15; l >= 2; l--) for (const n of buckets[l]) { if (wire.get(n) === l) wireNbrs(w, n, (m) => seed(m, l - 1)); }
      r.wire = wire;
      for (const i of r.k.wire) {
        const on = wire.has(i);
        if (on !== r.lit.has(i)) { if (on) r.lit.add(i); else r.lit.delete(i); redrawI(w, i); }
      }
      const powered = (i, only, skip) => {
        for (let f = 0; f < 6; f++) {
          if ((only !== undefined && f !== only) || f === skip) continue;
          const n = nbi(w, i, f);
          if (n < 0) continue;
          if ((wire.get(n) || 0) > 0 || srcOn(w, n)) return true;
          if (KIND[w.b[n]] === 'not') { const s = w.st.get(n); if (s && s.on && (s.f | 0) === (f ^ 1)) return true; }
        }
        return false;
      };
      const todo = [];
      for (const i of r.k.lamp) { const on = powered(i), id = w.b[i]; if (on !== (id === LAMP_ON)) todo.push(() => { const [x, y, z] = posI(w, i); w.set(x, y, z, on ? LAMP_ON : LAMP); }); }
      for (const i of r.k.piston) {
        const s = S(w, i);
        if (s.anim) continue;
        const want = powered(i, undefined, s.f === undefined ? 4 : s.f);
        if (want && !s.ext) todo.push(() => { if (w.b[i] === PISTON || w.b[i] === STICKY) extend(w, i); });
        else if (!want && s.ext) todo.push(() => { if (w.b[i] === PISTON || w.b[i] === STICKY) retract(w, i); });
      }
      for (const i of r.k.not) {
        const s = S(w, i), want = !powered(i, (s.f | 0) ^ 1);
        if (want !== !!s.on) { s.want = want; if (s.pend == null) s.pend = T0 + 2; } else s.pend = null;
      }
      for (const fn of todo) fn();
    }

    // ---- かいてんの ちから ----
    const ALL6 = 63;
    function kfaces(k, s) {
      if (k === 'shaft' || k === 'wheel') { const a = s.a | 0; return (1 << a) | (1 << (a + 1)); }
      if (k === 'windmill') return 1 << ((s.f | 0) ^ 1);
      if (k === 'belt') return ALL6 & ~(1 << 4);
      if (k === 'drill') return ALL6 & ~(1 << (s.f === undefined ? 4 : s.f));
      return ALL6;
    }
    function srcSpeed(w, i, k, s) {
      if (k === 'crank') return s.t > 0 ? 2 : 0;
      if (k === 'wheel') { for (let f = 0; f < 6; f++) { const n = nbi(w, i, f); if (n >= 0 && CS.LIQ[w.b[n]] === 1) return 1; } return 0; }
      if (k === 'windmill') { const n = nbi(w, i, s.f | 0); return n >= 0 && w.sky[n] >= 12 ? 1.5 : 0; }
      return 0;
    }
    function kinetics(w, r) {
      const spd = new Map(), seen = new Set();
      for (const k of KINK) for (const i0 of r.k[k]) {
        if (seen.has(i0)) continue;
        const comp = [], sign = new Map([[i0, 1]]), q = [i0];
        seen.add(i0);
        let best = 0;
        while (q.length) {
          const i = q.pop(), ki = KIND[w.b[i]], s = S(w, i), mask = kfaces(ki, s);
          comp.push(i);
          best = Math.max(best, srcSpeed(w, i, ki, s));
          for (let f = 0; f < 6; f++) {
            if (!(mask & (1 << f))) continue;
            const n = nbi(w, i, f);
            if (n < 0 || seen.has(n)) continue;
            const kn = KIND[w.b[n]];
            if (!kn || !KINK.has(kn) || !(kfaces(kn, S(w, n)) & (1 << (f ^ 1)))) continue;
            seen.add(n); sign.set(n, ki === 'gear' && kn === 'gear' ? -sign.get(i) : sign.get(i)); q.push(n);
          }
        }
        for (const i of comp) spd.set(i, best * sign.get(i));
      }
      r.spd = spd;
    }
    const speedAt = (w, i) => Math.abs(rt(w).spd.get(i) || 0);

    // ---- かいてんする きかい ----
    const axisPlace = (vertical) => function (w, x, y, z, p) { S(w, w.idx(x, y, z)).a = api.facing(p, vertical) & 6; rt(w).kin = true; };
    mach('crank', 'crank', {
      name: 'ぐるぐる ハンドル', tex: { top: T.crateTop, side: T.crate }, render: 'model', hard: 1.2,
      model(m) { m.box(1, 0, 1, 15, 16, 15, { top: T.crateTop, side: T.crate }); },
      onUse(w, x, y, z) {
        const s = S(w, w.idx(x, y, z));
        if (!(s.t > 0)) rt(w).kin = true;
        s.t = Math.min(400, (s.t | 0) + 100);
        api.sfx('click');
        return true;
      },
    });
    mach('wheel', 'wheel', { name: 'みずぐるま', tex: T.wood, flatIcon: I.wheel, render: 'custom', solid: false, hard: 1.2, onPlace: (w, x, y, z, p) => { S(w, w.idx(x, y, z)).a = api.facing(p, false) & 2; rt(w).kin = true; } });
    mach('windmill', 'windmill', {
      name: 'かざぐるま', tex: { top: T.wood, side: T.wood }, render: 'model', opaque: true, hard: 1.2,
      model(m, w, x, y, z) { const s = api.state(w, x, y, z) || {}; m.box(0, 0, 0, 16, 16, 16, { top: T.wood, side: T.wood, 0: T.windFront }, { tf: YR[s.f | 0] }); },
      onPlace(w, x, y, z, p) { S(w, w.idx(x, y, z)).f = api.facing(p, false) ^ 1; rt(w).kin = true; },
    });
    mach('shaft', 'shaft', { name: 'かいてん ぼう', tex: T.shaft, flatIcon: I.shaft, render: 'custom', solid: false, hard: 0.6, hardSound: 1, onPlace: axisPlace(true) });
    mach('gear', 'gear', { name: 'はぐるま', tex: T.gear, flatIcon: I.gear, render: 'custom', solid: false, hard: 0.6, hardSound: 1, onPlace: axisPlace(true) });
    mach('belt', 'belt', {
      name: 'ベルト コンベア', tex: { top: T.beltTop, side: T.beltSide, bottom: T.frame }, render: 'model', opaque: true, hard: 1,
      model(m, w, x, y, z) { const s = api.state(w, x, y, z) || {}; m.box(0, 0, 0, 16, 16, 16, { top: T.beltTop, side: T.beltSide, bottom: T.frame }, { tf: YR[s.f | 0] }); },
      onPlace(w, x, y, z, p) { S(w, w.idx(x, y, z)).f = api.facing(p, false); rt(w).kin = true; },
    });
    // こなごな マシン: いれた ものが 2ばいに なる
    const CRUSH = {
      ironOre: ['rawIron', 2], goldOre: ['rawGold', 2], coalOre: ['coal', 3], diamondOre: ['diamond', 2], crystalOre: ['crystal', 2],
      emberOre: ['emberGem', 2], starOre: ['starShard', 2], meteorOre: ['meteorIron', 2], pearlOre: ['pearl', 2], amberOre: ['fos_amber', 2],
      cobble: ['sand', 1], log: ['planks', 6],
    };
    const CR = {};
    for (const k in CRUSH) CR[api.id(k)] = [api.id(CRUSH[k][0]), CRUSH[k][1]];
    mach('crusher', 'crusher', {
      name: 'こなごな マシン', tex: { top: T.crushIn, side: T.crushSide }, render: 'model', opaque: true, hard: 2, hardSound: 1,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {}, o = { tf: YR[s.f | 0] };
        m.box(0, 0, 0, 16, 12, 16, { top: T.crushIn, side: T.crushSide, bottom: T.frame, 0: T.crushFront }, o);
        m.box(0, 12, 0, 2, 16, 16, T.crushSide, o); m.box(14, 12, 0, 16, 16, 16, T.crushSide, o);
        m.box(2, 12, 0, 14, 16, 2, T.crushSide, o); m.box(2, 12, 14, 14, 16, 16, T.crushSide, o);
      },
      onPlace(w, x, y, z, p) { S(w, w.idx(x, y, z)).f = api.facing(p, false) ^ 1; rt(w).kin = true; },
      onUse(w, x, y, z, p, held) {
        const s = S(w, w.idx(x, y, z));
        s.q = s.q || [];
        if (held && CR[held.id]) {
          const n = held.n;
          s.q.push([held.id, n]);
          if (!api.G.creative) p.inv[p.sel] = null;
          api.toast(`${CS.ITEMS[held.id].name} を ${n}こ いれた`);
          api.sfx('pop');
          return true;
        }
        const left = s.q.reduce((a, q) => a + q[1], 0);
        api.toast(speedAt(w, w.idx(x, y, z)) ? `こなごなに しているよ (のこり ${left}こ)` : 'まわす ちからが ないよ。ハンドルや みずぐるまに つなごう');
        return true;
      },
      onRemove(w, x, y, z, st) { if (st && st.q && !api.G.creative) for (const [id, n] of st.q) api.G.dropItem(id, n, x + 0.5, y + 0.5, z + 0.5); },
    });
    mach('drill', 'drill', {
      name: 'ほりほり ドリル', tex: { top: T.drillTop, side: T.drillSide, bottom: T.frame }, render: 'model', opaque: true, hard: 2, hardSound: 1,
      model(m, w, x, y, z) {
        const s = api.state(w, x, y, z) || {}, tf = OR[s.f === undefined ? 4 : s.f];
        m.box(0, 0, 0, 16, 10, 16, { top: T.drillTop, side: T.drillSide, bottom: T.frame }, tf ? { tf } : null);
      },
      onPlace(w, x, y, z, p) { S(w, w.idx(x, y, z)).f = api.facing(p, true); rt(w).kin = true; },
    });
    // スパナ: きかいの むきを かえる
    api.item('wrench', {
      name: 'スパナ', stack: 1,
      icon: (x, y) => {
        const on = Math.abs((x - 2) - (13 - y)) < 1.3 && x > 2 && x < 12;
        const head = Math.hypot(x - 12, y - 3.5) < 3.3 && !(Math.abs(x - 13.5) < 1.4 && y < 4);
        return head || on ? (x + y < 15 ? [200, 208, 220] : [140, 150, 165]) : null;
      },
      onUseBlock(w, x, y, z) {
        const i = w.idx(x, y, z), k = KIND[w.b[i]];
        if (!k) return false;
        const s = S(w, i);
        if (k === 'piston') { if (s.ext || s.anim) { api.toast('のびている ピストンは まわせないよ'); return true; } s.f = ((s.f === undefined ? 4 : s.f) + 1) % 6; }
        else if (k === 'drill') s.f = ((s.f === undefined ? 4 : s.f) + 1) % 6;
        else if (['belt', 'crusher', 'not', 'clock', 'windmill'].includes(k)) s.f = H4[(H4.indexOf(s.f | 0) + 1) % 4];
        else if (k === 'shaft' || k === 'gear') s.a = ((s.a | 0) + 2) % 6;
        else if (k === 'wheel') s.a = (s.a | 0) === 0 ? 2 : 0;
        else return false;
        mark(w, k); rt(w).sig = rt(w).kin = true;
        api.redraw(w, x, y, z);
        api.sfx('click');
        return true;
      },
    });

    // ================= まいtick =================
    function entOn(w, i) {
      const [x, y, z] = posI(w, i), G = api.G;
      for (const e of [G.player, ...G.ents, ...G.drops]) {
        if (!e || e.dead) continue;
        const hw = (e.w || 0.25) / 2;
        if (e.x + hw > x && e.x - hw < x + 1 && e.z + hw > z && e.z - hw < z + 1 && e.y < y + 0.35 && e.y + (e.h || 0.25) > y) return true;
      }
      return false;
    }
    api.onTick((w, T0) => {
      const r = rt(w);
      for (const i of r.k.button) { const s = w.st.get(i); if (s && s.t > 0 && !--s.t) { r.sig = true; redrawI(w, i); } }
      if (T0 % 2 === 0) for (const i of r.k.plate) { const s = S(w, i), on = entOn(w, i); if (!!s.on !== on) { s.on = on ? 1 : 0; r.sig = true; redrawI(w, i); api.sfx('click'); } }
      for (const i of r.k.clock) { const s = S(w, i); if (s.off) continue; s.c = ((s.c | 0) + 1) % 20; const out = s.c < 10 ? 1 : 0; if (out !== (s.out | 0)) { s.out = out; r.sig = true; redrawI(w, i); } }
      for (const i of r.k.not) { const s = w.st.get(i); if (s && s.pend != null && T0 >= s.pend) { s.pend = null; if (!!s.on !== !!s.want) { s.on = s.want ? 1 : 0; r.sig = true; redrawI(w, i); } } }
      if (T0 % 20 === 0 && r.k.piston.size) r.sig = true; // ふさがっていた ピストンを ときどき ためす
      if (r.sig) { r.sig = false; signals(w, r, T0); }
      anims(w, r, T0);
      for (const i of r.k.crank) { const s = w.st.get(i); if (s && s.t > 0 && !--s.t) r.kin = true; }
      if (r.kin || T0 % 20 === 0) { r.kin = false; kinetics(w, r); }
      const G = api.G;
      // ドリル
      for (const i of r.k.drill) {
        const sp = speedAt(w, i), s = S(w, i);
        if (!sp) continue;
        const [x, y, z] = posI(w, i), d = DIRS[s.f === undefined ? 4 : s.f], fx = x + d[0], fy = y + d[1], fz = z + d[2];
        const id = w.get(fx, fy, fz), def = BLOCKS[id];
        if (!id || CS.LIQ[id] || def.unbreak || def.portal || id >= 128 || id === CS.B.treasure || !w.inside(fx, fy, fz)) { s.p = 0; continue; }
        s.p = (s.p || 0) + sp / (20 * Math.max(0.25, (def.hard || 0.2) * 0.5));
        if (T0 % 5 === 0) G.burst(fx + 0.5 - d[0] * 0.5, fy + 0.5 - d[1] * 0.5, fz + 0.5 - d[2] * 0.5, [0.75, 0.72, 0.68], 2, 2, 0.3, 0.08);
        if (s.p >= 1) {
          s.p = 0;
          w.set(fx, fy, fz, 0);
          // ドリルは こうせきも そのまま ほりだす (こなごな マシンで 2ばいに できる)
          if (def.drop !== null && !G.creative) G.dropItem(id, 1, fx + 0.5, fy + 0.3, fz + 0.5);
          G.burst(fx + 0.5, fy + 0.5, fz + 0.5, [0.7, 0.68, 0.64], 10, 4, 0.6, 0.12);
          CS.sfx.brk(def.hardSound);
        }
      }
      // こなごな マシン
      for (const i of r.k.crusher) {
        const s = S(w, i), [x, y, z] = posI(w, i);
        s.q = s.q || [];
        for (const dr of G.drops) {
          if (dr.n <= 0 || !CR[dr.id] || dr.age < 0.3) continue;
          if (Math.abs(dr.x - x - 0.5) < 0.95 && Math.abs(dr.z - z - 0.5) < 0.95 && dr.y > y - 0.3 && dr.y < y + 1.6) { s.q.push([dr.id, dr.n]); dr.n = 0; CS.sfx.pop(); }
        }
        const sp = speedAt(w, i);
        if (!sp || !s.q.length) continue;
        s.p = (s.p || 0) + sp / 40;
        if (T0 % 4 === 0) G.burst(x + 0.5, y + 1.05, z + 0.5, [0.8, 0.78, 0.7], 2, 2, 0.35, 0.08);
        if (s.p >= 1) {
          s.p = 0;
          const q = s.q[0], out = CR[q[0]];
          if (--q[1] <= 0) s.q.shift();
          if (out) {
            const d = DIRS[s.f | 0];
            G.dropItem(out[0], out[1], x + 0.5 + d[0] * 0.85, y + 0.35, z + 0.5 + d[2] * 0.85);
            CS.sfx.brk(1);
          }
        }
      }
    });
    // まいフレーム: まわる かくど・ベルトで はこぶ
    api.onFrame((w, dt) => {
      const r = rt(w), G = api.G;
      for (const [i, sp] of r.spd) if (sp) r.ang.set(i, ((r.ang.get(i) || 0) + sp * dt * Math.PI) % (Math.PI * 64));
      if (!r.k.belt.size) return;
      for (const e of [G.player, ...G.ents, ...G.drops]) {
        if (!e || e.dead || e.exhibit || !e.onGround || (e === G.player && G.player.flying)) continue;
        const bx = Math.floor(e.x), by = Math.floor(e.y - 0.05), bz = Math.floor(e.z);
        if (!w.inside(bx, by, bz)) continue;
        const i = w.idx(bx, by, bz);
        if (KIND[w.b[i]] !== 'belt') continue;
        const sp = speedAt(w, i);
        if (!sp) continue;
        const d = DIRS[S(w, i).f | 0], v = sp * 1.6 * dt;
        CS.move(w, e, d[0] * v, 0, d[2] * v);
        e.onGround = true;
        if (e.age !== undefined) { // おちている ものは まんなかに よせる
          const k = Math.min(1, dt * 5);
          if (d[0]) e.z += (bz + 0.5 - e.z) * k; else e.x += (bx + 0.5 - e.x) * k;
        }
      }
    });

    // ================= うごく ぶひんを かく =================
    api.onDraw((ren, w) => {
      const r = rt(w), cam = ren.cam, R = ren.renderDist * 16, tn = api.now();
      const near = (x, z) => Math.abs(x - cam.x) < R && Math.abs(z - cam.z) < R;
      const lit = (x, y, z) => Math.max(ren.lightAt(x + 0.5, y + 0.5, z + 0.5), ren.lightAt(x + 0.5, y + 1.5, z + 0.5));
      const each = (k, fn) => { for (const i of r.k[k]) { const [x, y, z] = posI(w, i); if (near(x, z)) fn(i, x, y, z, w.st.get(i) || {}); } };
      const ang = (i) => r.ang.get(i) || 0;
      each('shaft', (i, x, y, z, s) => { const m = fin(X.ry(orientM(M0(x, y, z), s.a | 0), ang(i))); ren.atlasBox(m, [6, 0, 6, 10, 16, 10], T.shaft, lit(x, y, z)); });
      each('gear', (i, x, y, z, s) => {
        const L = lit(x, y, z), m = X.ry(orientM(M0(x, y, z), s.a | 0), ang(i));
        ren.atlasBox(fin(m), [7, 0, 7, 9, 16, 9], T.shaft, L);
        ren.atlasBox(fin(m), [3.5, 6.5, 3.5, 12.5, 9.5, 12.5], T.gear, L);
        ren.atlasBox(fin(X.ry(m, Math.PI / 4)), [3.5, 6.5, 3.5, 12.5, 9.5, 12.5], T.gear, L);
        for (let k = 0; k < 8; k++) ren.atlasBox(fin(X.ry(m, k * Math.PI / 4 + Math.PI / 8)), [6.8, 6.8, 13, 9.2, 9.2, 16], T.gear, L);
      });
      each('wheel', (i, x, y, z, s) => {
        const L = lit(x, y, z), m = X.ry(orientM(M0(x, y, z), s.a | 0), ang(i));
        ren.atlasBox(fin(m), [6.5, 0, 6.5, 9.5, 16, 9.5], T.shaft, L);
        for (let k = 0; k < 8; k++) {
          const mk = fin(X.ry(m, k * Math.PI / 4));
          ren.atlasBox(mk, [7.4, 6.5, 8, 8.6, 9.5, 13], T.wood, L);
          ren.atlasBox(mk, [7.2, 2, 12, 8.8, 14, 16.5], T.wood, L);
        }
      });
      each('windmill', (i, x, y, z, s) => {
        const L = lit(x, y, z), m = X.ry(orientM(M0(x, y, z), s.f | 0), ang(i));
        ren.atlasBox(fin(m), [6, 16, 6, 10, 19, 10], T.shaft, L);
        for (let k = 0; k < 4; k++) {
          const mk = fin(X.ry(m, k * Math.PI / 2));
          ren.atlasBox(mk, [7.3, 17, 8, 8.7, 18.4, 31], T.wood, L);
          ren.atlasBox(mk, [8.7, 17.4, 13, 15, 18, 31], T.sail, L);
        }
      });
      each('crank', (i, x, y, z) => {
        const L = lit(x, y, z), m = X.ry(M0(x, y, z), ang(i));
        ren.atlasBox(fin(m), [7, 16, 7, 9, 19.5, 9], T.shaft, L);
        ren.atlasBox(fin(m), [7, 18, 7, 9, 20, 14], T.stick, L);
        ren.atlasBox(fin(m), [6.8, 18, 12, 9.2, 24, 14.4], T.stick, L);
      });
      each('drill', (i, x, y, z, s) => {
        const L = lit(x, y, z), m = X.ry(orientM(M0(x, y, z), s.f === undefined ? 4 : s.f), ang(i) * 2);
        ren.atlasBox(fin(m), [4, 10, 4, 12, 12, 12], T.bit, L);
        ren.atlasBox(fin(X.ry(m, 0.6)), [5.2, 12, 5.2, 10.8, 14, 10.8], T.bit, L);
        ren.atlasBox(fin(X.ry(m, 1.2)), [6.6, 14, 6.6, 9.4, 16, 9.4], T.bit, L);
      });
      each('crusher', (i, x, y, z) => {
        const L = lit(x, y, z), a = ang(i) * 2;
        for (const side of [-1, 1]) {
          const m = X.ry(orientM(X.t(M0(x, y, z), 0, 5.5 / 16, side * 3 / 16), 2), a * side);
          ren.atlasBox(fin(m), [5.6, 2, 5.6, 10.4, 14, 10.4], T.roller, L);
          ren.atlasBox(fin(X.ry(m, Math.PI / 4)), [5.6, 2, 5.6, 10.4, 14, 10.4], T.roller, L);
        }
      });
      // ベルトの うえを ながれる よこじま
      each('belt', (i, x, y, z, s) => {
        const sp = r.spd.get(i);
        if (!sp) return;
        const f = s.f | 0, d = DIRS[f], q = [Math.abs(d[2]), 0, Math.abs(d[0])];
        const o = ((Math.abs(ang(i)) / Math.PI) * 0.8) % 1, yy = y + 1.004;
        const pt = (sv, tv) => {
          // tv: よこ (0..1)。うしろから みて ひだり→みぎ に なるよう、q の むきを あわせる
          const qa = f === 0 || f === 3 ? 1 - tv : tv;
          return [x + 0.5 + d[0] * (sv - 0.5) + q[0] * (qa - 0.5), yy, z + 0.5 + d[2] * (sv - 0.5) + q[2] * (qa - 0.5)];
        };
        const L = lit(x, y, z);
        ren.atlasQuad([pt(1, 0), pt(1, 1), pt(o, 1), pt(o, 0)], T.beltTop, [0, 0, 1, 1 - o], L);
        if (o > 0.001) ren.atlasQuad([pt(o, 0), pt(o, 1), pt(0, 1), pt(0, 0)], T.beltTop, [0, 1 - o, 1, 1], L);
      });
      // のびる・ちぢむ ピストン
      each('piston', (i, x, y, z, s) => {
        if (!s.anim) return;
        const t = CS.clamp((tn - s.t0) / ANIM, 0, 1), e = s.anim === 1 ? t : 1 - t, L = lit(x, y, z);
        const m = fin(orientM(M0(x, y, z), s.f === undefined ? 4 : s.f)), sticky = w.b[i] === STICKY;
        ren.atlasBox(m, [0, 12 + 16 * e, 0, 16, 16 + 16 * e, 16], { top: sticky ? T.pSticky : T.pFace, bottom: T.pInner, side: T.pSide }, L);
        if (e > 0.01) ren.atlasBox(m, [6, 12, 6, 10, 12 + 16 * e, 10], T.rod, L);
      });
      // うごいている ブロック
      each('mover', (i, x, y, z, s) => {
        const def = BLOCKS[s.id];
        if (!def || !def.tx) return;
        const t = CS.clamp((tn - s.t0) / ANIM, 0, 1), d = DIRS[s.f], k = 1 - t;
        const m = fin(M0(x - d[0] * k, y - d[1] * k, z - d[2] * k));
        ren.atlasBox(m, [0, 0, 0, 16, 16, 16], def.tx, lit(x, y, z));
      });
    });

    // ================= レシピ・お店・あそびかた =================
    api.recipe('wire', 12, [['ironIngot', 1], ['crystal', 1]], 'table');
    api.recipe('lever', 1, [['stick', 1], ['cobble', 1]], 'table');
    api.recipe('button', 2, [['cobble', 1], ['wire', 1]], 'table');
    api.recipe('plate', 1, [['planks', 2], ['wire', 1]], 'table');
    api.recipe('lamp', 1, [['glass', 2], ['wire', 2]], 'table');
    api.recipe('not', 1, [['cobble', 3], ['wire', 2], ['torch', 1]], 'table');
    api.recipe('clock', 1, [['cobble', 3], ['wire', 2], ['goldIngot', 1]], 'table');
    api.recipe('piston', 1, [['planks', 3], ['cobble', 4], ['ironIngot', 1], ['wire', 1]], 'table');
    api.recipe('stickyPiston', 1, [['piston', 1], ['crystal', 1]], 'table');
    api.recipe('crank', 1, [['planks', 4], ['stick', 2]], 'table');
    api.recipe('wheel', 1, [['planks', 6], ['ironIngot', 1]], 'table');
    api.recipe('windmill', 1, [['planks', 4], ['woolWhite', 4], ['stick', 2]], 'table');
    api.recipe('shaft', 4, [['ironIngot', 2]], 'table');
    api.recipe('gear', 2, [['planks', 2], ['ironIngot', 1]], 'table');
    api.recipe('belt', 4, [['woolWhite', 2], ['planks', 2], ['ironIngot', 1]], 'table');
    api.recipe('crusher', 1, [['stoneBrick', 4], ['ironIngot', 3], ['gear', 1]], 'table');
    api.recipe('drill', 1, [['ironIngot', 4], ['diamond', 1], ['gear', 1]], 'table');
    api.recipe('wrench', 1, [['ironIngot', 2], ['stick', 1]], 'table');
    api.shop('shop', 'wire', 16, 20);
    api.shop('shop', 'lever', 2, 6);
    api.shop('shop', 'piston', 1, 25);
    api.shop('shop', 'crank', 1, 10);
    api.shop('shop', 'wrench', 1, 15);
    api.help(`<p>でんきや かいてんする ちからで うごく しかけ。さぎょうだいで つくれるよ (クリエイティブは もちものの「MOD」タブ)。</p>
<ul>
<li><b>でんき</b>: <b>レバー</b>・<b>ボタン</b>・<b>ふみいた スイッチ</b>・<b>チカチカ タイマー</b> から でんきが でる。<b>でんきの せん</b> で つなぐと 15ブロック まで とどく。<b>でんきランプ</b> が ひかって、<b>ピストン</b> が うごくよ。</li>
<li><b>さかさ ブロック</b>: うしろから でんきが こない ときだけ、やじるしの ほうへ でんきを だす。</li>
<li><b>おしだし ピストン</b>: でんきが くると ブロックを 12こ まで おす。<b>ねばねば ピストン</b> は もどる ときに ひっぱる。おくときに みている ほうを むくよ。</li>
<li><b>かいてん</b>: <b>ぐるぐる ハンドル</b> (みぎクリックで まわす)・<b>みずぐるま</b> (みずの となりに おく)・<b>かざぐるま</b> (そとの ひらけた ところ) が ちからを つくる。<b>かいてん ぼう</b> と <b>はぐるま</b> で つたえよう。</li>
<li><b>ベルト コンベア</b>: まわっていると、のっている ものや ひとを はこぶ。<b>こなごな マシン</b>: こうせきを いれると 2ばいに なる (うえに おとしても はいる)。<b>ほりほり ドリル</b>: まえの ブロックを ほる。こうせきは そのまま でてくるよ。</li>
<li><b>スパナ</b>: きかいを みぎクリックすると むきが かわる。シフトを おしながら みぎクリックすると、きかいの となりにも ブロックが おけるよ。</li>
</ul>`);
  },
});
