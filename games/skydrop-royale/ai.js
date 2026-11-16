/* =========================================================================
   SKYDROP ROYALE ― コンピューターの うごき
   さがす → ひろう → たたかう → ゾーンへ にげる
   ========================================================================= */
'use strict';

const CAT_VALUE = { ar: 62, smg: 56, shotgun: 60, sniper: 50, lmg: 52, launcher: 46, energy: 55, element: 36, bow: 42, throw: 26, melee: 22, toy: 16, utility: 10, pistol: 40 };

const AI = {
  itemValue(it) {
    if (!it) return 0;
    if (it.kind === 'h') return { medkit: 45, bigsh: 50, smallsh: 38, bandage: 30, mixjuice: 40, supersoda: 70 }[it.id] || 30;
    if (it.kind !== 'w') return 0;
    const w = WEAPONS[it.id];
    return (CAT_VALUE[w.cat] || 20) + it.r * 12;
  },
  inSmoke(x, y) {
    for (const f of Game.fx) if (f.type === 'smoke' && !f.dead && dist2(f.x, f.y, x, y) < f.r * f.r) return true;
    return false;
  },
  canSee(p, q, d2) {
    if (World.inBush(q.x, q.y) && d2 > 130 * 130 && Game.t - (q.noiseT || -9) > 1) return false;
    if ((this.inSmoke(q.x, q.y) || this.inSmoke(p.x, p.y)) && d2 > 90 * 90) return false;
    return World.los(p.x, p.y, q.x, q.y);
  },

  think(p, dt) {
    const ai = p.ai;
    ai.release = false;
    ai.think -= dt;
    if (ai.think <= 0) { ai.think = 0.2 + Math.random() * 0.12; this.decide(p); }
    this.act(p, dt);
  },

  decide(p) {
    const ai = p.ai, diff = Game.diff;
    const sight = 600 + diff * 90;
    // てきを さがす
    let best = null, bd = sight * sight;
    for (const q of Game.near(p.x, p.y, sight)) {
      if (q === p || !q.alive || q.air) continue;
      const d2 = dist2(p.x, p.y, q.x, q.y);
      if (d2 >= bd) continue;
      if (!this.canSee(p, q, d2)) continue;
      bd = d2; best = q;
    }
    ai.vis = !!best;
    if (!best && ai.hurtBy && ai.hurtBy.alive && Game.t - ai.hurtT < 2.5) best = ai.hurtBy;
    if (best !== ai.target) { ai.target = best; ai.react = Game.t + [0.9, 0.6, 0.35][diff]; }
    if (ai.target && !ai.target.alive) ai.target = null;

    // ゾーン
    const z = Game.zone;
    ai.needZone = false;
    if (z && z.state !== 'done') {
      const out = dist(p.x, p.y, z.x, z.y) > z.r - 60;
      const soon = dist(p.x, p.y, z.tx, z.ty) > z.tr * 0.85 && (z.state === 'shrink' || z.t > z.wait * 0.35);
      if (out || soon) { ai.needZone = true; ai.zoneGoal = { x: z.tx + rand(-0.4, 0.4) * z.tr, y: z.ty + rand(-0.4, 0.4) * z.tr }; }
    }

    // うごきかたを きめる
    const tgt = ai.target;
    const td = tgt ? dist(p.x, p.y, tgt.x, tgt.y) : 1e9;
    const healSlot = p.inv.findIndex((s) => s && s.kind === 'h' && this.healUseful(p, s));
    if (healSlot >= 0 && p.hp + p.sh < 70 && (!tgt || td > 450 || !ai.vis)) { ai.mode = 'heal'; ai.healSlot = healSlot; }
    else if (tgt && (!this.armed(p) || Game.t - (p.landT || 0) < 8) && !(td < 70 && Game.t - (ai.hurtT || -9) < 1) && this.findLoot(p)) { /* ぶきが ないうち・おりたてのうちは ひろいに いく */ }
    else if (tgt && !this.armed(p) && td > 70) { ai.mode = 'wander'; ai.goal = { x: p.x + (p.x - tgt.x) * 2, y: p.y + (p.y - tgt.y) * 2 }; }
    else if (tgt && (td < sight || Game.t - ai.hurtT < 2.5)) { ai.mode = 'fight'; this.pickWeapon(p, td); }
    else if (ai.needZone) { ai.mode = 'zone'; ai.goal = ai.zoneGoal; ai.goalLoot = null; ai.goalChest = null; }
    else if (!this.findLoot(p)) {
      if (p.mats.wood < 80 && Math.random() < 0.6 && this.findHarvest(p)) ai.mode = 'harvest';
      else if (ai.mode !== 'wander' || !ai.goal || dist(p.x, p.y, ai.goal.x, ai.goal.y) < 60) {
        ai.mode = 'wander';
        const zz = Game.zone;
        const cx = zz ? zz.tx : p.x, cy = zz ? zz.ty : p.y, r = zz ? Math.min(zz.tr, 900) : 600;
        ai.goal = { x: clamp(cx + rand(-r, r), 200, WORLD_W - 200), y: clamp(cy + rand(-r, r), 200, WORLD_H - 200) };
      }
    }
    // かべを たてる
    if (ai.mode === 'fight' && diff >= 1 && Game.t - (ai.hurtT || -9) < 0.5 && td > 140 && p.mats.wood >= 10 && Math.random() < 0.18 * diff && Game.t > (ai.buildT || 0)) {
      ai.buildT = Game.t + 2.5;
      const keep = p.aim;
      p.aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      p.shape = p.mats.wood >= 30 ? 1 : 0; p.matSel = 0;
      Game.tryBuild(p);
      p.aim = keep;
    }
    // ひっかかり
    if (ai.lastX !== undefined && Game.t - (ai.lastT || 0) > 1) {
      const moved = dist(p.x, p.y, ai.lastX, ai.lastY);
      if (moved < 14 && (ai.mx || ai.my)) { ai.unstuckT = 0.8; ai.unstuckA = Math.atan2(ai.my, ai.mx) + (Math.random() < 0.5 ? 1 : -1) * rand(1.2, 2.4); ai.dig = true; }
      ai.lastX = p.x; ai.lastY = p.y; ai.lastT = Game.t;
    } else if (ai.lastX === undefined) { ai.lastX = p.x; ai.lastY = p.y; ai.lastT = Game.t; }
  },

  armed(p) {
    return p.inv.some((s) => s && s.kind === 'w' && WEAPONS[s.id].d > 0 && (!WEAPONS[s.id].m || s.mag > 0 || p.ammo[WEAPONS[s.id].ammo] > 0));
  },
  healUseful(p, s) {
    const h = HEALS[s.id];
    return (h.hp && p.hp < (h.max || 100)) || (h.sh && p.sh < (h.maxSh || 100)) || (h.hot && p.hp < 100);
  },

  pickWeapon(p, d) {
    let best = 0, bs = 1;
    for (let i = 0; i < 5; i++) {
      const s = p.inv[i];
      if (!s || s.kind !== 'w') continue;
      const w = WEAPONS[s.id];
      if (w.m && s.mag <= 0 && (!w.ammo || p.ammo[w.ammo] <= 0)) continue;
      if (w.proj === 'deploy' && w.dep !== 'turret' && w.dep !== 'mine') continue;
      if (w.proj === 'dash' || w.proj === 'grapple' || (w.area && w.area !== 'fire')) continue;
      let sc = weaponDps(w, s.r);
      if (w.cat === 'throw' || w.proj === 'deploy') sc = d > 150 && d < w.range && Math.random() < 0.3 ? 400 : 1;
      if (w.proj === 'melee') sc = d < w.range + 40 ? sc * 1.5 : 1;
      else if (d > w.range * 0.95) sc *= 0.1;
      if (w.cat === 'shotgun' && d < 260) sc *= 2.2;
      if (w.cat === 'sniper' && d > 450) sc *= 3;
      if (w.cat === 'sniper' && d < 200) sc *= 0.3;
      if (sc > bs) { bs = sc; best = i + 1; }
    }
    if (p.sel !== best) Game.selectSlot(p, best);
  },

  findLoot(p) {
    const ai = p.ai;
    // いまの もくひょうが まだ あるなら つづける
    if (ai.goalLoot && !ai.goalLoot.dead && ai.mode === 'loot') return true;
    if (ai.goalChest && World.obAt(ai.goalChest.tx, ai.goalChest.ty) === OB.CHEST && ai.mode === 'loot') return true;
    ai.goalLoot = null; ai.goalChest = null;
    const full = !p.inv.includes(null);
    let minV = 999;
    if (full) for (const s of p.inv) minV = Math.min(minV, this.itemValue(s));
    const weak = p.inv.filter((s) => s && s.kind === 'w').length < 2;
    const R = weak ? 700 : 380;
    let best = null, bs = 0;
    for (const L of Game.lootNear(p.x, p.y, R)) {
      if (L.dead) continue;
      let v = this.itemValue(L.it);
      if (L.it.kind === 'ammo') v = this.needsAmmo(p, L.it.id) ? 30 : 0;
      if (L.it.kind === 'mat') v = p.mats[L.it.id] < 200 ? 12 : 0;
      if ((L.it.kind === 'w' || L.it.kind === 'h') && full && v < minV + 10) continue;
      if (!v) continue;
      const sc = v / (60 + dist(p.x, p.y, L.x, L.y));
      if (sc > bs) { bs = sc; best = L; }
    }
    // たからばこ
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE), rr = weak ? 14 : 8;
    let chest = null, cs = bs;
    for (let y = ty - rr; y <= ty + rr; y += 1) for (let x = tx - rr; x <= tx + rr; x += 1) {
      if (World.obAt(x, y) !== OB.CHEST) continue;
      const sc = 90 / (60 + dist(p.x, p.y, (x + 0.5) * TILE, (y + 0.5) * TILE));
      if (sc > cs) { cs = sc; chest = { tx: x, ty: y }; }
    }
    for (const f of Game.fx) if (f.type === 'supply' && f.landed && !f.dead && dist(p.x, p.y, f.x, f.y) < 900) { ai.mode = 'loot'; ai.goal = { x: f.x, y: f.y }; ai.goalSupply = f; return true; }
    if (chest) { ai.mode = 'loot'; ai.goalChest = chest; ai.goal = { x: (chest.tx + 0.5) * TILE, y: (chest.ty + 0.5) * TILE }; return true; }
    if (best) { ai.mode = 'loot'; ai.goalLoot = best; ai.goal = { x: best.x, y: best.y }; return true; }
    return false;
  },
  needsAmmo(p, id) {
    for (const s of p.inv) if (s && s.kind === 'w' && WEAPONS[s.id].ammo === id) return p.ammo[id] < 120;
    return false;
  },
  findHarvest(p) {
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    let best = null, bd = 1e9;
    for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 6; x <= tx + 6; x++) {
      const o = World.obAt(x, y);
      if (o !== OB.TREE && o !== OB.PINE && o !== OB.ROCK && o !== OB.CRATE) continue;
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bd) { bd = d; best = { tx: x, ty: y }; }
    }
    if (!best) return false;
    p.ai.harvest = best;
    p.ai.goal = { x: (best.tx + 0.5) * TILE, y: (best.ty + 0.5) * TILE };
    return true;
  },

  /* 毎フレームの うごき */
  act(p, dt) {
    const ai = p.ai, diff = Game.diff;
    ai.fire = false;
    ai.mx = 0; ai.my = 0;
    if (ai.unstuckT > 0) ai.unstuckT -= dt;
    const tgt = ai.target;

    if (ai.mode === 'fight' && tgt && tgt.alive) {
      const d = dist(p.x, p.y, tgt.x, tgt.y);
      const s = curItem(p);
      const w = s && s.kind === 'w' ? (s.id === 'pickaxe' ? PICKAXE : WEAPONS[s.id]) : null;
      const pref = !w ? 200 : w.proj === 'melee' ? 30 : w.cat === 'shotgun' ? 120 : w.cat === 'sniper' ? 650 : w.cat === 'throw' ? 300 : 320;
      // よこに うごきながら きょりを たもつ
      if (!ai.strafeT || Game.t > ai.strafeT) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = Game.t + rand(0.6, 1.6); }
      const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      let fx = 0, fy = 0;
      if (d > pref + 60) { fx = Math.cos(a); fy = Math.sin(a); }
      else if (d < pref - 60) { fx = -Math.cos(a); fy = -Math.sin(a); }
      fx += Math.cos(a + Math.PI / 2) * ai.strafe * 0.8; fy += Math.sin(a + Math.PI / 2) * ai.strafe * 0.8;
      if (ai.needZone) { const zg = ai.zoneGoal; const za = Math.atan2(zg.y - p.y, zg.x - p.x); fx += Math.cos(za) * 1.2; fy += Math.sin(za) * 1.2; }
      if (!ai.vis && Game.t - (ai.hurtT || -9) < 2.5) { fx = Math.cos(a); fy = Math.sin(a); }
      [ai.mx, ai.my] = this.steerDir(p, Math.atan2(fy, fx));
      // ねらう
      const sp = w && w.spd ? w.spd : 1500;
      const lead = (d / sp) * [0.3, 0.6, 0.9][diff];
      const tvx = tgt.vxm || 0, tvy = tgt.vym || 0;
      const ax = tgt.x + clamp(tvx, -300, 300) * lead, ay = tgt.y + clamp(tvy, -300, 300) * lead;
      ai.errT = (ai.errT || 0) - dt;
      if (ai.errT <= 0) { ai.errT = rand(0.3, 0.7); ai.err = (Math.random() - 0.5) * 2 * [0.32, 0.2, 0.11][diff]; }
      const want = Math.atan2(ay - p.y, ax - p.x) + ai.err;
      p.aim += clamp(angDiff(p.aim, want), -9 * dt, 9 * dt);
      ai.aimPt = { x: ax, y: ay };
      const inRange = !w || d < (w.range || 600) * 1.05;
      // うちっぱなしに しない（すこし やすむ）
      if (!ai.burstEnd || Game.t > ai.burstEnd + ai.burstRest) { ai.burstEnd = Game.t + rand(0.5, 1.3); ai.burstRest = rand(0.35, 0.9) * (1.3 - diff * 0.3); }
      const resting = Game.t > ai.burstEnd && !(w && (w.charge || w.proj === 'melee'));
      if (ai.vis && Game.t > ai.react && inRange && !resting && Math.abs(angDiff(p.aim, want)) < 0.3) ai.fire = true;
      if (!p.alive) return;
    } else if (ai.mode === 'heal') {
      if (p.sel !== ai.healSlot + 1) Game.selectSlot(p, ai.healSlot + 1);
      ai.fire = true;
      const s = p.inv[ai.healSlot];
      if (!s || s.kind !== 'h' || !this.healUseful(p, s)) { ai.mode = 'wander'; ai.think = 0; }
      if (ai.needZone) [ai.mx, ai.my] = this.steerTo(p, ai.zoneGoal.x, ai.zoneGoal.y);
    } else if (ai.goal) {
      const g = ai.goal;
      const d = dist(p.x, p.y, g.x, g.y);
      if (ai.mode === 'harvest' && ai.harvest) {
        const o = World.obAt(ai.harvest.tx, ai.harvest.ty);
        if (!OBD[o].hp) { ai.mode = 'wander'; ai.harvest = null; ai.think = 0; }
        else if (d < 58) { if (p.sel !== 0) Game.selectSlot(p, 0); p.aim = Math.atan2(g.y - p.y, g.x - p.x); ai.fire = true; }
        else [ai.mx, ai.my] = this.steerTo(p, g.x, g.y);
      } else {
        if (d > 24) [ai.mx, ai.my] = this.steerTo(p, g.x, g.y);
        if (ai.mode === 'loot') {
          if (ai.goalChest && d < 58) { Game.interact(p); ai.goalChest = null; ai.think = 0.4; }
          else if (ai.goalLoot && d < 34) { if (!ai.goalLoot.dead) this.pickup(p, ai.goalLoot); ai.goalLoot = null; ai.think = 0; }
          else if (ai.goalSupply && d < 50) { Game.interact(p); ai.goalSupply = null; ai.think = 0.4; }
        }
        if (d > 24) p.aim = Math.atan2(ai.my || 0.01, ai.mx || 0.01);
      }
      // まえが ふさがっていたら ツルハシで こわす
      if (ai.dig && ai.unstuckT > 0) {
        const a = Math.atan2(g.y - p.y, g.x - p.x);
        const tx = Math.floor((p.x + Math.cos(a) * 34) / TILE), ty = Math.floor((p.y + Math.sin(a) * 34) / TILE);
        if (World.solid(tx, ty) && OBD[World.obAt(tx, ty)].hp) { if (p.sel !== 0) Game.selectSlot(p, 0); p.aim = a; ai.fire = true; ai.mx = 0; ai.my = 0; }
        else ai.dig = false;
      }
    }
  },

  pickup(p, L) {
    if (L.it.kind === 'ammo' || L.it.kind === 'mat') return;
    if (Game.give(p, Object.assign({}, L.it))) { Game.removeLoot(L); return; }
    // いちばん やくに たたない ものと いれかえ
    let mi = -1, mv = 999;
    p.inv.forEach((s, i) => { const v = this.itemValue(s); if (v < mv) { mv = v; mi = i; } });
    if (mi >= 0 && this.itemValue(L.it) > mv + 8) {
      const old = p.inv[mi];
      p.inv[mi] = Object.assign({}, L.it);
      Game.removeLoot(L);
      Game.spawnLoot(p.x, p.y, [old]);
    }
  },

  steerTo(p, gx, gy) { return this.steerDir(p, Math.atan2(gy - p.y, gx - p.x)); },
  steerDir(p, a) {
    const ai = p.ai;
    if (ai.unstuckT > 0) a = ai.unstuckA;
    const offs = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.6, -2.6];
    for (const o of offs) {
      const aa = a + o;
      const px = p.x + Math.cos(aa) * 28, py = p.y + Math.sin(aa) * 28;
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (World.solid(tx, ty)) continue;
      if (World.grAt(tx, ty) === GR.OCEAN && World.grAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) !== GR.OCEAN) continue;
      return [Math.cos(aa), Math.sin(aa)];
    }
    return [Math.cos(a), Math.sin(a)];
  },
};
