/* =========================================================================
   NEKO MART ― お店の中身
   セーブする状態 G / その場だけの状態 R / 商品の値段と人気 / 1日の流れ /
   お客さんの出現 / レジ / 目標 / 演出
   ========================================================================= */
'use strict';

let G = null; // セーブする状態
const R = {   // セーブしない状態
  player: null, cats: [], queue: [], fx: [], t: 0, spawnT: 1, layoutV: 0,
  doorOpen: 0, chimeT: 0, scanBoost: false, atRegister: false, saveT: 0, missionT: 0, speed: 1,
};

/* ------------------------------ 新しいゲーム ------------------------------ */
function newGame(shopName, hero) {
  G = {
    ver: 1, shopName, hero,
    day: 1, phase: 'prep', clock: PREP_MIN, money: 1500, rep: 10, weather: 'sunny', lv: 0,
    furn: [], walls: { top: Array(8).fill(null), bottom: Array(8).fill(null) }, door: { x: 3, auto: false },
    signs: [], pics: {}, picSeq: 1,
    stock: { onigiri: 10, candy: 10 }, mats: {}, prices: {}, designs: [], designSeq: 1,
    carry: null, litter: [], puddles: [],
    stats: { shelved: 0, sold: 0, soldOrig: 0, ordered: 0, soldKind: {}, bestDay: 0, totalSales: 0, customers: 0, wishes: 0 },
    today: freshDay(10), mdone: [], nextUid: 1,
    closet: [], survey: { topic: null, cards: [], unread: 0, seq: 1 },
  };
  G.furn.push(Shop.newFurn('shelf', 0, 0));
  G.furn.push(Shop.newFurn('stock', 6, 0));
  G.furn.push(Shop.newFurn('register', 5, 3));
  G.furn.push(Shop.newFurn('wagon', 1, 3));
  G.walls.top[3] = { type: 'window' };
  G.walls.top[4] = { type: 'window' };
  Shop.rebuild();
  resetRuntime();
}
function freshDay(rep) {
  return { sales: 0, cost: 0, customers: 0, happy: 0, sad: 0, sold: {}, repStart: rep, quotes: [] };
}
function resetRuntime() {
  R.cats = []; R.queue = []; R.fx = []; R.spawnT = 1; R.layoutV++;
  R.player = new Player();
  const reg = Shop.register();
  const st = reg ? Shop.cashTile(reg) : Shop.doorIn();
  const p = Shop.nearestFree(st.x + 0.5, st.y + 0.5);
  R.player.x = p.x; R.player.y = p.y;
  R.player.carry = G.carry;
}

/* ------------------------------ セーブ ------------------------------ */
function saveGame() {
  if (!G) return false;
  G.carry = R.player ? R.player.carry : G.carry;
  const data = JSON.parse(JSON.stringify(G));
  for (const c of R.cats) {           // まだ払っていないかごの中身は倉庫にもどしておく
    if (c.paidUp) continue;
    for (const b of c.basket) data.stock[b.pid] = (data.stock[b.pid] || 0) + 1;
  }
  return Save.write(data);
}
/* 前の版のセーブを今の形にそろえる */
function migrate(d) {
  const h = d.hero;
  if (h && ('acc' in h || 'apron' in h)) {
    const acc = h.acc || 'none';
    d.hero = { name: h.name, coat: h.coat, eye: h.eye, eye2: null, body: 'apron', bodyCol: h.apron || null,
      head: acc === 'ribbon' ? 'ribbon' : acc === 'hat' ? 'beret' : 'none', face: acc === 'glasses' ? 'glasses' : 'none',
      neck: acc === 'bell' || acc === 'scarf' ? acc : 'none' };
  }
  if (!d.mdone) d.mdone = MISSIONS_V1.slice(0, d.mission || 0);
  delete d.mission;
  d.closet = d.closet || [];
  d.survey = d.survey || { topic: null, cards: [], unread: 0, seq: 1 };
  d.stats.wishes = d.stats.wishes || 0;
  for (const q of d.today.quotes || []) if (q.cat && !q.look) { q.look = { sp: 'cat', coat: q.cat.coat, eye: q.cat.eye }; delete q.cat; }
}
function loadGame() {
  const d = Save.read();
  if (!d || d.ver !== 1) return false;
  migrate(d);
  G = d;
  Shop.rebuild();
  resetRuntime();
  return true;
}

