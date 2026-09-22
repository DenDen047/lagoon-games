/* =========================================================================
   ORE TO ARMADA ― お金と経済
   相場 / 店 / 設計図 / 依頼と評判 / 賞金 / 1日の区切り / 最初の依頼の列
   ========================================================================= */
'use strict';

const BP_PRICE = { 2: 300, 3: 1200, 4: 4000, 5: 12000 };
const REP_NEED = { 2: 0, 3: 5, 4: 15, 5: 30 };

const Econ = {
  /* ---------- 相場 ---------- */
  factor(sys, id) { const r = mulberry32(sys.seed ^ hashStr(id)); r(); return 0.7 + r() * 0.6; },
  demand(sys) {
    const r = new RNG(sys.seed ^ (G.day * 7919));
    const pool = ORE_IDS.filter((id) => RINGS[sys.ring].ores.includes(id)).concat(['m_iron', 'm_si', 'p_steel', 'p_circuit']);
    return r.shuffle(pool.slice()).slice(0, 3);
  },
  sellPrice(sys, id) {
    const d = itemDef(id);
    let p = d.price * this.factor(sys, id);
    if (d.kind === 'block') p = d.price / TUNE.markup * 0.6;
    if (this.demand(sys).includes(id)) p *= 1.2;
    // 売値は、同じ星系の買値の9割まで (売り買いだけで儲からないように)
    return Math.max(1, Math.min(Math.round(p), Math.floor(this.buyPrice(sys, id) * 0.9)));
  },
  buyPrice(sys, id) {
    const d = itemDef(id);
    if (d.kind === 'block') return d.price;
    const imp = d.kind === 'part' && !this.localPart(sys, id) ? TUNE.markup : 1;
    return Math.max(1, Math.round(d.price * this.factor(sys, id) * 1.25 * imp));
  },
  /* この環で材料が取れる部品か (取れないものは輸入品で割高) */
  localPart(sys, id) {
    const rec = ASSEMBLE.find((r) => r.out === id);
    if (!rec) return true;
    const ores = RINGS[sys.ring].ores;
    return Object.keys(rec.in).every((m) => { const ore = ORE_IDS.find((o) => ITEMS[o].mat === m); return !ore || ores.includes(ore); });
  },
  /* 市場で売っている物 */
  marketStock(sys) {
    const tier = RINGS[sys.ring].tier;
    const parts = ['p_steel', 'p_glass', 'p_circuit', 'p_thr'];
    // その環までに解放されるブロックに要る部品は必ず売る (DESIGN 13.2)
    for (const d of BLOCK_LIST) if (typeof d.tier === 'number' && d.tier <= tier && !d.noBuild) for (const k in d.cost) if (!parts.includes(k)) parts.push(k);
    const list = ['ore_ice', 'ammo', 'missile', 'o2_bottle', 'battery_pack'].concat(parts);
    if (sys.ring >= 1) list.push('m_iron', 'm_si');
    if (sys.ring >= 2 || tier >= 4) list.push('fuel_rod');
    return list;
  },
  shopBlocks(sys) {
    const tier = RINGS[sys.ring].tier;
    return BLOCK_LIST.filter((d) => !d.noBuild && typeof d.tier === 'number' && d.tier <= tier && G.unlocked[d.id]);
  },
  bpForSale(sys) {
    const tier = RINGS[sys.ring].tier;
    return BLOCK_LIST.filter((d) => !d.noBuild && typeof d.tier === 'number' && d.tier >= 2 && d.tier <= tier && !G.unlocked[d.id]);
  },

  /* ---------- お金 ---------- */
  earn(n, why) { G.credits += n; G.stats.earned += n; if (why) Toast.show(`${why} +${fmt(n)} ₵`, 'good'); Sfx.play('coin', 0.6); },
  spend(n) { if (G.credits < n) { Toast.show('お金が足りない', 'bad'); Sfx.play('bad'); return false; } G.credits -= n; Sfx.play('coin', 0.4); return true; },

  /* 売り買いに使う貨物: 入港中の船 (なければ主人公のかばん) */
  holder() { return Econ.dockShip && !Econ.dockShip.dead ? Econ.dockShip : G.player; },
  hCount(h, id) { return h.isPerson ? invCountP(h, id) : h.invTotal(id); },
  hAdd(h, id, n) { return h.isPerson ? invAddP(h, id, n) : h.invAdd(id, n); },
  hTake(h, id, n) { return h.isPerson ? invTakeP(h, id, n) : h.invTake(id, n); },
  sell(id, n) {
    const sys = S.sys, h = this.holder();
    const have = this.hCount(h, id);
    n = Math.min(n, have);
    if (n <= 0) return;
    const price = this.sellPrice(sys, id);
    this.hTake(h, id, n);
    this.earn(price * n);
    Quest.event('sell', id, n);
    Missions.onSell(id, n);
  },
  buy(id, n) {
    const sys = S.sys, h = this.holder();
    const price = this.buyPrice(sys, id);
    if (!this.spend(price * n)) return;
    const rest = this.hAdd(h, id, n);
    if (rest > 0) { const back = rest; this.hAdd(G.player, id, 0); G.credits += price * back; Toast.show(`${back} 個は入らなかったので返金した`, 'bad'); }
    Quest.event('buy', id, n);
  },
  buyBlueprint(d) {
    const need = REP_NEED[d.tier] || 0;
    if (G.rep < need) { Toast.show(`評判が ${need} 以上いる (今は ${G.rep})`, 'bad'); return; }
    if (!this.spend(BP_PRICE[d.tier])) return;
    G.unlocked[d.id] = true;
    Toast.show(`設計図「${d.name}」を手に入れた`, 'good');
  },
  refillH2() {
    const g = this.holder();
    if (g.isPerson) return;
    const need = Math.floor(g.h2cap - g.h2);
    if (need <= 0) { Toast.show('水素タンクは満タン'); return; }
    const cost = Math.ceil(need * 0.5);
    if (!this.spend(cost)) return;
    Ship.addH2(g, need);
    Toast.show(`水素を ${need} 入れた (-${cost} ₵)`);
  },
  repairCost(g) {
    let c = 0;
    g.eachBlock((b) => { if (b.hp < b.def.hp) c += (1 - b.hp / b.def.hp) * costValue(b.def.cost) * 0.5; });
    return Math.ceil(c);
  },
  repairAll(g) {
    const c = this.repairCost(g);
    if (c <= 0) { Toast.show('直すところはない'); return; }
    if (!this.spend(c)) return;
    g.eachBlock((b) => { if (b.hp < b.def.hp) { b.hp = b.def.hp; g.markChunks(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1); } });
    Toast.show(`修理した (-${fmt(c)} ₵)`, 'good');
  },
  heal() {
    const p = G.player;
    if (p.hp >= p.maxhp) { Toast.show('ケガはない'); } else if (this.spend(10)) { p.hp = p.maxhp; Toast.show('治療した'); }
    G.respawn = { sys: S.sys.id, station: true };
    Toast.show('このステーションを蘇生地点にした');
  },

  /* ---------- 撃破と賞金 ---------- */
  onDefeat(g, src) {
    const byPlayer = src && (src === G.player || src.faction === 'player' || (src.owner && src.owner.faction === 'player'));
    if (!byPlayer && g.lastHitBy && g.lastHitBy.faction === 'player') { /* 最後に当てたのが自分 */ }
    const mine = byPlayer || (g.lastHitBy && (g.lastHitBy.faction === 'player' || g.lastHitBy === G.player));
    if (!mine) return;
    const size = g.startCount || g.count;
    let bounty = Math.round(20 + size * 2.5 * (1 + S.sys.ring * 0.6));
    if (g.boss) {
      const B = BOSSES.find((b) => b.key === g.boss);
      bounty += B.bounty;
      G.bossDead[B.ring] = true;
      for (const id of B.drop) { G.unlocked[id] = true; Toast.show(`設計図「${BLOCKS[id].name}」を手に入れた`, 'good'); }
      if (B.ring === 0) { const pg = playerShip(); if (pg) { if (pg.invAdd('B:jumpdrive', 1) > 0) invAddP(G.player, 'B:jumpdrive', 1); } else invAddP(G.player, 'B:jumpdrive', 1); Toast.show('完成品のジャンプドライブを手に入れた。これで内側の環へ行ける', 'good'); }
      Quest.event('boss', B.ring);
      UI.story(B);
    }
    G.stats.kills++;
    G.rep += g.boss ? 10 : 1;
    this.earn(bounty, `${g.name} を撃破`);
    Quest.event('kill', g.enemyKind || g.faction);
    Missions.onKill(g);
  },

  /* ---------- 1日の区切り ---------- */
  tick(dt) {
    G.dayT += dt;
    if (G.dayT < TUNE.dayLength) return;
    G.dayT -= TUNE.dayLength;
    G.day++;
    Crew.payday();
    Missions.newDay();
  },
};

