/* =========================================================================
   ORE TO ARMADA ― 持ち船と艦隊
   一覧 / 命令と自動操縦 / ドッキング・着艦・発進 / ゲートとジャンプ / 船を捨てる
   ========================================================================= */
'use strict';

const ORDERS = {
  follow: 'ついてこい', attack: '攻撃', guard: '守れ', mine: '採掘', wait: '待機', return: '帰還',
};

const Fleet = {
  /* いまの星系とほかの星系の持ち船・基地 */
  all() {
    const out = [];
    for (const g of S.grids) if (g.faction === 'player' && !g.dead && !g.terrain && (g.kind === 'ship' || g.kind === 'base')) out.push({ g, sys: S.sys.id, here: true, kind: g.kind });
    for (const id in G.sysState) {
      if (+id === S.sys.id) continue;
      for (const o of G.sysState[id].grids || []) if (o.faction === 'player' && (o.kind === 'ship' || o.kind === 'base')) out.push({ o, sys: +id, here: false, kind: o.kind });
    }
    return out;
  },
  count(kind) { return this.all().filter((e) => e.kind === kind && !(e.g && e.g.loan) && !(e.o && e.o.loan)).length; },
  ownsShip() { return this.all().some((e) => e.kind === 'ship'); },
  canAct(g) { return !!(g.crewPilot || (g.sys && g.sys.aicore)); },
  setOrder(g, type, extra = {}) {
    g.order = Object.assign({ type }, extra);
    Toast.show(`${g.name} に「${ORDERS[type]}」を命じた` + (this.canAct(g) ? '' : '。ただし操縦士かAIコアがいないと動けない'), this.canAct(g) ? '' : 'bad');
  },

  /* ---------- 自動操縦 ---------- */
  steer(g, tx, ty, tvx, tvy, face, maxSpd = 30) {
    const c = g.ctrl;
    const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
    const spd = Math.min(maxSpd, d * 0.35);
    const vx = (d > 0.5 ? dx / d * spd : 0) + tvx, vy = (d > 0.5 ? dy / d * spd : 0) + tvy;
    const l = g.vecToLocal(vx - g.vx, vy - g.vy);
    c.mx = clamp(l.x * 0.4, -1, 1); c.my = clamp(l.y * 0.4, -1, 1);
    if (Math.abs(c.mx) < 0.04) c.mx = 0; if (Math.abs(c.my) < 0.04) c.my = 0;
    c.face = face; c.assist = true;
    return d;
  },
  ai(g, dt) {
    const c = g.ctrl;
    c.mx = 0; c.my = 0; c.rot = 0; c.face = null; c.assist = true; g.fireFixed = false;
    if (g.dockedTo || g.kind !== 'ship' || g.abandoned) return;
    if (!this.canAct(g)) return;
    const o = g.order || { type: 'wait' };
    const lead = playerShip() || (G.player.grid && G.player.grid.faction === 'player' ? G.player.grid : null);
    // 惑星の地上と宇宙は別の場所。ついていく相手・守る相手・帰る先が別の場所にいるときは、その場で待つ
    const here = Planet.zone(g.x, g.y), away = (x) => x && Planet.zone(x.x, x.y) !== here;
    if (o.type === 'follow' && away(lead)) return;
    if (o.type === 'follow') {
      if (!lead || lead === g || lead.dockedTo === g) return;
      const followers = S.grids.filter((x) => x.faction === 'player' && x.order && x.order.type === 'follow' && !x.dockedTo && x !== lead);
      const k = followers.indexOf(g);
      const side = k % 2 ? 1 : -1, row = Math.floor(k / 2) + 1;
      const off = lead.vecToWorld(side * (lead.radius + g.radius + 4) * 0.8, row * (lead.radius + g.radius + 6));
      this.steer(g, lead.x + off.x, lead.y + off.y, lead.vx, lead.vy, lead.a);
      return;
    }
    if (o.type === 'attack' || o.type === 'guard') {
      let t = o.type === 'attack' ? S.grids.find((x) => x.id === o.targetId && !x.dead && !x.disabled) : null;
      const anchor = o.type === 'guard' ? S.grids.find((x) => x.id === o.targetId && !x.dead) || lead : null;
      if (away(anchor)) return;
      if (!t) { let bd = 200 * 200; const ref = anchor || g; for (const x of S.grids) if (!x.dead && !x.disabled && !x.terrain && hostile('player', x.faction) && x.faction !== 'derelict') { const d = dist2(x.x, x.y, ref.x, ref.y); if (d < bd) { bd = d; t = x; } } }
      if (t) {
        g.target = t;
        const d = dist(t.x, t.y, g.x, g.y), a = Math.atan2(t.y - g.y, t.x - g.x);
        const R = 40 + t.radius;
        const px = t.x - Math.cos(a + 0.6) * R, py = t.y - Math.sin(a + 0.6) * R;
        this.steer(g, px, py, t.vx, t.vy, a + Math.PI / 2);
        g.fireFixed = d < 120 && Math.abs(angNorm(a + Math.PI / 2 - g.a)) < 0.25;
      } else if (anchor) this.steer(g, anchor.x + 30, anchor.y + 30, anchor.vx, anchor.vy, anchor.a);
      else if (o.type === 'attack') g.order = { type: 'follow' };
      return;
    }
    if (o.type === 'mine') { this.mineAI(g, dt, o); return; }
    if (o.type === 'return') {
      const home = S.grids.find((x) => x.id === o.targetId && !x.dead);
      if (!home || away(home)) { g.order = { type: 'wait' }; return; }
      const hangar = home.sys && home.sys.hangars ? this.hangarSpot(home, g) : null;
      if (hangar) {
        const d = this.steer(g, hangar.x, hangar.y, home.vx, home.vy, home.a, 14);
        if (d < 1.5 && this.canLand(g, home)) { this.dock(g, home, true); g.order = { type: "wait" }; }
      } else {
        const d = this.steer(g, home.x + home.radius + g.radius + 6, home.y, home.vx, home.vy, home.a);
        if (d < 5) g.order = { type: 'wait' };
      }
      return;
    }
    // 待機: その場で止まる (飛行アシストが止める)
  },
  mineAI(g, dt, o) {
    g.updateSys();
    const free = g.invFree(), cap = g.invCap();
    if (!o.state) o.state = 'go';
    if (o.state === 'go' && cap > 0 && free < cap * 0.05) o.state = 'unload';
    if (o.state === 'unload') {
      const home = S.grids.find((x) => x.id === o.homeId && !x.dead);
      if (!home || Planet.zone(home.x, home.y) !== Planet.zone(g.x, g.y)) { o.state = 'full'; return; }
      const d = this.steer(g, home.x + home.radius + g.radius + 4, home.y, 0, 0, g.a);
      if (d < home.radius + g.radius + 25) {
        const inv = g.invAll();
        for (const k in inv) if (itemDef(k).kind === 'ore' || itemDef(k).kind === 'mat') { const n = g.invTake(k, inv[k]); const rest = home.invAdd(k, n); if (rest > 0) g.invAdd(k, rest); }
        o.state = 'go'; g.mineCell = null;
      }
      return;
    }
    if (o.state === 'full') { if (free > cap * 0.2) o.state = 'go'; return; }
    // 鉱脈を探して向かう
    if (!g.mineCell || !g.mineRock || g.mineRock.dead || !S.asteroids.includes(g.mineRock) || !g.mineRock.tt(g.mineCell[0], g.mineCell[1])) {
      g.mineCell = null; g.mineRock = null;
      let best = null, bd = 1e12;
      for (const a of S.asteroids) {
        if (dist2(a.x, a.y, o.x, o.y) > 250 * 250) continue;
        for (let y = 0; y < a.h; y += 1) for (let x = 0; x < a.w; x += 1) {
          const t = a.cells[y * a.w + x];
          if (!t || !TERRAIN[t].ore) continue;
          const i = x + a.minX, j = y + a.minY;
          if (o.skip && o.skip.includes(a.rockIdx + ':' + i + ',' + j)) continue;
          // 表面に出ている鉱脈を先に狙う (岩の奥は届かないことがある)
          const exposed = !a.tt(i - 1, j) || !a.tt(i + 1, j) || !a.tt(i, j - 1) || !a.tt(i, j + 1);
          const w = a.toWorld(i + 0.5, j + 0.5), d = dist2(w.x, w.y, g.x, g.y) * (exposed ? 1 : 6);
          if (d < bd) { bd = d; best = { a, i, j }; }
        }
      }
      if (!best) { this.steer(g, o.x, o.y, 0, 0, g.a); return; }
      g.mineRock = best.a; g.mineCell = [best.i, best.j];
    }
    // しばらく何も掘れなければ、その鉱脈はあきらめて別のを狙う
    const used = g.invUsed();
    if (g.fireFixed && used === o.lastUsed) o.stuck = (o.stuck || 0) + dt; else o.stuck = 0;
    o.lastUsed = used;
    if (o.stuck > 10) { o.skip = (o.skip || []).concat(g.mineRock.rockIdx + ':' + g.mineCell[0] + ',' + g.mineCell[1]).slice(-30); g.mineCell = null; o.stuck = 0; return; }
    const w = g.mineRock.toWorld(g.mineCell[0] + 0.5, g.mineCell[1] + 0.5);
    const ang = Math.atan2(w.y - g.y, w.x - g.x);
    // 採掘レーザーがあれば離れて撃つ。ドリルだけなら、ドリルの先が鉱脈のマスに入るところへ寄る
    const hasLaser = g.sys.fixed.some((b) => b.def.weapon === 'mine');
    if (!hasLaser && g.sys.drills.length) {
      const b = g.sys.drills[0];
      const tx = b.x + 0.5 + DIRS[b.r][0] * 1.05 - g.comX, ty = b.y + 0.5 + DIRS[b.r][1] * 1.05 - g.comY;
      const face = ang - Math.atan2(DIRS[b.r][1], DIRS[b.r][0]);
      const c = Math.cos(face), sn = Math.sin(face);
      const px = w.x - (c * tx - sn * ty), py = w.y - (sn * tx + c * ty);
      const dd = this.steer(g, px, py, 0, 0, face, 8);
      g.fireFixed = dd < 2.5 && Math.abs(angNorm(face - g.a)) < 0.2;
      return;
    }
    const stand = g.radius + 7;
    const d = dist(w.x, w.y, g.x, g.y);
    const tx = w.x - Math.cos(ang) * stand, ty = w.y - Math.sin(ang) * stand;
    this.steer(g, tx, ty, 0, 0, ang + Math.PI / 2, 20);
    const aligned = Math.abs(angNorm(ang + Math.PI / 2 - g.a)) < 0.12;
    g.fireFixed = aligned && d < stand + 12;

  },

  /* ---------- ドッキング・着艦・発進 ---------- */
  connectorPair(g) {
    g.updateSys();
    for (const b of g.sys.connectors) {
      const p = g.blockWorld(b);
      for (const o of S.grids) {
        if (o === g || o.dead || o.terrain || !o.sys || !o.sys.connectors.length || (o.faction !== 'player' && o.kind !== 'station')) continue;
        if (o.dockedTo === g || g.dockedTo === o || o.dockedTo || g.dockedTo) continue;
        if (dist2(o.x, o.y, p.x, p.y) > (o.radius + 3) ** 2) continue;
        for (const ob of o.sys.connectors) { const q = o.blockWorld(ob); if (dist2(p.x, p.y, q.x, q.y) < 2.4 * 2.4) return { o, b, ob }; }
      }
    }
    return null;
  },
  canLand(g, carrier) {
    if (!carrier.sys || !carrier.sys.hangars || carrier.mass < g.mass * 1.5) return false;
    let on = 0, n = 0;
    g.eachBlock((b) => { n++; const w = g.blockWorld(b); const l = carrier.toLocal(w.x, w.y); const cb = carrier.at(Math.floor(l.x), Math.floor(l.y)); if (cb && cb.def.hangar) on++; });
    return n > 0 && on / n >= 0.7;
  },
  hangarSpot(carrier, g) {
    const cells = [];
    carrier.eachBlock((b) => { if (b.def.hangar) cells.push(b); });
    if (!cells.length) return null;
    let sx = 0, sy = 0; for (const b of cells) { sx += b.x + 0.5; sy += b.y + 0.5; }
    return carrier.toWorld(sx / cells.length, sy / cells.length);
  },
  landingCarrier(g) {
    for (const o of S.grids) if (o !== g && o.faction === 'player' && !o.dead && o.sys && o.sys.hangars && dist(o.x, o.y, g.x, g.y) < o.radius && this.canLand(g, o)) return o;
    return null;
  },
  dock(child, parent, landed) {
    for (let p = parent; p; p = p.dockedTo) if (p === child) return;
    child.dockedTo = parent;
    const l = parent.toLocal(child.x, child.y);
    child.dockRel = { x: l.x, y: l.y, a: child.a - parent.a };
    child.landed = !!landed;
    child.vx = parent.vx; child.vy = parent.vy; child.va = parent.va;
    Sfx.play('door');
    Toast.show(landed ? `${child.name} が ${parent.name} に着艦した` : `${child.name} と ${parent.name} をつないだ`, 'good');
  },
  undock(child, launch) {
    const p = child.dockedTo;
    if (!p) return;
    child.dockedTo = null; child.dockRel = null;
    child.vx = p.vx; child.vy = p.vy; child.va = 0;
    if (launch && p.sys && p.sys.catapults.length) {
      const cat = p.sys.catapults[0];
      const dir = p.vecToWorld(DIRS[cat.r][0], DIRS[cat.r][1]);
      child.vx += dir.x * 30; child.vy += dir.y * 30;
      child.noCollide = p.id; setTimeout(() => { if (child.noCollide === p.id) child.noCollide = null; }, 2500);
      Sfx.play('missile', 0.7); shake(0.3);
      Toast.show(`${child.name} を打ち出した`, 'good');
    } else {
      const a = Math.atan2(child.y - p.y, child.x - p.x);
      child.vx += Math.cos(a) * 3; child.vy += Math.sin(a) * 3;
      if (child.landed) { child.noCollide = p.id; setTimeout(() => { if (child.noCollide === p.id) child.noCollide = null; }, 4000); }
      Toast.show(`${child.name} を切り離した`);
    }
    child.landed = false;
  },
  relink() {
    for (const g of S.grids) if (g.dockedToId) { const p = S.grids.find((o) => o.id === g.dockedToId); if (p) { g.dockedTo = p; g.landed = true; } g.dockedToId = null; }
  },

  /* ---------- 船を捨てる ---------- */
  abandon(g, how) {
    const pl = G.player;
    if (how === 'scrap' && !g.loan) {
      const near = (S.station && dist(S.station.x, S.station.y, g.x, g.y) < 200) || S.grids.some((o) => o.kind === 'base' && o.faction === 'player' && dist(o.x, o.y, g.x, g.y) < 200);
      if (!near) { Toast.show('解体はステーションか基地の近くでだけできる', 'bad'); return; }
    }
    if (pl.grid === g) { if (pl.seat) standUp(pl); if (pl.mode === 'walk') { const w = personWorld(pl); pl.mode = 'eva'; pl.grid = null; pl.x = w.x; pl.y = w.y; pl.vx = g.vx; pl.vy = g.vy; } }
    this.evacuate(g);
    if (how === 'leave') {
      if (g.loan) { g.dead = true; G.loanOut = false; Toast.show('借りた採掘艇を返した'); return; }
      g.abandoned = true; g.order = null;
      Toast.show(`${g.name} を乗り捨てた。あとで操縦席に座れば戻る`);
    } else if (how === 'scrap') {
      if (g.loan) { g.dead = true; G.loanOut = false; Toast.show('借りた採掘艇を返した'); return; }
      const got = {};
      g.eachBlock((b) => { for (const k in b.def.cost) got[k] = (got[k] || 0) + b.def.cost[k] * TUNE.refundRate; });
      const inv = g.invAll(); for (const k in inv) got[k] = (got[k] || 0) + inv[k];
      const dest = S.grids.find((o) => o.faction === 'player' && o !== g && !o.dead && !o.terrain && o.invCap() > 0 && dist(o.x, o.y, g.x, g.y) < 300);
      let cash = 0;
      for (const k in got) { let n = Math.floor(got[k]); if (dest) n = dest.invAdd(k, n); cash += n * itemDef(k).price * 0.5; }
      g.dead = true;
      if (cash > 0) Econ.earn(Math.round(cash), '入りきらなかった材料を売った');
      Toast.show(`${g.name} を解体した` + (dest ? `。材料は ${dest.name} に積んだ` : ''), 'good');
    } else if (how === 'boom') {
      g.selfDestruct = 10;
      Toast.show(`${g.name} の自爆装置が動いた。10秒で爆発する`, 'bad');
      Sfx.play('alarm');
    }
  },
  evacuate(g) {
    const aboard = G.crew.filter((c) => c.grid === g);
    if (!aboard.length) return;
    const other = S.grids.find((o) => o !== g && o.faction === 'player' && !o.dead && !o.terrain && !o.abandoned && o.count > 3);
    g.updateSys();
    let podSeats = g.sys.pods.reduce((t, b) => t + b.def.pod, 0);
    for (const c of aboard) {
      if (c.seat) standUp(c);
      if (other) { Crew.board(c, other); c.gridId = other.id; continue; }
      if (podSeats > 0) { podSeats--; c.inPod = true; c.grid = null; c.gridId = null; S.persons = S.persons.filter((x) => x !== c); continue; }
      const a = Math.random() * TAU; c.mode = 'eva'; c.grid = null; c.gridId = null; c.att = null; c.x = g.x + Math.cos(a) * (g.radius + 3); c.y = g.y + Math.sin(a) * (g.radius + 3); c.vx = g.vx + Math.cos(a) * 2; c.vy = g.vy + Math.sin(a) * 2;
    }
    const pods = aboard.filter((c) => c.inPod).length;
    if (other) Toast.show(`乗員は ${other.name} へ移った`);
    else if (pods) Toast.show(`${pods}人が脱出ポッドで逃げた。次に乗る船で合流する`);
    else Toast.show('乗員が宇宙服で外へ出た。3分以内に拾おう', 'bad');
  },
  /* 脱出ポッドで逃げた乗員は、主人公が次に操縦する船に合流する */
  rejoinPods(g) {
    for (const c of G.crew) if (c.inPod) { c.inPod = false; Crew.board(c, g); }
  },
  tickSelfDestruct(dt) {
    for (const g of S.grids) {
      if (g.selfDestruct == null || g.dead) continue;
      g.selfDestruct -= dt;
      if (g.selfDestruct <= 0) {
        g.selfDestruct = null;
        const pts = []; g.eachBlock((b) => pts.push(g.blockWorld(b)));
        for (let k = 0; k < Math.min(8, pts.length); k++) { const p = pts[(Math.random() * pts.length) | 0]; explode(p.x, p.y, 4, 300, g, 'player'); }
        g.eachBlock((b) => { if (Math.random() < 0.6) destroyBlock(g, b, g, true); });
        g.faction = null; g.kind = 'debris';
      }
    }
  },

  /* ---------- ゲートとジャンプ ---------- */
  jumpCost(g) { return Math.round(100 + g.mass * 0.2); },
  h2Now(g) { g.updateSys(); g.h2 = g.sys.tanks.reduce((t, b) => t + b.h2, 0); return g.h2; },
  travel(toId, how) {
    const lead = playerShip();
    if (!lead) return;
    const from = S.sys.id;
    const group = [lead];
    const left = [];
    let fee = 0;
    for (const g of S.grids) {
      if (g === lead || g.faction !== 'player' || g.kind !== 'ship' || g.dead || g.dockedTo || g.abandoned) continue;
      if (!g.order || g.order.type !== 'follow' || dist(g.x, g.y, lead.x, lead.y) > 400) continue;
      if (how === 'jump') { g.updateSys(); if (!g.sys.jumps.length || this.h2Now(g) < this.jumpCost(g)) { left.push(g); continue; } Ship.takeH2(g, this.jumpCost(g)); }
      else fee += 50;
      group.push(g);
    }
    for (const g of S.grids) if (g.dockedTo && group.includes(g.dockedTo)) group.push(g);
    if (how === 'gate') { if (G.credits < 50 + fee) { Toast.show(`通行料 ${50 + fee} ₵ が足りない`, 'bad'); return; } G.credits -= 50 + fee; }
    const offs = group.map((g) => ({ dx: g.x - lead.x, dy: g.y - lead.y }));
    // 出撃中の無人機はベイに戻す
    for (const d of S.drones) if (d.bay && group.includes(d.owner)) { d.bay.drones++; d.bay.out = Math.max(0, (d.bay.out || 1) - 1); }
    S.drones = S.drones.filter((d) => !group.includes(d.owner));
    const crew = G.crew.filter((c) => c.grid && group.includes(c.grid));
    const seat = { x: G.player.seat.x, y: G.player.seat.y };
    for (const c of crew) { if (c.seat) { c.seat.occ = null; c.seat = null; } c.mode = 'walk'; c.gridId = c.grid.id; c.path = null; c.jobKey = null; c.traveling = true; }
    const saved = group.map((g) => gridToSave(g));
    G.player.seat.occ = null;
    S.grids = S.grids.filter((g) => !group.includes(g));
    S.persons = S.persons.filter((p) => !crew.includes(p));
    Sector.save();
    // 移る乗員は、星系を組み立てたあとで乗せる (二重に数えないように)
    for (const c of crew) c.sysId = -1;
    Sector.build(toId, how, from);
    const ap = arrivalPoint(S.sys, G.galaxy, from, how);
    const made = saved.map((o, k) => { const g = gridFromSave(o); g.x = ap.x + offs[k].dx; g.y = ap.y + offs[k].dy; g.vx = 0; g.vy = 0; g.va = 0; S.grids.push(g); return g; });
    for (const g of made) if (g.savedRooms) restoreRooms(g);
    this.relink();
    for (const c of crew) {
      c.sysId = toId; c.traveling = false;
      c.grid = S.grids.find((g) => g.id === c.gridId) || null;
      if (!c.grid) continue;
      const b = c.grid.at(Math.floor(c.lx), Math.floor(c.ly));
      if (!b || !b.def.walk) Crew.board(c, c.grid);
      else if (!S.persons.includes(c)) S.persons.push(c);
    }
    const ng = made[0];
    const sb = ng.at(seat.x, seat.y);
    G.player.grid = ng; G.player.mode = 'walk';
    if (sb) sitDown(G.player, ng, sb);
    Sfx.play('jump'); UI.flash();
    Toast.show(`${S.sys.name} (${RINGS[S.sys.ring].name}) に着いた`, 'good');
    if (left.length) Toast.show(`ジャンプできずに残った船: ${left.map((g) => g.name).join('、')}`, 'bad');
    Quest.event(how === 'gate' ? 'gate' : 'jump', S.sys.ring);
    Quest.event('ring', S.sys.ring);
    Quest.checkState();
    Save.write(true);
  },
  startJump(toId) {
    const g = playerShip();
    if (!g) return;
    g.updateSys();
    if (!g.sys.jumps.length) { Toast.show('この船にはジャンプドライブがない', 'bad'); return; }
    const need = this.jumpCost(g);
    if (this.h2Now(g) < need) { Toast.show(`水素が ${need} いる (今は ${Math.floor(g.h2)})`, 'bad'); return; }
    g.jump = { to: toId, t: 30 };
    Toast.show(`ジャンプドライブを充電している… 30秒で ${G.galaxy.systems[toId].name} へ跳ぶ`);
  },
  tickJump(dt) {
    const g = playerShip();
    for (const o of S.grids) if (o.jump && o !== g) o.jump = null;
    if (!g || !g.jump) return;
    g.jump.t -= dt;
    if (g.jump.t <= 0) {
      const to = g.jump.to; g.jump = null;
      if (this.h2Now(g) < this.jumpCost(g)) { Toast.show('水素が足りずにジャンプできなかった', 'bad'); return; }
      Ship.takeH2(g, this.jumpCost(g));
      this.travel(to, 'jump');
    }
  },
};
