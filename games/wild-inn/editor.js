/* =========================================================================
   WILD INN ― もようがえ
   部屋をつくる (ドラッグ) / かべをドラッグして大きさを変える / 部屋を動かす /
   部屋の種類とドア / 家具を置く・動かす・しまう / 階をふやす / 土地を広げる
   もようがえの間は時間が止まる
   ========================================================================= */
'use strict';

const Editor = {
  active: false, floor: 0, tab: 'room', tool: null, sel: null, hover: null, drag: null, pending: null,
  focus: { x: 0, y: 0 }, filter: 'town', lastTap: null, testKey: '', testWhy: null,

  open() {
    if (this.active) return;
    this.active = true;
    this.floor = R.viewFloor;
    this.tool = null; this.sel = null; this.drag = null; this.pending = null; this.hover = null;
    this.focus = { x: R.player.x, y: R.player.y };
    R.player.stop();
    Input.keys.clear();
    document.body.classList.add('editing');
    UI.showEditBar();
  },
  close() {
    if (!this.active) return;
    this.active = false;
    this.tool = null; this.sel = null; this.drag = null; this.pending = null;
    this.afterEdit();
    UI.hideEditBar();
    document.body.classList.remove('editing');
    saveGame();
  },
  setFloor(f) { this.floor = f; this.sel = null; this.pending = null; this.drag = null; this.renderBar(); },
  setTab(t) {
    this.tab = t; this.tool = null; this.pending = null;
    if (t === 'furn') {
      const r = this.sel && this.sel.room;
      this.filter = r ? r.hab : this.floor === 0 && !this.sel ? 'lobby' : this.filter;
    }
    this.renderBar();
  },
  setTool(t) { this.tool = t; this.sel = null; this.pending = null; this.drag = null; this.lastTap = null; this.testKey = ''; this.renderBar(); },

  /* ------------------------------ 指しているもの ------------------------------ */
  tileOf(w) { return { x: Math.floor(w.x), y: Math.floor(w.y) }; },
  /* 見た目で家具を拾う (背の高い家具は上の方を押しても選べる) */
  furnAtScreen(w) {
    let best = null;
    for (const fu of G.furn) {
      if (fu.floor !== this.floor) continue;
      const d = FURN[fu.type], top = Math.max(d.h * T, VIS_H[fu.type] || 0) / T;
      if (w.x >= fu.x && w.x < fu.x + d.w && w.y < fu.y + d.h && w.y >= fu.y + d.h - top) {
        if (!best || fu.y + d.h > best.y + FURN[best.type].h) best = fu;
      }
    }
    return best;
  },
  edgeOf(r, w, touch) {
    const m = touch ? 0.5 : 0.32;
    const inY = w.y > r.y - m && w.y < r.y + r.h + m, inX = w.x > r.x - m && w.x < r.x + r.w + m;
    const c = [];
    if (inY) { c.push(['w', Math.abs(w.x - r.x)]); c.push(['e', Math.abs(w.x - r.x - r.w)]); }
    if (inX) { c.push(['n', Math.abs(w.y - r.y)]); c.push(['s', Math.abs(w.y - r.y - r.h)]); }
    c.sort((a, b) => a[1] - b[1]);
    return c.length && c[0][1] < m ? c[0][0] : null;
  },
  dragging(fu) { return this.drag && this.drag.kind === 'furn' && this.drag.moved && this.drag.fu === fu; },

  /* ------------------------------ ゆび・マウス ------------------------------ */
  down(w, sx, sy, touch) {
    const t = this.tool, tile = this.tileOf(w);
    const d = { sx, sy, w0: w, tile0: tile, moved: false, touch, kind: 'pan', f0: { ...this.focus } };
    if (t && t.kind === 'room') d.kind = 'rect';
    else if (t && t.kind === 'furn') d.kind = 'tap';
    else {
      const r = this.sel && this.sel.room;
      const edge = r && this.edgeOf(r, w, touch);
      const fu = this.furnAtScreen(w);
      if (edge) { d.kind = 'edge'; d.room = r; d.edge = edge; }
      else if (fu) { d.kind = 'furn'; d.fu = fu; d.gx = tile.x - fu.x; d.gy = tile.y - fu.y; }
      else if (r && w.x >= r.x && w.x < r.x + r.w && w.y >= r.y && w.y < r.y + r.h) { d.kind = 'moveRoom'; d.room = r; }
    }
    this.drag = d;
  },
  move(w, sx, sy, touch) {
    if (!touch || !this.drag) this.hover = this.tileOf(w);
    const d = this.drag;
    if (!d) return;
    if (!d.moved && dist(sx, sy, d.sx, d.sy) > 10) d.moved = true;
    if (!d.moved) return;
    const tile = this.tileOf(w);
    if (d.kind === 'pan') {
      const px = Render.cam.px;
      this.focus.x = d.f0.x - (sx - d.sx) / px;
      this.focus.y = d.f0.y - (sy - d.sy) / px;
      const b = Render.bounds(this.floor);
      this.focus.x = clamp(this.focus.x, b.x0, b.x1); this.focus.y = clamp(this.focus.y, b.y0, b.y1);
    } else if (d.kind === 'rect') {
      const x0 = Math.min(d.tile0.x, tile.x), y0 = Math.min(d.tile0.y, tile.y);
      d.rc = { x: x0, y: y0, w: Math.abs(tile.x - d.tile0.x) + 1, h: Math.abs(tile.y - d.tile0.y) + 1 };
    } else if (d.kind === 'edge') {
      const r = d.room, rc = { x: r.x, y: r.y, w: r.w, h: r.h };
      const gx = Math.round(w.x), gy = Math.round(w.y);
      if (d.edge === 'w') { rc.x = Math.min(gx, r.x + r.w - 1); rc.w = r.x + r.w - rc.x; }
      if (d.edge === 'e') { rc.w = Math.max(1, gx - r.x); }
      if (d.edge === 'n') { rc.y = Math.min(gy, r.y + r.h - 1); rc.h = r.y + r.h - rc.y; }
      if (d.edge === 's') { rc.h = Math.max(1, gy - r.y); }
      d.rc = rc;
    } else if (d.kind === 'moveRoom') {
      const r = d.room;
      d.rc = { x: r.x + tile.x - d.tile0.x, y: r.y + tile.y - d.tile0.y, w: r.w, h: r.h };
    } else if (d.kind === 'furn') {
      d.to = { x: tile.x - d.gx, y: tile.y - d.gy };
    }
  },
  up(w, sx, sy, touch) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.moved) { this.tap(w, touch); return; }
    if (d.kind === 'rect' && d.rc) this.buildRoom(d.rc);
    else if (d.kind === 'edge' && d.rc) this.reshape(d.room, d.rc, true);
    else if (d.kind === 'moveRoom' && d.rc && (d.rc.x !== d.room.x || d.rc.y !== d.room.y)) this.reshape(d.room, d.rc, false);
    else if (d.kind === 'furn' && d.to) this.moveFurn(d.fu, d.to);
    this.renderBar();
  },
  tap(w, touch) {
    const t = this.tool, tile = this.tileOf(w);
    this.hover = tile;
    if (t && t.kind === 'room') {
      const rc = { x: tile.x - 1, y: tile.y - 1, w: 4, h: 4 };
      rc.x = clamp(rc.x, 0, Hotel.W - 4); rc.y = clamp(rc.y, 0, Hotel.H - 4);
      this.pending = rc;
      this.testKey = '';
      this.renderBar();
      return;
    }
    if (t && t.kind === 'furn') {
      const same = this.lastTap && this.lastTap.x === tile.x && this.lastTap.y === tile.y;
      this.lastTap = tile;
      if (touch && !same) { this.testKey = ''; return; }
      this.placeFurn(t.type, tile);
      return;
    }
    const fu = this.furnAtScreen(w);
    if (fu) { this.sel = { fu }; this.renderBar(); return; }
    const r = Hotel.roomAt(this.floor, tile.x, tile.y);
    this.sel = r ? { room: r } : null;
    if (r && this.tab === 'build') this.tab = 'room';
    this.renderBar();
  },

  /* ------------------------------ 部屋 ------------------------------ */
  roomCost(rc, hab) { return HABITATS[hab].cost + rc.w * rc.h * TILE_COST; },
  testRoom(rc, hab) {
    const key = ['add', this.floor, rc.x, rc.y, rc.w, rc.h, R.layoutV].join(',');
    if (key === this.testKey) return this.testWhy;
    const res = Hotel.addRoom(this.floor, rc, hab);
    if (res.room) { G.rooms.pop(); G.nextRoom--; Hotel.rebuild(); }
    this.testKey = ['add', this.floor, rc.x, rc.y, rc.w, rc.h, R.layoutV].join(',');
    this.testWhy = res.why || null;
    return this.testWhy;
  },
  testReshape(r, rc) {
    const key = ['re', r.id, rc.x, rc.y, rc.w, rc.h, R.layoutV].join(',');
    if (key === this.testKey) return this.testWhy;
    const res = Hotel.setRoomRect(r, rc, true);
    this.testKey = ['re', r.id, rc.x, rc.y, rc.w, rc.h, R.layoutV].join(',');
    this.testWhy = res.why || null;
    return this.testWhy;
  },
  buildRoom(rc) {
    const hab = this.tool.hab, cost = this.roomCost(rc, hab);
    if (G.money < cost) { this.fail('お金が足りないよ'); return; }
    const res = Hotel.addRoom(this.floor, rc, hab);
    if (res.why) { this.fail(res.why); return; }
    G.money -= cost;
    Sound.play('build');
    FX.sparkle(this.floor, rc.x + rc.w / 2, rc.y + rc.h / 2);
    Toast.show(`${res.room.name}ができた!`, 'good');
    this.pending = null;
    this.tool = null;
    this.sel = { room: res.room };
    this.focus = { x: rc.x + rc.w / 2, y: rc.y + rc.h / 2 };
    this.afterEdit();
  },
  /* 大きさを変える (resize = true) か、場所を動かす */
  reshape(r, rc, resize) {
    if (rc.x === r.x && rc.y === r.y && rc.w === r.w && rc.h === r.h) return;
    const add = Math.max(0, rc.w * rc.h - r.w * r.h) * TILE_COST;
    if (G.money < add) { this.fail(`お金が足りないよ (${yen(add)})`); return; }
    const res = Hotel.setRoomRect(r, rc, false);
    if (res.why) { this.fail(res.why); return; }
    G.money -= add;
    for (const p of R.pets) if (p.g && p.g.roomId === r.id && p.floor === r.floor) { p.x += res.dx; p.y += res.dy; p.stop(); }
    if (resize) G.stats.resized++;
    Sound.play('place');
    if (res.stored) Toast.show(`はみ出した家具 ${res.stored}こを「もちもの」にしまったよ`);
    this.afterEdit();
  },
  resizeBtn(side, dir) {
    const r = this.sel && this.sel.room;
    if (!r) return;
    const rc = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (side === 'w') rc.w += dir; else rc.h += dir;
    this.reshape(r, rc, true);
  },
  nudge(dx, dy) {
    const r = this.sel && this.sel.room;
    if (r) this.reshape(r, { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }, false);
  },
  setHab(hab) {
    const r = this.sel && this.sel.room;
    if (!r || r.hab === hab) return;
    if (!habOpen(hab)) { this.fail(`★${HABITATS[hab].star} になると つくれるよ`); return; }
    const cost = HABITATS[hab].cost;
    if (G.money < cost) { this.fail('お金が足りないよ'); return; }
    G.money -= cost;
    const auto = /\s\d+$/.test(r.name) && Object.values(HABITATS).some((h) => r.name.startsWith(h.room));
    r.hab = hab;
    if (auto) r.name = Hotel.autoName(hab);
    Hotel.rebuild();
    Sound.play('build');
    FX.sparkle(this.floor, r.x + r.w / 2, r.y + r.h / 2);
    this.afterEdit();
  },
  nextDoor() {
    const r = this.sel && this.sel.room;
    if (!r) return;
    const why = Hotel.nextDoor(r);
    if (why) { this.fail(why); return; }
    Sound.play('place');
    this.afterEdit();
  },
  removeRoom() {
    const r = this.sel && this.sel.room;
    if (!r) return;
    const why = Hotel.removeRoom(r);
    if (why) { this.fail(why); return; }
    G.money += Math.floor(HABITATS[r.hab].cost / 2);
    Sound.play('trash');
    this.sel = null;
    this.afterEdit();
  },
  rename(name) {
    const r = this.sel && this.sel.room;
    if (!r) return;
    const n = name.trim().slice(0, 10);
    if (n) { r.name = n; R.layoutV++; }
  },

  /* ------------------------------ 家具 ------------------------------ */
  testFurn(type, tile, fu) {
    const key = ['f', type, this.floor, tile.x, tile.y, fu ? fu.uid : 0, R.layoutV].join(',');
    if (key === this.testKey) return this.testWhy;
    let why;
    if (fu) {
      const o = { floor: fu.floor, x: fu.x, y: fu.y };
      why = Hotel.moveFurn(fu, this.floor, tile.x, tile.y);
      if (!why) { Object.assign(fu, o); Hotel.rebuild(); }
    } else {
      why = Hotel.placeFurn(type, this.floor, tile.x, tile.y);
      if (!why) { G.furn.pop(); G.nextUid--; Hotel.rebuild(); }
    }
    this.testKey = ['f', type, this.floor, tile.x, tile.y, fu ? fu.uid : 0, R.layoutV].join(',');
    this.testWhy = why || null;
    return this.testWhy;
  },
  placeFurn(type, tile) {
    const own = (G.inv[type] || 0) > 0, cost = own ? 0 : FURN[type].cost;
    if (G.money < cost) { this.fail('お金が足りないよ'); return; }
    const why = Hotel.placeFurn(type, this.floor, tile.x, tile.y);
    if (why) { this.fail(why); return; }
    if (own) G.inv[type]--; else G.money -= cost;
    G.stats.furnPlaced++;
    Sound.play('place');
    const d = FURN[type];
    FX.sparkle(this.floor, tile.x + d.w / 2, tile.y + d.h / 2);
    this.lastTap = null;
    this.afterEdit();
  },
  moveFurn(fu, to) {
    if (to.x === fu.x && to.y === fu.y && fu.floor === this.floor) return;
    const why = Hotel.moveFurn(fu, this.floor, to.x, to.y);
    if (why) { this.fail(why); return; }
    Sound.play('place');
    this.sel = { fu };
    this.afterEdit();
  },
  storeFurn() {
    const fu = this.sel && this.sel.fu;
    if (!fu) return;
    const why = Hotel.removeFurn(fu);
    if (why) { this.fail(why); return; }
    Sound.play('trash');
    this.sel = null;
    this.afterEdit();
  },
  sellFurn(type) {
    if (!(G.inv[type] > 0)) return;
    G.inv[type]--;
    G.money += Math.floor(FURN[type].cost / 2);
    Sound.play('coin');
    this.renderBar();
  },

  /* ------------------------------ 建物 ------------------------------ */
  addFloor() {
    if (G.floors >= MAX_FLOORS) return;
    const cost = FLOOR_COST[G.floors];
    if (G.money < cost) { this.fail('お金が足りないよ'); return; }
    G.money -= cost;
    Hotel.addFloor();
    Sound.play('build');
    Toast.show(`${G.floors}階ができた! 階段から行けるよ`, 'good');
    this.setFloor(G.floors - 1);
    this.focus = { x: Hotel.W / 2, y: Hotel.H / 2 };
    this.afterEdit();
  },
  expandLand() {
    const next = LANDS[G.lv + 1];
    if (!next) return;
    if (G.money < next.cost) { this.fail('お金が足りないよ'); return; }
    if (R.visitors.length) { this.fail('受付にお客さんがいる間は工事できないよ'); return; }
    G.money -= next.cost;
    const dh = Hotel.expandLand();
    for (const p of R.pets) { p.y += dh; p.stop(); if (p.g) p.g.y = p.y; }
    R.player.y += dh;
    this.focus.y += dh;
    Sound.play('build');
    Toast.show(`土地が ${next.w}×${next.h} マスに広がった!`, 'good');
    this.afterEdit();
  },

  /* 形が変わったあと、歩けない所にいる人や動物を近くへ動かす */
  afterEdit() {
    this.testKey = '';
    for (const p of R.pets) {
      if (!p.g) continue;
      const room = Hotel.roomById(p.g.roomId);
      if (p.mode === 'room' && room) {
        if (p.floor !== room.floor || Hotel.zone(p.floor, Math.floor(p.x), Math.floor(p.y)) !== room.id || !Hotel.walk(p.floor, Math.floor(p.x), Math.floor(p.y))) {
          const q = Hotel.nearestFree(room.floor, p.x, p.y, room.id);
          p.floor = room.floor; p.x = q.x; p.y = q.y;
        }
        p.stop();
      } else if (p.mode === 'travel') { p.stop(); p.travel(); }
      else if (p.mode === 'leave') { p.stop(); p.leaveRoom(); }
    }
    const pl = R.player;
    const q = Hotel.nearestFree(pl.floor, pl.x, pl.y);
    pl.x = q.x; pl.y = q.y; pl.stop();
    for (const v of R.visitors) {
      if (v.state === 'leave') v.leave();
      else v.goQueue();
    }
    Missions.check();
    this.renderBar();
  },
  fail(why) { Sound.play('error'); Toast.show(why, 'bad'); },

  /* ------------------------------ 帯 ------------------------------ */
  renderBar() { if (this.active) UI.renderEditBar(); },
  act(a, el) {
    const v = el.dataset.v;
    if (a === 'close') this.close();
    else if (a === 'tab') this.setTab(v);
    else if (a === 'roomTool') {
      if (!habOpen(v)) { this.fail(`★${HABITATS[v].star} になると つくれるよ`); return; }
      this.setTool(this.tool && this.tool.hab === v ? null : { kind: 'room', hab: v });
    }
    else if (a === 'build' && this.pending) this.buildRoom(this.pending);
    else if (a === 'cancel') { this.pending = null; this.setTool(null); }
    else if (a === 'hab') this.setHab(v);
    else if (a === 'size') { const [s, d] = v.split(':'); this.resizeBtn(s, +d); }
    else if (a === 'nudge') { const [dx, dy] = v.split(':').map(Number); this.nudge(dx, dy); }
    else if (a === 'door') this.nextDoor();
    else if (a === 'delRoom') this.removeRoom();
    else if (a === 'filter') { this.filter = v; this.tool = null; this.renderBar(); }
    else if (a === 'furnTool') this.setTool(this.tool && this.tool.type === v ? null : { kind: 'furn', type: v });
    else if (a === 'store') this.storeFurn();
    else if (a === 'sell') this.sellFurn(v);
    else if (a === 'addFloor') this.addFloor();
    else if (a === 'land') this.expandLand();
    else if (a === 'unsel') { this.sel = null; this.renderBar(); }
  },

  /* ------------------------------ 表示 ------------------------------ */
  drawOverlay(ctx) {
    const W = Hotel.W, H = Hotel.H, f = this.floor, t = this.tool, d = this.drag;
    ctx.save();
    ctx.strokeStyle = 'rgba(80,110,150,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, H * T); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(0, y * T); ctx.lineTo(W * T, y * T); }
    ctx.stroke();
    const dash = () => { ctx.setLineDash([5, 4]); ctx.lineDashOffset = -R.t * 16; };
    if (t && t.kind === 'room') {
      const lb = Hotel.lobby(f);
      ctx.fillStyle = 'rgba(200,90,90,0.13)'; ctx.fillRect(lb.x * T, lb.y * T, lb.w * T, lb.h * T);
      this.label(ctx, (lb.x + lb.w / 2) * T, (lb.y + 0.9) * T, f === 0 ? '受付まわり' : '階段の前', true, 0.75);
    }
    /* 部屋のプレビュー */
    let rc = null, hab = null, room = null;
    if (d && d.moved && d.rc && d.kind === 'rect') { rc = d.rc; hab = t.hab; }
    else if (d && d.moved && d.rc && (d.kind === 'edge' || d.kind === 'moveRoom')) { rc = d.rc; room = d.room; hab = room.hab; }
    else if (this.pending && t && t.kind === 'room') { rc = this.pending; hab = t.hab; }
    if (rc) {
      const why = room ? this.testReshape(room, rc) : this.testRoom(rc, hab);
      const cost = room ? Math.max(0, rc.w * rc.h - room.w * room.h) * TILE_COST : this.roomCost(rc, hab);
      const lack = G.money < cost;
      ctx.fillStyle = why || lack ? 'rgba(255,90,90,0.3)' : rgba(HABITATS[hab].floor, 0.65);
      ctx.fillRect(rc.x * T, rc.y * T, rc.w * T, rc.h * T);
      ctx.strokeStyle = why || lack ? '#e0504a' : '#3fae6a'; ctx.lineWidth = 3; dash();
      ctx.strokeRect(rc.x * T, rc.y * T, rc.w * T, rc.h * T);
      ctx.setLineDash([]);
      const msg = lack ? `お金が足りないよ (${yen(cost)})` : why || `${rc.w}×${rc.h} マス  ${Math.max(1, Math.floor((rc.w * rc.h) / SLOT_AREA))}ひき分${cost ? '  ' + yen(cost) : ''}`;
      this.label(ctx, (rc.x + rc.w / 2) * T, rc.y * T - 6, msg, !!(why || lack));
    }
    /* えらんだ部屋 */
    const sr = this.sel && this.sel.room;
    if (sr && sr.floor === f && !(d && d.moved && d.room === sr)) {
      ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 3; dash();
      ctx.strokeRect(sr.x * T - 2, sr.y * T - 2, sr.w * T + 4, sr.h * T + 4);
      ctx.setLineDash([]);
      for (const [hx, hy] of [[sr.x, sr.y + sr.h / 2], [sr.x + sr.w, sr.y + sr.h / 2], [sr.x + sr.w / 2, sr.y], [sr.x + sr.w / 2, sr.y + sr.h]]) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 2.5;
        ellipse(ctx, hx * T, hy * T, 7, 7); ctx.fill(); ctx.stroke();
      }
    }
    /* 家具のプレビュー */
    let ft = null, tile = null, mv = null;
    if (t && t.kind === 'furn' && this.hover) { ft = t.type; tile = this.lastTap && UI.touch ? this.lastTap : this.hover; }
    if (d && d.kind === 'furn' && d.moved && d.to) { ft = d.fu.type; tile = d.to; mv = d.fu; }
    if (ft && tile) {
      const fd = FURN[ft];
      const why = this.testFurn(ft, tile, mv);
      const cost = mv || (G.inv[ft] || 0) > 0 ? 0 : fd.cost, lack = G.money < cost;
      ctx.fillStyle = why || lack ? 'rgba(255,90,90,0.35)' : 'rgba(90,210,120,0.35)';
      ctx.fillRect(tile.x * T, tile.y * T, fd.w * T, fd.h * T);
      ctx.globalAlpha = 0.7;
      FurnArt.draw(ctx, ft, tile.x * T, tile.y * T, R.t);
      ctx.globalAlpha = 1;
      const msg = lack ? 'お金が足りないよ' : why || (mv ? 'はなすと置く' : UI.touch ? 'もう一度タップで置く' : 'クリックで置く');
      this.label(ctx, (tile.x + fd.w / 2) * T, tile.y * T - Math.max(8, (VIS_H[ft] || 0) - fd.h * T + 8), msg, !!(why || lack));
    }
    const sf = this.sel && this.sel.fu;
    if (sf && sf.floor === f && !this.dragging(sf)) {
      const fd = FURN[sf.type], top = Math.max(fd.h * T, VIS_H[sf.type] || 0);
      ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 3; dash();
      ctx.strokeRect(sf.x * T - 2, (sf.y + fd.h) * T - top - 2, fd.w * T + 4, top + 4);
      ctx.setLineDash([]);
    }
    ctx.restore();
  },
  label(ctx, x, y, text, bad, alpha = 0.92) {
    ctx.font = `800 11px ${FONT}`;
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = bad ? `rgba(170,40,40,${alpha})` : `rgba(30,110,60,${alpha})`;
    rrect(ctx, x - w / 2, y - 18, w, 18, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 8.5);
    ctx.textBaseline = 'alphabetic';
  },
};