/* ---------- 依頼板 ---------- */
const Missions = {
  offers(sys) {
    const r = new RNG(sys.seed ^ (G.day * 104729));
    const out = [];
    const ores = RINGS[sys.ring].ores;
    const deliverId = r.pick(ores.concat(['m_iron', 'm_si', 'p_steel']));
    const n = r.i(20, 60) * (ITEMS[deliverId].price > 20 ? 0.3 : 1) | 0;
    out.push({ id: `${sys.id}-${G.day}-d`, type: 'deliver', item: deliverId, n: Math.max(5, n), sys: sys.id, reward: Math.round(ITEMS[deliverId].price * Math.max(5, n) * 1.6 + 40), text: `${ITEMS[deliverId].name}を ${Math.max(5, n)} 個届ける` });
    const k = r.i(1, 3);
    out.push({ id: `${sys.id}-${G.day}-k`, type: 'bounty', n: k, got: 0, sys: sys.id, reward: 120 * k * (1 + sys.ring), text: `この星系で海賊か群体を ${k} 隻倒す` });
    const others = G.galaxy.systems.filter((s) => s.station && s.id !== sys.id && Math.abs(s.ring - sys.ring) <= 1);
    if (others.length) {
      const to = r.pick(others);
      const hops = hopCount(sys.id, to.id);
      out.push({ id: `${sys.id}-${G.day}-t`, type: 'transport', to: to.id, sys: sys.id, size: 10, reward: 150 + hops * 180, text: `荷物 (貨物 10 ぶん) を ${to.name} ステーションへ運ぶ` });
    }
    if (S.station) {
      const gate = S.layout.gates.length ? r.pick(S.layout.gates) : null;
      const a = r.f(TAU), dest = gate ? { x: gate.x, y: gate.y } : { x: Math.cos(a) * 1100, y: Math.sin(a) * 1100 };
      out.push({ id: `${sys.id}-${G.day}-e`, type: 'escort', sys: sys.id, dest, reward: 220 * (1 + sys.ring), text: gate ? `連合の輸送船を ${G.galaxy.systems[gate.to].name} 行きのゲートまで守る` : '連合の輸送船を星系の外れまで守る' });
    }
    if (r.chance(0.6)) out.push({ id: `${sys.id}-${G.day}-r`, type: 'rescue', sys: sys.id, reward: 250 * (1 + sys.ring), text: '漂流船の生き残りを連れ帰る', seed: r.i(1, 1e9) });
    return out.filter((m) => !G.missions.some((a) => a.id === m.id) && !(G.doneMissions || []).includes(m.id));
  },
  accept(m) {
    if (G.missions.length >= 5) { Toast.show('一度に受けられる依頼は5つまで', 'bad'); return; }
    if (m.type === 'transport') {
      const h = Econ.holder();
      if (h.isPerson || h.invFree() < m.size) { Toast.show('貨物庫に 10 以上の空きがいる (入港している船)', 'bad'); return; }
      h.invAdd('pkg', m.size);
    }
    if (m.type === 'escort') {
      const g = makeShip('hauler', { rng: new RNG(G.day) });
      g.faction = 'union'; g.name = '連合の輸送船'; g.transient = true; g.escortTo = m.dest; g.startCount = g.count;
      g.updateSys(); for (const b of g.sys.batteries) b.charge = b.def.cap;
      g.x = S.station.x + 40; g.y = S.station.y + 40;
      S.grids.push(g);
      m.gridId = g.id; m.active = true; m.ambushT = 25;
    }
    if (m.type === 'rescue') {
      // 近くに漂流船を出す
      const rng = new RNG(m.seed);
      const a = rng.f(TAU), r = rng.f(250, 600);
      const st = S.station || { x: 0, y: 0 };
      m.pos = { x: st.x + Math.cos(a) * r, y: st.y + Math.sin(a) * r };
      spawnRescueDerelict(m);
    }
    G.missions.push(Object.assign({}, m));
    Toast.show('依頼を受けた: ' + m.text, 'good');
    Sfx.play('ui');
  },
  complete(m, silent) {
    G.missions = G.missions.filter((x) => x !== m);
    G.doneMissions = (G.doneMissions || []).concat(m.id).slice(-60);
    G.rep += 2;
    Econ.earn(m.reward, '依頼を達成');
    Quest.event('mission');
  },
  /* ステーションで達成できるものを確かめる */
  checkAtStation(sys) {
    for (const m of G.missions.slice()) {
      const h = Econ.holder();
      if (m.type === 'deliver' && m.sys === sys.id && Econ.hCount(h, m.item) >= m.n) { Econ.hTake(h, m.item, m.n); this.complete(m); }
      else if (m.type === 'bounty' && m.sys === sys.id && m.got >= m.n) this.complete(m);
      else if (m.type === 'transport' && m.to === sys.id && Econ.hCount(h, 'pkg') >= m.size) { Econ.hTake(h, 'pkg', m.size); this.complete(m); }
      else if (m.type === 'rescue' && m.sys === sys.id && m.rescued) {
        this.complete(m);
        const p = S.persons.find((x) => x.survivor === m.id) || Crew.fromPlain(m.surv);
        UI.confirm(`助けた ${p.name} が「このまま雇ってほしい」と言っている。雇う？ (日給 ${p.wage} ₵)`, () => Crew.hireRescued(p), () => { S.persons = S.persons.filter((x) => x !== p); });
      }
    }
  },
  onSell() {},
  /* 護衛の依頼を進める */
  tick(dt) {
    for (const m of G.missions.slice()) {
      if (m.type !== 'escort' || !m.active) continue;
      const g = m.sys === S.sys.id ? S.grids.find((o) => o.id === m.gridId && !o.dead) : null;
      if (!g || g.disabled) { G.missions = G.missions.filter((x) => x !== m); Toast.show('護衛の依頼に失敗した。輸送船を守れなかった', 'bad'); G.rep = Math.max(-100, G.rep - 1); continue; }
      m.ambushT -= dt;
      if (m.ambushT <= 0 && !m.ambushed) {
        m.ambushed = true;
        const ring = S.sys.ring, a = Math.atan2(m.dest.y - g.y, m.dest.x - g.x);
        const kinds = ring === 0 ? ['scout', 'scout'] : ring === 1 ? ['raider', 'scout', 'raider'] : ['swarm_s', 'swarm_s', 'swarm_m'];
        Toast.show('待ち伏せだ！輸送船を守れ', 'bad'); Sfx.play('alarm');
        kinds.forEach((k, n) => Sector.spawnEnemy(k, g.x + Math.cos(a) * 160 + n * 18, g.y + Math.sin(a) * 160 - n * 12, { target: g }));
      }
      if (dist(g.x, g.y, m.dest.x, m.dest.y) < 45) { g.dead = true; this.complete(m); }
    }
  },
  onKill(g) { for (const m of G.missions) if (m.type === 'bounty' && m.sys === S.sys.id) { m.got = (m.got || 0) + 1; if (m.got === m.n) Toast.show('依頼の撃破数に届いた。ステーションで報告しよう', 'good'); } },
  newDay() {},
};
ITEMS.pkg = { id: 'pkg', name: '依頼の荷物', kind: 'pkg', price: 0, color: '#d8b070' };

