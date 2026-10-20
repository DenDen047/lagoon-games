/* =========================================================================
   WILD INN ― ホテルの中身
   セーブする状態 G / その場だけの状態 R / 1日の流れ / 電話 / 予約と受付 /
   ペットのきもち / 見送りと評価 / 目標 / 演出
   ========================================================================= */
'use strict';

let G = null; // セーブする状態
const R = {   // セーブしない状態
  player: null, pets: [], visitors: [], queue: [], fx: [], t: 0, speed: 1, saveT: 0, layoutV: 0,
  call: null, spawned: new Set(), viewFloor: 0, fade: 0, missionT: 0,
};

const stars = () => clamp(Math.floor(G.rep / 20), 0, 5);
const clockText = (m) => `${pad2(Math.floor(m / 60))}:${pad2(Math.floor((m % 60) / 10) * 10)}`;
const habOpen = (h) => stars() >= HABITATS[h].star;

/* ------------------------------ 新しいゲーム ------------------------------ */
function newGame(hotel, owner, price) {
  G = {
    ver: 1, hotel, owner, day: 1, clock: DAY_START, phase: 'day', money: 6000, rep: 20, lv: 0, floors: 1,
    rooms: [], furn: [], inv: {}, food: { kibble: 6, fish: 4, veggie: 6, seeds: 6 },
    prices: { town: price, jungle: 3000, savanna: 3600, desert: 2800, polar: 4000 },
    guests: [], bookings: [], nextId: 1, nextRoom: 1, nextUid: 1,
    nextCall: DAY_START + 12,
    stats: { accepted: 0, checkins: 0, checkouts: 0, fed: 0, petted: 0, resized: 0, furnPlaced: 0, hosted: {}, income: 0, bestDay: 0 },
    seen: {}, today: freshDay(20), mdone: [], pos: null,
  };
  Hotel.rebuild();
  const r = Hotel.addRoom(0, { x: 1, y: 1, w: 4, h: 4 }, 'town').room;
  Hotel.placeFurn('bed', 0, r.x + 3, r.y);
  Hotel.placeFurn('water', 0, r.x, r.y);
  G.furn.push({ uid: G.nextUid++, type: 'plant', floor: 0, x: 0, y: Hotel.H - 1 });
  G.furn.push({ uid: G.nextUid++, type: 'sofa', floor: 0, x: 0, y: Hotel.H - 2 });
  Hotel.rebuild();
  resetRuntime();
}
function freshDay(rep) {
  return { income: 0, cost: 0, checkins: 0, checkouts: 0, calls: 0, missed: 0, declined: 0, reviews: [], repStart: rep };
}
function resetRuntime() {
  R.pets = []; R.visitors = []; R.queue = []; R.fx = []; R.call = null; R.spawned = new Set();
  R.player = new Player();
  const s = Hotel.staffSpot();
  const p0 = G.pos || { floor: 0, x: s.x + 0.5, y: s.y + 0.5 };
  R.player.floor = clamp(p0.floor, 0, G.floors - 1);
  const p = Hotel.nearestFree(R.player.floor, p0.x, p0.y);
  R.player.x = p.x; R.player.y = p.y;
  R.viewFloor = R.player.floor;
  if (G.ring && G.phase === 'day') R.call = { offer: G.ring.offer, t: G.ring.t, ringT: 0 };
  for (const g of G.guests) R.pets.push(Pet.fromGuest(g));
}

/* ------------------------------ セーブ ------------------------------ */
function saveGame() {
  if (!G) return false;
  if (R.player) G.pos = { floor: R.player.floor, x: R.player.x, y: R.player.y };
  G.ring = R.call ? { offer: R.call.offer, t: R.call.t } : null;
  return Save.write(G);
}
function loadGame() {
  const d = Save.read();
  if (!d || d.ver !== 1) return false;
  G = d;
  Hotel.rebuild();
  resetRuntime();
  return true;
}

/* ------------------------------ 1フレーム ------------------------------ */
function simUpdate(dt) {
  R.t += dt;
  const dm = dt * MIN_PER_SEC;
  if (G.phase === 'day') {
    G.clock += dm;
    Calls.update(dt);
    Visits.update();
    Guests.tick(dm);
  }
  R.player.update(dt);
  for (const p of R.pets) p.update(dt);
  for (const v of R.visitors) v.update(dt, G.phase === 'day' ? dm : 0);
  R.visitors = R.visitors.filter((v) => !v.gone);
  R.pets = R.pets.filter((p) => !p.gone);
  FX.update(dt);
  if (R.fade > 0) R.fade -= dt;
  R.missionT -= dt;
  if (R.missionT <= 0) { R.missionT = 1; Missions.check(); }
  if (G.phase === 'day' && G.clock >= DAY_END) Day.end();
}

