/* =========================================================================
   ハムスターの冒険 ― ゲーム本体
   歩く / たたく / 集める / つくる / 売り買い / 塔 / 冒険のすすみぐあい
   ========================================================================= */
'use strict';

const SPEED = 150;
const ROLL_T = 0.32;
const SWING = { paw: [0.2, 24, 1.0], sword: [0.26, 36, 1.3], spear: [0.3, 48, 0.5], hammer: [0.42, 40, 1.7] };

const CHEST_LOOT = {
  forestNE: { coins: 30, items: [['acorn', 4], ['rope', 2]] },
  forestSW: { coins: 40, gear: 'shirtY' },
  lakeIsle: { items: [['goldseed', 1], ['honey', 2]] },
  mtPocket: { coins: 80, items: [['iron', 5]] },
  snowPeak: { coins: 150, items: [['ice', 2], ['potion', 2]] },
  valleyN: { items: [['goldseed', 1], ['ether', 2], ['crystal', 2]] },
  valleyS: { coins: 200, items: [['crystal', 3]] },
  moonSE: { coins: 300, items: [['goldseed', 2], ['moon', 2]] },
};

const needExp = (lv) => Math.round(10 + 5 * Math.pow(lv, 1.7));

const Game = {
  G: null, playing: false, last: 0, saveT: 0, hudT: 0, newArmed: false, busyFade: false, demoT: null,

  /* ============================== はじめ ============================== */
  boot() {
    Options.load();
    R.init(document.getElementById('game'));
    Input.init(R.canvas);
    UI.init();
    this.bindTitle();
    const unlock = () => { Snd.unlock(); if (!this.playing) Music.play('title'); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.startDemo();
    requestAnimationFrame((t) => this.loop(t));
  },

  /* タイトルの後ろで、家のまわりをハムスターが歩く */
  startDemo() {
    const G = this.fresh(HERO_DEFAULT);
    G.map = World.buildOverworld(G.flags);
    G.p.x = 18 * TILE; G.p.y = 106 * TILE;
    G.eq.weapon = 'wsword'; G.eq.hat = 'straw'; G.owned.add('leafbag');
    this.buildNpcsFor(G);
    this.G = G;
    Build.attach(G.map);
    this.demoT = 0;
    R.dropChunks();
    R.follow(G.map, 24 * TILE, 101 * TILE, true);
  },
  demoStep(dt) {
    const G = this.G, p = G.p;
    this.demoT += dt;
    const a = this.demoT * 0.5;
    const tx = 17 * TILE + Math.cos(a) * 56, ty = 106 * TILE + Math.sin(a) * 22;
    const dx = tx - p.x, dy = ty - p.y;
    p.moving = Math.hypot(dx, dy) > 2;
    if (p.moving) p.face = this.faceOf(dx, dy);
    p.x += dx * Math.min(1, dt * 3); p.y += dy * Math.min(1, dt * 3);
    R.follow(G.map, 24 * TILE, 101 * TILE, true);
  },

  bindTitle() {
    const $ = (id) => document.getElementById(id);
    const cont = $('btnContinue');
    const refresh = () => { cont.disabled = !Save.has(); cont.classList.toggle('ghost', cont.disabled); };
    refresh();
    $('btnNew').addEventListener('click', () => {
      Sfx.click();
      if (Save.has() && !this.newArmed) { this.newArmed = true; $('newWarn').classList.add('on'); return; }
      $('titleScreen').classList.add('hidden');
      $('nameScreen').classList.remove('hidden');
      $('heroInput').value = HERO_DEFAULT;
      UI.initSettings();
      $('heroInput').focus();
    });
    cont.addEventListener('click', () => { Sfx.click(); this.continueGame(); });
    $('btnHelp').addEventListener('click', () => $('titleHelp').classList.toggle('on'));
    $('btnNameBack').addEventListener('click', () => { $('nameScreen').classList.add('hidden'); $('titleScreen').classList.remove('hidden'); });
    $('btnStart').addEventListener('click', () => {
      const name = ($('heroInput').value.trim() || HERO_DEFAULT).slice(0, 8);
      $('nameScreen').classList.add('hidden');
      Sfx.click();
      this.newGame(name, UI.newSettings());
    });
    $('heroInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnStart').click(); });
    $('btnRevive').addEventListener('click', () => this.revive());
    $('btnEndClose').addEventListener('click', () => { $('endScreen').classList.add('hidden'); Music.play(this.regionMusic()); });
    $('btnEndTitle').addEventListener('click', () => { $('endScreen').classList.add('hidden'); this.save(); this.toTitle(); });
    this.refreshTitle = refresh;
  },

  toTitle() {
    this.playing = false; this.newArmed = false;
    this.startDemo();
    UI.closeAll();
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('newWarn').classList.remove('on');
    document.getElementById('titleScreen').classList.remove('hidden');
    this.refreshTitle();
    Music.play('title');
  },

  /* ============================== 状態 ============================== */
  fresh(name) {
    return {
      ver: 1, name,
      lv: 1, exp: 0, hp: 30, mp: 10, coins: 10,
      inv: [], owned: new Set(['paw', 'cheek', 'stick']),
      eq: { weapon: 'stick', staff: null, body: null, hat: null },
      books: { fire: false, wind: false, heal: false, star: false },
      spell: 'bolt',
      flags: { thorns: false, guide: false, bridge: false, chests: {}, warps: { home: true }, reqs: {}, elder: 0, bosses: {}, towers: {}, ending: false },
      rest: 'home', time: 0, kills: 0, earned: 0,
      reveal: new Uint8Array(CW * CH),

      map: null, tower: null,
      p: this.freshPlayer(),
      mobs: [], boss: null, shots: [], zaps: [], marks: [], drops: [], npcs: [], critters: [], pet: null, ride: null, raidT: 0,
      builds: [], bitems: [], bedAt: null, grave: null, fur: 'gold', keepInv: false,
      near: null, target: null, region: 'forest', coldT: 0, regenT: 0, calmT: 0, mpT: 0,
      floorOpen: false, objective: '',
    };
  },
  freshPlayer() {
    return {
      x: 0, y: 0, face: 'down', aim: Math.PI / 2, moving: false,
      swing: -1, swingMax: 0.26, swingHit: false, cool: 0,
      roll: -1, rollCool: 0, rdx: 0, rdy: 1,
      iframe: 0, hurtT: 0, flash: 0, castT: 0, castCool: 0, slowT: 0, kbx: 0, kby: 0, dead: false,
      climber: true, high: false,
    };
  },

  newGame(name, opt = {}) {
    const G = this.fresh(name);
    this.G = G;
    G.fur = FURS[opt.fur] ? opt.fur : 'gold';
    G.keepInv = !!opt.keepInv;
    G.map = World.buildOverworld(G.flags);
    Build.attach(G.map);
    const r = World.rests.home;
    G.p.x = r.x * TILE + 16; G.p.y = r.y * TILE + 20;
    this.buildNpcs();
    this.start();
    UI.talk('ハム太の家', [
      `${name}の 新しいくらしが はじまった。`,
      '木や草をたたいて 材料を集め、道具をつくろう（🎒 ボタン / I キー）。',
      `材料がそろったら ${Input.isTouch ? '🔨 ボタン' : 'B キー'}で建築。水べに水車を建てて、ベルトコンベアと機械を うごかそう！`,
    ]);
  },

  continueGame() {
    const d = Save.read();
    if (!d) return;
    const G = this.fresh(d.name || HERO_DEFAULT);
    this.G = G;
    for (const k of ['lv', 'exp', 'hp', 'mp', 'coins', 'spell', 'rest', 'time', 'kills', 'earned', 'bedAt', 'grave', 'keepInv']) if (d[k] !== undefined) G[k] = d[k];
    if (FURS[d.fur]) G.fur = d.fur;
    G.builds = Build.load(d.builds);
    G.inv = (d.inv || []).filter((s) => ITEMS[s.id] && s.n > 0);
    G.owned = new Set((d.owned || []).filter((id) => GEAR[id]));
    G.owned.add('paw'); G.owned.add('cheek'); G.owned.add('stick');
    Object.assign(G.eq, d.eq || {});
    for (const k in G.eq) if (G.eq[k] && !G.owned.has(G.eq[k])) G.eq[k] = k === 'weapon' ? 'paw' : null;
    Object.assign(G.books, d.books || {});
    Object.assign(G.flags, d.flags || {});
    if (d.reveal) for (let i = 0; i < Math.min(d.reveal.length, G.reveal.length); i++) G.reveal[i] = d.reveal.charCodeAt(i) === 49 ? 1 : 0;
    G.map = World.buildOverworld(G.flags);
    Build.attach(G.map);
    const pos = d.pos && World.walkable(G.map, d.pos.x, d.pos.y) ? d.pos : null;
    const r = World.rests[G.rest] && !World.rests[G.rest].map ? World.rests[G.rest] : World.rests.home;
    G.p.x = pos ? pos.x : r.x * TILE + 16; G.p.y = pos ? pos.y : r.y * TILE + 20;
    G.hp = clamp(G.hp, 1, this.maxHp()); G.mp = clamp(G.mp, 0, this.maxMp());
    Critters.loadPet();
    this.placeGraveStruct();
    this.buildNpcs();
    this.start();
    toast('つづきから はじめます');
  },

  start() {
    this.playing = true;
    this.demoT = null;
    document.getElementById('titleScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    R.dropChunks();
    R.follow(this.G.map, this.G.p.x, this.G.p.y, true);
    FX.clear();
    this.updateRegion(true);
    this.refreshObjective();
    UI.refreshHUD();
  },

  save() {
    const G = this.G;
    if (!G) return;
    let pos = { x: G.p.x, y: G.p.y };
    if (G.tower) { const s = this.towerStruct(G.tower.id); const d = World.door(s); pos = { x: d.x * TILE + 16, y: (d.y + 1) * TILE + 8 }; }
    if (G.map && G.map.kind === 'kingdom') pos = this.dockPos();
    Save.write({
      ver: 1, name: G.name, lv: G.lv, exp: G.exp, hp: G.hp, mp: G.mp, coins: G.coins,
      inv: G.inv, owned: [...G.owned], eq: G.eq, books: G.books, spell: G.spell, flags: G.flags,
      rest: G.rest, time: Math.round(G.time), kills: G.kills, earned: G.earned,
      reveal: Array.from(G.reveal, (v) => (v ? '1' : '0')).join(''), pos,
      builds: Build.saveData(), bedAt: G.bedAt, grave: G.grave, fur: G.fur, keepInv: G.keepInv,
    });
  },

  /* ============================== 町の人 ============================== */
  buildNpcs() { this.buildNpcsFor(this.G); },
  buildNpcsFor(G) {
    const N = (o) => {
      const n = Object.assign({ map: 'over', face: 'down', moving: false, seed: Math.random() * 10, wander: 0, fur: 'cream' }, o);
      n.x = n.tx * TILE + 16; n.y = n.ty * TILE + 20; n.hx = n.x; n.hy = n.y; n.goal = null; n.wait = Math.random() * 3;
      G.npcs.push(n);
      return n;
    };
    G.npcs = [];
    N({ id: 'elder', role: 'elder', name: ELDER.name, tx: 73, ty: 81, fur: 'white', beard: true, body: 'robe', glasses: true });
    N({ id: 'momo', role: 'req', req: 'bread', name: REQUESTS.bread.who, tx: 66, ty: 99, fur: 'cream', apron: '#ffffff', hat: 'ribbon', wander: 2 });
    N({ id: 'ganta', role: 'req', req: 'wood', name: REQUESTS.wood.who, tx: 80, ty: 99, fur: 'brown', body: 'shirtB', hat: 'straw', wander: 2 });
    N({ id: 'chiyo', role: 'req', req: 'silk', name: REQUESTS.silk.who, tx: 67, ty: 73, fur: 'white', body: 'shirtR', wander: 1 });
    N({ id: 'hakase', role: 'req', req: 'crystal', name: REQUESTS.crystal.who, tx: 82, ty: 73, fur: 'gray', glasses: true, body: 'robe', wander: 1 });
    N({ id: 'saba', role: 'req', req: 'honey', name: REQUESTS.honey.who, tx: 70, ty: 46, fur: 'choco', hat: 'straw', wander: 1 });
    const folk = [['ポポ', 'gold', 'shirtY', null], ['ミミ', 'white', 'shirtR', 'ribbon'], ['チップ', 'panda', 'shirtB', 'knitcap'], ['ココ', 'cream', null, null], ['ノノ', 'gray', 'shirtY', 'straw']];
    const spots = [[66, 85], [76, 76], [64, 66], [79, 86], [71, 92]];
    folk.forEach(([name, fur, body, hat], i) => N({ id: 'folk' + i, role: 'folk', name, tx: spots[i][0], ty: spots[i][1], fur, body, hat, wander: 4, line: i }));
    N({ id: 'guide', role: 'guide', name: GUIDE.name, tx: 108, ty: 46, fur: 'brown', body: 'coat', hat: 'knitcap' });
    N({ id: 'kurumi', role: 'merchant', name: SHOPS.camp.owner, tx: 144, ty: 48, fur: 'brown', bag: 'advbag', hat: 'straw' });
    /* 町の入口を守る騎士 */
    KNIGHT_POSTS.forEach(([tx, ty], i) => N({ id: 'knight' + i, role: 'knight', name: '王国の騎士', tx, ty, fur: ['gray', 'brown', 'white', 'black'][i % 4], body: 'knight', hat: 'helmet', weapon: 'cspear', line: i }));
    /* 湖の王国 */
    const K = (o) => N(Object.assign({ map: 'kingdom' }, o));
    K({ id: 'king', role: 'king', name: KING.name, tx: 75, ty: 34, fur: 'white', beard: true, body: 'royal', hat: 'crown', scale: 1.25 });
    K({ id: 'garde', role: 'knight', name: '騎士団長 ガルド', tx: 72, ty: 35, fur: 'gray', body: 'knight', hat: 'helmet', weapon: 'ksword', line: 0 });
    for (const [tx, ty] of [[72, 101], [77, 101], [72, 18], [77, 18], [25, 57], [25, 62], [125, 57], [125, 62]]) K({ id: 'kk' + tx + ty, role: 'knight', name: '王国の騎士', tx, ty, fur: 'gray', body: 'knight', hat: 'helmet', weapon: 'cspear', line: (tx + ty) % 3 });
    /* 城壁の上を見まわる騎士 */
    for (const [tx, ty] of [[50, 103], [100, 103], [50, 15], [100, 15], [23, 40], [127, 80]]) K({ id: 'kw' + tx + ty, role: 'knight', name: '城壁の見はり', tx, ty, fur: 'brown', body: 'knight', hat: 'helmet', weapon: 'cspear', line: 2 });
    const kfolk = [['ルル', 'white', 'shirtB', 'ribbon', 74, 46], ['ペコ', 'cream', 'shirtR', 'straw', 60, 60], ['トト', 'choco', null, 'knitcap', 90, 60], ['ナナ', 'gray', 'shirtY', null, 74, 78], ['モカ', 'brown', 'shirtB', null, 40, 60], ['ソラ', 'panda', null, 'straw', 110, 60]];
    kfolk.forEach(([name, fur, body, hat, tx, ty], i) => K({ id: 'kf' + i, role: 'folk', name, tx, ty, fur, body, hat, wander: 4, line: i + 3 }));
  },

  updateNpcs(dt) {
    const G = this.G;
    for (const n of G.npcs) {
      if (n.map !== G.map.id) continue;
      n.moving = false;
      const dp = dist(n.x, n.y, G.p.x, G.p.y);
      if (dp < 60) {
        const a = Math.atan2(G.p.y - n.y, G.p.x - n.x);
        n.face = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');
        continue;
      }
      if (!n.wander || n.fighting || n.stun) continue;
      if (!n.goal) {
        n.wait -= dt;
        if (n.wait <= 0) {
          const gx = n.hx + rand(-1, 1) * n.wander * TILE, gy = n.hy + rand(-1, 1) * n.wander * TILE;
          if (World.walkable(G.map, gx, gy, 8)) n.goal = { x: gx, y: gy };
          n.wait = rand(1.5, 4);
        }
        continue;
      }
      const dx = n.goal.x - n.x, dy = n.goal.y - n.y, d = Math.hypot(dx, dy);
      if (d < 4) { n.goal = null; continue; }
      const sp = 45 * dt;
      const ox = n.x, oy = n.y;
      World.move(G.map, n, (dx / d) * sp, (dy / d) * sp, 7);
      if (Math.hypot(n.x - ox, n.y - oy) < sp * 0.3) n.goal = null;
      n.moving = true;
      n.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    for (const n of G.npcs) {
      n.mark = null;
      if (n.role === 'req' && !G.flags.reqs[n.req]) n.mark = this.hasAll(REQUESTS[n.req].need) ? '★' : '!';
      if (n.role === 'guide' && !G.flags.guide) n.mark = '!';
      if (n.role === 'king' && !G.flags.king) n.mark = '!';
    }
  },

  /* ============================== 計算 ============================== */
  gearSum(k) {
    const G = this.G;
    let s = 0;
    for (const slot of ['weapon', 'staff', 'body', 'hat']) { const id = G.eq[slot]; if (id && GEAR[id][k]) s += GEAR[id][k]; }
    return s;
  },
  maxHp() { return 30 + (this.G.lv - 1) * 6; },
  maxMp() { return 10 + (this.G.lv - 1) * 2 + this.gearSum('mp'); },
  atk() { return GEAR[this.G.eq.weapon || 'paw'].atk + Math.floor((this.G.lv - 1) * 1.2); },
  def() { return this.gearSum('def'); },
  mag() { return this.G.eq.staff ? this.gearSum('mag') + Math.floor((this.G.lv - 1) * 0.8) : 0; },
  mineTier() {
    const G = this.G;
    let t = 0;
    if (G.owned.has('pick')) t = 1;
    if (G.owned.has('ipick')) t = 2;
    if (G.eq.weapon && GEAR[G.eq.weapon].mine) t = Math.max(t, GEAR[G.eq.weapon].mine);
    return t;
  },
  warm() { const b = this.G.eq.body; return !!(b && GEAR[b].warm); },
  bagId() {
    let best = 'cheek';
    for (const id of this.G.owned) if (GEAR[id].slot === 'bag' && GEAR[id].slots > GEAR[best].slots) best = id;
    return best;
  },
  slots() { return GEAR[this.bagId()].slots; },
  bagFill() {
    const G = this.G;
    const used = G.inv.length / this.slots();
    return this.bagId() === 'cheek' ? used : used * 0.35;
  },

  /* ------------------------------ もちもの ------------------------------ */
  count(id) { let n = 0; for (const s of this.G.inv) if (s.id === id) n += s.n; return n; },
  hasAll(need) { for (const k in need) if (this.count(k) < need[k]) return false; return true; },
  room(id) {
    let r = 0;
    for (const s of this.G.inv) if (s.id === id) r += STACK - s.n;
    return r + (this.slots() - this.G.inv.length) * STACK;
  },
  add(id, n) {
    const G = this.G;
    let left = n;
    for (const s of G.inv) {
      if (!left) break;
      if (s.id === id && s.n < STACK) { const k = Math.min(left, STACK - s.n); s.n += k; left -= k; }
    }
    while (left > 0 && G.inv.length < this.slots()) {
      const k = Math.min(left, STACK);
      G.inv.push({ id, n: k }); left -= k;
    }
    return n - left;
  },
  remove(id, n) {
    const G = this.G;
    for (let i = G.inv.length - 1; i >= 0 && n > 0; i--) {
      const s = G.inv[i];
      if (s.id !== id) continue;
      const k = Math.min(n, s.n); s.n -= k; n -= k;
      if (s.n <= 0) G.inv.splice(i, 1);
    }
  },
  /* 入りきらない分は足もとに置く */
  give(id, n, x, y) {
    const got = this.add(id, n);
    if (got < n) this.drop(x ?? this.G.p.x, y ?? this.G.p.y, id, n - got);
    return got;
  },
  gainGear(id) {
    const G = this.G, g = GEAR[id];
    const first = !G.owned.has(id);
    G.owned.add(id);
    if (['weapon', 'staff', 'body', 'hat'].includes(g.slot)) {
      const cur = G.eq[g.slot];
      const better = !cur || cur === 'paw' || (g.slot === 'weapon' && g.atk > GEAR[cur].atk) || (g.slot === 'staff' && g.mag > GEAR[cur].mag) ||
        ((g.slot === 'body' || g.slot === 'hat') && (g.def || 0) > (GEAR[cur].def || 0));
      if (better) G.eq[g.slot] = id;
    }
    return first;
  },
  equip(id) {
    const G = this.G, slot = GEAR[id].slot;
    if (!['weapon', 'staff', 'body', 'hat'].includes(slot)) return;
    if (G.eq[slot] === id) G.eq[slot] = slot === 'weapon' ? 'paw' : null;
    else G.eq[slot] = id;
    G.mp = Math.min(G.mp, this.maxMp());
    Sfx.click();
  },

  craft(r) {
    const G = this.G;
    if (!this.hasAll(r.need)) { Sfx.error(); return false; }
    const isGear = !!GEAR[r.out];
    if (isGear && G.owned.has(r.out)) { toast('もう もっているよ'); return false; }
    for (const k in r.need) this.remove(k, r.need[k]);
    if (isGear) {
      this.gainGear(r.out);
      toast(`${GEAR[r.out].name} をつくった！`, 'good');
    } else {
      const n = r.n || 1;
      const got = this.add(r.out, n);
      if (got < n) { this.remove(r.out, got); for (const k in r.need) this.add(k, r.need[k]); toast('カバンがいっぱいで つくれない', 'bad'); Sfx.error(); return false; }
      toast(`${ITEMS[r.out].name} をつくった！`, 'good');
    }
    Sfx.craft();
    FX.rise(G.p.x, G.p.y - 12, '#ffe680', 8);
    this.refreshObjective();
    return true;
  },

  /* ------------------------------ 食べる ------------------------------ */
  eat(id) {
    const G = this.G, it = ITEMS[id];
    if (!it || it.kind !== 'food' || !this.count(id)) return false;
    if (it.heal && G.hp >= this.maxHp() && !it.mp) { toast('HP は まんたんだよ'); return false; }
    if (it.mp && !it.heal && G.mp >= this.maxMp()) { toast('MP は まんたんだよ'); return false; }
    this.remove(id, 1);
    if (it.heal) { G.hp = Math.min(this.maxHp(), G.hp + it.heal); FX.text(G.p.x, G.p.y - 30, '+' + it.heal, '#7aff9a'); }
    if (it.mp) { G.mp = Math.min(this.maxMp(), G.mp + it.mp); FX.text(G.p.x, G.p.y - 30, '+' + it.mp + ' MP', '#9fd8ff'); }
    FX.icon(G.p.x, G.p.y - 40, it.icon);
    Sfx.eat();
    return true;
  },
  /* いちばんむだの少ない食べ物を食べる */
  quickEat() {
    const G = this.G;
    const miss = this.maxHp() - G.hp;
    if (miss <= 0) { toast('HP は まんたんだよ'); return; }
    let best = null, bestScore = Infinity;
    for (const s of G.inv) {
      const it = ITEMS[s.id];
      if (it.kind !== 'food' || !it.heal) continue;
      const score = it.heal >= miss ? it.heal - miss : (miss - it.heal) * 0.5 + 100;
      if (score < bestScore) { bestScore = score; best = s.id; }
    }
    if (!best) { toast('食べものを もっていない', 'bad'); Sfx.error(); return; }
    this.eat(best);
  },

  /* ============================== ループ ============================== */
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    R.t += dt;
    if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 30);
    if (!this.playing) {
      if (this.G && this.demoT !== null) { this.demoStep(dt); FX.update(dt); R.draw(this.G); }
      Input.endFrame(); return;
    }
    const G = this.G;
    const busy = UI.isBusy() || G.p.dead || this.busyFade;
    if (!busy) this.update(dt);
    else {
      /* 開いている画面への操作だけを受ける。同じキーでゲームが動かないように、ここで消費する */
      if (Input.hit('Escape')) UI.back();
      else if (UI.panel === 'bag' && (Input.hit('i') || Input.hit('b') || Input.hit('Tab'))) UI.closePanel();
      else if (UI.panel === 'map' && Input.hit('m')) UI.closePanel();
      else UI.updateTalkKeys();
      FX.update(dt); this.updateNpcs(0);
    }

    R.follow(G.map, G.p.x, G.p.y);
    R.draw(G);
    this.hudT += dt;
    if (this.hudT > 0.12) { this.hudT = 0; UI.refreshHUD(); }
    this.saveT += dt;
    if (this.saveT > 20 && !busy) { this.saveT = 0; this.save(); }
    Input.endFrame();
  },

  update(dt) {
    const G = this.G;
    G.time += dt;
    this.keys();
    if (!this.playing || UI.isBusy()) return;
    this.updatePlayer(dt);
    Mobs.update(dt);
    Shots.update(dt);
    this.updateDrops(dt);
    this.updateNodes(dt);
    this.updateNpcs(dt);
    Critters.update(dt);
    Raid.update(dt);
    Build.update(dt);
    FX.update(dt);
    for (let i = G.zaps.length - 1; i >= 0; i--) { G.zaps[i].t -= dt; if (G.zaps[i].t <= 0) G.zaps.splice(i, 1); }
    for (let i = G.marks.length - 1; i >= 0; i--) { G.marks[i].t -= dt; if (G.marks[i].t <= 0) G.marks.splice(i, 1); }
    this.updateRegion();
    this.findNear();
  },

  keys() {
    const G = this.G;
    if (Input.hit('Escape')) { if (Build.active) Build.toggle(false); else UI.openMenu(); return; }
    if (Input.hit('m')) { UI.openMap(); return; }
    if (Input.hit('i') || Input.hit('Tab')) { UI.openBag(); return; }
    if (Input.hit('b')) Build.toggle();
    if (Input.hit('e') || Input.hit('Enter')) this.act();
    if (Input.hit('f')) this.quickEat();
    if (Input.hit('r') && !Build.active) Critters.dismount();
    if (Input.hit('q')) this.cycleSpell(1);
    SPELL_ORDER.forEach((s, i) => { if (Input.hit(String(i + 1))) this.selectSpell(s); });
  },

  learned(s) { const b = SPELLS[s].book; return b ? this.G.books[b] : true; },
  selectSpell(s) {
    if (!this.learned(s)) { toast(`${SPELLS[s].name} は まだつかえない`); return; }
    this.G.spell = s; Sfx.click(); UI.refreshHUD();
  },
  cycleSpell(d) {
    const list = SPELL_ORDER.filter((s) => this.learned(s));
    const i = list.indexOf(this.G.spell);
    this.G.spell = list[(i + d + list.length) % list.length];
    Sfx.click(); UI.refreshHUD();
    toast(`${SPELLS[this.G.spell].icon} ${SPELLS[this.G.spell].name}`);
  },

  /* ============================== ハムスター ============================== */
  updatePlayer(dt) {
    const G = this.G, p = G.p;
    p.iframe = Math.max(0, p.iframe - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.flash = Math.max(0, p.flash - dt * 4);
    p.castT = Math.max(0, p.castT - dt);
    p.castCool = Math.max(0, p.castCool - dt);
    p.cool = Math.max(0, p.cool - dt);
    p.rollCool = Math.max(0, p.rollCool - dt);
    p.slowT = Math.max(0, p.slowT - dt);

    /* 寒さ */
    const tile = World.tileAt(G.map, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    if (G.map.kind === 'over' && tile === T.SNOW && !this.warm()) {
      G.coldT = Math.min(1, G.coldT + dt / 7);
      if (G.coldT >= 1) {
        G.coldTick = (G.coldTick || 0) + dt;
        if (G.coldTick > 0.6) { G.coldTick = 0; this.hurtRaw(2); }
        toast('さむい！ けがわのコートがないと こごえてしまう', 'bad');
      }
    } else G.coldT = Math.max(0, G.coldT - dt / 2);

    /* 自然に回復 */
    G.calmT += dt;
    if (G.calmT > 5 && G.hp < this.maxHp()) { G.regenT += dt; if (G.regenT > 3.5) { G.regenT = 0; G.hp++; } }
    G.mpT += dt;
    if (G.mpT > 1.6) { G.mpT = 0; if (G.mp < this.maxMp()) G.mp++; }

    const ax = Input.axis();
    if (p.roll >= 0) {
      p.roll += dt;
      World.move(G.map, p, p.rdx * 330 * dt, p.rdy * 330 * dt, 8);
      if (p.roll >= ROLL_T) { p.roll = -1; p.rollCool = 0.45; }
    } else {
      let sp = SPEED * Critters.speed() * (p.slowT > 0 ? 0.5 : 1) * (G.coldT >= 1 ? 0.55 : 1) * (p.swing >= 0 ? 0.45 : 1);
      const mx = ax.x * sp * dt + p.kbx * dt, my = ax.y * sp * dt + p.kby * dt;
      p.kbx *= Math.pow(0.002, dt); p.kby *= Math.pow(0.002, dt);
      if (mx || my) World.move(G.map, p, mx, my, 8);
      p.moving = Math.hypot(ax.x, ax.y) > 0.1;
      if (p.moving && p.swing < 0 && p.castT <= 0) p.face = this.faceOf(ax.x, ax.y);
      if (p.moving) { p.rdx = ax.x; p.rdy = ax.y; const l = Math.hypot(p.rdx, p.rdy); p.rdx /= l; p.rdy /= l; }
    }

    /* ころがる */
    if ((Input.hit('Shift') || Input.hit('l') || Input.hit('roll')) && p.roll < 0 && p.rollCool <= 0 && !G.ride) {
      if (!p.moving) { const a = this.faceAngle(p.face); p.rdx = Math.cos(a); p.rdy = Math.sin(a); }
      p.roll = 0; p.iframe = Math.max(p.iframe, ROLL_T + 0.05); p.swing = -1;
      Sfx.roll(); FX.burst(p.x, p.y - 4, '#d8c8a8', 5, 30, 0.4);
    }

    /* 建築モードのときは クリックで建てる */
    if (Build.input()) return;

    /* 攻撃 */
    let atkAim = null;
    if (Input.mouse.clicked) atkAim = this.aimAt(R.toWorld(Input.mouse.x, Input.mouse.y));
    if (Input.tap) atkAim = this.aimAt(R.toWorld(Input.tap.x, Input.tap.y));
    if (Input.hit(' ') || Input.hit('j') || Input.hit('atk')) atkAim = this.autoAim(150);
    if (atkAim !== null && p.swing < 0 && p.cool <= 0 && p.roll < 0) this.startSwing(atkAim);
    if (p.swing >= 0) {
      p.swing += dt;
      if (!p.swingHit && p.swing >= p.swingMax * 0.35) { p.swingHit = true; this.swingHit(); }
      if (p.swing >= p.swingMax) { p.swing = -1; p.cool = 0.12; }
    }

    /* 魔法 */
    let magAim = null;
    if (Input.mouse.rclicked) magAim = this.aimAt(R.toWorld(Input.mouse.x, Input.mouse.y));
    if (Input.hit('k') || Input.hit('mag')) magAim = this.autoAim(320);
    if (magAim !== null && p.roll < 0) this.cast(magAim);
  },

  faceOf(x, y) { return Math.abs(x) > Math.abs(y) * 0.9 ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up'); },
  faceAngle(f) { return { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[f]; },
  aimAt(w) { const p = this.G.p; return Math.atan2(w.y - (p.y - 10), w.x - p.x); },
  /* キーやボタンのときは、近くの魔物に少しだけ向きを合わせる */
  autoAim(range) {
    const G = this.G, p = G.p;
    let base = p.moving ? Math.atan2(p.rdy, p.rdx) : this.faceAngle(p.face);
    let best = null, bd = Infinity;
    const cands = G.boss && !G.boss.dead ? [...G.mobs, G.boss] : G.mobs;
    for (const m of cands) {
      const d = dist(p.x, p.y - 10, m.x, m.y - 10);
      if (d > range) continue;
      const a = Math.atan2(m.y - 10 - (p.y - 10), m.x - p.x);
      const off = Math.abs(angDiff(base, a));
      const lim = Input.isTouch ? Math.PI : 1.1;
      if (off > lim) continue;
      const score = d + off * 60;
      if (score < bd) { bd = score; best = a; }
    }
    if (best === null && range < 200) {
      /* 魔物がいなければ、すぐそばの木や岩のほうを向く */
      const m = G.map, cx = p.x, cy = p.y - 10;
      for (let ty = Math.floor(cy / TILE) - 2; ty <= Math.floor(cy / TILE) + 2; ty++) {
        for (let tx = Math.floor(cx / TILE) - 2; tx <= Math.floor(cx / TILE) + 2; tx++) {
          const n = m.nodes.get(ty * m.w + tx);
          if (!n || n.dead) continue;
          const nx = tx * TILE + 16, ny = ty * TILE + 16, d = dist(cx, cy, nx, ny);
          if (d > 50) continue;
          const a = Math.atan2(ny - cy, nx - cx), off = Math.abs(angDiff(base, a));
          if (!Input.isTouch && off > 1.6) continue;
          const score = d + off * 12;
          if (score < bd) { bd = score; best = a; }
        }
      }
    }
    return best ?? base;
  },

  startSwing(aim) {
    const G = this.G, p = G.p;
    const w = GEAR[G.eq.weapon || 'paw'];
    const sw = SWING[w.kind];
    p.swing = 0; p.swingMax = sw[0]; p.swingHit = false; p.aim = aim;
    p.face = this.faceOf(Math.cos(aim), Math.sin(aim));
    Sfx.swing();
  },

  swingHit() {
    const G = this.G, p = G.p;
    const w = GEAR[G.eq.weapon || 'paw'];
    const [, reach, arc] = SWING[w.kind];
    const cx = p.x, cy = p.y - 10;
    let hitAny = false;
    const atk = this.atk();
    const targets = G.boss && !G.boss.dead ? [...G.mobs, G.boss] : G.mobs.slice();
    for (const m of targets) {
      const my = m.y - (m.boss ? 24 : 8);
      const d = dist(cx, cy, m.x, my);
      if (d > reach + m.r) continue;
      const a = Math.atan2(my - cy, m.x - cx);
      if (d > m.r + 6 && Math.abs(angDiff(p.aim, a)) > arc + 0.25) continue;
      const dmg = Math.max(1, Math.round(atk * rand(0.9, 1.12)));
      Mobs.damage(m, dmg, Math.cos(a) * (w.kind === 'hammer' ? 260 : 170), Math.sin(a) * (w.kind === 'hammer' ? 260 : 170));
      hitAny = true;
    }
    if (hitAny) { Sfx.hit(); return; }
    /* 木や岩 */
    const n = this.nodeInFront(cx, cy, p.aim, reach);
    if (n) this.hitNode(n);
  },

  nodeInFront(cx, cy, aim, reach) {
    const m = this.G.map;
    let best = null, bd = Infinity;
    const tx0 = Math.floor((cx - reach - 20) / TILE), tx1 = Math.floor((cx + reach + 20) / TILE);
    const ty0 = Math.floor((cy - reach - 20) / TILE), ty1 = Math.floor((cy + reach + 30) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const n = m.nodes.get(ty * m.w + tx);
      if (!n || n.dead) continue;
      const nx = tx * TILE + 16, ny = ty * TILE + 16;
      const d = dist(cx, cy, nx, ny);
      if (d > reach + 18) continue;
      const off = Math.abs(angDiff(aim, Math.atan2(ny - cy, nx - cx)));
      if (off > 1.2 && d > 20) continue;
      const score = d + off * 20;
      if (score < bd) { bd = score; best = n; }
    }
    return best;
  },

  hitNode(n) {
    const G = this.G, d = NODE_DEFS[n.type];
    const x = n.tx * TILE + 16, y = n.ty * TILE + 16;
    n.shake = 0.25;
    if (d.fireOnly) {
      Sfx.clink(); toast('いばらは かたくて切れない…… ほのおで燃やせそうだ'); return;
    }
    if (d.tool && this.mineTier() < d.tool) {
      Sfx.clink();
      toast(d.tool === 1 ? 'カチン！ つるはしがないと こわせない' : 'カチン！ 鉄のつるはしがいる', 'bad');
      return;
    }
    const w = GEAR[this.G.eq.weapon || 'paw'];
    const power = (w.kind === 'hammer' && d.tool) ? 2 : (w.kind === 'paw' ? 1 : (d.hp >= 3 && w.atk >= 7 ? 2 : 1));
    n.hp -= power;
    (Sfx[d.sfx] || Sfx.chop)();
    FX.burst(x, y, d.chip, 5, 50, 0.45);
    if (n.hp > 0) return;
    n.dead = true; n.timer = d.regrow; n.hp = d.hp;
    for (const [id, a, b, p] of d.drops) {
      if (Math.random() > p) continue;
      this.drop(x, y, id, randi(a, b));
    }
  },

  updateNodes(dt) {
    const G = this.G, m = G.map;
    for (const n of m.nodes.values()) {
      if (n.shake > 0) n.shake -= dt;
      if (!n.dead) continue;
      n.timer -= dt;
      if (n.timer <= 0) {
        if (dist(G.p.x, G.p.y, n.tx * TILE + 16, n.ty * TILE + 20) < 30) { n.timer = 2; continue; }
        n.dead = false;
      }
    }
  },

  /* ============================== 落とし物 ============================== */
  drop(x, y, item, n = 1, extra = {}) {
    const a = Math.random() * TAU, s = rand(30, 80);
    this.G.drops.push(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 0, item, n, life: 60, seed: Math.random() * 10, delay: 0.35 }, extra));
  },
  dropCoins(x, y, total) {
    let left = total;
    while (left > 0) {
      const v = left > 30 ? 10 : left > 8 ? 5 : 1;
      this.drop(x, y, null, 1, { coin: v });
      left -= v;
    }
  },
  updateDrops(dt) {
    const G = this.G, p = G.p;
    for (let i = G.drops.length - 1; i >= 0; i--) {
      const d = G.drops[i];
      d.delay -= dt;
      if (d.vx || d.vy) {
        const ox = d.x, oy = d.y;
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (!World.walkable(G.map, d.x, d.y, 3)) { d.x = ox; d.y = oy; d.vx = 0; d.vy = 0; }
        d.vx *= Math.pow(0.02, dt); d.vy *= Math.pow(0.02, dt);
        if (Math.abs(d.vx) + Math.abs(d.vy) < 2) { d.vx = 0; d.vy = 0; }
      }
      if (!d.book && !d.gear) d.life -= dt;
      if (d.life <= 0) { G.drops.splice(i, 1); continue; }
      if (d.delay > 0 || p.dead) continue;
      const dd = dist(d.x, d.y, p.x, p.y);
      const canTake = d.coin || d.book || d.gear || this.room(d.item) > 0;
      if (dd < 46 && canTake) { d.x += (p.x - d.x) * Math.min(1, dt * 9); d.y += (p.y - d.y) * Math.min(1, dt * 9); }
      if (dd < 16) {
        if (d.coin) { G.coins += d.coin; G.earned += d.coin; Sfx.coin(); G.drops.splice(i, 1); continue; }
        if (d.book) { G.drops.splice(i, 1); this.gainBook(d.book); continue; }
        if (d.gear) { G.drops.splice(i, 1); this.gainGear(d.gear); Sfx.fanfare(); UI.talk('', [`${GEAR[d.gear].icon} ${GEAR[d.gear].name} を手に入れた！`]); continue; }
        const got = this.add(d.item, d.n);
        if (got > 0) {
          Sfx.pickup(); FX.icon(p.x, p.y - 34, ITEMS[d.item].icon);
          d.n -= got;
          if (d.n <= 0) G.drops.splice(i, 1);
          this.refreshObjective();
        } else if (!d.warned) { d.warned = true; toast('カバンがいっぱい！ 売るか、大きいカバンをつくろう', 'bad'); }
      }
    }
  },

  /* ============================== けが ============================== */
  hurt(dmg, sx, sy) {
    const G = this.G, p = G.p;
    if (p.iframe > 0 || p.dead || p.roll >= 0) return false;
    const d = Math.max(1, Math.round(dmg * 25 / (25 + this.def() * 2.5)));
    G.hp -= d; G.calmT = 0;
    p.iframe = 0.75; p.hurtT = 0.45; p.flash = 1;
    if (sx !== undefined) { const a = Math.atan2(p.y - sy, p.x - sx); p.kbx = Math.cos(a) * 260; p.kby = Math.sin(a) * 260; }
    FX.text(p.x, p.y - 30, '-' + d, '#ff8a8a');
    Sfx.hurt(); R.shake = Math.max(R.shake, 4);
    if (G.hp <= 0) this.die();
    return true;
  },
  hurtRaw(d) {
    const G = this.G;
    G.hp -= d; G.calmT = 0;
    FX.text(G.p.x, G.p.y - 30, '-' + d, '#bfe8ff');
    if (G.hp <= 0) this.die();
  },
  die() {
    const G = this.G;
    G.hp = 0; G.p.dead = true;
    Build.toggle(false);
    let msg = 'インベントリ保存が オンなので、もちものは そのまま。';
    if (!G.keepInv) {
      /* もちものと コインの半分を、たおれた場所に 袋で のこす (取りにもどれる) */
      const coins = Math.floor(G.coins / 2);
      const where = G.map.kind === 'over' ? { x: G.p.x, y: G.p.y } : G.tower ? (() => { const d = World.door(this.towerStruct(G.tower.id)); return { x: d.x * TILE + 16, y: (d.y + 1) * TILE + 16 }; })() : this.dockPos();
      const items = G.inv.map((s) => ({ id: s.id, n: s.n }));
      if (G.grave) { for (const s of G.grave.items) items.push(s); }
      G.grave = { x: where.x, y: where.y, items, coins: coins + (G.grave ? G.grave.coins : 0) };
      G.inv = []; G.coins -= coins;
      msg = items.length || coins ? 'もちものと コインの半分を 落としてしまった。たおれた場所の 袋から ひろえる。' : '';
    }
    document.getElementById('deadLost').textContent = msg;
    document.getElementById('deadScreen').classList.remove('hidden');
    Music.play(null);
  },
  pickGrave() {
    const G = this.G, g = G.grave;
    if (!g) return;
    G.grave = null;
    for (const s of g.items) this.give(s.id, s.n, g.x, g.y);
    G.coins += g.coins;
    this.removeGraveStruct();
    Sfx.fanfare();
    toast('落とした もちものを ひろった！', 'good');
    this.save();
  },
  removeGraveStruct() { World.over.structs = World.over.structs.filter((s) => s.kind !== 'grave'); },
  placeGraveStruct() {
    const G = this.G;
    this.removeGraveStruct();
    if (G.grave) World.over.structs.push({ kind: 'grave', x: Math.floor(G.grave.x / TILE), y: Math.floor(G.grave.y / TILE), w: 1, h: 1, solid: false, act: 'grave' });
  },
  revive() {
    const G = this.G;
    document.getElementById('deadScreen').classList.add('hidden');
    G.p = this.freshPlayer();
    G.ride = null;
    G.hp = this.maxHp(); G.mp = this.maxMp(); G.coldT = 0;
    this.leaveTowerTo(World.rests[G.rest] || World.rests.home);
    this.placeGraveStruct();
    this.save();
  },

  gainExp(n) {
    const G = this.G;
    G.exp += n;
    while (G.exp >= needExp(G.lv)) {
      G.exp -= needExp(G.lv); G.lv++;
      G.hp = this.maxHp(); G.mp = this.maxMp();
      Sfx.levelup();
      FX.ring(G.p.x, G.p.y - 10, '#ffe680', 18, 110);
      toast(`レベルアップ！ Lv ${G.lv} になった！`, 'good');
    }
  },

  /* ============================== 魔法 ============================== */
  cast(aim) {
    const G = this.G, p = G.p;
    if (p.castCool > 0) return;
    if (!G.eq.staff) {
      toast(G.owned.has('wstaff') || G.owned.has('cstaff') || G.owned.has('mstaff') ? '杖をそうびしよう（🎒 → そうび）' : '杖がないと 魔法はつかえない。魔法屋で買えるよ', 'bad');
      p.castCool = 0.6; return;
    }
    const s = SPELLS[G.spell];
    if (G.mp < s.mp) { toast('MP がたりない', 'bad'); Sfx.error(); p.castCool = 0.4; return; }
    G.mp -= s.mp;
    p.aim = aim; p.castT = 0.3;
    p.face = this.faceOf(Math.cos(aim), Math.sin(aim));
    const mag = this.mag();
    const sx = p.x + Math.cos(aim) * 18, sy = p.y - 10 + Math.sin(aim) * 18;
    const shot = (kind, sp, extra) => G.shots.push(Object.assign({ x: sx, y: sy, vx: Math.cos(aim) * sp, vy: Math.sin(aim) * sp, kind, from: 'p', life: 0.9, r: 7, hit: new Set() }, extra));
    switch (G.spell) {
      case 'bolt': shot('bolt', 340, { dmg: mag }); Sfx.bolt(); p.castCool = 0.24; break;
      case 'fire': shot('fire', 290, { dmg: Math.round(mag * 1.8), aoe: 48 }); Sfx.fire(); p.castCool = 0.4; break;
      case 'wind': shot('wind', 175, { dmg: Math.round(mag * 0.6), life: 1.5, pierce: true, r: 18, tick: 0.22 }); Sfx.wind(); p.castCool = 0.55; break;
      case 'heal': {
        const h = 30 + mag * 3;
        G.hp = Math.min(this.maxHp(), G.hp + h);
        FX.text(p.x, p.y - 32, '+' + h, '#7aff9a'); FX.rise(p.x, p.y - 8, '#7aff9a', 12);
        G.zaps.push({ kind: 'heal', x: p.x, y: p.y, t: 0.6, max: 0.6 });
        Sfx.heal(); p.castCool = 0.8; break;
      }
      case 'star': {
        const cands = (G.boss && !G.boss.dead ? [G.boss, ...G.mobs] : G.mobs.slice()).filter((m) => R.inView(m.x - 10, m.y - 10, 20, 20, 0));
        cands.slice(0, 8).forEach((m, i) => {
          G.shots.push({ x: m.x - 60, y: m.y - 220 - i * 30, vx: 120, vy: 440, kind: 'star', from: 'p', life: 2, r: 12, dmg: Math.round(mag * 2.4), hit: new Set(), aimAt: m, fall: m.y - 10 });
        });
        if (!cands.length) for (let i = 0; i < 5; i++) G.shots.push({ x: p.x + rand(-140, 80), y: p.y - 260 - i * 20, vx: 120, vy: 440, kind: 'star', from: 'p', life: 2, r: 12, dmg: Math.round(mag * 2.4), hit: new Set(), fall: p.y + rand(-80, 80) });
        Sfx.star(); p.castCool = 1.0; break;
      }
    }
  },

  /* いばらを燃やす */
  burnAt(x, y, r) {
    const G = this.G, m = G.map;
    if (m.kind !== 'over' || G.flags.thorns) return;
    let hit = false;
    for (const n of m.nodes.values()) if (n.type === 'thorns' && dist(x, y, n.tx * TILE + 16, n.ty * TILE + 16) < r + 20) hit = true;
    if (!hit) return;
    G.flags.thorns = true;
    for (const n of [...m.nodes.values()]) {
      if (n.type !== 'thorns') continue;
      FX.burst(n.tx * TILE + 16, n.ty * TILE + 10, '#ff8a3a', 14, 70, 0.9, -40);
      FX.burst(n.tx * TILE + 16, n.ty * TILE + 10, '#4a4a4a', 8, 40, 1.2, -30);
      G.marks.push({ kind: 'scorch', x: n.tx * TILE + 16, y: n.ty * TILE + 20, t: 30 });
      m.nodes.delete(n.ty * m.w + n.tx);
    }
    World.rebuildSolid(m);
    Sfx.burn();
    toast('いばらが燃えて、山道がひらいた！', 'good');
    this.refreshObjective();
    this.save();
  },

  gainBook(b) {
    const G = this.G;
    G.books[b] = true;
    const sp = SPELL_ORDER.find((s) => SPELLS[s].book === b);
    if (sp) G.spell = sp;
    Sfx.fanfare();
    FX.ring(G.p.x, G.p.y - 12, '#ffe680', 20, 120);
    const keys = Input.isTouch ? '✨ ボタン' : 'K キー（または右クリック）';
    const lines = [`${BOOKS[b].icon} 「${BOOKS[b].name}」を手に入れた！`];
    if (sp) lines.push(`魔法「${SPELLS[sp].name}」がつかえるようになった。杖をもって ${keys} でつかおう。`);
    if (b === 'fire') lines.push('町の東の山道をふさぐ いばらも、これで燃やせるはずだ。');
    UI.talk('', lines);
    this.refreshObjective();
    this.save();
  },


  /* ============================== しらべる ============================== */
  findNear() {
    const G = this.G, p = G.p;
    let best = null, bd = 44;
    const consider = (x, y, label, fn, h, range = 44) => {
      const d = dist(p.x, p.y, x, y);
      if (d < Math.min(bd, range)) { bd = d; best = { x, y, label, fn, h }; }
    };
    for (const s of G.map.structs) {
      if (!s.act) continue;
      if (p.high) break;
      if (s.kind === 'build') {
        const info = Build.act(s);
        if (info) consider((s.x + s.w / 2) * TILE, (s.y + s.h) * TILE - 6, info.label, info.fn, s.h * TILE + 20, 26 + Math.max(s.w, s.h) * 14);
        continue;
      }
      const big = ['home', 'shop', 'magic', 'tower', 'hut', 'tent'].includes(s.kind);
      const d0 = World.door(s);
      const x = big ? d0.x * TILE + (s.w % 2 ? 16 : 0) : s.x * TILE + 16;
      const y = big ? d0.y * TILE + 8 : s.y * TILE + 26;
      if (Math.abs(x - p.x) > 120 || Math.abs(y - p.y) > 120) continue;
      const info = this.structAct(s);
      if (info) consider(x, y, info.label, info.fn, big ? 58 : 46, big ? 40 : 44);
    }
    for (const n of G.npcs) {
      if (n.map !== G.map.id) continue;
      consider(n.x, n.y, n.role === 'merchant' ? 'おみせ' : 'はなす', () => this.talkNpc(n), 48 * (n.scale || 1), 40);
    }
    if (G.critters && !p.high) Critters.actions(consider);
    if (!best && G.ride && Input.isTouch) best = { x: p.x, y: p.y, label: 'おりる', fn: () => Critters.dismount(), h: CRITTERS[G.ride.type].seat + 30 };
    G.near = best;
  },

  act() {
    const n = this.G.near;
    if (n) n.fn();
  },

  structAct(s) {
    const G = this.G;
    switch (s.act) {
      case 'shop': return { label: 'はいる', fn: () => UI.openShop(s.shop) };
      case 'rest':
        if (s.shop) return { label: 'はいる', fn: () => UI.ask(s.label, SHOPS[s.shop].hello, [['やすむ', () => this.rest(s.rest)], ['おみせ', () => UI.openShop(s.shop)], ['やめる', null]]) };
        return { label: 'やすむ', fn: () => this.rest(s.rest) };
      case 'elderHouse': return { label: 'しらべる', fn: () => UI.talk('', ['長老の家だ。長老は 広場の噴水のそばにいるようだ。']) };
      case 'sign': return { label: 'よむ', fn: () => UI.talk('看板', [SIGNS[s.sign]]) };
      case 'chest': return this.chestOpened(s.id) ? null : { label: 'あける', fn: () => this.openChest(s) };
      case 'warp': return { label: G.flags.warps[s.id] ? 'ワープ' : 'さわる', fn: () => this.touchWarp(s) };
      case 'tower': return { label: 'はいる', fn: () => this.enterTower(s.tower) };
      case 'bridge': return G.flags.bridge ? null : { label: 'つり橋', fn: () => this.tryBridge() };
      case 'up': return { label: 'のぼる', fn: () => this.goFloor(1) };
      case 'down': return { label: G.tower && G.tower.floor === 1 ? 'そとへ' : 'おりる', fn: () => this.goFloor(-1) };
      case 'exit': return { label: 'そとへ', fn: () => this.exitTower() };
      case 'boat': return { label: 'ふねにのる', fn: () => this.takeBoat() };
      case 'grave': return { label: 'ひろう', fn: () => this.pickGrave() };
    }
    if (s.kind === 'board') return { label: 'よむ', fn: () => UI.openBoard() };
    return null;
  },

  rest(id) {
    const G = this.G;
    G.hp = this.maxHp(); G.mp = this.maxMp(); G.coldT = 0;
    G.rest = id;
    Sfx.heal();
    FX.rise(G.p.x, G.p.y - 10, '#7aff9a', 10);
    this.save();
    toast(`ぐっすり休んだ！ HP と MP がまんたんになった（セーブしました）`, 'good');
  },

  chestOpened(id) { return !!this.G.flags.chests[id]; },
  openChest(s) {
    const G = this.G;
    if (this.chestOpened(s.id)) return;
    let loot = CHEST_LOOT[s.id];
    if (!loot && G.tower) loot = TOWERS[G.tower.id].chests[G.tower.floor];
    if (!loot) return;
    G.flags.chests[s.id] = true;
    Sfx.fanfare();
    const lines = [];
    const x = s.x * TILE + 16, y = (s.y + 1) * TILE + 10;
    if (loot.coins) { G.coins += loot.coins; G.earned += loot.coins; lines.push(`🪙 ${loot.coins} コイン`); }
    for (const [id, n] of loot.items || []) { this.give(id, n, x, y); lines.push(`${ITEMS[id].icon} ${ITEMS[id].name} ×${n}`); }
    if (loot.gear) { this.gainGear(loot.gear); lines.push(`${GEAR[loot.gear].icon} ${GEAR[loot.gear].name}`); }
    FX.ring(x, y - 14, '#ffe680', 14, 70);
    UI.talk('宝箱', ['宝箱をあけた！ ' + lines.join('、') + ' を手に入れた！']);
    this.save();
  },

  touchWarp(s) {
    const G = this.G;
    if (!G.flags.warps[s.id]) {
      G.flags.warps[s.id] = true;
      Sfx.warp();
      FX.ring(s.x * TILE + 16, s.y * TILE + 10, '#7af0ff', 16, 80);
      toast(`道しるべ「${s.label}」を記録した！ 地図からワープできる`, 'good');
      this.save();
      return;
    }
    UI.openMap(true);
  },
  warpTo(id) {
    const G = this.G;
    const w = World.warps.find((x) => x.id === id);
    if (!w || !G.flags.warps[id] || G.map.kind !== 'over') return;
    UI.closeAll();
    this.transition(() => {
      G.p.x = w.x * TILE + 16; G.p.y = (w.y + 1) * TILE + 18;
      G.mobs.length = 0; G.shots.length = 0; G.drops.length = 0;
      R.follow(G.map, G.p.x, G.p.y, true);
      this.updateRegion(true);
      Sfx.warp();
    });
  },

  tryBridge() {
    const G = this.G;
    const need = { wood: 12, rope: 4 };
    if (!this.hasAll(need)) {
      UI.talk('看板', [SIGNS.bridgeSite, `いまの もちもの：木 ${this.count('wood')}/12、ロープ ${this.count('rope')}/4（ロープは 草3こ で つくれる）`]);
      return;
    }
    UI.ask('つり橋', '木12本 と ロープ4本 をつかって、つり橋をかけますか？', [['かける', () => {
      this.remove('wood', 12); this.remove('rope', 4);
      this.transition(() => {
        G.flags.bridge = true;
        World.layBridge(G.map);
        World.rebuildSolid(G.map);
        Sfx.build();
      }, () => {
        Sfx.fanfare();
        toast('つり橋がかかった！ 谷の向こうへ行ける！', 'good');
        this.refreshObjective();
        this.save();
      });
    }], ['やめる', null]]);
  },

  /* ------------------------------ 会話 ------------------------------ */
  hasStaff() { const o = this.G.owned; return o.has('wstaff') || o.has('cstaff') || o.has('mstaff'); },

  talkNpc(n) {
    const G = this.G;
    if (n.role === 'elder') { UI.talk(ELDER.name, [ELDER.tips[Math.floor(G.time / 15) % ELDER.tips.length]]); return; }
    if (n.role === 'req') { this.talkRequest(n); return; }
    if (n.role === 'guide') {
      if (G.flags.guide) { UI.talk(GUIDE.name, [GUIDE.after]); return; }
      if (this.warm()) {
        UI.talk(GUIDE.name, [GUIDE.open], () => {
          G.flags.guide = true;
          G.map.structs = G.map.structs.filter((s) => !(s.kind === 'fence' && s.id === 'guide'));
          World.rebuildSolid(G.map);
          Sfx.door();
          this.refreshObjective(); this.save();
        });
      } else if (G.owned.has('coat') || G.owned.has('royal')) UI.talk(GUIDE.name, [GUIDE.ownNotWorn]);
      else UI.talk(GUIDE.name, [GUIDE.block]);
      return;
    }
    if (n.role === 'merchant') { UI.openShop('camp'); return; }
    if (n.role === 'knight') { UI.talk(n.name, [KNIGHT_LINES[n.line % KNIGHT_LINES.length]]); return; }
    if (n.role === 'king') {
      if (!G.flags.king) {
        UI.talk(KING.name, KING.first, () => {
          G.flags.king = true;
          G.coins += 200; G.earned += 200;
          this.give('potion', 3);
          Sfx.fanfare();
          UI.talk('', ['🪙 200 コイン と 🧪 くすり ×3 を もらった！']);
          this.save();
        });
      } else UI.talk(KING.name, [KING.again[Math.floor(G.time / 20) % KING.again.length]]);
      return;
    }
    UI.talk(n.name, [TOWNSFOLK[(n.line + Math.floor(G.time / 30)) % TOWNSFOLK.length]]);
  },

  talkRequest(n) {
    const G = this.G, r = REQUESTS[n.req];
    if (G.flags.reqs[n.req]) { UI.talk(n.name, ['また来てね！']); return; }
    if (!this.hasAll(r.need)) { UI.talk(n.name, [r.ask]); return; }
    const needTxt = Object.entries(r.need).map(([k, v]) => `${ITEMS[k].name}×${v}`).join('、');
    UI.ask(n.name, `${r.ask}（${needTxt} をわたしますか？）`, [['わたす', () => {
      for (const k in r.need) this.remove(k, r.need[k]);
      G.flags.reqs[n.req] = true;
      if (r.coins) { G.coins += r.coins; G.earned += r.coins; }
      for (const [id, k] of r.items || []) this.give(id, k);
      if (r.gear) this.gainGear(r.gear);
      Sfx.fanfare();
      const got = [r.coins ? `🪙${r.coins}` : '', ...(r.items || []).map(([id, k]) => `${ITEMS[id].icon}${ITEMS[id].name}×${k}`), r.gear ? `${GEAR[r.gear].icon}${GEAR[r.gear].name}` : ''].filter(Boolean).join('、');
      UI.talk(n.name, [r.thanks, `${got} をもらった！`]);
      this.save();
    }], ['まだ', null]]);
  },

  /* ============================== 塔 ============================== */
  towerStruct(tid) { return World.over.structs.find((s) => s.kind === 'tower' && s.tower === tid); },
  towerOpen() { return true; },
  towerCleared(tid) { return !!this.G.flags.bosses[TOWERS[tid].boss]; },
  structState() {
    const self = this;
    return {
      flags: this.G.flags,
      towerOpen: (t) => self.towerOpen(t), towerCleared: (t) => self.towerCleared(t),
      chestOpened: (id) => self.chestOpened(id), stairsOpen: () => self.G.floorOpen,
    };
  },

  enterTower(tid) {
    if (!this.towerOpen(tid)) { UI.talk('月の塔', [SIGNS.moonGate, 'とびらは かたく閉じている。']); return; }
    const G = this.G;
    Sfx.door();
    if (G.ride) { toast(`${CRITTERS[G.ride.type].name}は 塔の外で まっている`); }
    this.transition(() => { Critters.dismount(true); this.loadFloor(tid, 1); });
  },
  loadFloor(tid, floor, fromAbove) {
    const G = this.G, def = TOWERS[tid];
    G.tower = { id: tid, floor };
    G.map = World.buildTowerFloor(tid, floor, G.flags);
    G.mobs.length = 0; G.shots.length = 0; G.drops.length = 0; G.zaps.length = 0; G.boss = null;
    const m = G.map;
    Critters.clear();
    if (fromAbove && m.up) { G.p.x = m.up.x * TILE + 16; G.p.y = (m.up.y + 1) * TILE + 16; }
    else { G.p.x = m.entry.x * TILE + 16; G.p.y = (m.entry.y - 1) * TILE + 16; }
    const cleared = G.flags.towers[tid] || 0;
    G.floorOpen = floor <= cleared;
    if (m.boss) {
      /* ボスは 何度でも 挑める */
      Mobs.spawnBoss(def.boss, 12 * TILE, 7 * TILE);
    } else {
      const n = floor <= cleared ? Math.ceil(def.base / 2) : def.base + floor;
      Mobs.spawnTower(def, n);
      Music.play(def.music);
    }
    R.dropChunks();
    R.follow(m, G.p.x, G.p.y, true);
    this.updateRegion(true);
    UI.banner(`${def.name} ${floor === def.floors ? 'さいじょうかい' : floor + 'かい'}`);
    this.refreshObjective();
  },
  goFloor(d) {
    const G = this.G;
    if (!G.tower) return;
    if (d > 0 && !G.floorOpen) { toast('この階の魔物を ぜんぶたおすと、階段がひらく'); Sfx.error(); return; }
    Sfx.door();
    if (d < 0 && G.tower.floor === 1) { this.exitTower(); return; }
    this.transition(() => this.loadFloor(G.tower.id, G.tower.floor + d, d < 0));
  },
  floorCleared() {
    const G = this.G;
    if (!G.tower || G.floorOpen || G.map.boss) return;
    G.floorOpen = true;
    G.flags.towers[G.tower.id] = Math.max(G.flags.towers[G.tower.id] || 0, G.tower.floor);
    Sfx.door();
    toast('階段がひらいた！', 'good');
    this.refreshObjective();
  },
  exitTower() {
    const G = this.G;
    if (!G.tower) return;
    const s = this.towerStruct(G.tower.id), d = World.door(s);
    this.transition(() => this.leaveTowerTo({ x: d.x, y: d.y + 1 }));
  },
  leaveTowerTo(r) {
    const G = this.G;
    G.tower = null; G.boss = null;
    G.map = r.map === 'kingdom' ? World.buildKingdom() : World.over;
    G.mobs.length = 0; G.shots.length = 0; G.drops.length = 0; G.zaps.length = 0;
    G.p.x = r.x * TILE + 16; G.p.y = r.y * TILE + 20; G.p.high = false;
    Critters.clear();
    R.dropChunks();
    R.follow(G.map, G.p.x, G.p.y, true);
    UI.bossBar(null);
    this.updateRegion(true);
    this.refreshObjective();
  },

  /* ============================== 湖の王国 ============================== */
  dockPos() { const s = World.over.structs.find((x) => x.kind === 'dock'); return { x: s.x * TILE + 24, y: (s.y + 1) * TILE + 16 }; },
  takeBoat() {
    const G = this.G;
    const toKingdom = G.map.kind === 'over';
    UI.ask('ふなつき場', toKingdom ? '舟にのって、湖の王国 ミナモへ わたりますか？' : '舟にのって、かがみ湖の ふなつき場へ もどりますか？', [['のる', () => {
      Sfx.door();
      this.transition(() => {
        G.mobs.length = 0; G.shots.length = 0; G.drops.length = 0; G.zaps.length = 0;
        if (toKingdom) {
          G.map = World.buildKingdom();
          G.p.x = G.map.entry.x * TILE; G.p.y = G.map.entry.y * TILE + 16;
        } else {
          G.map = World.over;
          const d = this.dockPos(); G.p.x = d.x; G.p.y = d.y;
        }
        G.p.high = false;
        Critters.clear();
        R.dropChunks();
        R.follow(G.map, G.p.x, G.p.y, true);
        this.updateRegion(true);
        if (toKingdom) UI.banner(REGIONS.kingdom.name);
        this.refreshObjective();
      });
    }], ['やめる', null]]);
  },

  transition(mid, after) {
    if (this.busyFade) return;
    this.busyFade = true;
    const t0 = performance.now();
    let did = false;
    const step = () => {
      const k = (performance.now() - t0) / 1000;
      if (k < 0.25) R.fade = k / 0.25;
      else if (!did) { did = true; R.fade = 1; mid(); }
      else if (k < 0.55) R.fade = 1 - (k - 0.25) / 0.3;
      else { R.fade = 0; this.busyFade = false; if (after) after(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  /* ============================== 地方と目的 ============================== */
  regionMusic() {
    const G = this.G;
    if (G.boss && !G.boss.dead) return 'boss';
    if (G.map.kind === 'tower') return 'tower';
    if (G.map.kind === 'kingdom') return 'town';
    return REGIONS[G.region] ? REGIONS[G.region].music : 'forest';
  },
  updateRegion(force) {
    const G = this.G;
    const reg = G.map.kind === 'over' ? World.regionAt(G.map, G.p.x, G.p.y) : G.map.kind === 'kingdom' ? 'kingdom' : null;
    if (G.map.kind === 'over') {
      const cx = Math.floor(G.p.x / TILE / CELL), cy = Math.floor(G.p.y / TILE / CELL);
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) if (x >= 0 && y >= 0 && x < CW && y < CH) G.reveal[y * CW + x] = 1;
    }
    if (reg !== G.region || force) {
      const changed = reg !== G.region;
      G.region = reg;
      if (reg && changed && !force) UI.banner(REGIONS[reg].name);
      Music.play(this.regionMusic());
    }
  },

  objective() {
    const G = this.G;
    const doorOf = (s) => { const d = World.door(s); return { map: 'over', x: d.x * TILE + (s.w % 2 ? 16 : 0), y: d.y * TILE + 10 }; };
    const npc = (id) => { const n = G.npcs.find((x) => x.id === id); return n ? { map: n.map, x: n.x, y: n.y } : null; };
    const st = (kind, key, val) => World.over.structs.find((s) => s.kind === kind && s[key] === val);
    if (G.map.kind === 'kingdom') return { text: '湖の王国 ミナモ。王さまと話したり、城壁にのぼったりしよう（南の舟で もどれる）', target: G.flags.king ? null : npc('king') };
    if (G.tower) {
      const m = G.map;
      if (m.boss) return { text: G.boss && !G.boss.dead ? `${G.boss.name}をたおせ！` : '魔法陣にのって 外へ出よう', target: null };
      if (G.floorOpen) return { text: '階段をのぼろう（▲）', target: m.up ? { map: m.id, x: m.up.x * TILE + 16, y: m.up.y * TILE + 16 } : null };
      return { text: `この階の魔物を ぜんぶたおそう（のこり ${G.mobs.length}）`, target: null };
    }
    const hasWeapon = [...G.owned].some((id) => GEAR[id].slot === 'weapon' && id !== 'paw' && id !== 'stick');
    if (!hasWeapon) {
      if (this.count('wood') < 5) return { text: `木をたたいて 木を集めよう（${this.count('wood')}/5）`, target: null };
      return { text: '🎒 をひらいて「つくる」から 木の剣をつくろう（いまは 木の棒）', target: null };
    }
    if (this.bagId() === 'cheek') return { text: `草むらをたたいて草を集め、葉っぱのカバンをつくろう（草 ${this.count('grass')}/8・木 ${Math.min(2, this.count('wood'))}/2）`, target: null };
    const has = (k) => G.builds.some((b) => b.k === k);
    const cost = (k) => Object.entries(BUILDS[k].cost).map(([id, n]) => `${ITEMS[id].name} ${Math.min(this.count(id), n)}/${n}`).join('・');
    const bkey = Input.isTouch ? '🔨' : 'B キー';
    if (!has('waterwheel')) return { text: `水べに 水車を建てよう（${bkey}・${cost('waterwheel')}）`, target: null };
    if (!has('sawmill')) return { text: `製材機を建てて、水車と 軸でつなごう（${cost('sawmill')}）`, target: null };
    if (!has('belt')) return { text: '機械の前に ベルトコンベアをならべ、木箱へ はこぼう', target: null };
    if (!has('bed')) return { text: `板で わらのベッドをつくろう（${cost('bed')}）。たおれても ベッドで目をさます`, target: null };
    return { text: '自由に 建てて 冒険しよう！ 塔のボスは 何度でも挑める', target: null };
  },
  refreshObjective() {
    if (!this.G) return;
    const o = this.objective();
    this.G.objective = o.text;
    this.G.target = o.target;
  },
};

window.addEventListener('load', () => Game.boot());