function hopCount(a, b) {
  const sys = G.galaxy.systems;
  const seen = new Map([[a, 0]]), q = [a];
  while (q.length) { const x = q.shift(); if (x === b) return seen.get(x); for (const l of sys[x].lanes) if (!seen.has(l.to)) { seen.set(l.to, seen.get(x) + 1); q.push(l.to); } }
  return 5;
}
function spawnRescueDerelict(m) {
  const d = { x: m.pos.x, y: m.pos.y, seed: m.seed, key: 'hauler' };
  const g = makeDerelict(d, S.sys);
  g.rescueId = m.id;
  g.bpLoot = null;
  S.grids.push(g);
  const c = Crew.candidate(new RNG(m.seed), S.sys);
  // 依頼には人そのものではなく、作り直せる情報だけを持たせる (保存できるように)
  m.surv = { name: c.name, skills: c.skills, trait: c.trait, wage: c.wage, color: c.color };
  placeSurvivor(m, g);
  Toast.show('地図に漂流船の場所を示した');
}
/* 救助の生存者を漂流船の床に立たせる */
function placeSurvivor(m, g) {
  if (S.persons.some((x) => x.survivor === m.id)) return;
  const floors = []; g.eachBlock((b) => { if (b.def.walk && !b.def.door) floors.push(b); });
  const b = floors[0];
  const p = Crew.fromPlain(m.surv);
  p.mode = 'walk'; p.grid = g; p.lx = b ? b.x + 0.5 : 0; p.ly = b ? b.y + 0.5 : 0; p.survivor = m.id; p.kind = 'survivor';
  const st = m.survState;
  if (st) {
    const sg = st.gridId != null ? S.grids.find((o) => o.id === st.gridId) : null;
    if (st.mode === 'eva') { p.mode = 'eva'; p.grid = null; p.x = st.x; p.y = st.y; p.vx = st.vx || 0; p.vy = st.vy || 0; }
    else if (sg) { p.grid = sg; p.lx = st.lx; p.ly = st.ly; }
    p.hp = st.hp; p.o2 = st.o2; p.suit = st.suit != null ? st.suit : p.suit; p.follow = st.follow;
  }
  S.persons.push(p);
}