/* ------------------------------ 商品 ------------------------------ */
const isOrig = (pid) => typeof pid === 'string' && pid.startsWith('my:');
const designOf = (pid) => G.designs.find((d) => d.id === pid);
function prod(pid) {
  if (isOrig(pid)) {
    const d = designOf(pid);
    if (!d) return null;
    const F = FORM[d.form];
    return { pid, name: d.name, kind: F.kind, store: KINDS[F.kind].store, cost: d.cost, fair: d.fair,
      appeal: d.appeal, tags: d.tags || [], orig: true, art: d.ink >= 0.04 };
  }
  const g = GOOD[pid];
  if (!g) return null;
  return { pid, name: g.name, kind: g.kind, store: KINDS[g.kind].store, cost: g.cost, fair: g.fair,
    appeal: 1, tags: g.tags || [], orig: false, art: false };
}
const priceOf = (pid) => (G.prices[pid] != null ? G.prices[pid] : (prod(pid) || { fair: 100 }).fair);
function priceWord(price, fair) {
  const r = price / fair;
  if (r <= 0.8) return { t: 'やすい', c: 'good' };
  if (r <= 1.05) return { t: 'ちょうどいい', c: 'ok' };
  if (r <= 1.3) return { t: 'ちょっと高い', c: 'warn' };
  if (r <= 1.65) return { t: '高い', c: 'bad' };
  return { t: '高すぎ!', c: 'bad' };
}
/* 店頭に並んでいる数 */
function shelfCount(pid) {
  let n = 0;
  for (const f of G.furn) if (f.slots) for (const s of f.slots) if (s.pid === pid) n += s.n;
  return n;
}

/* オリジナル商品の評価。材料の組み合わせと、ラッピングの絵で決まる */
function evalRecipe(formId, flav, shape, ink = 0, colors = 0) {
  const F = FORM[formId];
  const fl = flav.filter(Boolean);
  const notes = [];
  let a = 1, cost = F.baseCost;
  for (const k in F.need) cost += MAT[k].cost * F.need[k];
  for (const m of fl) cost += MAT[m].cost;
  const tagsOf = (list) => { const s = new Set(); list.forEach((m) => (MAT[m].tags || []).forEach((t) => s.add(t))); return s; };
  const ft = tagsOf(fl), all = tagsOf([...Object.keys(F.need), ...fl]);
  const pair = (x, y) => (ft.has(x) && all.has(y)) || (ft.has(y) && all.has(x));
  const add = (v, msg) => { a += v; notes.push({ v, msg }); };
  a += 0.15 * fl.length;
  if (formId === 'doll') {
    if (fl.length) add(0.1 * fl.length, 'かざりがついてかわいい');
    if (fl.includes('bell')) add(0.1, 'すずの音はねこに大人気');
    if (shape === 'cat') add(0.2, 'ねこの町では、ねこの形が人気');
    if (shape === 'fish') add(0.15, 'おさかなの形はねこが大好き');
  } else {
    const fruits = new Set(fl.filter((m) => (MAT[m].tags || []).includes('fruit')));
    if (ft.has('fish')) add(0.25, 'おさかな味はねこが大好き');
    if (pair('fruit', 'milk')) add(0.4, 'くだものとミルクは相性ばつぐん');
    if (pair('fruit', 'fizzy')) add(0.4, 'しゅわしゅわフルーツ');
    if (pair('bitter', 'milk')) add(0.3, 'ミルクとほろにがは相性がいい');
    if (fruits.size >= 2) add(0.3, 'ミックスフルーツ');
    if (pair('fish', 'sweet')) add(-0.35, 'あまいおさかなは、ちょっとへん…');
    if (pair('fish', 'fizzy')) add(-0.45, 'しゅわしゅわおさかなは、へんな味…');
    if (pair('fish', 'fruit')) add(-0.3, 'くだものとおさかなは合わない…');
    if (fl.length === 2 && fl[0] === fl[1]) add(0.1, 'こいめの味');
    if (formId === 'onigiri' && (fl.includes('fish') || fl.includes('shrimp'))) add(0.3, 'おにぎりの定番の具');
    if (formId === 'cookie' && fl.includes('choco')) add(0.25, 'チョコクッキーは定番');
    if (formId === 'pizza' && (fl.includes('fish') || fl.includes('shrimp'))) add(0.25, 'シーフードピザ');
    if (formId === 'ice' && (fl.includes('choco') || fl.includes('berry'))) add(0.2, 'アイスの人気の味');
    if (formId === 'juice' && (fl.includes('orange') || fl.includes('apple'))) add(0.15, 'ジュースの定番');
  }
  if (ink >= 0.04) add(0.35, 'ラッピングに絵がある');
  if (ink >= 0.2) add(0.15, 'たくさんかいてある');
  if (ink >= 0.04 && colors >= 3) add(0.1, 'カラフルな絵');
  a = clamp(a, 0.5, 3);
  const tags = [...ft];
  if (formId === 'doll' && shape === 'fish') tags.push('fish');
  return {
    appeal: a, cost, notes, tags,
    stars: clamp(Math.round((a - 0.7) * 2.4), 1, 5),
    fair: round10(cost * (1.25 + 0.5 * a)),
  };
}
function suggestName(formId, flav, shape) {
  const F = FORM[formId];
  const fl = flav.filter(Boolean);
  if (formId === 'doll') {
    const sh = DOLL_SHAPES.find((s) => s.id === shape);
    return (fl.includes('ribbon') ? 'リボンの' : fl.includes('bell') ? 'すずつき' : '') + (sh ? sh.name : '') + 'のぬいぐるみ';
  }
  const words = [];
  for (const m of fl) if (MAT[m].word && !words.includes(MAT[m].word)) words.push(MAT[m].word);
  return words.join('') + F.tail;
}

