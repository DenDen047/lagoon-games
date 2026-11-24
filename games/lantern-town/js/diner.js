// バーガー屋: へやと、りょうりの しごと (材料を とる → 焼く・切る → さらに のせる → おきゃくさんに 出す)。
import * as THREE from 'three';
import * as A from './assets.js';
import { scene, icon } from './engine.js';
import { G, SV, save } from './state.js';
import { RECIPES, INGREDIENTS, HERO_CLASSES } from './data.js';
import { addBox, addInteract, setBounds, hooks, addBeam, ROOM_LIGHTS } from './world.js';
import { Actor } from './actor.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';
import { burst, popText } from './fx.js';

export const DX = 400;
const SHIFT = 150;               // 1 回の しごとの 長さ (びょう)
const COOK = 5, BURN = 13, CHOP = 1.4, STEW = 6;
export const dinerRoot = new THREE.Group();
export const shift = { on: false, t: 0, served: 0, earned: 0, spawnT: 0 };
const stations = [];
const customers = [];
const seats = [];

const P = (x, z) => new THREE.Vector3(DX + x, 0, z);
function prop(name, x, z, { ry = 0, y = 0, s = 1 } = {}) {
  const o = A.prop(name); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); dinerRoot.add(o); return o;
}
function itemModel(id) {
  const m = id.startsWith('dish:') ? RECIPES[id.slice(5)].model : INGREDIENTS[id].model;
  const o = A.prop(m); o.scale.setScalar(0.75); return o;
}
export function itemName(id) { return id.startsWith('dish:') ? RECIPES[id.slice(5)].name : INGREDIENTS[id].name; }
export function itemIcon(id) {
  const m = id.startsWith('dish:') ? RECIPES[id.slice(5)].model : INGREDIENTS[id].model;
  return icon('i:' + m, () => A.prop(m), 96);
}

function station(def) {
  const s = { slots: [], ...def };
  s.it = addInteract({ area: 'diner', x: DX + s.x, z: s.z + (s.reachZ ?? 0.9), r: s.r ?? 1.35, label: () => s.label(), act: () => s.act() });
  stations.push(s);
  return s;
}
const hands = () => G.player.held;
const take = (id) => { G.player.hold(id, itemModel(id)); sfx('pick'); };
const drop = () => { const id = G.player.held; G.player.hold(null); return id; };