/* ---------- 最初の依頼の列 (DESIGN 3.3) と、その先の目標 ---------- */
const QUESTS = [
  { text: '近くの小惑星で鉄鉱石を掘る (マウス左で採掘レーザー)', n: 30, ev: 'mine', match: (a) => a === 'ore_iron', reward: 60 },
  { text: 'ステーションに戻って売る (近くで G で入港)', n: 1, ev: 'sell', reward: 40 },
  { text: '部品屋で小型推進器を買い、B の建築モードで船に付ける', n: 1, ev: 'build', match: (a) => a === 'thruster', reward: 80 },
  { text: 'F で操縦席を降り、手持ちドリル (1) で氷を掘る', n: 3, ev: 'minehand', match: (a) => a === 'ore_ice', reward: 60 },
  { text: '床と壁とドアで部屋を作り、酸素発生器を置く', n: 1, ev: 'room', reward: 150 },
  { text: '寝台を置いて、求人所で1人雇う', n: 1, ev: 'hire', reward: 150 },
  { text: 'はぐれ海賊を1隻倒す', n: 1, ev: 'kill', reward: 200 },
  { text: '大きな小惑星のとなりに固定アンカーを打って基地を作る', n: 1, ev: 'base', reward: 200 },
  { text: '2隻目の船を持つ (造船所で買うか、自分で組む)', n: 1, ev: 'fleet', reward: 200 },
  { text: '交易ゲートで隣の星系へ行く (ゲートのそばで G)', n: 1, ev: 'gate', reward: 250 },
  { text: '外縁のボス「海賊王の旗艦」を倒す (銀河マップ M で場所を確かめる)', n: 1, ev: 'boss', match: (a) => a === 0, reward: 0 },
  { text: 'ジャンプドライブを船に付けて、J で中域へ跳ぶ', n: 1, ev: 'ring', match: (a) => a >= 1, reward: 500 },
  { text: '中域のボス「鉄の要塞艦」を倒す', n: 1, ev: 'boss', match: (a) => a === 1, reward: 0 },
  { text: '内域のボス「群体の女王」を倒す', n: 1, ev: 'boss', match: (a) => a === 2, reward: 0 },
  { text: '中心核の「群体の母艦」を倒す', n: 1, ev: 'boss', match: (a) => a === 3, reward: 0 },
];
const Quest = {
  cur() { return QUESTS[G.quest] || null; },
  event(ev, a, b) {
    const q = this.cur();
    if (ev === 'mine' && G.player && G.player.mode !== 'seat') ev = 'minehand';
    if (!q) return;
    if (q.ev === 'minehand' && ev === 'mine') return;
    if (q.ev !== ev) return;
    if (q.match && !q.match(a, b)) return;
    G.questN = (G.questN || 0) + (ev === 'sell' ? 1 : 1);
    if (G.questN >= q.n) this.advance();
  },
  advance() {
    const q = this.cur();
    if (!q) return;
    G.quest++; G.questN = 0;
    if (q.reward) Econ.earn(q.reward, '依頼「' + q.text.split(' (')[0] + '」を達成');
    else Toast.show('達成: ' + q.text.split(' (')[0], 'good');
    this.checkState();
  },
  skip() { if (this.cur()) { G.quest++; G.questN = 0; this.checkState(); } },
  /* 状態で決まる依頼 (部屋ができた・船が2隻ある など) を確かめる */
  checkState() {
    const q = this.cur();
    if (!q) return;
    if (q.ev === 'room') {
      for (const g of S.grids) {
        if (g.faction !== 'player' || g.terrain) continue;
        g.updateSys();
        if (g.sys.o2gens.length && g.rooms.some((r) => !r.leak && r.size >= 2)) { this.advance(); return; }
      }
    }
    if (q.ev === 'fleet' && Fleet.count('ship') >= 2) this.advance();
    if (q.ev === 'hire' && G.crew.length >= 1) this.advance();
    if (q.ev === 'base' && Fleet.count('base') >= 1) this.advance();
    if (q.ev === 'boss' && G.bossDead[q.match ? [0, 1, 2, 3].find((r) => q.match(r)) : 0]) this.advance();
    if (q.ev === 'ring' && S.sys && S.sys.ring >= 1) this.advance();
  },
};