/* ------------------------------ 評判 ------------------------------ */
const stars = () => clamp(1 + Math.floor(G.rep / 20), 1, 5);
function addRep(v) { G.rep = clamp(G.rep + v, 0, 100); }

/* 通りの猫がお店に入りたくなる度合い */
function attraction() {
  const front = G.walls.bottom.filter((w) => w && w.type === 'window').length;
  const posters = G.walls.top.concat(G.walls.bottom).filter((w) => w && w.type === 'poster').length;
  const outLitter = G.litter.filter((l) => l.y >= Shop.H).length;
  const kinds = new Set();
  for (const f of G.furn) if (f.slots) for (const s of f.slots) if (s.n > 0) kinds.add(s.pid);
  let a = 0.28
    + 0.05 * Math.min(front, 4)
    + 0.03 * Math.min(posters, 4)
    + 0.1 * Math.min(G.signs.length, MAX_SIGNS)
    + (G.door.auto ? 0.08 : 0)
    + 0.02 * Math.min(Shop.count('plant'), 3)
    + G.rep * 0.003
    + 0.01 * Math.min(kinds.size, 10)
    - 0.03 * outLitter;
  return clamp(a, 0.05, 0.9);
}
const maxInside = () => 3 + G.lv * 2;
const shoppers = () => R.cats.filter((c) => c.shopper).length;
function timeMul(min) {
  const h = min / 60;
  if (h < 11) return 0.75;
  if (h < 13.5) return 1.4;
  if (h < 16) return 0.9;
  return 1.2;
}

/* ------------------------------ 1日の流れ ------------------------------ */
const Day = {
  open() {
    if (G.phase !== 'prep') return;
    G.phase = 'open';
    G.clock = OPEN_MIN;
    G.today = freshDay(G.rep);
    R.spawnT = 1.5;
    Sound.play('open');
    Toast.show('開店! いらっしゃいませ', 'good');
    UI.refresh();
  },
  update(dt) {
    if (G.phase === 'open') {
      G.clock += dt / MIN_SEC;
      if (G.clock >= CLOSE_MIN) {
        G.clock = CLOSE_MIN;
        G.phase = 'closing';
        Sound.play('close');
        Toast.show(shoppers() ? '閉店の時間。のこりのお客さんを接客しよう' : '閉店の時間');
      }
    }
    if (G.phase === 'closing' && shoppers() === 0) this.end();
  },
  end() {
    G.phase = 'summary';
    G.stats.bestDay = Math.max(G.stats.bestDay, G.today.sales);
    for (const f of G.furn) if (f.type === 'umbrella') f.umb = 0;
    G.puddles = [];
    Missions.check();
    saveGame();
    UI.showSummary();
  },
  next() {
    G.day++;
    G.phase = 'prep';
    G.clock = PREP_MIN;
    G.weather = pickWeighted({ sunny: 40, hot: 20, cloudy: 25, rain: 15 });
    G.today = freshDay(G.rep);
    R.cats = R.cats.filter((c) => !c.shopper);
    R.queue = [];
    Missions.check();
    saveGame();
    UI.refresh();
    const w = WEATHER[G.weather];
    Toast.show(`${G.day}日目 ${w.icon} ${w.name}: ${w.tip}`);
  },
};