/* ------------------------------ 1日 ------------------------------ */
const Day = {
  /* 夜8時。受付に残っているお客さんは、あずけに来た人はあしたに、むかえの人はスタッフが見送る */
  end() {
    G.clock = DAY_END;
    for (const v of R.visitors.slice()) {
      if (v.state === 'leave') { v.vanish(); continue; }
      if (v.kind === 'in') {
        v.booking.day = G.day + 1;
        v.booking.time = DAY_START + rint(10, 60);
        R.spawned.delete('b' + v.booking.id);
        v.vanish();
      } else {
        Desk.checkout(v, true, null, true);
        v.vanish();
      }
    }
    R.queue = [];
    if (R.call) { R.call = null; }
    G.phase = 'night';
    G.stats.bestDay = Math.max(G.stats.bestDay, G.today.income);
    Sound.play('night');
    saveGame();
    UI.showSummary();
  },
  next() {
    for (const g of G.guests) {
      g.hunger = Math.max(0, g.hunger - 25);
      g.love = Math.max(0, g.love - 12);
      const tg = Guests.target(g, Guests.comfort(g));
      g.mood = lerp(g.mood, tg, 0.5);
      g.moodSum += g.mood * 120; g.moodN += 120;
    }
    G.day++;
    G.clock = DAY_START;
    G.phase = 'day';
    G.today = freshDay(G.rep);
    G.nextCall = DAY_START + rint(6, 30);
    Sound.play('morning');
    const outs = G.guests.filter((g) => g.outDay === G.day).length;
    Toast.show(`${G.day}日目の朝。${outs ? `きょうは ${outs}ひきのお迎えがあるよ` : 'きょうもがんばろう!'}`);
    saveGame();
  },
};

/* ------------------------------ 電話 ------------------------------ */
const Calls = {
  update(dt) {
    const c = R.call;
    if (c) {
      c.t += dt;
      c.ringT -= dt;
      if (c.ringT <= 0) { Sound.play('ring'); c.ringT = 1.5; }
      if (c.t > 25) {
        Toast.show('電話に出られなかった…', 'bad');
        G.today.missed++;
        R.call = null;
        this.schedule();
      }
      return;
    }
    if (G.clock >= G.nextCall && G.clock < CALL_END) {
      R.call = { offer: this.makeOffer(), t: 0, ringT: 0 };
      G.today.calls++;
    }
  },
  /* 次の電話。部屋がいっぱいのときはゆっくり */
  schedule() {
    const s = stars();
    let free = -G.bookings.reduce((n, b) => n + SPECIES[b.sp].slots, 0);
    for (const r of G.rooms) free += Hotel.cap(r) - Hotel.used(r);
    G.nextCall = G.clock + rint(60, 110) * (1 - s * 0.06) * (free <= 0 ? 2 : 1);
  },
  makeOffer() {
    const s = stars();
    let hab = 'town';
    if (G.stats.accepted > 0) {
      const w = {};
      for (const h of HAB_ORDER) if (habOpen(h)) w[h] = (h === 'town' ? 3 : 1.2) + (G.rooms.some((r) => r.hab === h) ? 2.5 : 0);
      hab = pickWeighted(w);
    }
    const sps = SP_ORDER.filter((k) => SPECIES[k].hab === hab);
    const sp = pick(sps), S = SPECIES[sp], H = HABITATS[hab];
    const zoo = hab !== 'town' && chance(0.5);
    return {
      id: G.nextId++, sp, look: { sp, c: rint(0, S.cols.length - 1) }, name: pick(PET_NAMES),
      nights: rint(1, s >= 3 ? 4 : 3),
      budget: round10(H.market * S.k * S.slots * rfloat(1.0, 1.35) * (1 + 0.06 * s)),
      caller: zoo ? pick(ZOO_NAMES) : `${pick(OWNER_NAMES)}さん`, zoo,
      reason: pick(zoo ? REASONS_ZOO : hab === 'town' ? REASONS_HOME : REASONS_KEEPER),
      owner: zoo ? { ...randomPerson(), cap: '#3a8a5a', shirt: '#7ab86a' } : randomPerson(),
    };
  },
  /* 料金を聞いたときの返事 */
  reaction(o) {
    const fee = G.prices[SPECIES[o.sp].hab] * SPECIES[o.sp].slots;
    if (fee <= o.budget) return { kind: 'ok', fee };
    if (fee <= o.budget * 1.3) return { kind: 'haggle', fee, ask: Math.floor(o.budget / 10) * 10 };
    return { kind: 'no', fee };
  },
  accept(o, fee) {
    let day = G.day, time = G.clock + rint(15, 50);
    if (time > CALL_END + 30) { day++; time = DAY_START + rint(15, 90); }
    G.bookings.push({ id: o.id, sp: o.sp, look: o.look, name: o.name, nights: o.nights, fee, caller: o.caller, zoo: o.zoo, owner: o.owner, day, time });
    G.stats.accepted++;
    R.call = null;
    this.schedule();
    Toast.show(day === G.day ? `${o.name}が ${clockText(time)}ごろ 来るよ` : `${o.name}は あしたの朝に来るよ`, 'good');
    Missions.check();
  },
  decline() {
    G.today.declined++;
    R.call = null;
    this.schedule();
  },
};

