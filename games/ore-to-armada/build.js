/* =========================================================================
   ORE TO ARMADA ― 建てる
   建築モード / 材料 / 置く・外す / 左右対称 / 基地 / 設計図と予定図
   ========================================================================= */
'use strict';

/* 完成品のブロックは 'B:<id>' というアイテムとして貨物に入る */
function itemDef(id) {
  if (ITEMS[id]) return ITEMS[id];
  if (id.startsWith('B:')) {
    const d = BLOCKS[id.slice(2)];
    if (d) return { id, name: d.name + ' (完成品)', kind: 'block', price: Math.round(costValue(d.cost) * TUNE.markup), color: CAT[d.cat].color, block: d.id };
  }
  return { id, name: id, kind: '?', price: 0, color: '#888' };
}

const SLOPE_MIRROR = [1, 0, 3, 2];
const Build = {
  on: false, sel: 'wall', rot: 0, mirror: false, target: null, newBase: null, hover: null, lastCell: null, msgT: 0,

  enter() {
    const p = G.player;
    if (p.dead) return;
    this.on = true; this.target = this.defaultTarget(); this.lastCell = null;
    UI.showBuild(true);
    Sfx.play('ui');
  },
  exit() { this.on = false; this.hover = null; UI.showBuild(false); },
  toggle() { this.on ? this.exit() : this.enter(); },

  defaultTarget() {
    const p = G.player;
    if (p.grid && (p.grid.faction === 'player') && !p.grid.dead) return p.grid;
    const w = personWorld(p);
    return nearestGridTo(w.x, w.y, 12, (g) => g.faction === 'player' && !g.terrain);
  },
  /* 置く場所の基準になるグリッド: カーソルの下の自分のグリッド → いつもの対象 */
  gridAt(wx, wy) {
    const seat = BLOCKS[this.sel] && BLOCKS[this.sel].seat === 'pilot';
    for (const g of S.grids) {
      if (g.dead || g.terrain) continue;
      // 無力化した敵の船と漂流船には、操縦席だけ置ける (奪うため)
      if (g.faction !== 'player' && !(seat && (g.disabled || g.derelict) && g.kind === 'ship' && !g.sys.bioCores.length)) continue;
      if (dist2(g.x, g.y, wx, wy) > (g.radius + 2) ** 2) continue;
      const l = g.toLocal(wx, wy);
      const i = Math.floor(l.x), j = Math.floor(l.y);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (g.occupied(i + di, j + dj)) return g;
    }
    return null;
  },
  reachFrom() {
    const p = G.player, ship = playerShip();
    const w = personWorld(p);
    return { x: w.x, y: w.y, r: ship ? ship.radius + TUNE.buildRange : TUNE.buildRange };
  },

  /* 毎フレーム: カーソルの位置から置く場所を決める */
  update(mouseW) {
    const def = BLOCKS[this.sel];
    const reach = this.reachFrom();
    let g = this.gridAt(mouseW.x, mouseW.y) || (this.target && !this.target.dead ? this.target : null);
    let base = null;
    if (def.anchor) {
      // 大きな小惑星の方眼にそろえる
      const rock = nearestGridTo(mouseW.x, mouseW.y, 30, (o) => o.terrain && o.static);
      if (rock) { g = rock.base && !rock.base.dead ? rock.base : null; base = rock; }
    }
    let frame = g || base;
    let l, i, j;
    if (frame) { l = frame.toLocal(mouseW.x, mouseW.y); i = Math.floor(l.x); j = Math.floor(l.y); }
    else { i = Math.floor(mouseW.x); j = Math.floor(mouseW.y); }
    const [w, h] = Grid.sizeOf(def, this.rot);
    // 大きなブロックはカーソルが真ん中に来るようにずらす
    i -= Math.floor((w - 1) / 2); j -= Math.floor((h - 1) / 2);
    const chk = this.check(def, g, base, i, j, this.rot, reach);
    this.hover = { g, base, i, j, w, h, ok: chk.ok, why: chk.why, def, frame, rot: this.rot };
    if (this.mirror && frame) {
      // 列 0 の真ん中 (x = 0.5) を軸に折り返す
      const mr = def.slope ? SLOPE_MIRROR[this.rot] : (this.rot === 1 ? 3 : this.rot === 3 ? 1 : this.rot);
      const [mw] = Grid.sizeOf(def, mr);
      const mi = 1 - i - mw;
      this.hover.mirror = mi !== i ? { i: mi, j, r: mr, ok: this.check(def, g, base, mi, j, mr, reach).ok } : null;
    } else this.hover.mirror = null;
    // 外すときに狙うブロック
    this.hover.remove = null;
    const rg = this.gridAt(mouseW.x, mouseW.y);
    if (rg) { const q = rg.toLocal(mouseW.x, mouseW.y); const b = rg.at(Math.floor(q.x), Math.floor(q.y)); if (b) this.hover.remove = { g: rg, b }; }
  },

  check(def, g, base, i, j, r, reach) {
    if (!G.unlocked[def.id]) return { ok: false, why: 'この設計図をまだ持っていない' };
    if (def.baseOnly && !(g && g.kind === 'base')) return { ok: false, why: '基地にしか置けない' };
    const frame = g || base;
    const [w, h] = Grid.sizeOf(def, r);
    // 届くか
    const cw = frame ? frame.toWorld(i + w / 2, j + h / 2) : { x: i + w / 2, y: j + h / 2 };
    if (dist(cw.x, cw.y, reach.x, reach.y) > reach.r) return { ok: false, why: '遠すぎる' };
    if (enemyNear(cw.x, cw.y)) return { ok: false, why: '近くに敵がいる' };
    if (g) {
      if (!g.canPlace(def, i, j, r)) return { ok: false, why: 'ふさがっている' };
      if (g.count > 0) {
        let adj = false;
        for (let y = j - 1; y <= j + h && !adj; y++) for (let x = i - 1; x <= i + w && !adj; x++) {
          const inX = x >= i && x < i + w, inY = y >= j && y < j + h;
          if (inX === inY) continue;
          if (g.occupied(x, y) || (g.rockGrid && g.rockGrid.tt(x, y))) adj = true;
        }
        if (!adj) return { ok: false, why: 'ほかのブロックにつなげて置く' };
      }
      // 大きさの上限
      let x0 = i, y0 = j, x1 = i + w, y1 = j + h;
      g.eachBlock((b) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
      const lim = g.kind === 'base' ? TUNE.maxBaseSize : TUNE.maxGridSize;
      if (x1 - x0 > lim || y1 - y0 > lim) return { ok: false, why: `大きさは ${lim}×${lim} マスまで` };
      if (g.rockGrid) for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (g.rockGrid.tt(x, y)) return { ok: false, why: '岩を掘ってから置く' };
    } else if (base) {
      // 基地の最初のブロック (固定アンカー): 岩のとなりの空きマス
      let adj = false;
      for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) { if (base.tt(x, y)) return { ok: false, why: '岩を掘ってから置く' }; }
      for (let y = j - 1; y <= j + h && !adj; y++) for (let x = i - 1; x <= i + w && !adj; x++) if (base.tt(x, y)) adj = true;
      if (!adj) return { ok: false, why: '小惑星の岩のとなりに打ちこむ' };
    }
    // ほかのグリッドと重ならないか
    for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) {
      const p = frame ? frame.toWorld(x + 0.5, y + 0.5) : { x: x + 0.5, y: y + 0.5 };
      for (const o of S.grids) {
        if (o === g || o.dead || o.kind === 'gate' || (base && o === base)) continue;
        if (g && g.rockGrid === o) continue;
        if (dist2(o.x, o.y, p.x, p.y) > (o.radius + 1) ** 2) continue;
        const q = o.toLocal(p.x, p.y);
        if (o.occupied(Math.floor(q.x), Math.floor(q.y))) return { ok: false, why: 'ほかの物と重なる' };
      }
    }
    if (!this.source(def)) return { ok: false, why: '材料が足りない' };
    return { ok: true };
  },

  /* 材料の出どころ: 完成品 → 対象の船の貨物 → 背負いかばん → 近くの自分の船 */
  sources() {
    const p = G.player, out = [];
    const t = this.hover && this.hover.g;
    if (t && t.faction === 'player' && !t.loan) out.push(t);
    out.push(p);
    const w = personWorld(p);
    for (const g of S.grids) if (g.faction === 'player' && !g.terrain && !g.dead && g !== t && dist(g.x, g.y, w.x, w.y) < g.radius + 40) out.push(g);
    return out;
  },
  count(src, id) { return src.isPerson ? invCountP(src, id) : src.invTotal(id); },
  take(src, id, n) { return src.isPerson ? invTakeP(src, id, n) : src.invTake(id, n); },
  source(def) {
    const srcs = this.sources();
    for (const s of srcs) if (this.count(s, 'B:' + def.id) > 0) return { s, item: 'B:' + def.id };
    // 材料は複数の出どころから集めてよい
    for (const k in def.cost) { let have = 0; for (const s of srcs) have += this.count(s, k); if (have < def.cost[k]) return null; }
    return { multi: true };
  },
  pay(def) {
    const src = this.source(def);
    if (!src) return false;
    if (src.item) { this.take(src.s, src.item, 1); return true; }
    const srcs = this.sources();
    for (const k in def.cost) { let need = def.cost[k]; for (const s of srcs) { if (need <= 0) break; need -= this.take(s, k, need); } }
    return true;
  },
  refund(def, g, at) {
    for (const k in def.cost) {
      let n = Math.floor(def.cost[k] * TUNE.refundRate);
      if (n <= 0) continue;
      if (g && !g.dead) n = g.invAdd(k, n);
      if (n > 0) n = invAddP(G.player, k, n);
      if (n > 0) dropPickup(at.x, at.y, { [k]: n }, 'salvage');
    }
  },

  place(h) {
    if (!h || !h.ok) { if (h && h.why && this.msgT <= 0) { Toast.show(h.why, 'bad'); this.msgT = 1; } return false; }
    const def = h.def;
    let g = h.g;
    if (g && g.faction !== 'player') {
      const left = S.persons.filter((o) => o.kind === 'hostile' && o.grid === g && !o.dead).length;
      if (left > 0) { Toast.show(`まだ敵の乗員が ${left}人 残っている`, 'bad'); return false; }
    }
    if (!this.pay(def)) return false;
    let bi = h.i, bj = h.j;
    if (!g) { g = this.newGrid(h); if (!h.base) { bi = 0; bj = 0; } }
    const b = g.addBlock(def.id, bi, bj, h.rot);
    if (!b) return false;
    if (b.charge != null && b.def.cap) b.charge = 0;
    Sfx.play('place', 0.6);
    g.updateMass(); g.updateSys();
    if (g.faction !== 'player') Game.capture(g);
    Quest.event('build', def.id, g);
    if (h.mirror && h.mirror.ok && this.mirror && h.g) {
      const mh = Object.assign({}, h, { i: h.mirror.i, j: h.mirror.j, rot: h.mirror.r, g, mirror: null });
      const chk = this.check(def, g, null, mh.i, mh.j, mh.rot, this.reachFrom());
      if (chk.ok && this.pay(def)) { g.addBlock(def.id, mh.i, mh.j, mh.rot); g.updateMass(); }
    }
    return true;
  },
  newGrid(h) {
    const p = G.player;
    if (h.base) {
      const r = h.base;
      const g = new Grid({ kind: 'base', faction: 'player', name: '小惑星基地 ' + (Fleet.count('base') + 1), static: true });
      g.x = r.x; g.y = r.y; g.a = r.a; g.comX = r.comX; g.comY = r.comY;
      g.rockGrid = r; g.rockId = r.rockIdx; r.base = g;
      g.dirtyMass = false; g.mass = 1e6; g.inertia = 1e9;
      S.grids.push(g);
      Toast.show('小惑星に基地を作った', 'good');
      Quest.event('base', null, g);
      return g;
    }
    const g = new Grid({ kind: 'ship', faction: 'player', name: '新しい船 ' + (Fleet.count('ship') + 1) });
    const w = { x: h.i + h.w / 2, y: h.j + h.h / 2 };
    // 最初のブロックはローカル (0,0) に置くので、その中心がワールドの w に来るようにする
    g.x = w.x; g.y = w.y; g.a = 0; g.comX = h.w / 2; g.comY = h.h / 2; g.dirtyMass = true;
    const ref = nearestGridTo(w.x, w.y, 30);
    if (ref) { const v = ref.velAt(w.x, w.y); g.vx = v.x; g.vy = v.y; }
    S.grids.push(g);
    return g;
  },
  remove(hr) {
    if (!hr) return false;
    const { g, b } = hr;
    if (g.faction !== 'player' || b.def.noBuild) return false;
    if (b.occ) { Toast.show('人が座っている', 'bad'); return false; }
    if (b.def.anchor && g.kind === 'base' && g.sys.anchors.length <= 1) { Toast.show('基地の固定アンカーは外せない', 'bad'); return false; }
    const at = g.blockWorld(b);
    const stash = b.inv && b.used ? b.inv : null;
    g.removeBlock(b);
    if (!g.loan) this.refund(b.def, g, at);
    if (stash) for (const k in stash) { let n = g.invAdd(k, stash[k]); if (n > 0) n = invAddP(G.player, k, n); if (n > 0) dropPickup(at.x, at.y, { [k]: n }, 'salvage'); }
    Sfx.play('remove', 0.6);
    if (g.count === 0) { g.dead = true; }
    return true;
  },

  /* 入力 (建築モード中、ゲーム画面の上で) */
  input(mouseW, dt) {
    this.msgT -= dt;
    this.update(mouseW);
    const h = this.hover;
    if (Input.hit('KeyR')) { this.rot = (this.rot + 1) & 3; Sfx.play('ui', 0.4); }
    if (Input.hit('KeyX')) { this.mirror = !this.mirror; Toast.show(this.mirror ? '左右対称に置く: オン' : '左右対称に置く: オフ'); }
    if (Input.mdown[0]) {
      const key = h.frame ? (h.frame.id + ':' + h.i + ',' + h.j) : (h.i + ',' + h.j);
      if (key !== this.lastCell) { this.lastCell = key; this.place(h); }
    } else if (Input.mdown[2]) {
      const key = 'r' + (h.remove ? h.remove.g.id + ':' + h.remove.b.i : '');
      if (key !== this.lastCell) { this.lastCell = key; this.remove(h.remove); }
    } else this.lastCell = null;
  },
};

