/* ゲーム本体: 入力・動き・ブロックの操作・クエスト・保存 */
'use strict';
(function () {
  const CS = window.CS;
  const { B, I, ITEMS, BLOCKS, UI, Inv, TYPES } = CS;
  const $ = UI.$;
  const canvas = $('game');

  let ren;
  try { ren = new CS.Renderer(canvas); } catch (e) { UI.show('noGL'); return; }
  ren.setSkinAtlas(CS.Skin.atlas);
  let skinVer = CS.Skin.version;

  const DAY_LEN = 840; // 1日の長さ (秒)
  const G = {
    ren, state: 'title', worlds: {}, world: null, player: null, ents: [], projs: [], drops: [], parts: [],
    time: 0.08, creative: false, meta: null, data: null, cursor: null, uiOpen: false, third: false,
    touch: window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
    sens: CS.store.get('cubesaga.sens', 5), target: null,
  };
  CS.G = G;
  ren.renderDist = CS.store.get('cubesaga.dist', G.touch ? 4 : 6);

  // ブロックのだいたいの色 (こわしたときの粒に使う)
  const BCOL = [];
  (function () {
    const d = CS.ATLAS.getContext('2d').getImageData(0, 0, 256, 256).data;
    for (let id = 1; id < CS.NB; id++) {
      const t = BLOCKS[id].tx.side, ox = (t % 16) * 16, oy = (t >> 4) * 16;
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 2; y < 14; y += 2) for (let x = 2; x < 14; x += 2) { const i = ((oy + y) * 256 + ox + x) * 4; if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } }
      BCOL[id] = n ? [r / n / 255, g / n / 255, b / n / 255] : [0.6, 0.6, 0.6];
    }
  })();

  // ================= 保存 =================
  const LIST_KEY = 'cubesaga.worlds';
  const listWorlds = () => CS.store.get(LIST_KEY, []);
  function newPlayer(sp) {
    return {
      x: sp.x, y: sp.y, z: sp.z, vx: 0, vy: 0, vz: 0, w: 0.6, h: 1.8, yaw: 0, pitch: 0, onGround: false,
      hp: 20, food: 20, mp: 20, maxMp: 20, inv: new Array(36).fill(null), sel: 0, coins: 20, q: 0,
      flags: {}, exhibits: { species: {}, fossils: {} }, dim: 'over', flying: false, dead: false,
    };
  }
  const SAVE_FIELDS = ['x', 'y', 'z', 'yaw', 'pitch', 'hp', 'food', 'mp', 'maxMp', 'inv', 'sel', 'coins', 'q', 'flags', 'exhibits', 'dim', 'flying'];
  function saveGame(quiet) {
    if (!G.meta || !G.player) return;
    const p = G.player, d = G.data;
    d.player = {};
    for (const k of SAVE_FIELDS) d.player[k] = p[k];
    // 手に持ったままの アイテムも なくさない
    if (G.cursor) {
      const inv = p.inv.map((x) => x && { id: x.id, n: x.n });
      const tmp = { inv };
      Inv.add(tmp, G.cursor.id, G.cursor.n);
      d.player.inv = inv;
    }
    // はなした いきもの
    if (!d.pets) d.pets = {};
    if (G.world) d.pets[G.world.dim] = G.ents.filter((e) => e.tame && !e.dead).map((e) => [e.type, e.x, e.y, e.z]);
    d.time = G.time;
    for (const dim in G.worlds) d.diffs[dim] = G.worlds[dim].diffArray();
    const ok = CS.store.set('cubesaga.w.' + G.meta.id, d);
    const list = listWorlds();
    const m = list.find((x) => x.id === G.meta.id);
    if (m) { m.played = Date.now(); CS.store.set(LIST_KEY, list); }
    if (!ok && !quiet) UI.toast('セーブできなかった… ブラウザの ようりょうが いっぱいかも');
    return ok;
  }

  // ================= ワールドに はいる =================
  function loading(text, pct) { UI.show('loading'); $('loadText').textContent = text; $('loadBar').style.width = (pct || 0) + '%'; }
  const nextFrame = () => new Promise((r) => setTimeout(r, 30));
  async function startWorld(meta) {
    loading('せかいを つくっています…', 10);
    await nextFrame();
    G.meta = meta;
    G.data = CS.store.get('cubesaga.w.' + meta.id, null) || { diffs: {} };
    if (!G.data.diffs) G.data.diffs = {};
    G.creative = meta.mode === 'creative';
    G.worlds = {};
    G.demo = null;
    const dim = (G.data.player && G.data.player.hp > 0 && G.data.player.dim) || 'over';
    const w = getWorld(dim);
    let p;
    if (G.data.player) {
      p = newPlayer(w.info.spawn); Object.assign(p, G.data.player);
      if (p.hp <= 0) { const sp = getWorld('over').info.spawn; p.hp = 20; p.food = Math.max(p.food, 14); p.dim = 'over'; p.x = sp.x; p.y = sp.y; p.z = sp.z; }
    }
    else {
      p = newPlayer(getWorld('over').info.spawn);
      if (G.creative) { p.flying = false; ['grass', 'stone', 'planks', 'glass', 'stoneBrick', 'torch', 'lamp', 'wand_warp', 'heroSword'].forEach((k, i) => { p.inv[i] = { id: I[k], n: ITEMS[I[k]].stack }; }); }
      else { p.inv[0] = { id: I.bread, n: 3 }; }
    }
    if (G.creative) { p.hp = 20; p.food = 20; }
    G.player = p;
    G.time = G.data.time || 0.08;
    G.state = 'play';
    await enterDim(p.dim, null, true);
  }
  function getWorld(dim) {
    if (!G.worlds[dim]) G.worlds[dim] = CS.generate(dim, G.meta.seed, G.data.diffs[dim]);
    return G.worlds[dim];
  }
  async function enterDim(dim, from, keepPos) {
    const p = G.player;
    loading(CS.DIMS[dim].name + ' へ…', 30);
    await nextFrame();
    const w = getWorld(dim);
    G.world = w;
    ren.setWorld(w);
    p.dim = dim;
    if (!keepPos) {
      let sp = w.info.spawn;
      if (dim === 'over' && from === 'ancient') sp = w.info.ancientGate;
      if (dim === 'over' && from === 'sky') sp = w.info.skyGate;
      p.x = sp.x; p.y = sp.y; p.z = sp.z; p.vx = p.vy = p.vz = 0;
      p.yaw = dim === 'over' && from ? 0 : p.yaw;
    }
    // 体がうまっていたら上へ
    for (let k = 0; k < 40 && CS.collides(w, p); k++) p.y += 1;
    p.portalLock = true; p.portalT = 0; p.airTop = p.y;
    G.ents = []; G.projs = []; G.drops = []; G.parts = [];
    populate();
    restorePets();
    loading(CS.DIMS[dim].name + ' へ…', 60);
    await nextFrame();
    const total = (2 * ren.renderDist + 1) ** 2;
    let left = 1;
    while (left > 0) {
      left = ren.updateChunks(p.x, p.z, 120);
      loading(CS.DIMS[dim].name + ' へ…', 60 + 40 * (1 - left / total));
      await nextFrame();
    }
    UI.hideAll();
    $('hud').classList.remove('hidden');
    UI.resetHud();
    UI.banner(CS.DIMS[dim].name, dim === 'over' ? (G.creative ? 'クリエイティブ' : 'サバイバル') : dim === 'ancient' ? 'むかしの いきものが くらす せかい' : 'りゅうの すむ 空の しま');
    if (!G.touch) { G.uiOpen = true; UI.show('pause'); $('pause').querySelector('[data-act=resume]').textContent = 'クリックして はじめる'; }
    else G.uiOpen = false;
    $('touch').classList.toggle('hidden', !G.touch);
    $('hud').querySelector('[data-k=down]').classList.toggle('hidden', !G.creative);
  }
  // NPC・展示・番人・竜を置く
  function populate() {
    const w = G.world, p = G.player;
    if (w.dim === 'over') {
      for (const n of w.info.npcs) {
        const e = new CS.Ent(n.type, n.x, n.y, n.z);
        e.yaw = n.yaw; e.home = { x: n.x, z: n.z };
        G.ents.push(e);
      }
      refreshExhibits();
      if (!p.flags.swordTaken) {
        const s = w.info.shrine;
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI * 2 / 3;
          const x = s.x + Math.cos(a) * 7, z = s.z + Math.sin(a) * 7;
          const e = new CS.Ent('guardian', x, CS.groundY(w, x, z) + 0.1, z);
          e.home = { x: s.x, z: s.z };
          G.ents.push(e);
        }
      }
    } else if (w.dim === 'sky' && !p.flags.dragonDead) {
      const c = w.info.center;
      const e = new CS.Ent('dragon', c.x + 30, c.y + 16, c.z);
      G.ents.push(e);
      setTimeout(() => { if (G.world === w) { CS.sfx.roar(); UI.toast('てんくうりゅう ゼフィロスが あらわれた！'); } }, 1500);
    }
  }
  function restorePets() {
    const list = (G.data.pets && G.data.pets[G.world.dim]) || [];
    for (const [type, x, y, z] of list) {
      if (!TYPES[type]) continue;
      const e = new CS.Ent(type, x, y + 0.1, z);
      e.tame = true; e.home = { x, z };
      G.ents.push(e);
    }
  }
  function refreshExhibits() {
    const w = G.world;
    if (!w || w.dim !== 'over') return;
    G.ents = G.ents.filter((e) => !e.exhibit);
    CS.SPECIES.forEach((s, i) => {
      if (!G.player.exhibits.species[s.key]) return;
      const pen = w.info.pens[i];
      const e = new CS.Ent(s.key, pen.x, pen.y, pen.z);
      e.exhibit = true; e.yaw = Math.PI / 2;
      G.ents.push(e);
    });
  }
  G.refreshExhibits = refreshExhibits;

  // ================= 入力 =================
  const keys = {};
  let mouseL = false, mouseR = false, attackPressed = false, usePressed = false, lastSpace = 0;
  const locked = () => document.pointerLockElement === canvas;
  function lockPointer() { if (!G.touch && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* なし */ } } }
  G.closeUi = function () {
    UI.hideAll();
    G.uiOpen = false;
    if (G.player && G.player.dead) { UI.show('dead'); G.uiOpen = true; return; }
    lockPointer();
  };
  function openUi(fn) {
    G.uiOpen = true;
    mouseL = mouseR = false;
    for (const k in keys) keys[k] = false;
    if (locked()) document.exitPointerLock();
    fn();
  }
  document.addEventListener('pointerlockchange', () => {
    if (!locked() && G.state === 'play' && !G.uiOpen && !G.touch) { G.uiOpen = true; UI.show('pause'); $('pause').querySelector('[data-act=resume]').textContent = 'つづける'; saveGame(true); }
  });
  document.addEventListener('keydown', (e) => {
    CS.unlockAudio();
    if (G.state !== 'play') return;
    const k = e.code;
    if (k === 'KeyE') {
      e.preventDefault();
      if (UI.isPanelOpen()) { UI.closePanel(); return; }
      if (!G.uiOpen && !G.player.dead) openUi(() => UI.openInventory(G));
      return;
    }
    if (k === 'Escape' && UI.isPanelOpen()) { UI.closePanel(); return; }
    if (G.uiOpen) return;
    keys[k] = true;
    if (k === 'Space') {
      e.preventDefault();
      if (!e.repeat) {
        const now = performance.now();
        if (G.creative && now - lastSpace < 300) { G.player.flying = !G.player.flying; G.player.vy = 0; lastSpace = 0; }
        else lastSpace = now;
      }
    }
    if (k.startsWith('Digit')) { const n = +k.slice(5); if (n >= 1 && n <= 9) G.player.sel = n - 1; }
    if (k === 'KeyQ') dropHeld();
    if (k === 'KeyV' || k === 'F5') { e.preventDefault(); G.third = !G.third; }
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousedown', (e) => {
    CS.unlockAudio();
    if (G.state !== 'play' || G.uiOpen || G.touch) return;
    if (!locked()) { lockPointer(); return; }
    if (e.button === 0) { mouseL = true; attackPressed = true; }
    if (e.button === 2) { mouseR = true; usePressed = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('mousemove', (e) => {
    if (!locked() || G.uiOpen || !G.player) return;
    const s = 0.0006 * G.sens;
    G.player.yaw += e.movementX * s;
    G.player.pitch = CS.clamp(G.player.pitch - e.movementY * s, -1.55, 1.55);
  });
  window.addEventListener('wheel', (e) => {
    if (G.state !== 'play' || G.uiOpen) return;
    G.player.sel = (G.player.sel + (e.deltaY > 0 ? 1 : 8)) % 9;
  }, { passive: true });
  $('hotbar').addEventListener('pointerdown', (e) => {
    const s = e.target.closest('[data-i]');
    if (s && G.player) { G.player.sel = +s.dataset.i; e.stopPropagation(); }
  });
  document.body.classList.toggle('touch', G.touch);
  $('btnView').addEventListener('click', () => { if (G.state === 'play' && !G.uiOpen) G.third = !G.third; });
  $('btnPause').addEventListener('click', () => { if (G.state === 'play' && !G.uiOpen) openUi(() => { UI.show('pause'); $('pause').querySelector('[data-act=resume]').textContent = 'つづける'; }); });

  // ---------- スマホの操作 ----------
  const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
  const look = { id: null, x: 0, y: 0 };
  const stickEl = $('stick'), knob = stickEl.querySelector('i');
  stickEl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); CS.unlockAudio();
    stick.id = e.pointerId; stickEl.setPointerCapture(e.pointerId);
    const r = stickEl.getBoundingClientRect(); stick.ox = r.left + r.width / 2; stick.oy = r.top + r.height / 2;
    moveStick(e);
  });
  function moveStick(e) {
    const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy), m = 50;
    const k = l > m ? m / l : 1;
    stick.x = dx * k / m; stick.y = dy * k / m;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
  const endStick = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; } };
  stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
  canvas.addEventListener('pointerdown', (e) => {
    if (!G.touch || e.pointerType === 'mouse' && !G.touch) return;
    if (G.state !== 'play' || G.uiOpen) return;
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== look.id || !G.player) return;
    G.player.yaw += (e.clientX - look.x) * 0.006;
    G.player.pitch = CS.clamp(G.player.pitch - (e.clientY - look.y) * 0.006, -1.55, 1.55);
    look.x = e.clientX; look.y = e.clientY;
  });
  const endLook = (e) => { if (e.pointerId === look.id) look.id = null; };
  canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
  document.querySelectorAll('.tb').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); CS.unlockAudio();
      if (G.state !== 'play' || G.uiOpen) return;
      b.classList.add('on');
      if (k === 'dig') { mouseL = true; attackPressed = true; }
      if (k === 'use') { mouseR = true; usePressed = true; }
      if (k === 'jump') {
        keys.Space = true;
        const now = performance.now();
        if (G.creative && now - lastSpace < 300) { G.player.flying = !G.player.flying; G.player.vy = 0; lastSpace = 0; }
        else lastSpace = now;
      }
      if (k === 'down') keys.ShiftLeft = true;
      if (k === 'inv') openUi(() => UI.openInventory(G));
    });
    const up = () => {
      b.classList.remove('on');
      if (k === 'dig') mouseL = false;
      if (k === 'use') mouseR = false;
      if (k === 'jump') keys.Space = false;
      if (k === 'down') keys.ShiftLeft = false;
    };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });

  // ================= 画面のボタン =================
  let helpBack = 'title';
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-act],[data-dist],[data-mode]');
    if (!t) return;
    CS.unlockAudio();
    const go = t.dataset.go;
    if (go === 'title') UI.show('title');
    if (go === 'worlds') { showWorlds(); }
    if (go === 'help') { helpBack = 'title'; UI.show('help'); }
    if (go === 'back') UI.show(helpBack);
    if (go === 'skin') openSkin();
    if (t.dataset.mode) { document.querySelectorAll('.mode').forEach((m) => m.classList.toggle('on', m === t)); }
    if (t.dataset.dist) {
      ren.renderDist = +t.dataset.dist; CS.store.set('cubesaga.dist', ren.renderDist);
      document.querySelectorAll('[data-dist]').forEach((b) => b.classList.toggle('on', +b.dataset.dist === ren.renderDist));
    }
    const act = t.dataset.act;
    if (act === 'resume') { G.closeUi(); }
    if (act === 'help') { helpBack = 'pause'; UI.show('help'); }
    if (act === 'quit') { if (saveGame()) leaveToTitle(); }
    if (act === 'respawn') respawn();
  });
  $('sens').value = G.sens;
  $('sens').addEventListener('input', () => { G.sens = +$('sens').value; CS.store.set('cubesaga.sens', G.sens); });
  document.querySelectorAll('[data-dist]').forEach((b) => b.classList.toggle('on', +b.dataset.dist === ren.renderDist));
  function showWorlds() {
    UI.show('worlds');
    UI.renderWorlds(listWorlds().sort((a, b) => (b.played || 0) - (a.played || 0)), (m) => startWorld(m), (m) => {
      CS.store.set(LIST_KEY, listWorlds().filter((x) => x.id !== m.id));
      CS.store.del('cubesaga.w.' + m.id);
      showWorlds();
    });
  }
  $('wCreate').addEventListener('click', () => {
    const name = $('wName').value.trim() || 'わたしの せかい';
    const mode = document.querySelector('.mode.on').dataset.mode;
    const st = $('wSeed').value.trim();
    let seed;
    if (!st) seed = Math.floor(Math.random() * 1e9);
    else if (/^-?\d+$/.test(st)) seed = parseInt(st, 10) | 0;
    else { seed = 0; for (const ch of st) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0; }
    const m = { id: Date.now().toString(36), name, mode, seed, created: Date.now(), played: Date.now() };
    const list = listWorlds(); list.push(m);
    CS.store.set(LIST_KEY, list);
    $('wName').value = ''; $('wSeed').value = '';
    startWorld(m);
  });
  function openSkin() {
    UI.show('skin');
    CS.Skin.editor($('skin'), () => { UI.show('title'); });
  }
  function leaveToTitle() {
    G.state = 'title';
    G.uiOpen = false;
    $('hud').classList.add('hidden');
    if (locked()) document.exitPointerLock();
    G.worlds = {}; G.world = null; G.meta = null; G.player = null;
    ren.setWorld(null);
    UI.show('title');
    setupDemo();
  }
  window.addEventListener('beforeunload', () => { if (G.state === 'play') saveGame(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') saveGame(true); });

  // ================= 光線 (どこを見ているか) =================
  function raycast(w, ox, oy, oz, dx, dy, dz, maxD) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = dx ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let face = [0, 0, 0], t = 0;
    for (let i = 0; i < 200 && t <= maxD; i++) {
      const id = w.get(x, y, z);
      if (id && id !== B.water) return { x, y, z, id, face, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; face = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; face = [0, 0, -sz]; }
    }
    return null;
  }
  function entBox(e) {
    const s = e.exhibit ? 0.6 : 1, hw = e.w / 2 * s;
    return [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + e.h * s, e.z + hw];
  }
  function rayBox(o, d, b) {
    let t0 = 0, t1 = 1e9;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < b[a] || o[a] > b[a + 3]) return -1; continue; }
      let ta = (b[a] - o[a]) / d[a], tb = (b[a + 3] - o[a]) / d[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return -1;
    }
    return t0;
  }
  function eyeDir() {
    const p = G.player, cp = Math.cos(p.pitch);
    return [[p.x, p.y + 1.62, p.z], [Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp]];
  }
  function findTarget() {
    const w = G.world, [o, d] = eyeDir();
    const reach = G.creative ? 7 : 5;
    const hb = raycast(w, o[0], o[1], o[2], d[0], d[1], d[2], reach);
    // 草や花は 生きものを かくさない
    const see = hb && CS.SOLID[hb.id] ? hb.t : reach;
    let best = null, bt = see;
    for (const e of G.ents) {
      const r = e.T.ai === 'boss' ? reach + 4 : reach;
      if (Math.abs(e.x - o[0]) > r + 8 || Math.abs(e.z - o[2]) > r + 8) continue;
      const t = rayBox(o, d, entBox(e));
      if (t >= 0 && t < bt && t <= r) { bt = t; best = e; }
    }
    return best ? { ent: best } : hb ? { block: hb } : null;
  }

  // ================= 粒・落ちている物 =================
  function burst(x, y, z, col, n, spd, life, size) {
    for (let i = 0; i < n && G.parts.length < 700; i++) {
      G.parts.push({ x, y, z, vx: (Math.random() - 0.5) * spd, vy: Math.random() * spd * 0.8, vz: (Math.random() - 0.5) * spd, life: (life || 0.6) * (0.6 + Math.random() * 0.6), col, size: size || 0.12, grav: 12 });
    }
  }
  function dropItem(id, n, x, y, z) {
    const p = G.player;
    let vx = (Math.random() - 0.5) * 2, vz = (Math.random() - 0.5) * 2, vy = 3;
    if (x === undefined) {
      const [, d] = eyeDir();
      x = p.x + d[0] * 0.6; y = p.y + 1.3; z = p.z + d[2] * 0.6;
      vx = d[0] * 5; vy = d[1] * 5 + 2; vz = d[2] * 5;
    }
    G.drops.push({ id, n, x, y, z, vx, vy, vz, w: 0.25, h: 0.25, age: 0, autoStep: false });
  }
  G.dropItem = dropItem;
  function dropHeld() {
    const p = G.player, s = Inv.held(p);
    if (!s) return;
    dropItem(s.id, 1);
    Inv.useHeld(p);
  }

  // ================= ブロックの操作 =================
  function breakTime(id, held) {
    const def = BLOCKS[id];
    if (def.unbreak) return Infinity;
    if (!def.hard) return 0.05;
    const tool = held ? ITEMS[held.id] : null;
    let speed = 1;
    if (def.tool && tool && tool.tool === def.tool) speed = [1, 2, 4, 6, 8][tool.tier];
    let t = def.hard / speed * 0.7;
    if (def.tier && !(tool && tool.tool === 'pick' && tool.tier >= def.tier)) t *= 3.3;
    return t;
  }
  function canHarvest(id, held) {
    const def = BLOCKS[id], tool = held ? ITEMS[held.id] : null;
    return !def.tier || (tool && tool.tool === 'pick' && tool.tier >= def.tier);
  }
  function breakBlock(x, y, z, drop) {
    const w = G.world, id = w.get(x, y, z);
    if (!id || BLOCKS[id].unbreak) return false;
    w.set(x, y, z, 0);
    burst(x + 0.5, y + 0.5, z + 0.5, BCOL[id], 12, 4, 0.7, 0.13);
    if (drop) { const d = CS.rollDrop(id, Math.random()); if (d) dropItem(d[0], d[1], x + 0.5, y + 0.4, z + 0.5); }
    const up = w.get(x, y + 1, z);
    if (CS.RENDER[up] === 'cross' || up === B.torch) breakBlock(x, y + 1, z, drop);
    CS.sfx.brk(BLOCKS[id].hardSound);
    return true;
  }
  const REPLACEABLE = new Set([0, B.water, B.tallGrass, B.fern]);
  function placeBlock(hit, id) {
    const w = G.world, p = G.player;
    let x = hit.x + hit.face[0], y = hit.y + hit.face[1], z = hit.z + hit.face[2];
    if (REPLACEABLE.has(hit.id) && hit.id !== 0) { x = hit.x; y = hit.y; z = hit.z; }
    if (!w.inside(x, y, z) || !REPLACEABLE.has(w.get(x, y, z))) return false;
    if (CS.SOLID[id]) {
      const box = [x, y, z, x + 1, y + 1, z + 1];
      const hitsBox = (b) => b[0] < box[3] && b[3] > box[0] && b[1] < box[4] && b[4] > box[1] && b[2] < box[5] && b[5] > box[2];
      if (hitsBox([p.x - 0.3, p.y, p.z - 0.3, p.x + 0.3, p.y + 1.8, p.z + 0.3])) return false;
      for (const e of G.ents) if (hitsBox(entBox(e))) return false;
    }
    w.set(x, y, z, id);
    CS.sfx.place();
    return true;
  }
  G.nearStations = function () {
    const w = G.world, p = G.player, r = { table: false, furnace: false };
    for (let y = -3; y <= 3; y++) for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
      const id = w.get(p.x + x, p.y + 1 + y, p.z + z);
      if (id === B.table) r.table = true;
      if (id === B.furnace) r.furnace = true;
    }
    return r;
  };
  G.onCraft = function (id) {
    if (id === I.table && !G.player.flags.tipTable) { G.player.flags.tipTable = 1; UI.toast('さぎょうだいを おくと、ちかくで どうぐが つくれるよ'); }
  };

  // ================= ダメージ =================
  G.hurtPlayer = function (dmg, fx, fz, kb) {
    const p = G.player;
    if (G.creative || p.dead || (p.invuln || 0) > 0) return;
    p.hp -= dmg; p.invuln = 0.5;
    const dx = p.x - fx, dz = p.z - fz, l = Math.hypot(dx, dz) || 1;
    p.vx += dx / l * (kb || 7); p.vz += dz / l * (kb || 7); p.vy = Math.max(p.vy, 5);
    $('hurtFx').style.opacity = 1; setTimeout(() => { $('hurtFx').style.opacity = 0; }, 180);
    CS.sfx.hurt();
    if (p.hp <= 0) die();
  };
  function die() {
    const p = G.player;
    p.hp = 0; p.dead = true;
    if (UI.isPanelOpen()) { UI.closePanel(); return; } // とじる処理が たおれた画面を出す
    openUi(() => UI.show('dead'));
  }
  async function respawn() {
    const p = G.player;
    p.dead = false; p.hp = 20; p.food = Math.max(p.food, 14); p.vx = p.vy = p.vz = 0;
    UI.hideAll();
    if (G.world.dim !== 'over') { await enterDim('over', null); const sp = G.world.info.spawn; p.x = sp.x; p.y = sp.y; p.z = sp.z; }
    else { const sp = G.world.info.spawn; p.x = sp.x; p.y = sp.y; p.z = sp.z; G.closeUi(); }
  }
  function attackEnt(e) {
    const p = G.player, held = Inv.held(p), d = held ? ITEMS[held.id] : null;
    if (e.T.ai === 'npc' || e.exhibit) { if (e.T.ai === 'npc') talkTo(e); return; }
    let dmg = d && d.dmg ? d.dmg : 1;
    if (!p.onGround && p.vy < -1) { dmg = Math.ceil(dmg * 1.5); burst(e.x, e.y + e.h * 0.8, e.z, [1, 1, 0.6], 8, 4, 0.5); }
    hurtEnt(e, dmg, p.x, p.z);
  }
  function hurtEnt(e, dmg, fx, fz) {
    if (e.dead || e.T.ai === 'npc' || e.exhibit) return;
    e.hp -= dmg; e.hurt = 0.35;
    if (e.T.ai !== 'boss') {
      const dx = e.x - fx, dz = e.z - fz, l = Math.hypot(dx, dz) || 1;
      const kb = 6 / Math.max(1, e.w);
      e.vx += dx / l * kb; e.vz += dz / l * kb; e.vy = Math.max(e.vy, 4);
    }
    if (e.T.ai === 'passive') e.flee = 4;
    if (e.T.ai === 'neutral') e.angry = 20;
    CS.sfx.hit();
    burst(e.x, e.y + e.h * 0.6, e.z, [0.9, 0.2, 0.2], 6, 3, 0.4, 0.1);
    if (e.hp <= 0) killEnt(e);
  }
  function killEnt(e) {
    e.dead = true;
    const col = e.T.ai === 'boss' ? [0.6, 0.4, 1] : [0.85, 0.85, 0.85];
    burst(e.x, e.y + e.h / 2, e.z, col, e.T.ai === 'boss' ? 200 : 16, e.T.ai === 'boss' ? 14 : 4, e.T.ai === 'boss' ? 2.5 : 0.8, e.T.ai === 'boss' ? 0.35 : 0.18);
    for (const [k, a, b] of (e.T.drops || [])) { const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0) dropItem(I[k], n, e.x, e.y + 0.5, e.z); }
    if (e.T.species) { const n = 1 + Math.floor(Math.random() * 2); dropItem(I.rawMeat, n, e.x, e.y + 0.5, e.z); }
    if (e.type === 'guardian') UI.toast('もりのばんにんを たおした！');
    if (e.type === 'dragon') dragonDefeated(e);
  }
  function dragonDefeated(e) {
    const p = G.player;
    p.flags.dragonDead = 1;
    const left = Inv.add(p, I.scale, 5); // ほうびは 落とさず もちものへ
    if (left) dropItem(I.scale, left);
    UI.toast('てんくうりゅうの ウロコを 5まい てにいれた！');
    CS.sfx.fanfare();
    $('flashFx').style.opacity = 1; setTimeout(() => { $('flashFx').style.opacity = 0; }, 300);
    UI.banner('ゼフィロスを たおした！', G.creative ? 'すごい！' : 'おうこくに もどって おうさまに ほうこくしよう');
    saveGame(true);
  }

  // ================= つかう (みぎクリック) =================
  function useAction() {
    const p = G.player, w = G.world, tg = G.target, held = Inv.held(p), d = held ? ITEMS[held.id] : null;
    if (tg && tg.ent && tg.ent.T.ai === 'npc') { talkTo(tg.ent); return true; }
    if (d && d.key === 'net') {
      if (tg && tg.ent && tg.ent.T.species) { capture(tg.ent); return true; }
      if (tg && tg.ent) { UI.toast('つかまえアミは こだいの いきもの だけに つかえるよ'); return true; }
    }
    if (tg && tg.block) {
      const id = tg.block.id;
      if (id === B.pedestal) { takeSword(); return true; }
      if ((id === B.table || id === B.furnace) && !G.creative) { openUi(() => UI.openInventory(G)); return true; }
    }
    if (d && d.food && !G.creative) {
      if (p.food >= 20) { UI.toast('おなかが いっぱい！'); return true; }
      p.food = Math.min(20, p.food + d.food); Inv.useHeld(p); CS.sfx.eat(); burst(p.x, p.y + 1.5, p.z, [0.8, 0.5, 0.3], 5, 2, 0.4); return true;
    }
    if (d && d.wand) { castWand(d); return true; }
    if (d && d.key === 'bow') { shootBow(); return true; }
    if (d && d.special === 'beam') {
      if (p.mp < 4 && !G.creative) { UI.toast('MPが たりない'); return true; }
      if (!G.creative) p.mp -= 4;
      const [o, dir] = eyeDir();
      G.shoot({ kind: 'beam', owner: 'player', x: o[0], y: o[1] - 0.2, z: o[2], vx: dir[0] * 30, vy: dir[1] * 30, vz: dir[2] * 30, dmg: 10 });
      CS.sfx.magic(); UI.swingHand();
      return true;
    }
    if (d && d.cage && tg && tg.block) {
      const h = tg.block, x = h.x + h.face[0] + 0.5, y = h.y + h.face[1], z = h.z + h.face[2] + 0.5;
      const e = new CS.Ent(d.cage, x, y, z);
      e.tame = true; e.home = { x, z };
      G.ents.push(e); Inv.useHeld(p);
      burst(x, y + 1, z, [1, 1, 0.6], 14, 3, 0.8);
      UI.toast(CS.SPECIES.find((s) => s.key === d.cage).name + ' を はなしたよ');
      return true;
    }
    if (d && d.block !== undefined && tg && tg.block) {
      if (placeBlock(tg.block, d.block)) { if (!G.creative) Inv.useHeld(p); UI.swingHand(); return true; }
    }
    return false;
  }
  function capture(e) {
    const p = G.player;
    if (e.exhibit) return;
    if ((e.T.ai === 'hostile' || e.T.ai === 'neutral') && e.hp > e.maxHp / 2 && !e.tame) {
      UI.toast('あばれている！ もっと よわらせてから つかまえよう (HPが はんぶん いか)');
      e.angry = 20;
      return;
    }
    e.dead = true;
    const s = CS.SPECIES.find((x) => x.key === e.T.species);
    const left = Inv.add(p, s.item, 1);
    if (left) dropItem(s.item, 1, e.x, e.y + 0.5, e.z);
    burst(e.x, e.y + e.h / 2, e.z, [1, 1, 1], 20, 4, 0.7);
    CS.sfx.pop(); CS.sfx.coin();
    UI.toast(`${s.name} を つかまえた！ はくぶつかんで うれるよ`);
  }
  function takeSword() {
    const p = G.player;
    if (p.flags.swordTaken && (p.q >= 2 || Inv.count(p, I.heroSword) > 0)) { UI.toast('つるぎは もう ぬかれている'); return; }
    p.flags.swordTaken = 1;
    const left = Inv.add(p, I.heroSword, 1);
    if (left) dropItem(I.heroSword, 1);
    const s = G.world.info.shrine;
    burst(s.x + 0.5, s.y + 1.5, s.z + 0.5, [1, 0.95, 0.5], 80, 8, 1.5, 0.2);
    CS.sfx.fanfare();
    UI.banner('ゆうしゃのつるぎを てにいれた！', p.q >= 2 || G.creative ? '' : 'おしろの おうさまに みせに いこう');
  }
  function shootBow() {
    const p = G.player;
    if ((p.bowCd || 0) > 0) return;
    if (!G.creative && !Inv.remove(p, I.arrow, 1)) { UI.toast('や が ない'); return; }
    p.bowCd = 0.6;
    const [o, d] = eyeDir();
    G.shoot({ kind: 'arrow', owner: 'player', x: o[0], y: o[1] - 0.1, z: o[2], vx: d[0] * 32, vy: d[1] * 32, vz: d[2] * 32, dmg: 6 });
    CS.sfx.bow();
  }
  function castWand(d) {
    const p = G.player, w = G.world;
    if ((p.wandCd || 0) > 0) return;
    if (p.mp < d.mp && !G.creative) { UI.toast('MPが たりない (じかんで もどるよ)'); return; }
    const [o, dir] = eyeDir();
    let ok = true;
    if (d.wand === 'fire') { G.shoot({ kind: 'fire', owner: 'player', x: o[0], y: o[1] - 0.2, z: o[2], vx: dir[0] * 24, vy: dir[1] * 24, vz: dir[2] * 24, dmg: 8 }); CS.sfx.fire(); }
    else if (d.wand === 'ice') { G.shoot({ kind: 'ice', owner: 'player', x: o[0], y: o[1] - 0.2, z: o[2], vx: dir[0] * 26, vy: dir[1] * 26, vz: dir[2] * 26, dmg: 4 }); CS.sfx.magic(); }
    else if (d.wand === 'heal') { p.hp = Math.min(20, p.hp + 8); burst(p.x, p.y + 1, p.z, [0.4, 1, 0.5], 24, 3, 0.9); CS.sfx.magic(); }
    else if (d.wand === 'thunder') {
      let pt = null;
      const tg = findTargetFar(64);
      if (tg) pt = tg;
      if (!pt) { UI.toast('ねらいが とおすぎる'); ok = false; }
      else {
        for (let y = 0; y < 30; y += 0.6) G.parts.push({ x: pt[0] + (Math.random() - 0.5) * 0.4, y: pt[1] + y, z: pt[2] + (Math.random() - 0.5) * 0.4, vx: 0, vy: 0, vz: 0, life: 0.35, col: [1, 1, 0.6], size: 0.5, grav: 0 });
        burst(pt[0], pt[1], pt[2], [1, 1, 0.5], 30, 8, 0.6, 0.2);
        for (const e of G.ents) if (Math.hypot(e.x - pt[0], e.y + e.h / 2 - pt[1], e.z - pt[2]) < 3 + e.w / 2) hurtEnt(e, 16, pt[0], pt[2]);
        $('flashFx').style.opacity = 0.7; setTimeout(() => { $('flashFx').style.opacity = 0; }, 90);
        CS.sfx.thunder();
      }
    } else if (d.wand === 'warp') {
      const hb = raycast(w, o[0], o[1], o[2], dir[0], dir[1], dir[2], 40);
      if (!hb) { UI.toast('とおすぎて とべない'); ok = false; }
      else {
        let x = hb.x + 0.5, y = hb.y + 1, z = hb.z + 0.5;
        if (hb.face[1] !== 1) { x = hb.x + hb.face[0] + 0.5; y = hb.y + hb.face[1]; z = hb.z + hb.face[2] + 0.5; }
        const old = [p.x, p.y, p.z];
        burst(p.x, p.y + 1, p.z, [0.8, 0.5, 1], 20, 3, 0.7);
        p.x = x; p.y = y; p.z = z; p.vy = 0; p.airTop = p.y;
        let k = 0;
        while (CS.collides(w, p) && k++ < 4) p.y += 1;
        if (CS.collides(w, p)) { p.x = old[0]; p.y = old[1]; p.z = old[2]; ok = false; UI.toast('そこには とべない'); }
        else { burst(p.x, p.y + 1, p.z, [0.8, 0.5, 1], 20, 3, 0.7); CS.sfx.portal(); }
      }
    } else if (d.wand === 'blast') {
      const hb = raycast(w, o[0], o[1], o[2], dir[0], dir[1], dir[2], 20);
      if (!hb) { ok = false; }
      else {
        w.beginBatch();
        for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const x = hb.x + dx, y = hb.y + dy, z = hb.z + dz, id = w.get(x, y, z);
          if (!id || BLOCKS[id].unbreak || id === B.water) continue;
          if (!G.creative) { const dr = CS.rollDrop(id, Math.random()); if (dr) { const left = Inv.add(p, dr[0], dr[1]); if (left) dropItem(dr[0], left, x + 0.5, y + 0.5, z + 0.5); } }
          w.set(x, y, z, 0);
          if (Math.random() < 0.4) burst(x + 0.5, y + 0.5, z + 0.5, BCOL[id], 3, 6, 0.7, 0.15);
        }
        w.endBatch();
        burst(hb.x + 0.5, hb.y + 0.5, hb.z + 0.5, [1, 0.6, 0.3], 30, 10, 0.6, 0.25);
        for (const e of G.ents) if (Math.hypot(e.x - hb.x - 0.5, e.y - hb.y, e.z - hb.z - 0.5) < 3) hurtEnt(e, 6, hb.x, hb.z);
        CS.sfx.thunder();
      }
    }
    if (ok) { if (!G.creative) p.mp -= d.mp; p.wandCd = 0.35; UI.swingHand(); }
  }
  function findTargetFar(dist) {
    const w = G.world, [o, d] = eyeDir();
    let best = null, bt = dist;
    for (const e of G.ents) { if (e.T.ai === 'npc' || e.exhibit) continue; const t = rayBox(o, d, entBox(e)); if (t >= 0 && t < bt) { bt = t; best = [e.x, e.y + e.h / 2, e.z]; } }
    if (best) return best;
    const hb = raycast(w, o[0], o[1], o[2], d[0], d[1], d[2], dist);
    return hb ? [hb.x + 0.5, hb.y + 1, hb.z + 0.5] : null;
  }

  // ================= 飛ぶもの =================
  G.shoot = (o) => { o.life = 5; G.projs.push(o); };
  const PCOL = { arrow: [0.6, 0.45, 0.3], fire: [1, 0.5, 0.1], ice: [0.6, 0.9, 1], beam: [0.6, 0.9, 1], dfire: [0.8, 0.3, 1] };
  function updateProjs(dt) {
    const w = G.world, p = G.player;
    for (const pr of G.projs) {
      pr.life -= dt;
      if (pr.kind === 'arrow') pr.vy -= 18 * dt;
      const spd = Math.hypot(pr.vx, pr.vy, pr.vz), n = Math.max(1, Math.ceil(spd * dt / 0.35));
      for (let s = 0; s < n && pr.life > 0; s++) {
        pr.x += pr.vx * dt / n; pr.y += pr.vy * dt / n; pr.z += pr.vz * dt / n;
        if (CS.SOLID[w.get(pr.x, pr.y, pr.z)] || pr.y < -20) { impact(pr, null); break; }
        if (pr.owner === 'player') {
          for (const e of G.ents) {
            if (e.dead || e.T.ai === 'npc' || e.exhibit) continue;
            const b = entBox(e);
            if (pr.x > b[0] - 0.3 && pr.x < b[3] + 0.3 && pr.y > b[1] - 0.3 && pr.y < b[4] + 0.3 && pr.z > b[2] - 0.3 && pr.z < b[5] + 0.3) { hurtEnt(e, pr.dmg, pr.x - pr.vx, pr.z - pr.vz); if (pr.kind === 'ice') e.slow = 4; impact(pr, e); break; }
          }
        } else if (!p.dead && pr.x > p.x - 0.5 && pr.x < p.x + 0.5 && pr.y > p.y - 0.2 && pr.y < p.y + 2 && pr.z > p.z - 0.5 && pr.z < p.z + 0.5) {
          G.hurtPlayer(pr.dmg, pr.x - pr.vx, pr.z - pr.vz, 6); impact(pr, null);
        }
      }
      if (Math.random() < 0.7 && pr.kind !== 'arrow') G.parts.push({ x: pr.x, y: pr.y, z: pr.z, vx: 0, vy: 0.5, vz: 0, life: 0.3, col: PCOL[pr.kind], size: pr.kind === 'dfire' ? 0.5 : 0.18, grav: 0 });
    }
    G.projs = G.projs.filter((pr) => pr.life > 0);
  }
  function impact(pr, hitEnt) {
    const w = G.world, p = G.player;
    pr.life = 0;
    if (pr.kind === 'fire') {
      burst(pr.x, pr.y, pr.z, [1, 0.5, 0.1], 18, 6, 0.5, 0.18);
      for (const e of G.ents) if (e !== hitEnt && Math.hypot(e.x - pr.x, e.y + e.h / 2 - pr.y, e.z - pr.z) < 1.8 + e.w / 2) hurtEnt(e, 4, pr.x, pr.z);
    } else if (pr.kind === 'ice') {
      burst(pr.x, pr.y, pr.z, [0.7, 0.9, 1], 14, 4, 0.5, 0.15);
      w.beginBatch();
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 1; dy++) {
        const x = Math.floor(pr.x) + dx, y = Math.floor(pr.y) + dy, z = Math.floor(pr.z) + dz;
        if (w.get(x, y, z) === B.water && w.get(x, y + 1, z) !== B.water) w.set(x, y, z, B.ice);
      }
      w.endBatch();
    } else if (pr.kind === 'dfire') {
      burst(pr.x, pr.y, pr.z, [0.8, 0.3, 1], 24, 7, 0.6, 0.25);
      if (Math.hypot(p.x - pr.x, p.y + 1 - pr.y, p.z - pr.z) < 2.6) G.hurtPlayer(pr.dmg, pr.x, pr.z, 8);
      CS.sfx.fire();
    } else burst(pr.x, pr.y, pr.z, PCOL[pr.kind], 6, 2, 0.3, 0.1);
  }

  // ================= はなす =================
  function dirName(dx, dz) {
    const a = Math.atan2(dx, -dz) * 180 / Math.PI;
    const n = ['きた', 'ほくとう', 'ひがし', 'なんとう', 'みなみ', 'なんせい', 'にし', 'ほくせい'];
    return n[((Math.round(a / 45) % 8) + 8) % 8];
  }
  function talkTo(e) {
    const p = G.player, info = G.world.info;
    openUi(() => {
      const t = e.type, who = e.T.name;
      if (t === 'king') return kingTalk();
      if (t === 'shop') return UI.openShop(G, 'shop');
      if (t === 'mage') return UI.openShop(G, 'mage');
      if (t === 'curator') {
        if (!p.flags.gotNet) {
          return UI.talk(G, who, [
            'ようこそ、はくぶつかんへ！ わたしは かんちょうだよ。',
            'おうこくの <b>こだいのゲート</b> を くぐると、ぜつめつした はずの いきものが いきている <b>こだいの せかい</b> に いける。',
            'じめんを ほると <b>かせき</b> が でてくるし、この <b>つかまえアミ</b> で いきものを つかまえる こともできる。あばれる いきものは よわらせてから つかまえてね。',
            'もってきてくれたら たかく かいとって、ここに かざるよ！',
          ], [{ label: 'アミを もらう', ok: true, fn: () => { p.flags.gotNet = 1; const l = Inv.add(p, I.net, 1); if (l) dropItem(I.net, 1); CS.sfx.pop(); UI.closePanel(); } }]);
        }
        return UI.openMuseum(G);
      }
      const tips = t === 'guard' ? [
        'よるは モンスターが でるぞ。たいまつで あかるく するんだ。',
        `ゆうしゃの森は ここから ${dirName(info.forest.x - e.x, info.forest.z - e.z)} の ほうに あるらしい。ひかる き が めじるしだ。`,
        'ゆうしゃの森には つるぎを まもる「もりのばんにん」が いるそうだ。',
      ] : [
        'はくぶつかんの かんちょうさんが、こだいの いきものを ほしがって いたよ。',
        'ちかの ふかい ところで ひかる いしを みつけたら、まほうつかいさんに おしえてあげて。',
        'てつの つるはしが あれば、きんや ダイヤモンドも ほれるんだって。',
        'おうさまは ゆうしゃを さがして いるんだって！',
      ];
      UI.talk(G, who, [tips[Math.floor(Math.random() * tips.length)]]);
    });
  }
  function kingTalk() {
    const p = G.player, info = G.world.info, who = 'おうさま';
    const fdir = dirName(info.forest.x - info.castle.x, info.forest.z - info.castle.z);
    if (p.q === 0) {
      UI.talk(G, who, [
        'よくぞ まいった、たびびとよ。わしは キューブおうこくの おうさまじゃ。',
        `この おしろから <b>${fdir}</b> の ほうに「<b>ゆうしゃの森</b>」が ある。森の どこかに、むかしの ゆうしゃが のこした <b>ゆうしゃのつるぎ</b> が ねむって おるのじゃ。`,
        'つるぎを みつけて もってきた ものを、この くにの ゆうしゃと みとめよう！',
      ], [{
        label: 'まかせて！', ok: true, fn: () => {
          p.q = 1;
          if (!G.creative) {
            [['stone_pick', 1], ['stone_sword', 1], ['torch', 8], ['bread', 5]].forEach(([k, n]) => { const l = Inv.add(p, I[k], n); if (l) dropItem(I[k], l); });
            p.coins += 30;
            UI.toast('たびの したくを もらった！ (いしの つるはし・つるぎ、たいまつ、パン、30コイン)', 4500);
          }
          CS.sfx.coin(); UI.closePanel();
        },
      }]);
    } else if (p.q === 1) {
      if (Inv.count(p, I.heroSword) > 0) {
        UI.talk(G, who, [
          'おお…！ その かがやき、まさしく <b>ゆうしゃのつるぎ</b>！',
          'きょうから そなたは キューブおうこくの <b>ゆうしゃ</b> じゃ！ ゆうしゃの あかしの マントを さずけよう。',
          'じつは いま、おうこくの 空を <b>てんくうりゅう ゼフィロス</b> が おびやかして おる。ひろばの <b>てんくうのゲート</b> は ゆうしゃしか とおれぬ。ゼフィロスを たおして くれぬか。',
        ], [{
          label: 'ゆうしゃに なる！', ok: true, fn: () => {
            p.q = 2; p.maxMp = 30; p.mp = 30; p.coins += 300;
            CS.sfx.fanfare(); UI.closePanel();
            UI.banner('ゆうしゃに なった！', 'マントと 300コインを もらった。MPが ふえた！');
          },
        }]);
      } else {
        UI.talk(G, who, [
          `ゆうしゃの森は おしろから みて <b>${fdir}</b> じゃ。ひかる はっぱの き が めじるしじゃぞ。`,
          '森の なかで <b>きらきら ひかる ばしょ</b> を さがすのじゃ。つるぎは そこに ある。',
          'ただし「もりのばんにん」には きをつけるのじゃぞ。',
        ]);
      }
    } else if (p.q === 2) {
      if (p.flags.dragonDead) {
        UI.talk(G, who, [
          'なんと！ あの ゼフィロスを たおしたと いうのか！',
          'そなたこそ まことの ゆうしゃじゃ。おうこくを すくって くれて ありがとう。これは おれいの 1000コインと、ゆうしゃの かんむりじゃ！',
        ], [{
          label: 'やったー！', ok: true, fn: () => {
            p.q = 3; p.coins += 1000; p.flags.crown = 1;
            CS.sfx.fanfare(); UI.closePanel();
            UI.banner('キューブおうこくに へいわが もどった！', 'これからも じゆうに ぼうけんしよう');
          },
        }]);
      } else {
        UI.talk(G, who, [
          'ひろばの <b>てんくうのゲート</b> を くぐれば、ゼフィロスの すむ 空の しまへ いける。',
          'ゼフィロスは ときどき しまに おりてくる。その ときが チャンスじゃ。ゆみや まほうのつえ、ゆうしゃのつるぎの ひかり (みぎクリック) も きくぞ。',
        ]);
      }
    } else {
      const ex = p.exhibits, n = Object.keys(ex.species).length + Object.keys(ex.fossils).length;
      UI.talk(G, who, [
        'ゆうしゃどの！ いつでも あそびに きてくだされ。',
        `はくぶつかんの てんじは いま ${n} / ${CS.SPECIES.length + CS.FOSSILS.length} じゃ。ぜんぶ そろえると すごいのう。`,
      ]);
    }
  }

  // ================= 生きものを わかせる =================
  let spawnT = 0;
  function spawnTick(env) {
    const w = G.world, p = G.player;
    if (w.dim === 'sky') return;
    let passive = 0, hostile = 0;
    for (const e of G.ents) {
      if (e.exhibit || e.tame || e.T.ai === 'npc' || e.T.ai === 'boss' || e.type === 'guardian') continue;
      if (e.T.ai === 'hostile') hostile++; else passive++;
    }
    const at = (minD, maxD) => {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      if (x < 2 || z < 2 || x >= w.W - 2 || z >= w.D - 2) return null;
      const y = CS.groundY(w, x, z);
      return { x: x + 0.5, y, z: z + 0.5, g: w.get(x, y - 1, z) };
    };
    const add = (type, pos) => { const e = new CS.Ent(type, pos.x, pos.y, pos.z); e.home = { x: pos.x, z: pos.z }; G.ents.push(e); return e; };
    const K = w.info.kingdom;
    const outside = (pos) => !K || Math.hypot(pos.x - K.x, pos.z - K.z) > 40;
    if (w.dim === 'over') {
      if (passive < 8 && Math.random() < 0.4) {
        const pos = at(20, 44);
        if (pos && pos.g === B.grass && outside(pos)) {
          const t = ['cow', 'pig', 'sheep', 'chicken'][Math.floor(Math.random() * 4)];
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) add(t, { x: pos.x + i * 0.8, y: pos.y + 0.1, z: pos.z });
        }
      }
      const night = env.day < 0.45;
      if (night && hostile < 5) {
        const pos = at(16, 36);
        if (pos && [B.grass, B.sand, B.dirt, B.stone, B.snow].includes(pos.g) && outside(pos) && w.bl[w.idx(Math.floor(pos.x), Math.min(w.H - 1, pos.y), Math.floor(pos.z))] < 6) {
          add(['zombie', 'zombie', 'skeleton', 'slime'][Math.floor(Math.random() * 4)], pos);
        }
      }
      // 地下の くらい ところ
      if (hostile < 6 && Math.random() < 0.35) {
        const x = Math.floor(p.x + (Math.random() - 0.5) * 48), y = Math.floor(p.y + (Math.random() - 0.5) * 16), z = Math.floor(p.z + (Math.random() - 0.5) * 48);
        if (w.inside(x, y, z) && Math.hypot(x - p.x, z - p.z) > 12 && !w.get(x, y, z) && !w.get(x, y + 1, z) && CS.SOLID[w.get(x, y - 1, z)] &&
          w.sky[w.idx(x, y, z)] < 4 && w.bl[w.idx(x, y, z)] < 6 && (!K || Math.hypot(x - K.x, z - K.z) > 38)) {
          add(Math.random() < 0.6 ? 'zombie' : 'skeleton', { x: x + 0.5, y, z: z + 0.5 });
        }
      }
    } else if (w.dim === 'ancient' && passive + hostile < 12 && Math.random() < 0.6) {
      const pos = at(18, 42);
      if (pos && [B.ancientGrass, B.sand, B.dirt].includes(pos.g) && Math.hypot(pos.x - w.W / 2, pos.z - w.D / 2) > 10) {
        const table = [['dodo', 3], ['mammoth', 2], ['trike', 2], ['stego', 2], ['ptera', 2], ['raptor', 2], ['saber', 1.2], ['trex', 0.6]];
        let r = Math.random() * table.reduce((s, x) => s + x[1], 0), t = 'dodo';
        for (const [k, wt] of table) { r -= wt; if (r < 0) { t = k; break; } }
        add(t, { x: pos.x, y: pos.y + (TYPES[t].fly ? 3 : 0.1), z: pos.z });
      }
    }
  }

  // ================= 毎フレームの更新 =================
  let qT = 0, saveT = 0, digT = 0, mining = null, useT = 0, attackT = 0, breakCd = 0, portalWarn = 0;
  function update(dt) {
    const p = G.player, w = G.world;
    const env = environment();
    G.env = env;
    if (G.uiOpen) { $('ring').style.display = 'none'; return; } // メニューを ひらいている あいだは とめる
    G.time = (G.time + dt / DAY_LEN) % 1;
    p.invuln = Math.max(0, (p.invuln || 0) - dt);
    p.bowCd = Math.max(0, (p.bowCd || 0) - dt);
    p.wandCd = Math.max(0, (p.wandCd || 0) - dt);
    p.swing = Math.max(0, (p.swing || 0) - dt * 4);

    // ---- 動く ----
    const active = !G.uiOpen && !p.dead;
    let fx = 0, fz = 0;
    if (active) {
      if (keys.KeyW || keys.ArrowUp) fz += 1;
      if (keys.KeyS || keys.ArrowDown) fz -= 1;
      if (keys.KeyA || keys.ArrowLeft) fx -= 1;
      if (keys.KeyD || keys.ArrowRight) fx += 1;
      fx += stick.x; fz -= stick.y;
    }
    const fl = Math.hypot(fx, fz); if (fl > 1) { fx /= fl; fz /= fl; }
    const swim = CS.inWater(w, p);
    const sprint = active && (keys.ShiftLeft || keys.ShiftRight) && !p.flying;
    let speed = p.flying ? (keys.ControlLeft ? 16 : 10) : sprint ? 5.8 : 4.3;
    if (swim && !p.flying) speed *= 0.6;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const wx = (sy * fz + cy * fx) * speed, wz = (-cy * fz + sy * fx) * speed;
    const acc = Math.min(1, dt * (p.onGround || p.flying || swim ? 12 : 2.5));
    p.vx += (wx - p.vx) * acc; p.vz += (wz - p.vz) * acc;
    const up = active && keys.Space, down = active && (keys.ShiftLeft || keys.ShiftRight);
    if (p.flying) { p.vy += (((up ? 8 : 0) - (down ? 8 : 0)) - p.vy) * Math.min(1, dt * 10); }
    else if (swim) { p.vy = up ? Math.min(p.vy + 30 * dt, 4) : Math.max(p.vy - 12 * dt, -3); }
    else {
      p.vy -= 28 * dt;
      if (up && p.onGround) p.vy = 8.6;
      if (G.touch && p.onGround && p.hitH && fl > 0.3) p.vy = 8.6; // スマホは かってに 1だん のぼる
    }
    p.vy = Math.max(p.vy, -50);
    const wasGround = p.onGround;
    CS.move(w, p, p.vx * dt, p.vy * dt, p.vz * dt);
    if (p.flying && p.onGround) p.flying = false;
    // おちた ときの ダメージ
    if (p.onGround || swim || p.flying) {
      if (!wasGround && !G.creative && !swim && !p.flying) { const fall = p.airTop - p.y; if (fall > 3.6) G.hurtPlayer(Math.floor(fall - 3), p.x, p.z, 0); }
      p.airTop = p.y;
    } else p.airTop = Math.max(p.airTop, p.y);
    if (p.y < -12) {
      const sp = w.info.spawn; p.x = sp.x; p.y = sp.y + 1; p.z = sp.z; p.vx = p.vy = p.vz = 0; p.airTop = p.y;
      if (!G.creative) { p.hp -= 4; if (p.hp <= 0) die(); }
      UI.toast('しまから おちてしまった！');
    }

    // ---- おなか・HP・MP ----
    if (!G.creative && !p.dead) {
      p.foodT = (p.foodT || 0) + dt * (sprint ? 2 : 1);
      if (p.foodT > 45) { p.foodT = 0; p.food = Math.max(0, p.food - 1); }
      p.regenT = (p.regenT || 0) + dt;
      if (p.regenT > 3) {
        p.regenT = 0;
        if (p.food >= 16 && p.hp < 20) p.hp = Math.min(20, p.hp + 1);
        else if (p.food <= 0 && p.hp > 2) p.hp -= 1;
      }
    }
    p.mp = Math.min(p.maxMp, p.mp + dt * 0.8);

    // ---- 見ている もの ----
    G.target = active ? findTarget() : null;
    const held = Inv.held(p);
    // こうげき・こわす
    attackT = Math.max(0, attackT - dt); breakCd = Math.max(0, breakCd - dt);
    if (active && mouseL) {
      const tg = G.target;
      if (tg && tg.ent) {
        if (attackPressed || attackT <= 0) { if (attackT <= 0) { attackEnt(tg.ent); attackT = 0.4; UI.swingHand(); p.swing = 1; } }
        mining = null;
      } else if (tg && tg.block) {
        const b = tg.block;
        if (G.creative) {
          if (breakCd <= 0) { if (b.id === B.pedestal) takeSword(); else breakBlock(b.x, b.y, b.z, false); breakCd = 0.22; UI.swingHand(); p.swing = 1; }
        } else if (b.id === B.pedestal) { if (attackPressed) takeSword(); }
        else {
          if (!mining || mining.x !== b.x || mining.y !== b.y || mining.z !== b.z) mining = { x: b.x, y: b.y, z: b.z, id: b.id, prog: 0, time: breakTime(b.id, held) };
          mining.prog += dt / mining.time;
          digT -= dt;
          if (digT <= 0) { digT = 0.24; CS.sfx.dig(BLOCKS[b.id].hardSound); UI.swingHand(); p.swing = 1; burst(b.x + 0.5 + b.face[0] * 0.5, b.y + 0.5 + b.face[1] * 0.5, b.z + 0.5 + b.face[2] * 0.5, BCOL[b.id], 3, 2, 0.4, 0.09); }
          if (mining.prog >= 1) {
            const harvest = canHarvest(b.id, held);
            if (!harvest && !p.flags.tipTier) { p.flags.tipTier = 1; UI.toast('この ブロックは もっと いい つるはしで ほらないと なにも でないよ'); }
            breakBlock(b.x, b.y, b.z, harvest);
            mining = null;
          }
        }
      } else mining = null;
    } else mining = null;
    attackPressed = false;
    // つかう
    useT = Math.max(0, useT - dt);
    if (active && mouseR && (usePressed || useT <= 0)) {
      const did = useAction();
      useT = usePressed ? 0.3 : 0.22;
      if (!did && usePressed) useT = 0;
    }
    usePressed = false;
    const ring = $('ring');
    if (mining && mining.time > 0.1) {
      const pr = Math.min(1, mining.prog);
      ring.style.display = 'block';
      ring.style.background = `conic-gradient(rgba(255,255,255,0.85) ${pr * 360}deg, rgba(255,255,255,0.15) 0)`;
      ring.style.mask = ring.style.webkitMask = 'radial-gradient(circle, transparent 13px, #000 14px)';
    } else ring.style.display = 'none';

    // ---- 生きもの ----
    const g = { world: w, player: p, creative: G.creative, shoot: G.shoot, hurtPlayer: G.hurtPlayer, toast: UI.toast };
    for (const e of G.ents) {
      if (e.dead) continue;
      const far = Math.hypot(e.x - p.x, e.z - p.z);
      if (far > 90 && e.T.ai !== 'npc' && !e.exhibit && !e.tame && e.T.ai !== 'boss' && e.type !== 'guardian') { e.dead = true; continue; }
      if (far > 64 && e.T.ai !== 'boss') continue; // とおくの ものは とめておく
      CS.think(e, g, dt);
      // 朝日で きえる モンスター
      if ((e.type === 'zombie' || e.type === 'skeleton') && env.day > 0.6 && w.dim === 'over') {
        const ix = Math.floor(e.x), iy = Math.floor(e.y + 1.6), iz = Math.floor(e.z);
        if (w.inside(ix, iy, iz) && w.sky[w.idx(ix, iy, iz)] >= 15) {
          e.hp -= dt * 4;
          if (Math.random() < 0.3) G.parts.push({ x: e.x, y: e.y + 2, z: e.z, vx: 0, vy: 1, vz: 0, life: 0.8, col: [0.3, 0.3, 0.3], size: 0.3, grav: -1 });
          if (e.hp <= 0) killEnt(e);
        }
      }
      if (e.y < -20) e.dead = true;
    }
    G.ents = G.ents.filter((e) => !e.dead);
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = 1; spawnTick(env); }

    updateProjs(dt);

    // ---- 落ちている物 ----
    for (const d of G.drops) {
      d.age += dt;
      d.vy -= 20 * dt;
      d.vx *= Math.pow(0.1, dt); d.vz *= Math.pow(0.1, dt);
      CS.move(w, d, d.vx * dt, d.vy * dt, d.vz * dt);
      if (d.onGround) { d.vx *= 0.8; d.vz *= 0.8; }
      const dist = Math.hypot(d.x - p.x, d.y - p.y - 0.8, d.z - p.z);
      if (d.age > 0.6 && dist < 1.6 && !p.dead) {
        const left = Inv.add(p, d.id, d.n);
        if (left < d.n) { CS.sfx.pop(); d.n = left; }
      } else if (d.age > 0.6 && dist < 3.5 && !p.dead) {
        d.x += (p.x - d.x) * dt * 4; d.z += (p.z - d.z) * dt * 4;
      }
    }
    G.drops = G.drops.filter((d) => d.n > 0 && d.age < 300 && d.y > -20);

    // ---- 粒 ----
    for (const q of G.parts) { q.life -= dt; q.vy -= q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    G.parts = G.parts.filter((q) => q.life > 0);
    // つるぎの きらきら
    if (w.dim === 'over' && !p.flags.swordTaken) {
      const s = w.info.shrine;
      if (Math.hypot(s.x - p.x, s.z - p.z) < 110 && Math.random() < dt * 14) {
        G.parts.push({ x: s.x + 0.5 + (Math.random() - 0.5) * 2, y: s.y + 1, z: s.z + 0.5 + (Math.random() - 0.5) * 2, vx: 0, vy: 3 + Math.random() * 2, vz: 0, life: 3.2, col: Math.random() < 0.5 ? [1, 0.95, 0.5] : [0.7, 1, 1], size: 0.13, grav: 0 });
      }
    }

    // ---- ゲート ----
    const feet = w.get(p.x, p.y + 0.2, p.z), body = w.get(p.x, p.y + 1.2, p.z);
    const pdef = BLOCKS[feet].portal ? BLOCKS[feet] : BLOCKS[body].portal ? BLOCKS[body] : null;
    portalWarn = Math.max(0, portalWarn - dt);
    if (pdef && !p.portalLock) {
      if (pdef.portal === 'sky' && !G.creative && p.q < 2) {
        if (portalWarn <= 0) { UI.toast('この ゲートは ゆうしゃ しか とおれない！ まずは おうさまに あおう'); portalWarn = 3; }
        p.vz += 8; p.portalLock = true;
      } else {
        p.portalT = (p.portalT || 0) + dt;
        $('portalFx').style.opacity = Math.min(1, p.portalT);
        if (p.portalT >= 1) {
          $('portalFx').style.opacity = 0;
          CS.sfx.portal();
          const from = w.dim;
          saveGame(true);
          const to = pdef.portal === 'home' ? 'over' : pdef.portal;
          G.uiOpen = true;
          if (locked()) document.exitPointerLock();
          enterDim(to, from).then(() => saveGame(true));
          return;
        }
      }
    } else {
      if (!pdef) p.portalLock = false;
      p.portalT = 0; $('portalFx').style.opacity = 0;
    }

    // ---- クエスト表示 ----
    qT -= dt;
    if (qT <= 0) { qT = 0.2; updateQuest(); }
    saveT += dt;
    if (saveT > 30) { saveT = 0; saveGame(true); }
    UI.updateHud(G);
    $('hand').style.visibility = G.third ? 'hidden' : '';
    // ボスの HP
    const boss = G.ents.find((e) => e.T.ai === 'boss');
    $('boss').classList.toggle('hidden', !boss);
    if (boss) { $('bossName').textContent = boss.T.name; $('bossBar').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; }
  }
  function updateQuest() {
    const p = G.player, w = G.world, info = w.info;
    let text = '', tgt = null;
    if (w.dim === 'ancient') { text = 'かせきを ほったり、つかまえアミで いきものを つかまえよう。かえりは きんの ゲート'; tgt = { x: w.W / 2, z: w.D / 2 - 5 }; }
    else if (w.dim === 'sky') { text = p.flags.dragonDead ? 'きんの ゲートから おうこくへ かえろう' : 'てんくうりゅう ゼフィロスを たおそう！'; tgt = p.flags.dragonDead ? { x: info.spawn.x, z: info.spawn.z + 4 } : null; }
    else if (G.creative) { text = 'クリエイティブ: スペース 2かいで 空を とべる。E で ブロックを えらぼう'; }
    else if (p.q === 0) { text = 'おしろの おうさまに あいに いこう (' + (G.touch ? 'つかうボタン' : 'みぎクリック') + 'で はなす)'; tgt = info.castle; }
    else if (p.q === 1) {
      if (Inv.count(p, I.heroSword) > 0) { text = 'おしろに もどって、おうさまに つるぎを みせよう'; tgt = info.castle; }
      else if (Math.hypot(p.x - info.forest.x, p.z - info.forest.z) < info.forest.r) { text = 'ゆうしゃの森の なかだ！ きらきら ひかる ばしょを さがそう'; }
      else { text = 'ゆうしゃの森で ゆうしゃのつるぎを さがそう'; tgt = info.forest; }
    } else if (p.q === 2) {
      if (p.flags.dragonDead) { text = 'おうさまに ゼフィロスを たおしたことを ほうこくしよう'; tgt = info.castle; }
      else { text = 'ひろばの てんくうのゲートから 空へ。ゼフィロスを たおそう'; tgt = info.skyGate; }
    } else {
      const n = Object.keys(p.exhibits.species).length + Object.keys(p.exhibits.fossils).length;
      text = `はくぶつかんの てんじを あつめよう (${n}/${CS.SPECIES.length + CS.FOSSILS.length})`;
      tgt = null;
    }
    $('qText').textContent = text;
    $('quest').classList.toggle('off', !text);
    const arrow = $('qArrow');
    if (tgt) {
      arrow.style.display = '';
      const a = Math.atan2(tgt.x - p.x, -(tgt.z - p.z)) - p.yaw;
      arrow.querySelector('i').style.transform = `rotate(${a}rad)`;
      $('qDist').textContent = 'あと ' + Math.round(Math.hypot(tgt.x - p.x, tgt.z - p.z)) + ' ブロック';
    } else arrow.style.display = 'none';
  }

  // ================= 空の色・明るさ =================
  function environment() {
    const w = G.world, dim = w ? w.dim : 'over', R = ren.renderDist * 16;
    let fog = [R * 0.55, R * 0.95];
    if (dim === 'sky') return { day: 1, sky: [0.6, 0.78, 1], fog, sun: null };
    const a = G.time * Math.PI * 2, sunH = Math.sin(a);
    const day = CS.clamp(0.26 + (sunH + 0.15) * 1.2, 0.24, 1);
    const k = (day - 0.24) / 0.76;
    const dayC = dim === 'ancient' ? [0.95, 0.78, 0.58] : [0.55, 0.76, 1];
    let sky = [CS.lerp(0.02, dayC[0], k), CS.lerp(0.03, dayC[1], k), CS.lerp(0.08, dayC[2], k)];
    const dusk = Math.max(0, 1 - Math.abs(sunH) * 4) * 0.5;
    sky = [CS.lerp(sky[0], 0.95, dusk), CS.lerp(sky[1], 0.5, dusk), CS.lerp(sky[2], 0.3, dusk)];
    const p = G.player;
    if (p && w && w.info.forest && Math.hypot(p.x - w.info.forest.x, p.z - w.info.forest.z) < w.info.forest.r + 3) {
      fog = [6, 44]; sky = [sky[0] * 0.55, sky[1] * 0.85, sky[2] * 0.8];
    }
    if (p && w && w.get(p.x, p.y + 1.62, p.z) === B.water) { fog = [1, 14]; sky = [0.08 * day + 0.02, 0.22 * day + 0.03, 0.5 * day + 0.06]; }
    return { day, sky, fog, sun: [Math.cos(a), sunH, 0.3] };
  }

  // ================= 描く =================
  function render(now) {
    const p = G.player, w = G.world;
    if (CS.Skin.version !== skinVer) { skinVer = CS.Skin.version; ren.setSkinAtlas(CS.Skin.atlas); }
    let cam;
    const env = G.env || environment();
    const playing = G.state === 'play' && p && w;
    if (playing) {
      cam = { x: p.x, y: p.y + 1.62, z: p.z, yaw: p.yaw, pitch: p.pitch };
      if (G.third) {
        const cp = Math.cos(p.pitch), d = [Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp];
        let dist = 4;
        for (let t = 0.3; t <= 4; t += 0.2) if (CS.SOLID[w.get(cam.x - d[0] * t, cam.y - d[1] * t, cam.z - d[2] * t)]) { dist = t - 0.3; break; }
        cam.x -= d[0] * dist; cam.y -= d[1] * dist; cam.z -= d[2] * dist;
      }
    } else if (G.demo) {
      const t = now / 1000 * 0.05, c = G.demo.info.kingdom;
      cam = { x: c.x + Math.sin(t) * 52, y: 52, z: c.z + Math.cos(t) * 52, yaw: 0, pitch: -0.42 };
      cam.yaw = Math.atan2(c.x - cam.x, -(c.z - cam.z));
    } else {
      ren.begin({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { day: 1, sky: [0.06, 0.08, 0.12], fog: [100, 200] });
      ren.finish();
      return;
    }
    ren.begin(cam, env);
    if (playing) ren.updateChunks(p.x, p.z, 5);
    else ren.updateChunks(cam.x, cam.z, 8);
    // 太陽と月
    if (env.sun) {
      const s = env.sun, l = Math.hypot(...s), dir = [s[0] / l, s[1] / l, s[2] / l];
      ren.skyQuad(dir, 30, 4, [1, 0.95, 0.7]);
      ren.skyQuad([-dir[0], -dir[1], -dir[2]], 30, 2.6, [0.85, 0.88, 1]);
    }
    const near = (x, z, r) => Math.abs(x - cam.x) < r && Math.abs(z - cam.z) < r;
    const R = ren.renderDist * 16;
    for (const e of G.ents) {
      if (!near(e.x, e.z, R + 10)) continue;
      CS.drawEnt(ren, e, ren.lightAt(e.x, e.y + e.h * 0.7, e.z));
    }
    if (playing) {
      if (G.third) {
        CS.drawHumanoid(ren, {
          x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, slot: 0, light: ren.lightAt(p.x, p.y + 1.5, p.z),
          walk: Math.sin(now / 120) * Math.min(1, Math.hypot(p.vx, p.vz) / 4) * 0.8, swing: p.swing, cape: p.q >= 2, crown: !!p.flags.crown, hurt: (p.invuln || 0) > 0.3,
        });
      }
      for (const d of G.drops) if (near(d.x, d.z, R)) ren.billboard(d.x, d.y + 0.25 + Math.sin(now / 300 + d.x) * 0.06, d.z, 0.42, ITEMS[d.id].icon, [1, 1, 1], ren.lightAt(d.x, d.y + 0.3, d.z), true);
      for (const pr of G.projs) if (pr.kind === 'arrow') ren.billboard(pr.x, pr.y, pr.z, 0.5, ITEMS[I.arrow].icon, [1, 1, 1], 1);
      if (w.dim === 'over') {
        if (!p.flags.swordTaken) { const s = w.info.shrine; ren.billboard(s.x + 0.5, s.y + 1.7 + Math.sin(now / 500) * 0.15, s.z + 0.5, 1.1, ITEMS[I.heroSword].icon, [1, 1, 1], 1, true); }
        CS.FOSSILS.forEach((f, i) => { if (p.exhibits.fossils[f.key]) { const c = w.info.fossilCases[i]; ren.billboard(c.x, c.y, c.z, 0.6, ITEMS[f.item].icon, [1, 1, 1], ren.lightAt(c.x, c.y, c.z), true); } });
      }
      const tg = G.target;
      if (tg && tg.block) {
        const b = tg.block, pr = mining ? Math.min(1, mining.prog) : 0;
        ren.outline(b.x, b.y, b.z, 1, 1, 1, [pr, 0, 0]);
      }
    }
    for (const q of G.parts) ren.billboard(q.x, q.y, q.z, q.size, -1, q.col, 1);
    ren.finish();
  }

  // ================= タイトルの 背景 =================
  function setupDemo() {
    if (G.demo) { ren.setWorld(G.demo); return; }
    setTimeout(() => {
      if (G.state !== 'title') return;
      G.demo = CS.generate('over', 20261110, null);
      if (G.state === 'title') ren.setWorld(G.demo);
    }, 50);
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      if (G.state === 'play' && G.player && G.world && $('loading').classList.contains('hidden')) update(dt);
      render(now);
    } catch (err) { console.error(err); }
  }
  UI.buildHud();
  UI.show('title');
  setupDemo();
  requestAnimationFrame(frame);
  window.__cs = G; // 動作確認用
})();