/* ------------------------------ お客さん ------------------------------ */
function spawnTick(dt) {
  R.spawnT -= dt;
  if (R.spawnT > 0) return;
  const W = WEATHER[G.weather];
  const rate = G.phase === 'open' ? (0.38 + G.rep * 0.004) * timeMul(G.clock) * W.walk : 0.12;
  R.spawnT = (1 / rate) * rfloat(0.6, 1.4);
  if (R.cats.length >= 28) return;
  const enter = G.phase === 'open' && shoppers() < maxInside() && chance(attraction());
  R.cats.push(new Customer(enter));
}
function chooseWant(sp) {
  if (chance(0.15)) return null;
  const onShelf = new Set();
  for (const f of G.furn) if (f.slots) for (const s of f.slots) { const p = s.n > 0 && prod(s.pid); if (p) onShelf.add(p.kind); }
  const w = {}, ww = WEATHER[G.weather].want, sw = SPECIES[sp || 'cat'].want || {};
  for (const k in KINDS) w[k] = (onShelf.has(k) ? 3 : 0.35) * (ww[k] || 1) * (sw[k] || 1);
  return pickWeighted(w);
}

/* ------------------------------ レジ ------------------------------ */
function updateRegister(dt) {
  const reg = Shop.register();
  if (!reg) return;
  const cash = Shop.cashTile(reg);
  const p = R.player;
  R.atRegister = dist(p.x, p.y, cash.x + 0.5, cash.y + 0.5) < 0.62;
  R.queue = R.queue.filter((c) => c.alive && (c.state === 'queue' || c.state === 'pay'));
  R.queue.forEach((c, i) => { if (c.qi !== i) { c.qi = i; c.goQueue(); } });
  const front = R.queue[0];
  if (!front) { R.scanBoost = false; return; }
  if (front.state === 'queue' && front.arrived && R.atRegister) {
    front.state = 'pay'; front.scanI = 0; front.scanT = 0;
  }
  if (front.state !== 'pay' || !R.atRegister) return;
  front.scanT += dt;
  if (front.scanT >= 0.42 || R.scanBoost) {
    R.scanBoost = false;
    front.scanT = 0;
    const b = front.basket[front.scanI++];
    if (b) {
      Sound.play('scan');
      FX.fly(b.pid, front.x, front.y - 0.4, reg.x + 0.6, reg.y + 0.1, 0.25);
    }
  }
  if (front.scanI >= front.basket.length) checkout(front);
}
function checkout(c) {
  let total = 0, cost = 0;
  for (const b of c.basket) {
    total += b.price; cost += b.cost;
    const p = prod(b.pid);
    G.today.sold[b.pid] = (G.today.sold[b.pid] || 0) + 1;
    G.stats.sold++;
    if (p && p.orig) G.stats.soldOrig++;
    if (p) G.stats.soldKind[p.kind] = (G.stats.soldKind[p.kind] || 0) + 1;
  }
  G.money += total;
  G.today.sales += total;
  G.today.cost += cost;
  G.stats.totalSales += total;
  Sound.play('coin');
  const reg = Shop.register();
  FX.coins(reg.x + 0.6, reg.y + 0.3, Math.min(8, 2 + c.basket.length));
  FX.text('+' + yen(total), reg.x + 1.6, reg.y - 0.3, '#ffcf3a');
  R.queue.shift();
  c.paidUp = true;
  c.paid();
  Missions.check();
}