function enemyNear(x, y) {
  for (const g of S.grids) {
    if (g.dead || g.disabled || g.terrain || !hostile('player', g.faction) || g.faction === 'derelict') continue;
    if (dist2(g.x, g.y, x, y) < 150 * 150) return true;
  }
  return false;
}

/* ---------- 設計図 ---------- */
const Blueprints = {
  save(g, name) {
    const bp = gridToBlueprint(g, name || g.name);
    G.blueprints.push(bp);
    Toast.show(`設計図「${bp.name}」を保存した`, 'good');
    return bp;
  },
  /* 予定図として今の船に重ねる。操縦席の位置で合わせる */
  overlay(g, bp) {
    const seat = (list) => list.find(([id]) => BLOCKS[id].seat === 'pilot');
    const bs = seat(bp.blocks);
    g.updateSys();
    const gs = g.sys.pilotSeats[0];
    let ox = 0, oy = 0;
    if (bs && gs) { ox = gs.x - bs[1]; oy = gs.y - bs[2]; }
    else { let x0 = Infinity, y0 = Infinity; g.eachBlock((b) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); }); ox = x0; oy = y0; }
    const plan = [];
    for (const [id, x, y, r] of bp.blocks) {
      const b = g.at(x + ox, y + oy);
      if (b && b.def.id === id && b.x === x + ox && b.y === y + oy && b.r === r) continue;
      plan.push([id, x + ox, y + oy, r]);
    }
    g.plan = plan;
    Toast.show(`予定図を重ねた (${plan.length} ブロック)。溶接機か技師で建てる`, 'good');
  },
  /* 予定図のブロックを1つ建てる (溶接機・技師)。建てたら true */
  buildPlanAt(g, i, j, payer) {
    if (!g.plan || !g.plan.length) return false;
    const k = g.plan.findIndex(([id, x, y, r]) => { const [w, h] = Grid.sizeOf(BLOCKS[id], r); return i >= x && i < x + w && j >= y && j < y + h; });
    if (k < 0) return false;
    const [id, x, y, r] = g.plan[k];
    const def = BLOCKS[id];
    if (!g.canPlace(def, x, y, r)) { return false; }
    const srcs = payer && payer.isPerson ? [g, payer] : [g];
    for (const c in def.cost) { let have = 0; for (const s of srcs) have += s.isPerson ? invCountP(s, c) : s.invTotal(c); if (have < def.cost[c]) return false; }
    for (const c in def.cost) { let need = def.cost[c]; for (const s of srcs) { if (need <= 0) break; need -= s.isPerson ? invTakeP(s, c, need) : s.invTake(c, need); } }
    g.addBlock(id, x, y, r);
    g.plan.splice(k, 1);
    if (!g.plan.length) { g.plan = null; if (g.faction === 'player') Toast.show('予定図のブロックを全部建てた', 'good'); }
    return true;
  },
};