/* ------------------------------ 来る時間になったお客さん ------------------------------ */
const Visits = {
  update() {
    const due = (day, time) => G.day > day || (G.day === day && G.clock >= time);
    for (const b of G.bookings) {
      const k = 'b' + b.id;
      if (R.spawned.has(k) || !due(b.day, b.time)) continue;
      R.spawned.add(k);
      R.visitors.push(new Visitor('in', b));
    }
    for (const g of G.guests) {
      const k = 'g' + g.id;
      if (R.spawned.has(k) || !due(g.outDay, g.outTime)) continue;
      R.spawned.add(k);
      R.visitors.push(new Visitor('out', g));
    }
  },
};

/* ------------------------------ 受付 ------------------------------ */
const Desk = {
  front() { const v = R.queue[0]; return v && v.state === 'wait' ? v : null; },
  waiting() { return R.queue.length; },
  checkin(v, room) {
    const b = v.booking, S = SPECIES[b.sp];
    const g = {
      id: b.id, sp: b.sp, look: b.look, name: b.name, owner: { name: b.caller, look: b.owner, zoo: b.zoo },
      nights: b.nights, fee: b.fee, roomId: room.id, inDay: G.day, outDay: G.day + b.nights, outTime: rint(9 * 60, 16 * 60),
      hunger: 70, mood: 60, love: 30, moodSum: 0, moodN: 0, fedOk: 0, fedNo: 0, petN: 0,
      floor: v.pet.floor, x: v.pet.x, y: v.pet.y,
    };
    G.guests.push(g);
    G.bookings = G.bookings.filter((x) => x !== b);
    v.pet.attach(g);
    v.leave();
    G.stats.checkins++;
    G.stats.hosted[S.hab] = (G.stats.hosted[S.hab] || 0) + 1;
    G.seen[b.sp] = true;
    G.today.checkins++;
    Sound.play('door');
    Toast.show(`${b.name}を ${room.name}に案内したよ`, 'good');
    Missions.check();
  },
  /* auto = 待たせすぎて、スタッフが代わりに見送った。pre は画面に見せた評価 */
  checkout(v, auto, pre, quiet) {
    const g = v.guest;
    if (!G.guests.includes(g)) return null;
    const r = pre || Guests.rate(g, auto);
    G.money += r.total;
    G.today.income += r.total;
    G.stats.income += r.total;
    G.rep = clamp(G.rep + [-8, -4, 1, 4, 7][r.stars - 1], 0, 100);
    G.today.reviews.push({ sp: g.sp, look: g.look, name: g.name, owner: g.owner.name, stars: r.stars, line: r.line, total: r.total });
    G.guests = G.guests.filter((x) => x !== g);
    G.stats.checkouts++;
    G.today.checkouts++;
    const pet = R.pets.find((p) => p.g === g);
    if (pet) { pet.g = null; pet.leader = v; pet.mode = 'follow'; pet.path = null; pet.legs = null; }
    v.pet = pet || null;
    v.leave();
    FX.coin(0, v.x, v.y - 1.2, r.total);
    Sound.play('coin');
    if (auto && !quiet) Toast.show(`待たせすぎて、スタッフが${g.name}を見送ったよ`, 'bad');
    Missions.check();
    return r;
  },
};

