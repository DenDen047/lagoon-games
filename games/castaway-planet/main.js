/* =========================================================================
   CASTAWAY PLANET ― 進行
   入力 / 主人公 / 搭乗 / 手なずけ / 持ち物 / クラフト / 惑星移動 / セーブ
   ========================================================================= */
'use strict';

(function () {

const HOURS_PER_SEC = 0.026;      /* ゲーム内 1 日 ≒ 実時間 16 分 */
const PLAYER_SPEED = 132;
const PLAYER_REACH = TILE * 2.4;
const ROBOT_REACH = TILE * 3.6;
const INTERACT_RANGE = 52;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewZoom = 1;
    this.zoom = 1;
    this.clock = 0;
    this.frame = 0;
    this.uiOpen = false;
    this.hot = 0;
    this.activeSide = 'right';
    this.canWater = 12;
    this.workRobotId = 0;
    this.nearAlien = null;
    this.smelterHot = 0;
    this.swing = 0;
    this.dead = false;
    this.ended = false;
    Input.init(this.canvas);
    UI.init(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindTitle();
    this.bindHudButtons();
    this.lastT = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ------------------------------ 立ち上げ ------------------------------ */
  bindTitle() {
    const save = Save.read();
    const cont = document.getElementById('btnContinue');
    cont.disabled = !save;
    if (save) cont.textContent = `つづきから（${PLANETS[save.world.pi].name} ${save.day}日目）`;
    cont.addEventListener('click', () => { if (this.load()) this.start(); });
    const btnNew = document.getElementById('btnNew');
    btnNew.addEventListener('click', () => {
      const warn = document.getElementById('newWarn');
      if (save && !this.askedNew) {
        this.askedNew = true;
        btnNew.textContent = '本当に始める';
        btnNew.classList.add('danger');
        warn.style.visibility = 'visible';
        setTimeout(() => {
          if (this.startedOnce) return;
          this.askedNew = false;
          btnNew.textContent = '新しく始める';
          btnNew.classList.remove('danger');
          warn.style.visibility = 'hidden';
        }, 8000);
        return;
      }
      this.newGame(); this.start();
    });
    document.getElementById('btnHelp').addEventListener('click', () => { this.startedOnce ? UI.open('help') : this.showTitleHelp(); });
  }

  bindHudButtons() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('btnE', () => this.interact());
    on('btnBag', () => (UI.isOpen() && UI.kind === 'inv' ? UI.close() : UI.open('inv')));
    on('btnCraft', () => (UI.isOpen() && UI.kind === 'craft' ? UI.close() : UI.open('craft')));
    on('btnHelp2', () => (UI.isOpen() && UI.kind === 'help' ? UI.close() : UI.open('help')));
    on('btnRestart', () => window.location.reload());
  }

  showTitleHelp() {
    const box = document.getElementById('titleHelp');
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
  }

  start() {
    document.getElementById('titleScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.startedOnce = true;
    UI.hud();
  }

  newGame() {
    this.world = new World(0, (Math.random() * 1e9) | 0);
    this.player = {
      x: this.world.spawn.x, y: this.world.spawn.y + 8, vx: 0, vy: 0,
      hp: 100, maxhp: 100, st: 100, maxst: 100, face: 1, walk: 0, hurt: 0,
    };
    this.inv = new Array(30).fill(null);
    this.robots = [];
    this.riding = null;
    this.mount = null;
    this.time = 7.0;
    this.day = 1;
    this.canWater = 12;
    this.addItem('tool_pick', 1); this.addItem('tool_axe', 1);
    this.addItem('tool_hoe', 1); this.addItem('tool_can', 1);
    this.addItem('fiber', 6); this.addItem('wood', 4);
    this.addItem('berry', 3);
    this.hot = 0;
    toast('宇宙船が墜ちた。まずは近くの残骸を集めよう', 'good');
    UI.open('help');
  }

  /* ------------------------------ セーブ ------------------------------ */
  save() {
    if (!this.world || this.ended) return;
    Save.write({
      v: 1, world: this.world.toJSON(), day: this.day, time: this.time,
      player: { x: this.player.x, y: this.player.y, hp: this.player.hp, st: this.player.st },
      inv: this.inv, robots: this.robots.map((r) => r.toJSON()),
      ridingId: this.riding ? this.riding.id : 0, canWater: this.canWater, hot: this.hot,
    });
  }

  load() {
    const d = Save.read();
    if (!d) return false;
    try {
      this.world = World.fromJSON(d.world);
      this.player = {
        x: d.player.x, y: d.player.y, vx: 0, vy: 0, hp: d.player.hp, maxhp: 100,
        st: d.player.st, maxst: 100, face: 1, walk: 0, hurt: 0,
      };
      this.inv = d.inv.slice(0, 30);
      while (this.inv.length < 30) this.inv.push(null);
      this.robots = (d.robots || []).map((r) => Robot.fromJSON(r));
      this.riding = this.robots.find((r) => r.id === d.ridingId) || null;
      if (this.riding) this.riding.ridden = true;
      this.mount = null;
      this.day = d.day; this.time = d.time; this.canWater = d.canWater ?? 12; this.hot = d.hot || 0;
      Render._mmDirty = true;
      return true;
    } catch (e) {
      toast('セーブデータを読めなかった', 'warn');
      return false;
    }
  }

  /* ------------------------------ 画面 ------------------------------ */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.viewZoom = clamp(Math.min(w / 1080, h / 660), 0.85, 1.5);
    this.zoom = this.viewZoom * this.dpr;
  }

  /* ------------------------------ 時間 ------------------------------ */
  clockText() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
  }
  isNight() { return this.time < 5.5 || this.time > 19; }
  darkness() {
    const t = this.time;
    if (t >= 6 && t <= 18) return 0;
    if (t > 18 && t < 20.5) return (t - 18) / 2.5;
    if (t > 4 && t < 6) return 1 - (t - 4) / 2;
    return 1;
  }

  /* ------------------------------ 参照 ------------------------------ */
  focus() { return this.riding || this.mount || this.player; }
  reach() { return this.riding ? ROBOT_REACH : PLAYER_REACH; }
  heldItem() { const s = this.inv[this.hot]; return s ? s.id : null; }

  aimTile() {
    const cam = Render.cam;
    const wx = cam.x + Input.mouse.x / this.viewZoom;
    const wy = cam.y + Input.mouse.y / this.viewZoom;
    return { tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE), x: wx, y: wy };
  }

  questText() {
    if (!this.world) return '';
    /* 全タイルを見るので、毎フレームは数えない */
    if (this._questCache && this.frame - this._questFrame < 45) return this._questCache;
    this._questFrame = this.frame;
    this._questCache = this.computeQuest();
    return this._questCache;
  }

  computeQuest() {
    if (this.world.shipRepaired) return '宇宙船から次の星へ飛べる';
    const part = this.world.planet.part;
    if (this.countItem(part) > 0) return `${itemName(part)}を宇宙船に取り付ける（船の前で E）`;
    if (!this.everBuilt('st_workbench')) return '木と石を集めて、作業台を作る（C）';
    if (!this.everBuilt('st_smelter')) return '製錬炉を建てて、鉱石をインゴットにする';
    if (!this.everBuilt('st_assembler')) return '組立台を建てて、部品と回路を作る';
    if (!this.robots.length) return 'ロボット工房を建てて、ロボットを組み立てる';
    return `${itemName(part)}を作って、宇宙船を直す`;
  }

  everBuilt(id) {
    const W = this.world;
    for (let i = 0; i < W.obj.length; i++) {
      const o = W.obj[i];
      if (o && o.t === 'station' && o.id === id) return true;
    }
    return false;
  }

  notify(msg, kind = '') { toast(msg, kind); }

  /* ------------------------------ 持ち物 ------------------------------ */
  addItem(id, n = 1) {
    let left = n;
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      const s = this.inv[i];
      if (s && s.id === id && s.n < 99) { const put = Math.min(99 - s.n, left); s.n += put; left -= put; }
    }
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      if (!this.inv[i]) { const put = Math.min(99, left); this.inv[i] = { id, n: put }; left -= put; }
    }
    if (left > 0) toast('持ちきれない', 'warn');
    return n - left;
  }
  countItem(id) { return this.inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0); }
  hasItem(id, n = 1) { return this.countItem(id) >= n; }
  takeItem(id, n = 1) {
    let left = n;
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      const s = this.inv[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.n, left);
      s.n -= take; left -= take;
      if (s.n <= 0) this.inv[i] = null;
    }
    return left === 0;
  }
  moveToHotbar(i) {
    for (let k = 0; k < 9; k++) if (!this.inv[k]) { this.inv[k] = this.inv[i]; this.inv[i] = null; this.hot = k; return; }
    const tmp = this.inv[this.hot]; this.inv[this.hot] = this.inv[i]; this.inv[i] = tmp;
  }
  dropOne(i) {
    const s = this.inv[i];
    if (!s) return;
    s.n--; if (s.n <= 0) this.inv[i] = null;
  }
  eat(i) {
    const s = this.inv[i];
    if (!s) return;
    const d = ITEMS[s.id];
    if (!d || d.kind !== 'food') return;
    this.player.st = Math.min(this.player.maxst, this.player.st + d.stamina);
    this.player.hp = Math.min(this.player.maxhp, this.player.hp + 4);
    this.takeItem(s.id, 1);
    toast(`${d.name}を食べた`, 'good');
  }
  selectedSeed() {
    const held = this.heldItem();
    if (held && ITEMS[held] && ITEMS[held].kind === 'seed') return held;
    for (const s of this.inv) if (s && ITEMS[s.id] && ITEMS[s.id].kind === 'seed') return s.id;
    return null;
  }
  collect(drops, tx, ty) {
    for (const [id, n] of drops) {
      this.addItem(id, n);
      FX.text(tx * TILE + 16, ty * TILE + 6, `${itemIcon(id)}+${n}`, '#ffe9a8');
    }
  }

  /* ------------------------------ クラフト ------------------------------ */
  nearStations() {
    const set = new Set(), f = this.focus(), W = this.world;
    const ctx0 = Math.floor(f.x / TILE), cty0 = Math.floor(f.y / TILE);
    for (let ty = cty0 - 3; ty <= cty0 + 3; ty++) {
      for (let tx = ctx0 - 3; tx <= ctx0 + 3; tx++) {
        const o = W.objAt(tx, ty);
        if (o && o.t === 'station') set.add(o.id);
      }
    }
    return set;
  }
  hasFuel() { return this.inv.some((s) => s && ITEMS[s.id] && ITEMS[s.id].kind === 'fuel'); }
  fuelId() { const s = this.inv.find((x) => x && ITEMS[x.id] && ITEMS[x.id].kind === 'fuel'); return s ? s.id : null; }
  canCraft(r) {
    if (r.station && !this.nearStations().has(r.station)) return false;
    if (r.fuel && !this.hasFuel()) return false;
    return r.cost.every(([id, n]) => this.countItem(id) >= n);
  }
  craft(r) {
    if (!this.canCraft(r)) { toast('材料が足りない', 'warn'); return false; }
    for (const [id, n] of r.cost) this.takeItem(id, n);
    if (r.fuel) { this.takeItem(this.fuelId(), 1); this.smelterHot = 2.5; }
    this.addItem(r.out[0], r.out[1]);
    toast(`${itemName(r.out[0])}を作った`, 'good');
    this.save();
    return true;
  }

  /* ------------------------------ ロボット ------------------------------ */
  workRobot() { return this.robots.find((r) => r.id === this.workRobotId) || this.robots[0] || null; }
  ownedArms() {
    const set = new Set();
    for (const s of this.inv) if (s && ARMS[s.id]) set.add(s.id);
    const r = this.workRobot();
    if (r) { if (r.arms.left) set.add(r.arms.left); if (r.arms.right) set.add(r.arms.right); }
    return Array.from(set);
  }
  equipArm(r, side, armId) {
    const cur = r.arms[side];
    if (cur === armId) return;
    const other = side === 'left' ? 'right' : 'left';
    if (armId && !this.hasItem(armId, 1)) {
      if (r.arms[other] === armId) { r.arms[other] = cur; r.arms[side] = armId; return; }
      toast('そのアームを持っていない', 'warn');
      return;
    }
    if (armId) this.takeItem(armId, 1);
    if (cur) this.addItem(cur, 1);
    r.arms[side] = armId;
    this.save();
  }
  buildRobot() {
    if (!this.hasItem('robot_kit', 1)) { toast('ロボット素体がない', 'warn'); return; }
    this.takeItem('robot_kit', 1);
    const f = this.focus();
    const r = new Robot(f.x + 34, f.y + 10, ROBOT_PRESETS[this.robots.length % ROBOT_PRESETS.length]);
    this.robots.push(r);
    this.workRobotId = r.id;
    toast(`${r.name}が起動した`, 'good');
    this.save();
  }

  /* ------------------------------ 交流 ------------------------------ */
  doTrade(a) {
    const t = ALIENS[a.sp].trade;
    if (!this.hasItem(t.want[0], t.want[1])) return;
    this.takeItem(t.want[0], t.want[1]);
    this.addItem(t.give[0], t.give[1]);
    a.traded = true;
    FX.text(a.x, a.y - 26, '🤝', '#ffe9a8');
    toast(`${itemName(t.give[0])}を受け取った`, 'good');
    this.save();
  }

  feedMount(a) {
    const held = this.heldItem();
    const d = held ? ITEMS[held] : null;
    if (!d || (d.kind !== 'food' && d.kind !== 'feed')) {
      toast('食べ物を手に持って E。エサ玉なら一度でなつく', 'warn');
      return;
    }
    this.takeItem(held, 1);
    a.tame = Math.min(100, (a.tame || 0) + (d.tame || 30));
    a.chew = 0.6;
    for (let k = 0; k < 6; k++) FX.text(a.x + (Math.random() - 0.5) * 26, a.y - 18 - Math.random() * 10, '♥', '#ff9ec4');
    if (a.tame >= 100) toast('ガルパがなついた。E で乗れる', 'good');
    else toast(`${itemName(held)}をあげた（なつき ${a.tame}%）`);
    this.save();
  }

  /* ------------------------------ 乗り降り ------------------------------ */
  rideRobot(r) {
    if (r.batt <= 1) { toast('バッテリーが空。工房かソーラー充電器で充電する', 'warn'); return; }
    this.riding = r; r.ridden = true;
    this.player.x = r.x; this.player.y = r.y;
    toast(`${r.name}に乗った ― 左クリック:右手 / 右クリック:左手`, 'good');
  }
  dismountRobot() {
    const r = this.riding;
    if (!r) return;
    r.ridden = false;
    this.riding = null;
    this.player.x = r.x - 26; this.player.y = r.y + 6;
    this.world.moveCircle(this.player, 0, 0, 9);
  }
  rideMount(a) {
    this.mount = a; a.ridden = true;
    toast('ガルパに乗った ― 左クリックで噛みつく', 'good');
  }
  dismountMount() {
    const a = this.mount;
    if (!a) return;
    a.ridden = false; this.mount = null;
    this.player.x = a.x - 30; this.player.y = a.y + 8;
    this.world.moveCircle(this.player, 0, 0, 9);
  }

  /* ------------------------------ 被弾 ------------------------------ */
  hurtPlayer(dmg) {
    if (this.player.hurt > 0.4 || this.dead) return;
    this.player.hp = Math.max(0, this.player.hp - dmg);
    this.player.hurt = 0.6;
    FX.burst(this.player.x, this.player.y - 8, '#ff6a5a', 8, 90, 0.5);
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 180);
    if (this.player.hp <= 0) this.knockOut();
  }
  hurtMount(dmg) {
    const a = this.mount;
    if (!a) return;
    a.hp = Math.max(0, a.hp - dmg * 0.6);
    a.hurt = 0.3;
    if (a.hp <= 0) {
      a.hp = Math.round(a.maxhp * 0.5);
      this.dismountMount();
      toast('ガルパが逃げ出した', 'warn');
    }
  }
  knockOut() {
    this.dead = true;
    if (this.riding) this.dismountRobot();
    if (this.mount) this.dismountMount();
    toast('気を失った……', 'warn');
    setTimeout(() => {
      this.player.x = this.world.spawn.x; this.player.y = this.world.spawn.y + 20;
      this.player.hp = 60; this.player.st = 50;
      this.skipTo(6.5);
      this.dead = false;
      toast('宇宙船のそばで目を覚ました', 'good');
    }, 1400);
  }

  /* ------------------------------ 睡眠 ------------------------------ */
  skipTo(hour) {
    let hours = hour - this.time;
    if (hours <= 0) { hours += 24; this.day++; }
    let left = hours;
    while (left > 0) { const step = Math.min(1, left); this.world.tick(step); left -= step; }
    this.time = hour;
  }
  sleep() {
    this.skipTo(6.5);
    this.player.st = this.player.maxst;
    this.player.hp = Math.min(this.player.maxhp, this.player.hp + 40);
    toast(`${this.day}日目の朝`, 'good');
    this.save();
  }

  /* ------------------------------ 宇宙船 ------------------------------ */
  repairShip() {
    const part = this.world.planet.part;
    if (!this.hasItem(part, 1)) return;
    this.takeItem(part, 1);
    this.world.shipRepaired = true;
    FX.burst(this.world.shipTile.x * TILE + 16, this.world.shipTile.y * TILE + 16, '#7fe8d0', 26, 160, 1.1);
    toast('宇宙船が直った。次の星へ飛べる', 'good');
    this.save();
  }

  warp() {
    const nextIdx = this.world.pi + 1;
    if (nextIdx >= PLANETS.length) return;
    /* なついたガルパは一緒に連れて行く */
    const pets = this.world.aliens.filter((a) => a.tame >= 100).slice(0, 2);
    const w = new World(nextIdx, (Math.random() * 1e9) | 0);
    this.world = w;
    Render._mmDirty = true;
    this.player.x = w.spawn.x; this.player.y = w.spawn.y + 10;
    this.mount = null;
    for (let i = 0; i < this.robots.length; i++) {
      const r = this.robots[i];
      r.x = w.spawn.x + 40 + i * 30; r.y = w.spawn.y + 24;
      r.ridden = false;
    }
    this.riding = null;
    for (const p of pets) {
      p.x = w.spawn.x - 40; p.y = w.spawn.y + 30; p.ridden = false; p.vx = 0; p.vy = 0;
      w.aliens.push(p);
    }
    this.time = 7; this.day++;
    toast(`${w.planet.name}に着いた ― ${w.planet.tag}`, 'good');
    UI.open('ship');
    this.save();
  }

  ending() {
    this.ended = true;
    Save.clear();
    document.getElementById('endScreen').style.display = 'flex';
    document.getElementById('endBody').innerHTML =
      `<p>ワープコアが息を吹き返した。<br>4つの星を渡り歩いた記録が、航海日誌に残る。</p>
       <ul><li>かかった日数: <b>${this.day}日</b></li>
       <li>連れて帰るロボット: <b>${this.robots.length}体</b></li>
       <li>なついたガルパ: <b>${this.world.aliens.filter((a) => a.tame >= 100).length}匹</b></li></ul>`;
  }

  /* ------------------------------ 貯蔵箱 ------------------------------ */
  chestPut(st, i) {
    const s = this.inv[i];
    if (!s) return;
    st.items = st.items || [];
    const ex = st.items.find((x) => x.id === s.id);
    if (ex) ex.n += s.n; else st.items.push({ id: s.id, n: s.n });
    this.inv[i] = null;
  }
  chestTake(st, i) {
    const s = st.items[i];
    if (!s) return;
    const got = this.addItem(s.id, s.n);
    s.n -= got;
    if (s.n <= 0) st.items.splice(i, 1);
  }

  /* ------------------------------ 入力 ------------------------------ */
  handleKeys() {
    for (let i = 1; i <= 9; i++) if (Input.hit(String(i))) this.hot = i - 1;
    if (Input.hit('Escape')) { if (UI.isOpen()) UI.close(); }
    if (Input.hit('Tab') || Input.hit('i')) { UI.isOpen() && UI.kind === 'inv' ? UI.close() : UI.open('inv'); }
    if (Input.hit('c')) { UI.isOpen() && UI.kind === 'craft' ? UI.close() : UI.open('craft'); }
    if (Input.hit('h')) { UI.isOpen() && UI.kind === 'help' ? UI.close() : UI.open('help'); }
    if (Input.hit('q')) this.activeSide = this.activeSide === 'right' ? 'left' : 'right';
    if (Input.hit('e')) this.interact();
  }

  /* 目の前でいちばん近いもの。案内文と E の動作はここで一本化する */
  bestInteraction() {
    const p = this.player, W = this.world;
    let best = null, bestD = INTERACT_RANGE;

    for (const r of this.robots) {
      if (r.ridden) continue;
      const d = dist(p.x, p.y, r.x, r.y);
      if (d < bestD) { bestD = d; best = { kind: 'robot', r, label: `E で${r.name}に乗る（🔋${Math.round(r.batt)}%）` }; }
    }
    for (const a of W.aliens) {
      const def = ALIENS[a.sp];
      if (def.hostile || a.ridden) continue;
      const d = dist(p.x, p.y, a.x, a.y);
      if (d >= bestD) continue;
      bestD = d;
      if (def.mount) {
        best = a.tame >= 100
          ? { kind: 'mount', a, label: `E で${def.name}に乗る` }
          : { kind: 'feed', a, label: `E で餌をあげる（なつき ${a.tame || 0}%）` };
      } else {
        best = { kind: 'alien', a, label: `E で${def.name}と話す` };
      }
    }
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    let water = null;
    for (let ty = pty - 1; ty <= pty + 1; ty++) {
      for (let tx = ptx - 1; tx <= ptx + 1; tx++) {
        const d = dist(p.x, p.y, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
        const o = W.objAt(tx, ty);
        if (o && o.t === 'station' && d < bestD) {
          bestD = d; best = { kind: 'station', o, tx, ty, label: `E で${STATIONS[o.id].name}を使う` };
        } else if (o && o.t === 'ship' && d < bestD + 14) {
          bestD = d; best = { kind: 'ship', label: 'E で宇宙船を調べる' };
        } else if (!water && W.groundAt(tx, ty) === GT.WATER && d < 48) {
          water = { kind: 'water', label: 'E で水を汲む' };
        }
      }
    }
    return best || water;
  }

  interact() {
    if (UI.isOpen()) { UI.close(); return; }
    if (this.riding) { this.dismountRobot(); return; }
    if (this.mount) { this.dismountMount(); return; }

    const best = this.bestInteraction();
    if (!best) { toast('近くに何もない'); return; }
    switch (best.kind) {
      case 'robot': return this.rideRobot(best.r);
      case 'mount': return this.rideMount(best.a);
      case 'feed': return this.feedMount(best.a);
      case 'alien': {
        const def = ALIENS[best.a.sp];
        if (def.trade) return UI.open('trade', { alien: best.a });
        toast(def.line || '……');
        return undefined;
      }
      case 'ship': return UI.open('ship');
      case 'water': {
        let did = false;
        const r = this.robots.find((rb) => dist(rb.x, rb.y, this.player.x, this.player.y) < 60);
        if (r && r.water < r.maxwater) { r.fill(r.maxwater); toast(`${r.name}のタンクを満たした`, 'good'); did = true; }
        if (this.hasItem('tool_can', 1) && this.canWater < 12) { this.canWater = 12; toast('ジョウロを満たした', 'good'); did = true; }
        if (!did) toast('もう満タン');
        return undefined;
      }
      case 'station': {
        const o = best.o, def = STATIONS[o.id];
        if (!def.ui) { toast(def.name); return undefined; }
        if (def.ui === 'craft') return UI.open('craft');
        if (def.ui === 'robot') { const r = this.workRobot(); if (r) this.workRobotId = r.id; return UI.open('robot'); }
        if (def.ui === 'chest') return UI.open('chest', { station: o });
        if (def.ui === 'sleep') return UI.open('sleep');
        if (def.ui === 'charge') return UI.open('charge', { x: (best.tx + 0.5) * TILE, y: (best.ty + 0.5) * TILE });
        if (def.ui === 'water') return UI.open('water', { station: o, x: (best.tx + 0.5) * TILE, y: (best.ty + 0.5) * TILE });
        return undefined;
      }
      default: return undefined;
    }
  }

  /* 手に持っているもので、狙ったマスに触る */
  useHeld() {
    const p = this.player, W = this.world;
    const aim = this.aimTile();
    const held = this.heldItem();
    const d = held ? itemDef(held) : null;
    const far = dist(p.x, p.y, (aim.tx + 0.5) * TILE, (aim.ty + 0.5) * TILE) > PLAYER_REACH;

    /* 敵をたたく */
    if (held && ITEMS[held] && ITEMS[held].act === 'hit') {
      let hit = null, hd = 46;
      for (const a of W.aliens) {
        const dd = dist(aim.x, aim.y, a.x, a.y);
        if (dd < hd && dist(p.x, p.y, a.x, a.y) < 60) { hd = dd; hit = a; }
      }
      if (hit) {
        if (!this.spend(ITEMS[held].stamina)) return;
        hit.hp -= ITEMS[held].dmg; hit.hurt = 0.25;
        FX.burst(hit.x, hit.y, '#ffd28a', 7, 90, 0.4);
        this.swing = 1;
        return;
      }
    }
    if (far) { toast('遠すぎる'); return; }
    p.face = aim.x > p.x ? 1 : -1;
    this.swing = 1;

    if (d && isStation(held)) {
      if (W.place(aim.tx, aim.ty, held)) { this.takeItem(held, 1); Render._mmDirty = true; toast(`${itemName(held)}を置いた`, 'good'); this.save(); }
      else toast('ここには置けない', 'warn');
      return;
    }
    if (d && d.kind === 'seed') {
      if (W.sow(aim.tx, aim.ty, held)) { this.takeItem(held, 1); this.spend(1); }
      else toast('耕した畑に蒔く', 'warn');
      return;
    }
    if (d && d.kind === 'tool') {
      switch (d.act) {
        case 'mine': {
          const r = W.mine(aim.tx, aim.ty, d.hardness, 1);
          if (!r) { toast('掘るものがない'); return; }
          if (r.fail === 'hard') { toast(`${r.name}は硬い。ロボットのドリルが要る`, 'warn'); return; }
          if (!this.spend(d.stamina)) return;
          if (r.drops) this.collect(r.drops, aim.tx, aim.ty);
          Render._mmDirty = true;
          return;
        }
        case 'chop': {
          const r = W.gather(aim.tx, aim.ty, { canChop: true });
          if (!r) { toast('切るものがない'); return; }
          if (!this.spend(d.stamina)) return;
          if (r.drops) this.collect(r.drops, aim.tx, aim.ty);
          Render._mmDirty = true;
          return;
        }
        case 'till': {
          if (!W.canTill(aim.tx, aim.ty)) { toast('ここは耕せない'); return; }
          if (!this.spend(d.stamina)) return;
          W.till(aim.tx, aim.ty);
          Render._mmDirty = true;
          return;
        }
        case 'water': {
          if (this.canWater <= 0) { toast('ジョウロが空。水辺で E', 'warn'); return; }
          if (W.water(aim.tx, aim.ty)) { this.canWater--; this.spend(d.stamina); }
          else toast('水をやる畑がない');
          return;
        }
        default: return;
      }
    }
    /* 素手 */
    const r = W.gather(aim.tx, aim.ty, { canChop: false });
    if (!r) { toast('採るものがない'); return; }
    if (r.fail === 'tree') { toast('木は斧で切る', 'warn'); return; }
    if (r.fail === 'young') { toast('まだ育っていない'); return; }
    if (!this.spend(2)) return;
    if (r.drops) this.collect(r.drops, aim.tx, aim.ty);
  }

  spend(n) {
    if (this.player.st < n) { toast('疲れて力が入らない。何か食べよう', 'warn'); return false; }
    this.player.st -= n;
    return true;
  }

  /* 乗っているガルパで噛みつく */
  biteWithMount() {
    const a = this.mount;
    if (!a || a.cd > 0) return;
    a.cd = 0.7; a.chew = 0.5;
    const aim = this.aimTile();
    const ang = Math.atan2(aim.y - a.y, aim.x - a.x);
    a.ang = ang;
    let hit = 0;
    for (const o of this.world.aliens) {
      if (o === a || !ALIENS[o.sp].hostile) continue;
      const d = dist(o.x, o.y, a.x + Math.cos(ang) * 26, a.y + Math.sin(ang) * 26);
      if (d < 34) { o.hp -= ALIENS[a.sp].dmg; o.hurt = 0.25; FX.burst(o.x, o.y, '#ffd28a', 8, 100, 0.4); hit++; }
    }
    if (!hit) FX.burst(a.x + Math.cos(ang) * 26, a.y + Math.sin(ang) * 26, '#d8c2ff', 5, 70, 0.3);
  }

  /* ------------------------------ 更新 ------------------------------ */
  update(dt) {
    if (!this.world) return;
    this.clock += dt;
    this.frame++;
    this.smelterHot = Math.max(0, this.smelterHot - dt);
    this.swing = Math.max(0, this.swing - dt * 4);

    const dHours = dt * HOURS_PER_SEC;
    this.time += dHours;
    if (this.time >= 24) { this.time -= 24; this.day++; toast(`${this.day}日目`, 'good'); }
    this.world.tick(dHours);

    this.handleKeys();
    if (!this.uiOpen && !this.dead) {
      if (this.riding) this.updateRiding(dt);
      else if (this.mount) this.updateMountRide(dt);
      else this.updatePlayer(dt);
    }
    for (const r of this.robots) r.update(dt, this.world);
    this.chargeRobots(dt);

    /* 主人公は乗り物と一緒に動く */
    if (this.riding) { this.player.x = this.riding.x; this.player.y = this.riding.y; }
    if (this.mount) { this.player.x = this.mount.x; this.player.y = this.mount.y; }

    const targets = [];
    const f = this.focus();
    targets.push({
      x: f.x, y: f.y,
      onHit: (dmg) => {
        if (this.riding) { this.riding.damage(dmg * 0.5); this.hurtPlayer(dmg * 0.25); }
        else if (this.mount) this.hurtMount(dmg);
        else this.hurtPlayer(dmg);
      },
    });
    for (const r of this.robots) if (!r.ridden) targets.push({ x: r.x, y: r.y, onHit: (dmg) => r.damage(dmg) });
    this.world.updateAliens(dt, this.isNight(), targets);
    FX.update(dt);

    /* 体力・スタミナの自然回復 */
    const p = this.player;
    p.hurt = Math.max(0, p.hurt - dt);
    if (!this.riding && Math.hypot(p.vx, p.vy) < 10) p.st = Math.min(p.maxst, p.st + dt * 1.2);
    if (p.st > 60) p.hp = Math.min(p.maxhp, p.hp + dt * 0.8);
    if (this.time > 22 || this.time < 4) p.st = Math.max(0, p.st - dt * 0.35);

    /* 近くのものを案内する */
    this.updatePrompt();

    this.autoSave = (this.autoSave || 0) + dt;
    if (this.autoSave > 20) { this.autoSave = 0; this.save(); }
  }

  updatePlayer(dt) {
    const p = this.player;
    let ax = (Input.held('d') || Input.held('ArrowRight') ? 1 : 0) - (Input.held('a') || Input.held('ArrowLeft') ? 1 : 0);
    let ay = (Input.held('s') || Input.held('ArrowDown') ? 1 : 0) - (Input.held('w') || Input.held('ArrowUp') ? 1 : 0);
    if (Input.touch.active) { ax += Input.touch.dx; ay += Input.touch.dy; }
    const m = Math.hypot(ax, ay);
    if (m > 1) { ax /= m; ay /= m; }
    const tired = p.st <= 0 ? 0.55 : 1;
    p.vx = ax * PLAYER_SPEED * tired; p.vy = ay * PLAYER_SPEED * tired;
    if (ax) p.face = ax > 0 ? 1 : -1;
    p.walk += dt * (m > 0.1 ? 9 : 0);
    this.world.moveCircle(p, p.vx * dt, p.vy * dt, 9);
    if (Input.mouse.clicked) this.useHeld();
  }

  updateRiding(dt) {
    const r = this.riding;
    let ax = (Input.held('d') || Input.held('ArrowRight') ? 1 : 0) - (Input.held('a') || Input.held('ArrowLeft') ? 1 : 0);
    let ay = (Input.held('s') || Input.held('ArrowDown') ? 1 : 0) - (Input.held('w') || Input.held('ArrowUp') ? 1 : 0);
    if (Input.touch.active) { ax += Input.touch.dx; ay += Input.touch.dy; }
    const m = Math.hypot(ax, ay);
    if (m > 1) { ax /= m; ay /= m; }
    const speed = 168;
    r.vx = ax * speed; r.vy = ay * speed;
    if (ax) r.face = ax > 0 ? 1 : -1;
    this.world.moveCircle(r, r.vx * dt, r.vy * dt, 13);
    const aim = this.aimTile();
    r.aim = Math.atan2(aim.y - r.y, aim.x - r.x);
    if (Input.mouse.clicked) r.useArm('right', this);
    if (Input.mouse.rclicked) r.useArm('left', this);
    if (r.batt <= 0) { toast('バッテリーが切れた', 'warn'); this.dismountRobot(); }
  }

  updateMountRide(dt) {
    const a = this.mount;
    const def = ALIENS[a.sp];
    let ax = (Input.held('d') || Input.held('ArrowRight') ? 1 : 0) - (Input.held('a') || Input.held('ArrowLeft') ? 1 : 0);
    let ay = (Input.held('s') || Input.held('ArrowDown') ? 1 : 0) - (Input.held('w') || Input.held('ArrowUp') ? 1 : 0);
    if (Input.touch.active) { ax += Input.touch.dx; ay += Input.touch.dy; }
    const m = Math.hypot(ax, ay);
    if (m > 1) { ax /= m; ay /= m; }
    a.vx = ax * def.rideSpeed; a.vy = ay * def.rideSpeed;
    a.cd = Math.max(0, a.cd - dt);
    if (ax) a.face = ax > 0 ? 1 : -1;
    this.world.moveCircle(a, a.vx * dt, a.vy * dt, 13);
    if (Input.mouse.clicked) this.biteWithMount();
  }

  chargeRobots(dt) {
    const W = this.world;
    for (const r of this.robots) {
      const tx = Math.floor(r.x / TILE), ty = Math.floor(r.y / TILE);
      let bay = false, solar = false;
      for (let y = ty - 2; y <= ty + 2; y++) {
        for (let x = tx - 2; x <= tx + 2; x++) {
          const o = W.objAt(x, y);
          if (!o || o.t !== 'station') continue;
          if (o.id === 'st_robotbay') bay = true;
          if (o.id === 'st_charger') solar = true;
          if (o.id === 'st_tank' && r.water < r.maxwater && o.water > 0) {
            const give = Math.min(dt * 6, o.water, r.maxwater - r.water);
            r.water += give; o.water -= give;
          }
        }
      }
      if (bay || (solar && !this.isNight())) r.charge(dt * (bay ? 9 : 5));
    }
    /* 貯水タンクは少しずつ溜まる */
    if (this.frame % 60 === 0) {
      for (let i = 0; i < W.obj.length; i++) {
        const o = W.obj[i];
        if (o && o.t === 'station' && o.id === 'st_tank') o.water = Math.min(40, (o.water || 0) + (W.planet.dry ? 0.3 : 0.8));
      }
    }
  }

  updatePrompt() {
    if (this.uiOpen) { UI.showPrompt(null); this.nearAlien = null; return; }
    if (this.riding) {
      UI.showPrompt(`E で降りる ／ Q で使う手を切り替え（今: ${this.activeSide === 'right' ? '右手' : '左手'}）`);
      this.nearAlien = null;
      return;
    }
    if (this.mount) { UI.showPrompt('E で降りる ／ 左クリックで噛みつく'); this.nearAlien = null; return; }
    const best = this.bestInteraction();
    this.nearAlien = best && best.a ? best.a : null;
    UI.showPrompt(best ? best.label : null);
  }

  /* --------------------------- タイトルの背景 --------------------------- */
  drawTitleScene(dt) {
    const ctx = this.ctx, dpr = this.dpr;
    const w = this.canvas.width / dpr, h = this.canvas.height / dpr;
    this.tclock = (this.tclock || 0) + dt;
    const t = this.tclock;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = ctx.createLinearGradient(0, 0, w * 0.4, h);
    sky.addColorStop(0, '#0a1524');
    sky.addColorStop(0.55, '#0a0f1a');
    sky.addColorStop(1, '#05070d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    if (!this._stars || this._starW !== w) {
      const rng = new RNG(20260901);
      this._starW = w;
      this._stars = [];
      for (let i = 0; i < 190; i++) {
        this._stars.push({ x: rng.f(0, w), y: rng.f(0, h), r: rng.f(0.5, 1.7), p: rng.f(0, TAU), s: rng.f(0.4, 1.6) });
      }
    }
    for (const st of this._stars) {
      ctx.globalAlpha = 0.35 + Math.sin(t * st.s + st.p) * 0.3;
      ctx.fillStyle = '#dff0ff';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* 大きな惑星 */
    const px = w * 0.78, py = h * 0.92, pr = Math.min(w, h) * 0.46;
    const halo = ctx.createRadialGradient(px, py, pr * 0.9, px, py, pr * 1.35);
    halo.addColorStop(0, 'rgba(95,211,200,0.22)');
    halo.addColorStop(1, 'rgba(95,211,200,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(px, py, pr * 1.35, 0, TAU); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.clip();
    ctx.fillStyle = '#3f8a6a';
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    const bands = ['#54a87c', '#6fc08c', '#31705f', '#5fb083'];
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = bands[i % bands.length];
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(px + Math.sin(i * 1.7 + t * 0.05) * pr * 0.3, py - pr + i * pr * 0.26,
        pr * (0.7 + (i % 3) * 0.12), pr * 0.1, 0.1, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* 昼と夜の境目 */
    const term = ctx.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
    term.addColorStop(0, 'rgba(255,244,210,0.26)');
    term.addColorStop(0.5, 'rgba(0,0,0,0)');
    term.addColorStop(1, 'rgba(0,4,12,0.62)');
    ctx.fillStyle = term;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    ctx.restore();

    /* 小さな月 */
    const mx = w * 0.2, my = h * 0.24, mr = Math.min(w, h) * 0.055;
    ctx.fillStyle = '#c8d4e2';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.arc(mx + mr * 0.3, my - mr * 0.2, mr * 0.22, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx - mr * 0.35, my + mr * 0.3, mr * 0.16, 0, TAU); ctx.fill();

    /* 落ちていく補給船 */
    const period = 9;
    const k = (t % period) / period;
    const sx = w * (0.05 + k * 0.95), sy = h * (0.1 + k * k * 0.55);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(0.5 + k * 0.3);
    const trail = ctx.createLinearGradient(-140, 0, 0, 0);
    trail.addColorStop(0, 'rgba(255,170,90,0)');
    trail.addColorStop(1, 'rgba(255,190,120,0.55)');
    ctx.fillStyle = trail;
    ctx.beginPath(); ctx.moveTo(-150, -4); ctx.lineTo(0, -6); ctx.lineTo(0, 6); ctx.lineTo(-150, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cdd8e4';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -7); ctx.lineTo(-12, 0); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a6f8a';
    ctx.beginPath(); ctx.ellipse(4, -1, 4, 2.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ------------------------------ ループ ------------------------------ */
  loop(t) {
    requestAnimationFrame((n) => this.loop(n));
    const dt = clamp((t - this.lastT) / 1000 || 0, 0, 0.05);
    this.lastT = t;
    if (!this.world) { this.drawTitleScene(dt); Input.endFrame(); return; }
    this.update(dt);
    Render.draw(this, this.canvas, this.ctx);
    UI.hud();
    Input.endFrame();
  }
}

window.addEventListener('DOMContentLoaded', () => { window.GAME = new Game(); });

})();
