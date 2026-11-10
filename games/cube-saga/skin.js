/* スキン: 前と後ろの2枚の絵 (16×32) から、体の箱に貼るテクスチャを作る */
'use strict';
(function () {
  const CS = window.CS;
  const GW = 16, GH = 32;
  // 箱は 1/16 ブロック単位。前の絵の x=0 側 (見る人の左) がモデルの -X。
  const PARTS = [
    { key: 'head', box: [-4, 24, -4, 4, 32, 4], w: 8, h: 8, d: 8, fx: 4, fy: 0, bx: 4, by: 0, pivot: [0, 24, 0] },
    { key: 'body', box: [-4, 12, -2, 4, 24, 2], w: 8, h: 12, d: 4, fx: 4, fy: 8, bx: 4, by: 8, pivot: [0, 12, 0] },
    { key: 'armR', box: [-8, 12, -2, -4, 24, 2], w: 4, h: 12, d: 4, fx: 0, fy: 8, bx: 12, by: 8, pivot: [-6, 22, 0] },
    { key: 'armL', box: [4, 12, -2, 8, 24, 2], w: 4, h: 12, d: 4, fx: 12, fy: 8, bx: 0, by: 8, pivot: [6, 22, 0] },
    { key: 'legR', box: [-4, 0, -2, 0, 12, 2], w: 4, h: 12, d: 4, fx: 4, fy: 20, bx: 8, by: 20, pivot: [-2, 12, 0] },
    { key: 'legL', box: [0, 0, -2, 4, 12, 2], w: 4, h: 12, d: 4, fx: 8, fy: 20, bx: 4, by: 20, pivot: [2, 12, 0] },
  ];
  function paintable(x, y) {
    for (const p of PARTS) if (x >= p.fx && x < p.fx + p.w && y >= p.fy && y < p.fy + p.h) return p;
    return null;
  }
  function blank() { return { f: new Array(GW * GH).fill('#888888'), b: new Array(GW * GH).fill('#888888') }; }
  const at = (g, x, y) => g[y * GW + x];

  // 各面のドットの色。面の向きは render.js の FACES と同じ順 (+Z,-Z,+X,-X,+Y,-Y)
  function facePixel(s, p, f, u, v) {
    const F = s.f, K = s.b, w = p.w, h = p.h, d = p.d;
    switch (f) {
      case 0: return at(F, p.fx + u, p.fy + v);
      case 1: return at(K, p.bx + u, p.by + v);
      case 2: return u < d / 2 ? at(F, p.fx + w - 1, p.fy + v) : at(K, p.bx, p.by + v);
      case 3: return u < d / 2 ? at(K, p.bx + w - 1, p.by + v) : at(F, p.fx, p.fy + v);
      case 4: return v >= d / 2 ? at(F, p.fx + u, p.fy) : at(K, p.bx + w - 1 - u, p.by);
      default: return v < d / 2 ? at(F, p.fx + u, p.fy + h - 1) : at(K, p.bx + w - 1 - u, p.by + h - 1);
    }
  }
  const faceSize = (p, f) => (f < 2 ? [p.w, p.h] : f < 4 ? [p.d, p.h] : [p.w, p.d]);
  // 64×64 の中の面の置き場 (どのスキンでも同じ)
  const LAYOUT = {};
  (function () {
    let x = 0, y = 0, rowH = 0;
    for (const p of PARTS) {
      LAYOUT[p.key] = [];
      for (let f = 0; f < 6; f++) {
        const [fw, fh] = faceSize(p, f);
        if (x + fw > 64) { x = 0; y += rowH; rowH = 0; }
        LAYOUT[p.key].push([x, y, fw, fh]);
        x += fw; rowH = Math.max(rowH, fh);
      }
    }
  })();
  function drawSkin(g, s, ox, oy) {
    for (const p of PARTS) for (let f = 0; f < 6; f++) {
      const [lx, ly, fw, fh] = LAYOUT[p.key][f];
      for (let v = 0; v < fh; v++) for (let u = 0; u < fw; u++) {
        g.fillStyle = facePixel(s, p, f, u, v);
        g.fillRect(ox + lx + u, oy + ly + v, 1, 1);
      }
    }
  }
  // スキンの束 (8×2 枚 = 512×128)。0番はプレイヤー、1番から NPC。
  const ATW = 512, ATH = 128;
  const atlas = document.createElement('canvas');
  atlas.width = ATW; atlas.height = ATH;
  const ag = atlas.getContext('2d');
  function slotUV(slot) {
    const ox = (slot % 8) * 64, oy = Math.floor(slot / 8) * 64, uv = {};
    for (const p of PARTS) uv[p.key] = LAYOUT[p.key].map(([x, y, w, h]) => [(ox + x) / ATW, (oy + y) / ATH, (ox + x + w) / ATW, (oy + y + h) / ATH]);
    return uv;
  }
  function putSlot(slot, s) { drawSkin(ag, s, (slot % 8) * 64, Math.floor(slot / 8) * 64); }

  // ---------- プリセット ----------
  function makeSkin(o) {
    const s = blank();
    const P = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < GW && y < GH) g[y * GW + x] = c; };
    const R = (g, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(g, x, y, c); };
    for (const g of [s.f, s.b]) {
      R(g, 4, 0, 11, 7, o.skin);
      R(g, 4, 8, 11, 19, o.shirt);
      R(g, 0, 8, 3, 19, o.shirt); R(g, 12, 8, 15, 19, o.shirt);
      R(g, 0, 16, 3, 19, o.sleeve === 'long' ? o.shirt : o.skin); R(g, 12, 16, 15, 19, o.sleeve === 'long' ? o.shirt : o.skin);
      R(g, 0, 18, 3, 19, o.glove || o.skin); R(g, 12, 18, 15, 19, o.glove || o.skin);
      R(g, 4, 20, 11, 28, o.pants); R(g, 4, 29, 11, 31, o.shoes);
      if (o.belt) R(g, 4, 18, 11, 19, o.belt);
    }
    // 髪
    R(s.f, 4, 0, 11, 1, o.hair); P(s.f, 4, 2, o.hair); P(s.f, 11, 2, o.hair); P(s.f, 4, 3, o.hair); P(s.f, 11, 3, o.hair);
    R(s.b, 4, 0, 11, o.longHair ? 7 : 5, o.hair);
    // 顔
    P(s.f, 6, 4, '#ffffff'); P(s.f, 9, 4, '#ffffff'); P(s.f, 6, 5, o.eye); P(s.f, 9, 5, o.eye);
    P(s.f, 7, 6, o.mouth || '#b5655a'); P(s.f, 8, 6, o.mouth || '#b5655a');
    if (o.extra) o.extra(s, P, R);
    return s;
  }
  const PRESETS = [
    { key: 'hero', name: 'ゆうしゃ', o: { skin: '#f2c49b', hair: '#5a3a1c', eye: '#2a4a9a', shirt: '#2f6fd0', pants: '#4a3a2a', shoes: '#3a2414', belt: '#8a5a2a' } },
    { key: 'mage', name: 'まほうつかい', o: { skin: '#f6d2b0', hair: '#e8e8f0', eye: '#7a3ab0', shirt: '#6a3aa8', pants: '#5a2a90', shoes: '#2a1840', sleeve: 'long', longHair: true, extra(s, P, R) { R(s.f, 7, 8, 8, 19, '#ffd84a'); } } },
    { key: 'ninja', name: 'にんじゃ', o: { skin: '#e8b88f', hair: '#1a1a1e', eye: '#d02020', shirt: '#26262c', pants: '#26262c', shoes: '#111', sleeve: 'long', glove: '#111', belt: '#c02828', extra(s, P, R) { R(s.f, 4, 6, 11, 7, '#26262c'); R(s.f, 4, 0, 11, 2, '#26262c'); R(s.b, 4, 0, 11, 7, '#26262c'); P(s.b, 8, 3, '#c02828'); P(s.b, 9, 3, '#c02828'); } } },
    { key: 'knight', name: 'きし', o: { skin: '#f0c8a0', hair: '#c0c4cc', eye: '#203050', shirt: '#b8bec8', pants: '#8c929c', shoes: '#5a5e66', sleeve: 'long', glove: '#8c929c', extra(s, P, R) { R(s.f, 4, 0, 11, 2, '#c0c4cc'); R(s.f, 4, 3, 5, 7, '#c0c4cc'); R(s.f, 10, 3, 11, 7, '#c0c4cc'); R(s.b, 4, 0, 11, 7, '#c0c4cc'); R(s.f, 7, 9, 8, 15, '#d02a2a'); R(s.f, 5, 11, 10, 12, '#d02a2a'); } } },
    { key: 'cat', name: 'ねこ', o: { skin: '#f0a040', hair: '#f0a040', eye: '#30a040', shirt: '#ffffff', pants: '#f0a040', shoes: '#f0a040', mouth: '#ff8aa0', extra(s, P, R) { P(s.f, 4, 0, '#c06a20'); P(s.f, 11, 0, '#c06a20'); R(s.f, 5, 2, 10, 2, '#c06a20'); P(s.f, 5, 6, '#c06a20'); P(s.f, 10, 6, '#c06a20'); R(s.b, 4, 1, 11, 1, '#c06a20'); R(s.b, 4, 4, 11, 4, '#c06a20'); } } },
    { key: 'robot', name: 'ロボット', o: { skin: '#9aa4b0', hair: '#6a7480', eye: '#30e0ff', shirt: '#6a7480', pants: '#4a525c', shoes: '#30363e', sleeve: 'long', glove: '#30363e', mouth: '#30363e', extra(s, P, R) { R(s.f, 5, 4, 10, 5, '#102030'); P(s.f, 6, 4, '#30e0ff'); P(s.f, 9, 4, '#30e0ff'); R(s.f, 6, 11, 9, 14, '#30e0ff'); R(s.f, 7, 12, 8, 13, '#ffffff'); } } },
    { key: 'princess', name: 'おひめさま', o: { skin: '#f8d8c0', hair: '#f0c040', eye: '#3a70d0', shirt: '#f080b0', pants: '#f080b0', shoes: '#ffffff', longHair: true, mouth: '#e05070', extra(s, P, R) { P(s.f, 6, 0, '#ffd700'); P(s.f, 8, 0, '#ffd700'); P(s.f, 10, 0, '#ffd700'); R(s.f, 4, 20, 11, 26, '#f080b0'); R(s.b, 4, 20, 11, 26, '#f080b0'); } } },
  ];
  const NPC_SKINS = {
    king: { skin: '#f2c49b', hair: '#ffffff', eye: '#3a2a1a', shirt: '#c02020', pants: '#a01818', shoes: '#3a2414', sleeve: 'long', glove: '#ffffff', extra(s, P, R) { R(s.f, 5, 5, 10, 7, '#ffffff'); P(s.f, 7, 6, '#b5655a'); R(s.f, 4, 8, 4, 19, '#ffffff'); R(s.f, 11, 8, 11, 19, '#ffffff'); R(s.f, 7, 8, 8, 19, '#ffd84a'); } },
    guard: { skin: '#e8b88f', hair: '#9aa0aa', eye: '#203050', shirt: '#9aa0aa', pants: '#3a4a8a', shoes: '#30343c', sleeve: 'long', glove: '#5a5e66', extra(s, P, R) { R(s.f, 4, 0, 11, 2, '#9aa0aa'); R(s.b, 4, 0, 11, 7, '#9aa0aa'); R(s.f, 6, 10, 9, 14, '#3a4a8a'); } },
    shop: { skin: '#f0c8a0', hair: '#7a4a20', eye: '#3a2a1a', shirt: '#f0e6d0', pants: '#5a4a3a', shoes: '#3a2414', extra(s, P, R) { R(s.f, 5, 12, 10, 22, '#3a8a40'); } },
    mage: PRESETS[1].o,
    curator: { skin: '#f2c49b', hair: '#888', eye: '#3a2a1a', shirt: '#7a5a3a', pants: '#5a4030', shoes: '#2a1a10', sleeve: 'long', extra(s, P, R) { R(s.f, 5, 4, 10, 4, '#202020'); P(s.f, 6, 4, '#cfe8ff'); P(s.f, 9, 4, '#cfe8ff'); R(s.f, 7, 8, 8, 13, '#ffffff'); P(s.f, 7, 9, '#a02020'); } },
    villager: { skin: '#e8b88f', hair: '#3a2a1a', eye: '#3a2a1a', shirt: '#a0703a', pants: '#6a5030', shoes: '#3a2414', belt: '#4a3018' },
    villager2: { skin: '#f6d2b0', hair: '#c06020', eye: '#2a6a2a', shirt: '#4a8a5a', pants: '#3a3a5a', shoes: '#2a2a2a', longHair: true },
  };
  const NPC_SLOT = { king: 1, guard: 2, shop: 3, mage: 4, curator: 5, villager: 6, villager2: 7 };
  for (const k in NPC_SKINS) putSlot(NPC_SLOT[k], makeSkin(NPC_SKINS[k]));

  // ---------- 保存 ----------
  const KEY = 'cubesaga.skin', KEYS = 'cubesaga.skins';
  function loadCurrent() {
    const s = CS.store.get(KEY, null);
    if (s && s.f && s.b && s.f.length === GW * GH) return s;
    return makeSkin(PRESETS[0].o);
  }
  let current = loadCurrent();
  putSlot(0, current);
  let version = 1;
  function setCurrent(s) { current = { f: s.f.slice(), b: s.b.slice() }; CS.store.set(KEY, current); putSlot(0, current); version++; }

  // ================= スキンエディター =================
  const PALETTE = ['#000000', '#3a3a3a', '#7a7a7a', '#c0c0c0', '#ffffff', '#5a3a1c', '#8a5a2a', '#c08040', '#f2c49b', '#f8d8c0',
    '#e8b88f', '#a0522d', '#c02020', '#ff5050', '#ff9a30', '#ffd84a', '#fff27a', '#3a8a40', '#60d060', '#30a0a0',
    '#30e0ff', '#2f6fd0', '#1a2a8a', '#6a3aa8', '#b060e0', '#f080b0'];
  function editor(root, onDone) {
    const work = { f: current.f.slice(), b: current.b.slice() };
    const hist = [];
    let side = 'f', tool = 'pen', color = '#2f6fd0', drawing = false, rot = 0.5;
    root.innerHTML = `
<div class="skCard">
  <div class="skHead"><b>スキンを つくる</b><span class="sp"></span><button class="btn" data-a="cancel">やめる</button><button class="btn ok" data-a="save">これにする</button></div>
  <div class="skMain">
    <div class="skLeft">
      <div class="tabs"><button class="tab on" data-side="f">まえ</button><button class="tab" data-side="b">うしろ</button></div>
      <canvas class="skGrid" width="192" height="384"></canvas>
      <div class="skTools">
        <button class="tool on" data-t="pen">ふで</button><button class="tool" data-t="fill">ぬりつぶし</button><button class="tool" data-t="pick">スポイト</button>
        <button class="tool" data-a="undo">もどす</button><button class="tool" data-a="copy">まえ→うしろ</button>
      </div>
    </div>
    <div class="skRight">
      <canvas class="skPrev" width="260" height="300"></canvas>
      <div class="pal"></div>
      <label class="custom">すきな いろ <input type="color" value="#2f6fd0"></label>
      <div class="presets"><small>おてほん</small><div class="pl"></div></div>
    </div>
  </div>
</div>`;
    const grid = root.querySelector('.skGrid'), gg = grid.getContext('2d');
    const prev = root.querySelector('.skPrev');
    const pal = root.querySelector('.pal');
    const cin = root.querySelector('input[type=color]');
    PALETTE.forEach((c) => { const b = document.createElement('button'); b.className = 'sw'; b.style.background = c; b.dataset.c = c; pal.appendChild(b); });
    const pl = root.querySelector('.pl');
    PRESETS.forEach((p, i) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = p.name; b.dataset.p = i; pl.appendChild(b); });
    const CELL = 12;
    function drawGrid() {
      const g = work[side];
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        if (paintable(x, y)) { gg.fillStyle = at(g, x, y); gg.fillRect(x * CELL, y * CELL, CELL, CELL); }
        else { gg.fillStyle = (x + y) % 2 ? '#2a2f3a' : '#232833'; gg.fillRect(x * CELL, y * CELL, CELL, CELL); }
      }
      gg.strokeStyle = 'rgba(0,0,0,0.25)'; gg.lineWidth = 1;
      for (let x = 0; x <= GW; x++) { gg.beginPath(); gg.moveTo(x * CELL + 0.5, 0); gg.lineTo(x * CELL + 0.5, GH * CELL); gg.stroke(); }
      for (let y = 0; y <= GH; y++) { gg.beginPath(); gg.moveTo(0, y * CELL + 0.5); gg.lineTo(GW * CELL, y * CELL + 0.5); gg.stroke(); }
      gg.strokeStyle = 'rgba(255,255,255,0.7)'; gg.lineWidth = 2;
      for (const p of PARTS) gg.strokeRect(p.fx * CELL + 1, p.fy * CELL + 1, p.w * CELL - 2, p.h * CELL - 2);
    }
    function snapshot() { hist.push({ f: work.f.slice(), b: work.b.slice() }); if (hist.length > 40) hist.shift(); }
    function cellAt(ev) {
      const r = grid.getBoundingClientRect();
      const x = Math.floor((ev.clientX - r.left) / r.width * GW), y = Math.floor((ev.clientY - r.top) / r.height * GH);
      return [x, y];
    }
    function apply(x, y) {
      const p = paintable(x, y);
      if (!p) return;
      const g = work[side];
      if (tool === 'pen') g[y * GW + x] = color;
      else if (tool === 'pick') { color = g[y * GW + x]; cin.value = color; setTool('pen'); }
      else if (tool === 'fill') {
        const from = g[y * GW + x];
        if (from === color) return;
        const st = [[x, y]];
        while (st.length) {
          const [a, b] = st.pop();
          if (a < p.fx || b < p.fy || a >= p.fx + p.w || b >= p.fy + p.h || g[b * GW + a] !== from) continue;
          g[b * GW + a] = color;
          st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
        }
      }
      drawGrid();
    }
    function setTool(t) { tool = t; root.querySelectorAll('.tool[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); }
    grid.addEventListener('pointerdown', (e) => { e.preventDefault(); grid.setPointerCapture(e.pointerId); snapshot(); drawing = true; apply(...cellAt(e)); });
    grid.addEventListener('pointermove', (e) => { if (drawing && tool === 'pen') apply(...cellAt(e)); });
    grid.addEventListener('pointerup', () => { drawing = false; });
    root.onclick = (e) => {
      const t = e.target;
      if (t.dataset.side) { side = t.dataset.side; root.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.side === side)); rot = side === 'f' ? 0.5 : Math.PI + 0.5; drawGrid(); }
      else if (t.dataset.t) setTool(t.dataset.t);
      else if (t.dataset.c) { color = t.dataset.c; cin.value = color; if (tool === 'pick') setTool('pen'); }
      else if (t.dataset.p) { snapshot(); const s = makeSkin(PRESETS[+t.dataset.p].o); work.f = s.f; work.b = s.b; drawGrid(); }
      else if (t.dataset.a === 'undo') { const h = hist.pop(); if (h) { work.f = h.f; work.b = h.b; drawGrid(); } }
      else if (t.dataset.a === 'copy') {
        snapshot();
        // 前の服を後ろにうつす (顔は髪の色でぬる)
        for (const p of PARTS) for (let v = 0; v < p.h; v++) for (let u = 0; u < p.w; u++) {
          const src = p.key === 'head' ? at(work.f, p.fx + u, p.fy) : at(work.f, p.fx + (p.w - 1 - u), p.fy + v);
          work.b[(p.by + v) * GW + p.bx + u] = src;
        }
        drawGrid();
      }
      else if (t.dataset.a === 'save') { setCurrent(work); stop(); onDone(true); }
      else if (t.dataset.a === 'cancel') { stop(); onDone(false); }
      CS.sfx.click();
    };
    cin.addEventListener('input', () => { color = cin.value; if (tool === 'pick') setTool('pen'); });
    // 3D の見本
    let ren = null, raf = 0, drag = null;
    const pc = document.createElement('canvas'); pc.width = 64; pc.height = 64;
    const pcg = pc.getContext('2d');
    try { ren = new CS.Renderer(prev); } catch (e) { ren = null; }
    prev.addEventListener('pointerdown', (e) => { drag = e.clientX; prev.setPointerCapture(e.pointerId); });
    prev.addEventListener('pointermove', (e) => { if (drag !== null) { rot += (e.clientX - drag) * 0.02; drag = e.clientX; } });
    prev.addEventListener('pointerup', () => { drag = null; });
    let lastKey = '';
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (!ren) return;
      const key = work.f.join('') + work.b.join('');
      if (key !== lastKey) {
        lastKey = key;
        drawSkin(pcg, work, 0, 0);
        const big = document.createElement('canvas'); big.width = ATW; big.height = ATH;
        big.getContext('2d').drawImage(pc, 0, 0);
        ren.setSkinAtlas(big);
      }
      if (drag === null) rot += 0.006;
      ren.begin({ x: 0, y: 1.05, z: 3.4, yaw: 0, pitch: -0.08, fov: 45 }, { day: 1, sky: [0.13, 0.15, 0.2], fog: [100, 200] });
      CS.drawHumanoid(ren, { x: 0, y: 0, z: 0, yaw: rot, walk: Math.sin(t / 300) * 0.3, pitch: 0, slot: 0, light: 1 });
      ren.finish();
    }
    drawGrid();
    raf = requestAnimationFrame(frame);
    function stop() {
      cancelAnimationFrame(raf);
      if (ren) { const ext = ren.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
    }
  }

  CS.Skin = {
    PARTS, PRESETS, NPC_SLOT, atlas, slotUV, editor,
    get version() { return version; },
    get current() { return current; },
  };
})();