/* ------------------------------ ペットのきもち ------------------------------
   ごきげん (mood) は、部屋のいごこち・おなか・なかよし度 (love) で決まる目標に少しずつ近づく */
const Guests = {
  comfort(g) {
    const room = Hotel.roomById(g.roomId), S = SPECIES[g.sp];
    const why = [];
    if (!room) return { s: 10, why: ['room'] };
    let s = 0;
    if (room.hab === S.hab) s += 45; else why.push('room');
    let items = 0, fav = false, water = false;
    for (const fu of Hotel.furnIn(room)) {
      const d = FURN[fu.type];
      if (d.hab === S.hab) items++;
      if (fu.type === S.likes) fav = true;
      if (fu.type === 'water') water = true;
    }
    s += Math.min(4, items) * 6;
    if (fav) s += 15; else why.push('fav');
    if (water) s += 6;
    const per = (room.w * room.h) / Math.max(1, Hotel.used(room));
    if (per >= 6) s += 10;
    else if (per < 4) { s -= 10; why.push('crowd'); }
    if (S.prey && Hotel.guestsIn(room).some((o) => o !== g && SPECIES[o.sp].pred)) { s -= 35; why.push('scary'); }
    return { s: clamp(s, 0, 100), why, fav, water, items };
  },
  target(g, c) { return c.s * 0.5 + g.hunger * 0.3 + g.love * 0.2; },
  tick(dm) {
    for (const g of G.guests) {
      g.hunger = Math.max(0, g.hunger - 0.22 * dm);
      g.love = Math.max(0, g.love - 0.07 * dm);
      const tg = this.target(g, this.comfort(g));
      g.mood += (tg - g.mood) * Math.min(1, 0.012 * dm);
      g.moodSum += g.mood * dm;
      g.moodN += dm;
    }
  },
  rate(g, auto) {
    const avg = g.moodN > 0 ? g.moodSum / g.moodN : g.mood;
    const sc = avg * 0.65 + g.mood * 0.35 + lobbyBonus();
    let st = sc >= 76 ? 5 : sc >= 62 ? 4 : sc >= 48 ? 3 : sc >= 34 ? 2 : 1;
    if (auto) st = Math.max(1, st - 1);
    const base = g.fee * g.nights;
    const tip = st === 5 ? round10(base * 0.2) : st === 4 ? round10(base * 0.1) : 0;
    const c = this.comfort(g);
    let key;
    if (st >= 5) key = 'great';
    else if (st === 4) key = 'good';
    else if (c.why.includes('scary')) key = 'scary';
    else if (c.why.includes('room')) key = 'room';
    else if (g.hunger < 35 || g.fedOk < g.nights) key = 'hungry';
    else if (c.why.includes('crowd')) key = 'crowd';
    else if (g.love < 35) key = 'lonely';
    else if (st <= 3 && c.why.includes('fav')) key = 'fav';
    else key = 'good';
    return { stars: st, base, tip, total: base + tip, line: pick(REVIEW_LINES[key]), key };
  },
  /* なでる。うれしさは動物によってちがう */
  pet(p) {
    const g = p.g, S = SPECIES[g.sp];
    if (p.state === 'sleep') { p.wake(); FX.text(p.floor, p.x, p.y - S.h / TILE - 0.3, 'ふぁ…', '#7a6a9a'); return; }
    if (R.t - (p.petAt || -9) < 0.8) return;
    p.petAt = R.t;
    g.petN++;
    if (g.love >= 98) { FX.text(p.floor, p.x, p.y - S.h / TILE - 0.3, 'もうまんぞく', '#c96a80'); return; }
    g.love = Math.min(100, g.love + 22 * S.pet);
    G.stats.petted++;
    Sound.play('pet');
    if (S.pet >= 0.5) { p.react('happy', 1.4); FX.hearts(p.floor, p.x, p.y - S.h / TILE, S.pet >= 0.8 ? 3 : 2); }
    else { p.react('idle', 0.6); FX.text(p.floor, p.x, p.y - S.h / TILE - 0.3, 'ちょっとにがて…', '#6a8a6a'); }
    Missions.check();
  },
  /* えさをあげる。好きじゃない物は食べない (へらない) */
  feed(p, food) {
    const g = p.g, S = SPECIES[g.sp], top = p.y - S.h / TILE - 0.3;
    if (!(G.food[food] > 0)) { Sound.play('error'); Toast.show(`${FOODS[food].name}がないよ。「えさ」で注文しよう`, 'bad'); return 'none'; }
    if (p.state === 'sleep') p.wake();
    if (!S.foods.includes(food)) {
      g.love = Math.max(0, g.love - 3);
      g.fedNo++;
      Sound.play('refuse');
      p.react('idle', 0.8);
      FX.text(p.floor, p.x, top, 'ぷいっ', '#b05a5a');
      return 'no';
    }
    if (g.hunger > 88) { FX.text(p.floor, p.x, top, 'おなかいっぱい', '#8a7a5a'); return 'full'; }
    G.food[food]--;
    const fav = food === S.fav;
    g.hunger = Math.min(100, g.hunger + (fav ? 55 : 40));
    g.love = Math.min(100, g.love + (fav ? 10 : 5));
    g.fedOk++;
    G.stats.fed++;
    Sound.play('eat');
    p.react('eat', 1.6);
    FX.text(p.floor, p.x, top, fav ? 'だいすき!' : 'もぐもぐ', fav ? '#e0507a' : '#5a8a4a');
    if (fav) FX.hearts(p.floor, p.x, p.y - S.h / TILE, 2);
    Missions.check();
    return fav ? 'fav' : 'ok';
  },
  /* 部屋を変える */
  move(p, room) {
    p.g.roomId = room.id;
    p.travel();
  },
};
/* ロビーにかざりがあると、見送りのときの印象が少しよくなる */
function lobbyBonus() {
  let n = 0;
  for (const fu of G.furn) if (fu.floor === 0 && FURN[fu.type].hab === 'lobby' && Hotel.zone(0, fu.x, fu.y) === 0) n++;
  return Math.min(6, n * 1.5);
}