export function buildDiner() {
  dinerRoot.position.set(DX, 0, 0);
  scene.add(dinerRoot);
  setBounds('diner', [DX - 7.4, DX + 7.4, -5.0, 6.2]);
  for (const x of [-6, -2, 2, 6]) for (const z of [-4, 0, 4]) prop('floor_kitchen', x, z, { y: -0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.6, 12.6), new THREE.MeshStandardMaterial({ color: 0x5b4636 }));
  base.position.set(0, -0.8, 0); dinerRoot.add(base);
  ['wall', 'wall_window_open', 'wall_decorated', 'wall'].forEach((n, i) => prop(n, -6 + i * 4, -6));
  for (const z of [-4, 0, 4]) { prop(z === 0 ? 'wall_window_open' : 'wall', -8, z, { ry: Math.PI / 2 }); prop(z === 0 ? 'wall_window_open' : 'wall', 8, z, { ry: -Math.PI / 2 }); }
  addBeam(dinerRoot, new THREE.Vector3(-7.7, 2.5, 0), new THREE.Vector3(1.25, -1, 0.15), { len: 5.6 });
  addBeam(dinerRoot, new THREE.Vector3(7.7, 2.5, 0), new THREE.Vector3(-1.25, -1, 0.15), { len: 5.6 });
  const light = new THREE.PointLight(0xfff0d0, 7, 20, 1.5); ROOM_LIGHTS.push(light); light.userData.base = light.intensity; light.position.set(0, 3.8, 0); dinerRoot.add(light);

  // ---- うしろの れつ (z=-4.9) ----
  const back = -4.9;
  prop('fridge_A', -7, back + 0.1);
  prop('stove_multi', -5, back); prop('extractorhood', -5, back);
  prop('kitchencounter_straight_A', -3, back); prop('cuttingboard', -3, back + 0.1, { y: 1.0 });
  prop('kitchencounter_straight_B', -1, back); prop('kitchencounter_straight_B', 1, back);
  prop('stove_multi', 3, back); prop('extractorhood', 3, back);
  prop('kitchencounter_sink', 5, back); prop('kitchencounter_straight_decorated', 7, back);
  for (const x of [-3, -1, 1, 5, 7]) prop('kitchencabinet', x, back);
  addBox('diner', DX, back, 8, 1.05);
  const potMesh = { empty: prop('pot_A', 3, back + 0.1, { y: 1.2 }), full: prop('pot_A_stew', 3, back + 0.1, { y: 1.2 }) };
  potMesh.full.visible = false;

  // ---- 材料の はこ (z=-1.4) ----
  const crates = [['crate_buns', 'bun', 'パン'], ['crate_cheese', 'rawCheese', 'チーズ'], ['crate_lettuce', 'rawLettuce', 'レタス'], ['crate_tomatoes', 'rawTomato', 'トマト'],
    ['crate_potatoes', 'rawPotato', 'じゃがいも'], ['crate_carrots', 'rawCarrot', 'にんじん']];
  crates.forEach(([model, item, name], i) => {
    const x = -6 + i * 2;
    prop(model, x, -1.4);
    for (const side of [-1, 1]) {
      station({ x, z: -1.4, reachZ: side * 1.35, r: 1.1, label: () => (hands() ? null : name + 'を とる'), act: () => { if (!hands()) take(item); } });
    }
  });
  prop('crate', 6, -1.4); prop('crate_lid', 6, -1.4, { y: 0.8, ry: 0.3 });
  for (const side of [-1, 1]) station({ x: 6, z: -1.4, reachZ: side * 1.35, r: 1.1, label: () => (hands() ? 'すてる' : null), act: () => { drop(); sfx('put'); } });
  addBox('diner', DX, -1.4, 7, 1.0);
  UI.label('diner', 'ゴミばこ', P(6, -1.4).setY(1.6));

  // 冷蔵庫 (なまの にく)
  station({ x: -7, z: back, r: 1.3, label: () => (hands() ? null : 'にくを とる'), act: () => { if (!hands()) take('rawPatty'); } });

  // コンロ: にくを 2 まいまで 焼ける
  const stove = station({ x: -5, z: back, r: 1.3, cook: [null, null],
    label() {
      const h = hands();
      if (h === 'rawPatty' && this.cook.includes(null)) return 'にくを やく';
      if (!h && this.cook.some((c) => c)) return 'にくを とる';
      return h === 'rawPatty' ? 'コンロが いっぱい' : null;
    },
    act() {
      const h = hands();
      if (h === 'rawPatty') {
        const i = this.cook.indexOf(null);
        if (i < 0) return;
        drop();
        const m = itemModel('rawPatty'); m.position.set(-5.45 + i * 0.9, 1.25, back + 0.15); dinerRoot.add(m);
        this.cook[i] = { t: 0, m, state: 'rawPatty' };
        sfx('put');
      } else if (!h) {
        let best = -1;
        this.cook.forEach((c, i) => { if (c && (best < 0 || c.t > this.cook[best].t)) best = i; });
        const c = this.cook[best];
        dinerRoot.remove(c.m);
        this.cook[best] = null;
        UI.untag('cook' + best);
        take(c.state);
      }
    } });

  // まな板
  const board = station({ x: -3, z: back, r: 1.3, item: null, t: 0, m: null,
    label() {
      const h = hands();
      if (h && INGREDIENTS[h]?.chop && !this.item) return INGREDIENTS[h].name + 'を きる';
      if (!h && this.item && this.t >= CHOP) return INGREDIENTS[this.item].name + 'を とる';
      if (this.item && this.t < CHOP) return 'きっている…';
      return null;
    },
    act() {
      const h = hands();
      if (h && INGREDIENTS[h]?.chop && !this.item) {
        drop(); this.item = h; this.t = 0;
        this.m = itemModel(h); this.m.position.set(-3, 1.2, back + 0.1); dinerRoot.add(this.m);
        sfx('put');
      } else if (!h && this.item && this.t >= CHOP) {
        dinerRoot.remove(this.m); const id = this.item; this.item = null; UI.untag('chop'); take(id);
      }
    } });

  // もりつけ台 (さら) 2 つ
  const plates = [-1, 1].map((x, k) => {
    prop('plate', x, back + 0.1, { y: 1.0 });
    return station({ x, z: back, r: 1.15, parts: [], dish: null, group: new THREE.Group(), k,
      label() {
        const h = hands();
        if (h && !h.startsWith('dish') && !INGREDIENTS[h].raw && canAdd(this, h)) return INGREDIENTS[h].name + 'を のせる';
        if (h && INGREDIENTS[h]?.raw) return null;
        if (!h && this.dish) return RECIPES[this.dish].name + 'を もつ';
        if (!h && this.parts.length) return 'まだ できていない';
        return null;
      },
      act() {
        const h = hands();
        if (h && !h.startsWith('dish') && !INGREDIENTS[h].raw && canAdd(this, h)) {
          drop(); this.parts.push(h); this.dish = match(this.parts); sfx('put'); drawPlate(this);
          if (this.dish) sfx('ding');
        } else if (!h && this.dish) {
          const id = 'dish:' + this.dish; this.parts = []; this.dish = null; drawPlate(this); take(id);
        }
      } });
  });
  plates.forEach((p, k) => { p.group.position.set(-1 + k * 2, 1.08, back + 0.1); dinerRoot.add(p.group); });

  // おなべ: きった じゃがいもと にんじんで シチュー
  station({ x: 3, z: back, r: 1.3, has: new Set(), t: 0,
    label() {
      const h = hands();
      if ((h === 'potato' || h === 'carrot') && !this.has.has(h) && this.t === 0) return INGREDIENTS[h].name + 'を いれる';
      if (!h && this.t >= STEW) return 'シチューを よそう';
      if (this.has.size === 2 && this.t < STEW) return 'にこんでいる…';
      if (!h && this.has.size < 2) return 'きった じゃがいもと にんじんを いれてね';
      return null;
    },
    act() {
      const h = hands();
      if ((h === 'potato' || h === 'carrot') && !this.has.has(h) && this.t === 0) {
        drop(); this.has.add(h); potMesh.empty.visible = this.has.size < 2; potMesh.full.visible = this.has.size === 2; sfx('put');
      } else if (!h && this.t >= STEW) {
        this.has.clear(); this.t = 0; potMesh.empty.visible = true; potMesh.full.visible = false; UI.untag('stew'); take('dish:stew');
      }
    },
    tick(dt) {
      if (this.has.size === 2 && this.t < STEW) {
        this.t = Math.min(STEW, this.t + dt);
        UI.tag('stew', P(3, back + 0.1).setY(2.3), bar(this.t / STEW, this.t >= STEW ? 'できた!' : ''));
        if (this.t >= STEW) sfx('ding');
      }
    } });
  stove.tick = (dt) => {
    stove.cook.forEach((c, i) => {
      if (!c) return;
      c.t += dt;
      const st = c.t >= BURN ? 'burnt' : c.t >= COOK ? 'patty' : 'rawPatty';
      if (st !== c.state) {
        c.state = st;
        dinerRoot.remove(c.m); c.m = itemModel(st); c.m.position.set(-5.45 + i * 0.9, 1.25, back + 0.15); dinerRoot.add(c.m);
        if (st === 'patty') sfx('ding');
      }
      if (Math.random() < dt * 2) sfx('sizzle');
      if (st === 'burnt' && Math.random() < dt * 6) burst(P(-5.45 + i * 0.9, back + 0.15).setY(1.5), 0x555555, 1, 0.5, { up: 2, grav: -1, life: 1.2 });
      const k = c.t < COOK ? c.t / COOK : Math.min(1, (c.t - COOK) / (BURN - COOK));
      UI.tag('cook' + i, P(-5.45 + i * 0.9, back + 0.15).setY(2.0), bar(k, st === 'burnt' ? 'こげた!' : st === 'patty' ? 'やけた!' : '', st === 'patty' ? 'warn' : st === 'burnt' ? 'bad' : ''));
    });
  };
  board.tick = (dt) => {
    if (!board.item || board.t >= CHOP) return;
    const near = G.player.pos.distanceTo(P(-3, back + 1)) < 1.8;
    if (!near) return;
    board.t += dt;
    G.player.chopping = true;
    if (Math.floor(board.t * 6) !== Math.floor((board.t - dt) * 6)) sfx('chop');
    UI.tag('chop', P(-3, back).setY(2.0), bar(board.t / CHOP));
    if (board.t >= CHOP) {
      board.item = INGREDIENTS[board.item].chop;
      dinerRoot.remove(board.m); board.m = itemModel(board.item); board.m.position.set(-3, 1.15, back + 0.1); dinerRoot.add(board.m);
      UI.untag('chop'); sfx('ding');
    }
  };

  // ---- 客席 ----
  for (const tx of [-4.5, 0, 4.5]) {
    prop('table_round_A_small', tx, 2.9);
    prop('chair_A', tx, 1.75);
    addBox('diner', DX + tx, 2.9, 0.75, 0.75);
    const seat = { x: tx, z: 1.75, tx, tz: 2.9, cust: null };
    seats.push(seat);
    station({ x: tx, z: 2.9, reachZ: 1.25, r: 1.4, label: () => serveLabel(seat), act: () => serve(seat) });
  }
  // しごとボード
  prop('table_round_A_small', 6.2, 4.6, { s: 0.8 }); prop('menu', 6.2, 4.6, { y: 0.8, ry: -0.5 });
  addBox('diner', DX + 6.2, 4.6, 0.6, 0.6);
  addInteract({ area: 'diner', x: DX + 5.2, z: 4.6, r: 1.4, label: () => (shift.on ? 'しごとを おわる' : 'しごとを はじめる'), act: () => (shift.on ? endShift() : startShift()) });
  UI.label('diner', 'しごとボード', P(6.2, 4.6).setY(2.2));
  // 出口
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x2f6b4f, roughness: 1 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.02, 5.7); dinerRoot.add(mat);
  addInteract({ area: 'diner', x: DX, z: 5.7, r: 1.3, label: () => 'そとに でる', act: () => hooks.enter('town') });
}