/* ------------------------------ 目標 ------------------------------ */
const MCHECK = {
  shelve: () => G.stats.shelved > 0,
  open: () => G.phase !== 'prep' || G.day > 1,
  sell1: () => G.stats.sold > 0,
  day2: () => G.day >= 2,
  order: () => G.stats.ordered > 0,
  bench: () => Shop.count('bench') > 0,
  craft: () => G.designs.length > 0,
  wrap: () => G.designs.some((d) => d.ink >= 0.04),
  sellOrig: () => G.stats.soldOrig >= 3,
  sign: () => G.signs.length > 0,
  drink: () => (G.stats.soldKind.drink || 0) > 0,
  trash: () => Shop.count('trash') > 0,
  poster: () => G.walls.top.concat(G.walls.bottom).some((w) => w && w.type === 'poster'),
  window: () => G.walls.bottom.some((w) => w && w.type === 'window'),
  sales5k: () => Math.max(G.stats.bestDay, G.today.sales) >= 5000,
  expand: () => G.lv > 0,
  umbrella: () => Shop.count('umbrella') > 0,
  cold: () => Shop.count('freezer') > 0 && Shop.count('icecase') > 0,
  autodoor: () => G.door.auto,
  star4: () => stars() >= 4,
  sales20k: () => Math.max(G.stats.bestDay, G.today.sales) >= 20000,
  maxshop: () => G.lv >= SHOP_SIZES.length - 1,
  survey: () => Shop.count('survey') > 0,
  wish: () => G.stats.wishes > 0,
  fashion: () => G.closet.length > 0,
};
const Missions = {
  current() { return MISSIONS.find((m) => !G.mdone.includes(m.id)) || null; },
  check() {
    let m = this.current();
    while (m && MCHECK[m.id]()) {
      G.mdone.push(m.id);
      if (m.reward) G.money += m.reward;
      Sound.play('mission');
      Toast.show('目標クリア! ' + (m.reward ? `ごほうび ${yen(m.reward)}` : ''), 'good');
      m = this.current();
    }
    UI.refreshMission();
  },
  /* 矢印で指す場所 (最初のうちだけ) */
  guide() {
    const m = this.current();
    if (!m) return null;
    const p = R.player;
    if (m.id === 'shelve') {
      if (!p.carry) return Shop.stockRack();
      return Shop.displays().find((f) => FURN[f.type].display === prod(p.carry.pid).store) || null;
    }
    if (m.id === 'sell1' && R.queue.length && !R.atRegister) return Shop.register();
    if (m.id === 'craft') return G.furn.find((f) => f.type === 'bench') || null;
    if (m.id === 'wish' && G.survey.unread) return G.furn.find((f) => f.type === 'survey') || null;
    return null;
  },
};

/* ------------------------------ アンケート ------------------------------
   お客さんが「こんなのがほしい」を紙に書く。その物を店に並べるとかなう */