/* ------------------------------ 目標 ------------------------------ */
const Missions = {
  current() { return MISSIONS.find((m) => !G.mdone.includes(m.id)) || null; },
  met(id) {
    const s = G.stats;
    switch (id) {
      case 'call': return s.accepted >= 1;
      case 'checkin': return s.checkins >= 1;
      case 'feed': return s.fed >= 1;
      case 'pet': return s.petted >= 1;
      case 'checkout': return s.checkouts >= 1;
      case 'furn': return s.furnPlaced >= 1;
      case 'jungle': return G.rooms.some((r) => r.hab === 'jungle');
      case 'jungleGuest': return (s.hosted.jungle || 0) >= 1;
      case 'resize': return s.resized >= 1;
      case 'savanna': return G.rooms.some((r) => r.hab === 'savanna');
      case 'five': return G.guests.length >= 5;
      case 'floor2': return G.floors >= 2;
      case 'star3': return stars() >= 3;
      case 'all': return HAB_ORDER.every((h) => G.rooms.some((r) => r.hab === h));
      case 'star5': return stars() >= 5;
    }
    return false;
  },
  check() {
    if (!G) return;
    let m, changed = false;
    while ((m = this.current()) && this.met(m.id)) {
      G.mdone.push(m.id);
      changed = true;
      if (m.reward) G.money += m.reward;
      Sound.play('mission');
      Toast.show(`🎯 目標クリア! ${m.reward ? `ごほうび ${yen(m.reward)}` : ''}`, 'good');
    }
    if (changed) UI.refreshMission();
  },
};

/* ------------------------------ 演出 ------------------------------ */
const FX = {
  add(o) { R.fx.push(Object.assign({ t: 0, life: 1.2 }, o)); },
  hearts(floor, x, y, n) {
    for (let i = 0; i < n; i++) this.add({ kind: 'heart', floor, x: x + rfloat(-0.3, 0.3), y: y - rfloat(0, 0.2), vx: rfloat(-0.3, 0.3), life: 1.1 + i * 0.15, delay: i * 0.12 });
  },
  text(floor, x, y, text, col) { this.add({ kind: 'text', floor, x, y, text, col, life: 1.4 }); },
  coin(floor, x, y, n) { this.add({ kind: 'text', floor, x, y, text: '+' + yen(n), col: '#c98a10', life: 1.8, big: true }); },
  sparkle(floor, x, y) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      this.add({ kind: 'spark', floor, x, y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.2, life: 0.7 });
    }
  },
  update(dt) {
    for (const f of R.fx) f.t += dt;
    R.fx = R.fx.filter((f) => f.t < f.life + (f.delay || 0));
  },
};
