/* =========================================================================
   CELLHOUSE ― 進行
   カメラ / マウス・タッチ・キー / 道具 / セーブ / ループ
   ========================================================================= */
'use strict';

const SPEEDS = [0, 1, 3, 8];

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cam = { x: MAP_W / 2, y: MAP_H - 12, z: 1 };
    this.tool = null;
    this.rot = 0;
    this.hover = null;
    this.drag = null;
    this.sel = null;
    this.speed = 1;
    this.lastSpeed = 1;
    this.showZones = false;
    this.showDanger = true;
    this.follow = null;
    this.keys = new Set();
    this.started = false;
    this.world = null; this.sim = null; this.seed = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    UI.init(this);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.started) this.save(true); });
  }

  /* ------------------------------ 開始 ------------------------------ */
  newGame() {
    this.seed = (Math.random() * 1e9) | 0;
    this.world = new World();
    this.world.generate(this.seed);
    this.sim = new Sim(this.world);
    this.world.recomputeRooms(this.sim.research);
    this.sim.afterRooms();
    const st = this.sim.stockTile();
    const sx = st % MAP_W, sy = (st / MAP_W) | 0;
    for (const role in START_STAFF) {
      for (let k = 0; k < START_STAFF[role]; k++) {
        const p = new Person(this.sim, 'staff', role);
        p.name = pick(FAMILY_NAMES) + ' ' + pick(STAFF_GIVEN);
        this.sim.add(p, sx + rint(-3, 3), sy + rint(-2, 0));
      }
    }
    this.sim.log('土地を手に入れた。まずは房と仮監房を建てよう。明日の朝9時に最初の囚人が来る', 'info');
    this.hookSim();
    this.cam = { x: sx + 0.5, y: sy - 6, z: 1 };
  }
  hookSim() {
    const s = this.sim;
    s.onLog = (e) => UI.onLog(e);
    s.onDay = () => { this.save(true); UI.dayReport(); };
    s.onHourCb = (h) => { if (h % 6 === 3) this.save(true); };
  }
  load() {
    const d = Save.read();
    if (!d) return false;
    try {
      this.seed = d.seed;
      this.sim = Sim.load(d);
      this.world = this.sim.world;
      this.world.recomputeRooms(this.sim.research);
      this.sim.afterRooms();
      this.hookSim();
      const st = this.sim.stockTile();
      this.cam = { x: st % MAP_W + 0.5, y: ((st / MAP_W) | 0) - 6, z: 1 };
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
  save(quiet) {
    if (!this.sim || this.sim.over) return;
    const ok = Save.write(this.sim.serialize(this.seed));
    if (!quiet) Toast.show(ok ? '保存した' : '保存できなかった（ブラウザの設定を確認）', ok ? 'good' : 'bad');
  }
  start() {
    this.started = true;
    document.getElementById('title').classList.add('hide');
    document.getElementById('hud').classList.remove('hide');
    UI.refreshAll();
  }

  /* ------------------------------ 画面 ------------------------------ */
  resize() {
    this.cw = window.innerWidth; this.ch = window.innerHeight;
    this.canvas.width = Math.round(this.cw * this.dpr);
    this.canvas.height = Math.round(this.ch * this.dpr);
    this.canvas.style.width = this.cw + 'px';
    this.canvas.style.height = this.ch + 'px';
  }
  toWorld(mx, my) {
    const Z = this.cam.z * TILE;
    return { x: this.cam.x + (mx - this.cw / 2) / Z, y: this.cam.y + (my - this.ch / 2) / Z };
  }
  toScreen(x, y) {
    const Z = this.cam.z * TILE;
    return { x: (x - this.cam.x) * Z + this.cw / 2, y: (y - this.cam.y) * Z + this.ch / 2 };
  }
  zoomAt(mx, my, f) {
    const before = this.toWorld(mx, my);
    this.cam.z = clamp(this.cam.z * f, 0.35, 2.6);
    const after = this.toWorld(mx, my);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
    this.clampCam();
  }
  clampCam() {
    this.cam.x = clamp(this.cam.x, 0, MAP_W);
    this.cam.y = clamp(this.cam.y, 0, MAP_H);
  }
  jump(x, y) { this.cam.x = x; this.cam.y = y; this.follow = null; }

  /* ------------------------------ 入力 ------------------------------ */
  bindInput() {
    const cv = this.canvas;
    const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
    window.addEventListener('keydown', (e) => {
      if (typing(e) || !this.started) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(k);
      if (k === ' ') { e.preventDefault(); this.setSpeed(this.speed ? 0 : this.lastSpeed || 1); }
      else if (k === '1' || k === '2' || k === '3') this.setSpeed(+k);
      else if (k === 'r') this.rot = (this.rot + 1) % 4;
      else if (k === 'Escape') { if (UI.modalOpen()) UI.closeModal(); else if (this.tool) this.setTool(null); else { this.sel = null; UI.inspect(null); } }
      else if (k === 'z') { this.showZones = !this.showZones; UI.refreshToggles(); }
      if (k.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys.delete(k); });
    window.addEventListener('blur', () => this.keys.clear());

    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousedown', (e) => {
      const m = pos(e);
      if (e.button === 2 || e.button === 1) { this.pan = { x: m.x, y: m.y, cx: this.cam.x, cy: this.cam.y, moved: false, right: true }; return; }
      this.pointerDown(m.x, m.y);
    });
    window.addEventListener('mousemove', (e) => {
      const m = pos(e);
      this.mouse = m;
      if (this.pan) { this.panMove(m.x, m.y); return; }
      this.pointerMove(m.x, m.y);
    });
    window.addEventListener('mouseup', (e) => {
      const m = pos(e);
      if (this.pan && this.pan.right) {
        if (!this.pan.moved && this.tool) this.setTool(null);
        this.pan = null; return;
      }
      this.pointerUp(m.x, m.y);
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const m = pos(e);
      this.zoomAt(m.x, m.y, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    /* タッチ: 1本指は道具か移動、2本指はつまんで拡大 */
    const touches = new Map();
    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) touches.set(t.identifier, pos(t));
      if (touches.size === 1) { const m = [...touches.values()][0]; this.mouse = m; this.pointerDown(m.x, m.y, true); }
      else if (touches.size === 2) {
        this.drag = null; this.pan = null;
        const [a, b] = [...touches.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) touches.set(t.identifier, pos(t));
      if (touches.size === 2 && this.pinch) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.zoomAt(cx, cy, d / this.pinch.d);
        const Z = this.cam.z * TILE;
        this.cam.x -= (cx - this.pinch.cx) / Z; this.cam.y -= (cy - this.pinch.cy) / Z;
        this.clampCam();
        this.pinch = { d, cx, cy };
      } else if (touches.size === 1) {
        const m = [...touches.values()][0];
        this.mouse = m;
        if (this.pan) this.panMove(m.x, m.y); else this.pointerMove(m.x, m.y);
      }
    }, { passive: false });
    const tend = (e) => {
      e.preventDefault();
      let last = null;
      for (const t of e.changedTouches) { last = pos(t); touches.delete(t.identifier); }
      if (touches.size === 0) {
        if (this.pinch) { this.pinch = null; this.pan = null; this.drag = null; return; }
        if (last) this.pointerUp(last.x, last.y);
      }
    };
    cv.addEventListener('touchend', tend, { passive: false });
    cv.addEventListener('touchcancel', tend, { passive: false });
  }

  tileAt(mx, my) {
    const p = this.toWorld(mx, my);
    return { x: Math.floor(p.x), y: Math.floor(p.y), fx: p.x, fy: p.y };
  }
  pointerDown(mx, my) {
    if (!this.started) return;
    const t = this.tileAt(mx, my);
    this.hover = t;
    if (!this.tool) { this.pan = { x: mx, y: my, cx: this.cam.x, cy: this.cam.y, moved: false }; return; }
    this.drag = { x0: t.x, y0: t.y, x1: t.x, y1: t.y };
  }
  pointerMove(mx, my) {
    if (!this.started) return;
    const t = this.tileAt(mx, my);
    this.hover = t;
    if (this.drag) { this.drag.x1 = t.x; this.drag.y1 = t.y; }
    UI.tip(mx, my);
  }
  panMove(mx, my) {
    const p = this.pan;
    if (Math.abs(mx - p.x) + Math.abs(my - p.y) > 5) p.moved = true;
    if (!p.moved) return;
    const Z = this.cam.z * TILE;
    this.cam.x = p.cx - (mx - p.x) / Z; this.cam.y = p.cy - (my - p.y) / Z;
    this.follow = null;
    this.clampCam();
  }
  pointerUp(mx, my) {
    if (this.pan) {
      const moved = this.pan.moved;
      this.pan = null;
      if (!moved) this.select(mx, my);
      return;
    }
    if (this.drag && this.tool) this.apply();
    this.drag = null;
  }

  select(mx, my) {
    const p = this.toWorld(mx, my);
    const s = this.sim, w = this.world;
    let best = null, bd = 0.55;
    for (const q of s.people) {
      const d = dist(q.x, q.y, p.x, p.y);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) { this.sel = { type: 'person', p: best }; UI.inspect(this.sel); return; }
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (!w.inb(tx, ty)) { this.sel = null; UI.inspect(null); return; }
    const i = w.idx(tx, ty);
    const o = w.obj(i);
    if (o && o.key !== 'tree') { this.sel = { type: 'obj', o }; UI.inspect(this.sel); return; }
    const r = w.roomOf(i);
    if (r) { this.sel = { type: 'room', key: r.key }; UI.inspect(this.sel); return; }
    this.sel = null; UI.inspect(null);
  }

  setSpeed(n) {
    if (n) this.lastSpeed = n;
    this.speed = n;
    UI.refreshSpeed();
  }
  setTool(t) {
    this.tool = t;
    this.drag = null;
    UI.refreshTool();
  }

  /* ------------------------------ 道具 ------------------------------ */
  dragRect() {
    const d = this.drag || (this.hover && { x0: this.hover.x, y0: this.hover.y, x1: this.hover.x, y1: this.hover.y });
    if (!d) return null;
    const x0 = clamp(Math.min(d.x0, d.x1), 0, MAP_W - 1), x1 = clamp(Math.max(d.x0, d.x1), 0, MAP_W - 1);
    const y0 = clamp(Math.min(d.y0, d.y1), 0, MAP_H - 1), y1 = clamp(Math.max(d.y0, d.y1), 0, MAP_H - 1);
    return { x0, x1, y0, y1 };
  }
  /* 道具が触るマス。{walls, floors} に分けて返す (建物の道具のため) */
  toolTiles() {
    const t = this.tool, r = this.dragRect();
    if (!t || !r) return null;
    const w = this.world, out = [], inner = [];
    const rectAll = () => { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) out.push(w.idx(x, y)); };
    const outline = () => {
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        const edge = x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1;
        (edge ? out : inner).push(w.idx(x, y));
      }
    };
    switch (t.kind) {
      case 'wall': outline(); break;
      case 'room': outline(); break;
      case 'door': case 'patrol': out.push(w.idx(r.x1, r.y1)); break;
      default: rectAll();
    }
    return { out, inner };
  }
  previewTiles() {
    if (!this.tool || this.tool.kind === 'obj') return null;
    const tt = this.toolTiles();
    if (!tt) return null;
    return this.tool.kind === 'room' ? tt.out.concat(tt.inner) : tt.out;
  }
  /* dry=true なら費用だけ計算する */
  runTool(dry) {
    const t = this.tool, s = this.sim, w = this.world, jobs = s.jobs;
    let cost = 0, count = 0, blocked = 0;
    const add = (c) => { if (c < 0) blocked++; else { cost += c; if (c) count++; } };
    if (t.kind === 'obj') {
      const h = this.hover;
      if (!h) return null;
      const c = jobs.planObj(t.key, h.x, h.y, this.rot, dry);
      if (c < 0) return { cost: 0, count: 0, reason: w.canPlace(t.key, h.x, h.y, this.rot) || '置けない' };
      return { cost: c, count: 1 };
    }
    const tt = this.toolTiles();
    if (!tt) return null;
    switch (t.kind) {
      case 'wall': for (const i of tt.out) add(jobs.planWall(i, t.v, dry)); break;
      case 'room':
        for (const i of tt.out) { add(jobs.planWall(i, t.wall, dry)); add(jobs.planFloor(i, t.floor, dry)); }
        for (const i of tt.inner) add(jobs.planFloor(i, t.floor, dry));
        break;
      case 'floor': for (const i of tt.out) add(jobs.planFloor(i, t.v, dry)); break;
      case 'door': for (const i of tt.out) add(jobs.planDoor(i, t.v, dry)); break;
      case 'remove': for (const i of tt.out) { const c = jobs.planRemove(i, dry); cost += c; if (c !== 0 || w.wall[i] || w.door[i] || w.objAt[i] >= 0) count++; } break;
      case 'rmFloor': for (const i of tt.out) { const c = jobs.planRemoveFloor(i, dry); cost += c; if (w.floor[i]) count++; } break;
      case 'zone': case 'unzone': {
        const z = t.kind === 'zone' ? ROOM_KEYS.indexOf(t.key) + 1 : 0;
        for (const i of tt.out) {
          if (!w.buildable(i) && z) continue;
          if (w.zone[i] !== z) { count++; if (!dry) w.zone[i] = z; }
        }
        if (!dry && count) w.roomsDirty = true;
        break;
      }
      case 'patrol': {
        const i = tt.out[0];
        if (!dry) {
          const k = w.patrol.indexOf(i);
          if (k >= 0) w.patrol.splice(k, 1); else if (w.canWalk(i, null, false)) w.patrol.push(i);
        }
        count = 1;
        break;
      }
    }
    return { cost, count, blocked };
  }
  apply() {
    const s = this.sim;
    const pre = this.runTool(true);
    if (!pre) return;
    if (pre.reason) { Toast.show(pre.reason, 'bad'); return; }
    if (pre.cost > 0 && !s.canAfford(pre.cost)) { Toast.show(`お金が足りない（${yen(pre.cost)} 必要）`, 'bad'); return; }
    const r = this.runTool(false);
    if (r.cost) s.spend(r.cost, 'build');
    if (this.tool.kind === 'room' && r.count) this.maybeHint();
  }
  maybeHint() {
    if (this.hinted) return;
    this.hinted = true;
    Toast.show('次は「部屋」で中を塗り、用途を決めよう');
  }

  /* ------------------------------ ループ ------------------------------ */
  loop(now) {
    const rdt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.started && this.sim) {
      const s = this.sim;
      if (this.speed && !s.over) {
        const simDt = rdt * SPEEDS[this.speed];
        const steps = Math.max(1, Math.ceil(simDt / 0.05));
        for (let k = 0; k < steps; k++) s.step(simDt / steps);
      }
      if (s.over && !this.endShown) { this.endShown = true; UI.showEnd(); }
      const pan = 14 / this.cam.z * rdt;
      if (this.keys.has('w') || this.keys.has('ArrowUp')) { this.cam.y -= pan; this.follow = null; }
      if (this.keys.has('s') || this.keys.has('ArrowDown')) { this.cam.y += pan; this.follow = null; }
      if (this.keys.has('a') || this.keys.has('ArrowLeft')) { this.cam.x -= pan; this.follow = null; }
      if (this.keys.has('d') || this.keys.has('ArrowRight')) { this.cam.x += pan; this.follow = null; }
      if (this.follow) {
        if (this.follow.gone) this.follow = null;
        else { this.cam.x = lerp(this.cam.x, this.follow.x, 0.15); this.cam.y = lerp(this.cam.y, this.follow.y, 0.15); }
      }
      this.clampCam();
      if (this.sel && this.sel.type === 'person' && this.sel.p.gone) { this.sel = null; UI.inspect(null); }
      Render.frame(this);
      UI.update(rdt);
    } else {
      this.titleBackdrop(rdt);
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  /* タイトルの後ろで流す景色 */
  titleBackdrop(rdt) {
    if (!this.demo) {
      const w = new World();
      w.generate(12345);
      const s = new Sim(w);
      for (let y = 42; y < 58; y++) for (let x = 30; x < 66; x++) {
        const i = w.idx(x, y);
        const edge = x === 30 || x === 65 || y === 42 || y === 57;
        w.floor[i] = edge ? 1 : (x < 48 ? 1 : 2);
        if (edge) w.wall[i] = 2;
        const o = w.obj(i); if (o) w.removeObject(o.id);
      }
      for (let y = 43; y < 57; y++) w.wall[w.idx(48, y)] = 1;
      for (let x = 31; x < 48; x++) if (x % 4 === 3) for (let y = 43; y < 49; y++) w.wall[w.idx(x, y)] = 1;
      for (let x = 31; x < 48; x++) w.wall[w.idx(x, 49)] = 1;
      for (let x = 31; x < 47; x += 4) { w.door[w.idx(x + 2, 49)] = 3; w.wall[w.idx(x + 2, 49)] = 0; w.addObject('bed', x + 1, 43, 0); w.addObject('toilet', x + 3, 43, 0); }
      w.door[w.idx(48, 52)] = 1; w.wall[w.idx(48, 52)] = 0;
      w.door[w.idx(56, 57)] = 2; w.wall[w.idx(56, 57)] = 0;
      for (let k = 0; k < 3; k++) w.addObject('table', 52 + (k % 2) * 5, 46 + k * 3, 0);
      w.addObject('serving', 61, 44, 0);
      w.addObject('tv', 37, 55, 2); w.addObject('sofa', 36, 52, 2);
      for (let i = 0; i < w.n; i++) if (w.wall[i] || w.door[i]) w.hp[i] = 100;
      w.roomsDirty = true;
      w.recomputeRooms(s.research);
      for (let k = 0; k < 14; k++) {
        const p = s.makePrisoner(k % 3); p.state = 'normal'; p.escort = false;
        s.add(p, 32 + (k * 5) % 30, 50 + (k * 3) % 6);
      }
      for (let k = 0; k < 3; k++) { const g = new Person(s, 'staff', 'guard'); g.name = '看守'; s.add(g, 40 + k * 8, 53); }
      s.sched = new Array(24).fill('free');
      this.demo = { w, s, t: 0 };
    }
    const d = this.demo;
    d.t += rdt;
    d.s.step(Math.min(0.05, rdt));
    const save = { world: this.world, sim: this.sim, cam: this.cam, tool: this.tool, sel: this.sel };
    this.world = d.w; this.sim = d.s; this.tool = null; this.sel = null;
    this.cam = { x: 48 + Math.sin(d.t * 0.05) * 6, y: 50, z: Math.max(0.9, Math.min(1.6, this.cw / 1100)) };
    Render.frame(this);
    Object.assign(this, save);
  }
}

window.addEventListener('load', () => { window.game = new Game(); });