function bar(k, text = '', cls = '') {
  return `<div class="pbar ${cls}"><i style="width:${Math.round(k * 100)}%"></i></div>${text ? `<b class="ptext ${cls}">${text}</b>` : ''}`;
}
function match(parts) {
  const set = [...parts].sort().join(',');
  for (const [id, r] of Object.entries(RECIPES)) if (r.parts && [...r.parts].sort().join(',') === set) return id;
  return null;
}
function canAdd(plate, id) {
  if (plate.parts.includes(id)) return false;
  // どれかの レシピに つながる ときだけ のせられる
  const next = [...plate.parts, id];
  return Object.values(RECIPES).some((r) => r.parts && next.every((p) => r.parts.includes(p)));
}
function drawPlate(p) {
  p.group.clear();
  if (p.dish) { const m = A.prop(RECIPES[p.dish].model); m.scale.setScalar(0.75); p.group.add(m); return; }
  p.parts.forEach((id, i) => { const m = itemModel(id); m.scale.setScalar(0.55); m.position.y = i * 0.14; p.group.add(m); });
}

// ---------- おきゃくさん ----------
const HATS = ['Knight_Helmet', 'Knight_Cape', 'Barbarian_Hat', 'Barbarian_Cape', 'Mage_Hat', 'Mage_Cape', 'Rogue_Cape'];
function spawnCustomer() {
  const seat = seats.filter((s) => !s.cust)[Math.floor(Math.random() * 3)] || seats.find((s) => !s.cust);
  if (!seat) return;
  const bodies = Object.keys(HERO_CLASSES);
  const a = new Actor(bodies[Math.floor(Math.random() * bodies.length)], { show: HATS, area: 'diner' });
  a.pos.set(DX, 0, 7.5);
  const orders = ['burger', 'burger', 'cheese', 'veggie', 'stew'];
  const order = orders[Math.floor(Math.random() * Math.min(orders.length, 2 + SV.stats.served))];
  const c = { a, seat, order, state: 'walk', patience: 70, max: 70, t: 0,
    path: [P(seat.x + 1.4, 4.6), P(seat.x + 1.4, seat.z), P(seat.x, seat.z)] };
  seat.cust = c;
  customers.push(c);
}
function serveLabel(seat) {
  const c = seat.cust;
  if (!c || c.state !== 'wait') return null;
  const h = hands();
  if (h === 'dish:' + c.order) return RECIPES[c.order].name + 'を だす';
  return RECIPES[c.order].name + 'が ほしいみたい';
}
function serve(seat) {
  const c = seat.cust;
  if (!c || c.state !== 'wait' || hands() !== 'dish:' + c.order) { sfx('fail'); return; }
  drop();
  const r = RECIPES[c.order];
  const tip = Math.round(10 * c.patience / c.max);
  const pay = r.pay + tip;
  SV.coins += pay;
  shift.earned += pay; shift.served++;
  SV.stats.served++;
  c.state = 'eat'; c.t = 0;
  c.food = A.prop(r.model); c.food.scale.setScalar(0.7); c.food.position.set(seat.tx, 1.0, seat.tz - 0.2); dinerRoot.add(c.food);
  UI.untag('order' + seats.indexOf(seat));
  popText(c.a.pos.clone().setY(2.6), '+' + pay, 'coin');
  burst(c.a.pos.clone().setY(2.2), 0xff7aa8, 14, 3, { up: 3, grav: 4, life: 0.9 });
  sfx('serve');
  save();
}

