/* =========================================================================
   NEKO MART ― もようがえ
   家具を買って置く / 動かす / しまう、かべに窓やポスター、看板、ドア、お店を広げる
   もようがえの間は時間が止まる
   ========================================================================= */
'use strict';

const PIC_SIZE = { poster: { w: 120, h: 160 }, sign: { w: 250, h: 100 } };

const Editor = {
  active: false, tool: null, hover: null, sel: null, lastTap: null, testKey: '', testWhy: null,

  open() {
    if (this.active) return;
    this.active = true;
    this.tool = null; this.sel = null; this.hover = null; this.lastTap = null;
    if (R.player.carry) Interact.returnBox();
    UI.showEditBar();
  },
  close() {
    if (!this.active) return;
    this.active = false;
    this.tool = null; this.sel = null; this.hover = null;
    R.layoutV++;
    UI.hideEditBar();
    saveGame();
  },
  setTool(t) {
    this.tool = t; this.sel = null; this.lastTap = null; this.testKey = '';
    UI.renderEditBar();
  },

  /* 画面のどこを指しているか */
  hit(w) {
    const W = Shop.W, H = Shop.H;
    const x = Math.floor(w.x), y = Math.floor(w.y);
    if (w.y < 0 && w.y >= -1.7 && x >= 0 && x < W) return { wall: 'top', x };
    if (y === H && x >= 0 && x < W) return { wall: 'bottom', x };
    if (y === H + 1 && x >= -2 && x <= W + 1) return { side: true, x, y };
    if (Shop.interior(x, y)) return { x, y };
    return null;
  },
  /* 見た目で家具を拾う (背の高い家具は上の方を押しても選べる) */
  furnAtScreen(w) {
    let best = null;
    for (const f of G.furn) {
      const d = FURN[f.type];
      const top = (VIS_H[f.type] || 50) / T;
      if (w.x >= f.x && w.x < f.x + d.w && w.y < f.y + d.h && w.y >= f.y + d.h - top) {
        if (!best || f.y + d.h > best.y + FURN[best.type].h) best = f;
      }
    }
    return best;
  },
  signAt(w) {
    const H = Shop.H;
    return G.signs.find((s) => Math.abs(w.x - (s.x + 0.5)) < 0.85 && w.y > H + 0.5 && w.y < H + 2) || null;
  },

  hoverAt(w) { this.hover = this.hit(w); },

  /* 置けるかどうか (実際に置いてみて、もどす) */
  test(type, x, y, f) {
    const key = [type, x, y, f ? f.uid : 0, G.furn.length].join(',');
    if (key === this.testKey) return this.testWhy;
    this.testKey = key;
    if (f) {
      const ox = f.x, oy = f.y;
      const why = Shop.move(f, x, y);
      if (!why) { f.x = ox; f.y = oy; Shop.rebuild(); }
      this.testWhy = why;
    } else {
      const why = Shop.place(type, x, y);
      if (!why) { G.furn.pop(); G.nextUid--; Shop.rebuild(); }
      this.testWhy = why;
    }
    return this.testWhy;
  },

  tap(w, touch) {
    const h = this.hit(w);
    const t = this.tool;
    const same = h && this.lastTap && h.x === this.lastTap.x && h.y === this.lastTap.y && h.wall === this.lastTap.wall;
    this.hover = h;
    this.lastTap = h;
    if (!t) { this.select(w, h); return; }
    if (!h) return;
    if (touch && !same && (t.kind === 'furn' || t.kind === 'move')) { this.testKey = ''; return; } // 1回目のタップは場所えらび
    if (t.kind === 'furn') {
      if (h.wall || h.side) return;
      const d = FURN[t.type];
      if (G.money < d.cost) { Sound.play('error'); Toast.show('お金が足りないよ', 'bad'); return; }
      const why = Shop.place(t.type, h.x, h.y);
      this.testKey = '';
      if (why) { Sound.play('error'); Toast.show(why, 'bad'); return; }
      G.money -= d.cost;
      Sound.play('place');
      FX.sparkle(h.x + d.w / 2, h.y + 0.5);
      this.lastTap = null;
      Missions.check();
      UI.renderEditBar();
    } else if (t.kind === 'move') {
      if (h.wall || h.side) return;
      const why = Shop.move(t.f, h.x, h.y);
      this.testKey = '';
      if (why) { Sound.play('error'); Toast.show(why, 'bad'); return; }
      Sound.play('place');
      this.setTool(null);
    } else if (t.kind === 'wall') {
      if (!h.wall) return;
      this.putWall(h.wall, h.x, t.type);
    } else if (t.kind === 'door') {
      if (h.wall !== 'bottom') return;
      const why = Shop.moveDoor(h.x);
      if (why) { Sound.play('error'); Toast.show(why, 'bad'); return; }
      Sound.play('place');
      this.setTool(null);
    } else if (t.kind === 'sign') {
      if (!h.side) return;
      this.putSign(h.x);
    }
  },
  select(w, h) {
    const s = this.signAt(w);
    if (s) { this.sel = { sign: s }; UI.renderEditBar(); return; }
    if (h && h.wall) {
      const it = G.walls[h.wall][h.x];
      if (it) { this.sel = { wall: h.wall, x: h.x }; UI.renderEditBar(); return; }
      if (h.wall === 'bottom' && h.x === G.door.x) { this.sel = { door: true }; UI.renderEditBar(); return; }
    }
    const f = this.furnAtScreen(w);
    this.sel = f ? { f } : null;
    UI.renderEditBar();
  },

  putWall(side, x, type) {
    const walls = G.walls[side];
    if (side === 'bottom' && x === G.door.x) { Toast.show('ドアのところには付けられないよ'); return; }
    if (walls[x]) { Toast.show('もう ' + WALLS[walls[x].type].name + ' が付いているよ'); return; }
    const cost = WALLS[type].cost;
    if (G.money < cost) { Sound.play('error'); Toast.show('お金が足りないよ', 'bad'); return; }
    if (type === 'window') {
      walls[x] = { type: 'window' };
      G.money -= cost;
      Sound.play('place');
      Missions.check();
      UI.renderEditBar();
      return;
    }
    UI.choosePic('poster', (pic) => {
      if (walls[x]) return;
      if (G.money < cost) { Toast.show('お金が足りないよ', 'bad'); return; }
      walls[x] = { type: 'poster', pic };
      G.money -= cost;
      Sound.play('place');
      Missions.check();
      UI.renderEditBar();
    });
  },
  putSign(x) {
    if (G.signs.length >= MAX_SIGNS) { Toast.show(`看板は ${MAX_SIGNS} こまで`); return; }
    const cost = WALLS.sign.cost;
    if (G.money < cost) { Sound.play('error'); Toast.show('お金が足りないよ', 'bad'); return; }
    if (G.signs.some((s) => s.x === x)) { Toast.show('もう看板があるよ'); return; }
    UI.choosePic('sign', (pic) => {
      if (G.money < cost) return;
      const why = Shop.placeSign(x, pic);
      if (why) { Sound.play('error'); Toast.show(why, 'bad'); return; }
      G.money -= cost;
      Sound.play('place');
      Missions.check();
      this.setTool(null);
    });
  },
  /* 選んだ物をしまう (半分のお金がもどる) */
  removeSel() {
    const s = this.sel;
    if (!s) return;
    if (s.f) {
      const d = FURN[s.f.type];
      if (d.keep) { Toast.show(d.name + 'はしまえないよ。動かすことはできる'); return; }
      if (s.f.slots) for (const sl of s.f.slots) if (sl.n > 0) G.stock[sl.pid] = (G.stock[sl.pid] || 0) + sl.n;
      G.money += Math.floor(d.cost / 2);
      Shop.remove(s.f);
    } else if (s.wall) {
      const it = G.walls[s.wall][s.x];
      if (it) G.money += Math.floor(WALLS[it.type].cost / 2);
      G.walls[s.wall][s.x] = null;
    } else if (s.sign) {
      G.money += Math.floor(WALLS.sign.cost / 2);
      G.signs = G.signs.filter((x) => x !== s.sign);
      Shop.rebuild();
    }
    Sound.play('trash');
    this.sel = null;
    UI.renderEditBar();
  },
  redrawSel() {
    const s = this.sel;
    const id = s.sign ? s.sign.design : s.wall ? G.walls[s.wall][s.x].pic : null;
    if (id == null) return;
    UI.drawPic(id, () => UI.renderEditBar());
  },
  buyAutoDoor() {
    if (G.door.auto) return;
    const c = WALLS.autodoor.cost;
    if (G.money < c) { Sound.play('error'); Toast.show('お金が足りないよ', 'bad'); return; }
    G.money -= c;
    G.door.auto = true;
    Sound.play('place');
    Toast.show('自動ドアになった!', 'good');
    Missions.check();
    UI.renderEditBar();
  },
  expand() {
    const next = SHOP_SIZES[G.lv + 1];
    if (!next) return;
    if (G.phase !== 'prep') { Toast.show('お店を広げる工事は、開店前のじゅんび中にできるよ'); return; }
    if (G.money < next.cost) { Sound.play('error'); Toast.show('お金が足りないよ', 'bad'); return; }
    G.money -= next.cost;
    Shop.expand();
    G.carry = R.player.carry;
    resetRuntime();
    Render.cam.cx = 0;
    Sound.play('mission');
    Toast.show(`お店が ${next.w}×${next.h} マスに広がった!`, 'good');
    Missions.check();
    UI.renderEditBar();
  },

  /* ------------------------------ 表示 ------------------------------ */
  drawOverlay(ctx) {
    const W = Shop.W, H = Shop.H, t = this.tool, h = this.hover;
    ctx.save();
    ctx.strokeStyle = 'rgba(80,120,160,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, H * T); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(0, y * T); ctx.lineTo(W * T, y * T); }
    ctx.stroke();
    const dash = () => { ctx.setLineDash([4, 4]); ctx.lineDashOffset = -R.t * 16; };
    if (t && (t.kind === 'wall' || t.kind === 'door')) {
      dash();
      ctx.lineWidth = 2;
      for (let x = 0; x < W; x++) {
        if (t.kind === 'wall') {
          ctx.strokeStyle = G.walls.top[x] ? 'rgba(200,80,80,0.5)' : 'rgba(60,140,220,0.8)';
          ctx.strokeRect(x * T + 4, -1.55 * T, T - 8, 1.3 * T);
        }
        if (x === G.door.x) continue;
        ctx.strokeStyle = G.walls.bottom[x] ? 'rgba(200,80,80,0.5)' : 'rgba(60,140,220,0.8)';
        ctx.strokeRect(x * T + 4, H * T + 4, T - 8, T - 8);
      }
    }
    if (t && t.kind === 'sign') {
      dash();
      ctx.lineWidth = 2;
      for (let x = -2; x <= W + 1; x++) {
        ctx.strokeStyle = G.signs.some((s) => s.x === x) || x === G.door.x ? 'rgba(200,80,80,0.5)' : 'rgba(60,140,220,0.8)';
        ctx.strokeRect(x * T + 4, (H + 1) * T + 4, T - 8, T - 8);
      }
    }
    ctx.setLineDash([]);
    if (h && t && (t.kind === 'furn' || t.kind === 'move') && !h.wall && !h.side) {
      const type = t.kind === 'furn' ? t.type : t.f.type;
      const d = FURN[type];
      const why = this.test(type, h.x, h.y, t.kind === 'move' ? t.f : null);
      const lack = t.kind === 'furn' && G.money < d.cost;
      ctx.fillStyle = why || lack ? 'rgba(255,90,90,0.35)' : 'rgba(90,210,120,0.35)';
      ctx.fillRect(h.x * T, h.y * T, d.w * T, d.h * T);
      ctx.globalAlpha = 0.65;
      Render.drawFurn(ctx, Object.assign(Shop.ghost(type), { x: h.x, y: h.y }), false);
      ctx.globalAlpha = 1;
      const msg = lack ? 'お金が足りないよ' : why || (UI.touch ? 'もう一度タップで置く' : 'クリックで置く');
      this.label(ctx, (h.x + d.w / 2) * T, h.y * T - 64, msg, !!(why || lack));
    }
    if (h && h.wall && t && (t.kind === 'wall' || t.kind === 'door')) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      if (h.wall === 'top') ctx.strokeRect(h.x * T + 2, -1.6 * T, T - 4, 1.4 * T);
      else ctx.strokeRect(h.x * T + 2, H * T + 2, T - 4, T - 4);
    }
    if (h && h.side && t && t.kind === 'sign') {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.strokeRect(h.x * T + 2, (H + 1) * T + 2, T - 4, T - 4);
    }
    const s = this.sel;
    if (s) {
      ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 3;
      dash();
      if (s.f) {
        const d = FURN[s.f.type], top = (VIS_H[s.f.type] || 50);
        ctx.strokeRect(s.f.x * T - 2, (s.f.y + d.h) * T - top - 2, d.w * T + 4, top + 4);
      } else if (s.wall) {
        if (s.wall === 'top') ctx.strokeRect(s.x * T + 2, -1.6 * T, T - 4, 1.4 * T);
        else ctx.strokeRect(s.x * T + 2, H * T + 2, T - 4, T - 4);
      } else if (s.sign) ctx.strokeRect(s.sign.x * T - 16, (H + 0.7) * T, T + 32, 1.3 * T);
      else if (s.door) ctx.strokeRect(G.door.x * T + 2, H * T + 2, T - 4, T - 4);
      ctx.setLineDash([]);
    }
    ctx.restore();
  },
  label(ctx, x, y, text, bad) {
    ctx.font = `800 11px ${FONT}`;
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = bad ? 'rgba(170,40,40,0.9)' : 'rgba(30,110,60,0.9)';
    rrect(ctx, x - w / 2, y - 18, w, 18, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 8.5);
  },
};

/* 家具の見た目の高さ (ワールド座標)。もようがえで上の方を押したときに使う */
const VIS_H = { shelf: 66, wagon: 44, fridge: 86, freezer: 58, icecase: 58, register: 50, stock: 76, bench: 42, trash: 44, umbrella: 46, plant: 56, survey: 48 };