const Survey = {
  name(q) {
    if (q.t === 'good') return GOOD[q.pid].name;
    if (q.shape) return DOLL_SHAPES.find((s) => s.id === q.shape).name + 'のぬいぐるみ';
    return MAT[q.flav].word + FORM[q.form].tail;
  },
  key(q) { return q.t === 'good' ? 'g:' + q.pid : `m:${q.form}:${q.flav || ''}:${q.shape || ''}`; },
  kind(q) { return q.t === 'good' ? GOOD[q.pid].kind : FORM[q.form].kind; },
  icon(q) {
    if (q.t === 'good') return GOOD[q.pid].emoji;
    return FORM[q.form].emoji + (q.flav ? MAT[q.flav].emoji : '');
  },
  fulfilled(q) {
    if (q.t === 'good') return shelfCount(q.pid) > 0;
    return G.designs.some((d) => d.form === q.form && (!q.flav || d.flav.includes(q.flav)) &&
      (!q.shape || d.shape === q.shape) && shelfCount(d.id) > 0);
  },
  /* お客さんが書くたのみごと。質問 (topic) があれば、その種類の中から */
  make(c) {
    const topic = G.survey.topic, S = SPECIES[c.look.sp];
    const opts = [];
    if (c.want && !c.gotWant) for (const g of GOODS) if (g.kind === c.want) opts.push([{ t: 'good', pid: g.id }, 3]);
    for (const w of S.wishes) opts.push([{ t: 'make', ...w }, 1.5]);
    for (const g of GOODS) opts.push([{ t: 'good', pid: g.id }, 0.25]);
    if (topic) {
      for (const f of FORMS) {
        if (f.kind !== topic) continue;
        if (f.id === 'doll') for (const s of DOLL_SHAPES) opts.push([{ t: 'make', form: 'doll', shape: s.id }, 0.3]);
        else for (const m of f.choices) opts.push([{ t: 'make', form: f.id, flav: m }, 0.15]);
      }
    }
    const cand = opts.filter(([q]) => (!topic || this.kind(q) === topic) && !this.fulfilled(q));
    if (!cand.length) return null;
    const w = {};
    cand.forEach(([, v], i) => { w[i] = v; });
    return cand[+pickWeighted(w)][0];
  },
  write(c) {
    const q = this.make(c);
    if (!q) return false;
    const n = this.name(q);
    const lines = q.t === 'good'
      ? [`「${n}」を置いてほしいにゃ`, `${n}があったらうれしいにゃ`, `${n}、売ってほしいにゃ!`]
      : [`「${n}」を作ってほしいにゃ`, `${n}がほしいにゃ!`, `${n}、作れるかにゃ?`];
    const cards = G.survey.cards;
    cards.unshift({ id: G.survey.seq++, day: G.day, name: c.name, look: { ...c.look }, req: q, text: voice(pick(lines), c.look.sp), done: false });
    while (cards.length > 30) {
      let i = -1;
      for (let k = cards.length - 1; k >= 0; k--) if (cards[k].done) { i = k; break; }
      cards.splice(i >= 0 ? i : cards.length - 1, 1);
    }
    if (!G.survey.unread++) Toast.show('📝 アンケート台に新しい紙が入った');
    return true;
  },
  check() {
    for (const card of G.survey.cards) {
      if (card.done || !this.fulfilled(card.req)) continue;
      card.done = true;
      card.doneDay = G.day;
      G.stats.wishes++;
      addRep(1.5);
      Sound.play('mission');
      Toast.show(`✨ ${card.name}さんのリクエスト「${this.name(card.req)}」をかなえた!`, 'good');
    }
  },
};
const heroLook = () => ({ sp: 'cat', ...G.hero, size: 1.06, seed: 0.3 });

/* ------------------------------ 演出 ------------------------------ */
const FX = {
  text(text, x, y, color = '#fff', life = 1.3) { R.fx.push({ k: 'text', text, x, y, color, t: 0, life }); },
  coins(x, y, n) {
    for (let i = 0; i < n; i++) R.fx.push({ k: 'coin', x, y, vx: rfloat(-1.6, 1.6), vy: rfloat(-4.2, -2.6), t: 0, life: 0.8 });
  },
  fly(pid, x0, y0, x1, y1, life = 0.35) { R.fx.push({ k: 'fly', pid, x0, y0, x1, y1, t: 0, life }); },
  sparkle(x, y, n = 6) {
    for (let i = 0; i < n; i++) R.fx.push({ k: 'spark', x: x + rfloat(-0.4, 0.4), y: y + rfloat(-0.6, 0.1), t: -i * 0.05, life: 0.7 });
  },
  heart(x, y) { R.fx.push({ k: 'heart', x, y, t: 0, life: 1.1 }); },
  update(dt) {
    for (const f of R.fx) {
      f.t += dt;
      if (f.k === 'coin') { f.vy += 12 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    }
    R.fx = R.fx.filter((f) => f.t < f.life);
  },
};

/* ------------------------------ 1フレーム ------------------------------ */
function simUpdate(dt) {
  R.t += dt;
  Day.update(dt);
  spawnTick(dt);
  R.player.update(dt);
  for (const c of R.cats) c.update(dt);
  R.cats = R.cats.filter((c) => c.alive);
  updateRegister(dt);
  FX.update(dt);
  R.chimeT -= dt;
  /* ドアのあけしめ */
  const d = Shop.doorIn();
  let near = dist(R.player.x, R.player.y, d.x + 0.5, d.y + 1) < 1.2;
  if (!near) for (const c of R.cats) if (dist(c.x, c.y, d.x + 0.5, d.y + 1) < 1.2) { near = true; break; }
  R.doorOpen = clamp(R.doorOpen + (near ? 1 : -1) * dt * (G.door.auto ? 5 : 3.5), 0, 1);
  R.missionT -= dt;
  if (R.missionT <= 0) { R.missionT = 0.5; Survey.check(); Missions.check(); }
}