export function startShift() {
  shift.on = true; shift.t = SHIFT; shift.served = 0; shift.earned = 0; shift.spawnT = 1.5;
  UI.toast('しごと スタート! おきゃくさんの ちゅうもんを つくろう');
  sfx('quest');
}
export function endShift(silent = false) {
  if (!shift.on) return;
  shift.on = false;
  for (const c of customers) if (c.state !== 'leave') leave(c);
  if (!silent) UI.toast(`おつかれさま! ${shift.served}かい りょうりを だして ${shift.earned} コイン かせいだ`, 'big');
  save();
}
function leave(c) {
  c.state = 'leave'; c.t = 0;
  c.path = [P(c.seat.x + 1.4, c.seat.z), P(c.seat.x + 1.4, 4.6), P(0, 7.5)];
  UI.untag('order' + seats.indexOf(c.seat));
  if (c.food) { dinerRoot.remove(c.food); c.food = null; }
}
function walk(c, dt) {
  const tgt = c.path[0];
  const dx = tgt.x - c.a.pos.x, dz = tgt.z - c.a.pos.z, d = Math.hypot(dx, dz);
  c.a.play('Walking_A');
  if (d < 0.08) { c.path.shift(); return c.path.length === 0; }
  const step = Math.min(d, 2.6 * dt);
  c.a.pos.x += dx / d * step; c.a.pos.z += dz / d * step;
  c.a.faceTo(dx, dz, dt);
  return false;
}

export function updateDiner(dt) {
  for (const s of stations) s.tick?.(dt);
  if (shift.on) {
    shift.t -= dt;
    shift.spawnT -= dt;
    if (shift.spawnT <= 0) { spawnCustomer(); shift.spawnT = 9 + Math.random() * 7; }
    if (shift.t <= 0) endShift();
  }
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i];
    c.t += dt;
    if (c.state === 'walk') {
      if (walk(c, dt)) { c.state = 'sit'; c.t = 0; c.a.pos.set(DX + c.seat.x, 0, c.seat.z); c.a.yaw = 0; c.a.play('Sit_Chair_Down', { once: true }); }
    } else if (c.state === 'sit') {
      if (c.t > 1.0) { c.state = 'wait'; c.a.play('Sit_Chair_Idle'); }
    } else if (c.state === 'wait') {
      c.patience -= dt;
      const k = c.patience / c.max;
      UI.tag('order' + seats.indexOf(c.seat), c.a.pos.clone().setY(3.1),
        `<div class="order"><img src="${itemIcon('dish:' + c.order)}"><div class="pbar ${k < 0.3 ? 'bad' : k < 0.6 ? 'warn' : ''}"><i style="width:${Math.round(k * 100)}%"></i></div></div>`);
      if (c.patience <= 0) { sfx('fail'); UI.toast('おきゃくさんが おこって かえっちゃった…'); leave(c); }
    } else if (c.state === 'eat') {
      if (c.t > 3) leave(c);
    } else if (c.state === 'leave') {
      if (c.t < 0.9) c.a.play('Sit_Chair_StandUp', { once: true });
      else if (walk(c, dt)) { c.a.dispose(); c.seat.cust = null; customers.splice(i, 1); continue; }
    }
    c.a.update(dt);
  }
}

/** バーガー屋を 出るとき: しごとを おわらせて、つくりかけを かたづける */
export function leaveDiner() {
  endShift(true);
  for (const c of customers) { c.a.dispose(); c.seat.cust = null; UI.untag('order' + seats.indexOf(c.seat)); if (c.food) dinerRoot.remove(c.food); }
  customers.length = 0;
}
