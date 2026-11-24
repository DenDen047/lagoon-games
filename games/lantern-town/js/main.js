// LANTERN TOWN の 入口: 読みこみ → タイトル → ゲームの ループ。場所の 行き来・ねる・もようがえ も ここで つなぐ。
import * as THREE from 'three';
import * as E from './engine.js';
import * as A from './assets.js';
import { G, SV, setSave, loadSave, freshSave, save, maxHp } from './state.js';
import { I, bindInput, updateInput } from './input.js';
import { initAudio, sfx, setSound } from './audio.js';
import { initFx, updateFx } from './fx.js';
import { buildTown, townRoot, hooks, DOORS, DUMMIES } from './world.js';
import { buildHouse, houseRoot, HX, deco, decoStart, decoEnd, decoUpdate, decoPlace, decoStore, decoRotate, setGhost, rebuildFurniture } from './house.js';
import { buildDiner, dinerRoot, DX, updateDiner, leaveDiner } from './diner.js';
import { Player } from './player.js';
import { updateEnemies, clearEnemies, spawn } from './enemies.js';
import { spawnNpcs, updateNpcs } from './npcs.js';
import { initDayNight, updateDayNight } from './daynight.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);
function fail(msg) { const e = $('err'); e.textContent = msg; e.classList.remove('hidden'); }
window.addEventListener('error', (e) => fail('エラー: ' + (e.message || '読みこみに失敗') + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'));

const FIXED = { house: { x: HX, y: 10.5, z: 12, lz: -0.6 }, diner: { x: DX, y: 13, z: 14.5, lz: -1.2 } };
let fading = false;

async function boot() {
  const canvas = $('game');
  if (!E.init(canvas)) { fail('この ブラウザは WebGL に たいおうしていないため あそべません。あたらしい Chrome / Safari / Edge で ひらいてください。'); return; }
  E.setQuality('auto');
  try {
    await A.loadAll((k) => UI.progress(k));
  } catch (err) {
    fail('3D の そざいを よみこめませんでした。ページを よみこみなおしてください。(' + err.message + ')');
    return;
  }
  setSave(loadSave() || freshSave('Knight'));
  buildTown();
  buildHouse();
  buildDiner();
  initFx();
  initDayNight();
  UI.init(handlers);
  bindInput(canvas, { canLock: () => G.mode === 'play' && !G.menu && G.area === 'town' && !fading, onLock: (on) => $('clickHint').classList.toggle('hidden', on || I.touch || G.area !== 'town') });
  E.setQuality(SV.opts.quality);
  spawnNpcs();
  hooks.enter = enter;
  hooks.shop = () => UI.openMenu('shop');
  hooks.sit = (seat) => G.player.sit(seat);
  hooks.sleep = sleep;
  // 1 フレーム 描いて シェーダーを 準備してから タイトルを 出す
  E.cam.target.set(0, 0, 20);
  E.renderer.compile(E.scene, E.camera);
  G.mode = 'title';
  UI.showTitle(loadSave(), start);
  requestAnimationFrame(frame);
}

function start(hero) {
  initAudio();
  setSound(SV.opts.sound);
  if (hero) setSave(freshSave(hero));
  const fresh = !!hero;
  if (G.player) G.player.dispose();
  G.player = new Player(SV.hero);
  rebuildFurniture();
  SV.hp = Math.min(SV.hp, maxHp());
  UI.hideTitle();
  G.mode = 'play';
  sfx('quest');
  if (fresh || SV.time < 6 || SV.time >= 20) placeIn('house', HX, 1.5, Math.PI);
  else placeIn('town', DOORS.building_A.x, DOORS.building_A.z, 0);
  if (fresh) setTimeout(() => UI.toast('あさだ。そとに でて まちを あるいてみよう!', 'big'), 600);
}

function placeIn(area, x, z, yaw) {
  G.area = area;
  G.player.teleport(area, x, z, yaw);
  townRoot.visible = area === 'town';
  houseRoot.visible = area === 'house';
  dinerRoot.visible = area === 'diner';
  for (const n of G.npcs) n.a.root.visible = area === 'town';
  E.cam.fixed = FIXED[area] || null;
  E.cam.target.copy(G.player.pos);
  E.cam.snap = true;
  if (area === 'town') { E.cam.yaw = yaw + (yaw === 0 ? 0 : Math.PI); E.cam.pitch = 0.42; }
  if (area !== 'town' && document.pointerLockElement) document.exitPointerLock();
  $('clickHint').classList.toggle('hidden', area !== 'town' || I.touch || I.locked);
}

function fadeTo(fn, hold = 250) {
  fading = true;
  $('fade').classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => { $('fade').classList.remove('on'); fading = false; }, hold); }, 380);
}

function enter(area) {
  sfx('ui');
  fadeTo(() => {
    const from = G.area;
    if (from === 'diner') leaveDiner();
    if (from === 'house' && deco.on) { decoEnd(); UI.decoBar(false); }
    if (area === 'house') placeIn('house', HX, 3.6, Math.PI);
    else if (area === 'diner') placeIn('diner', DX, 4.6, Math.PI);
    else {
      const d = from === 'diner' ? DOORS.building_E : DOORS.building_A;
      placeIn('town', d.x, d.z + 0.5, 0);
    }
    if (area === 'diner' && !SV.stats.served) setTimeout(() => UI.toast('みぎおくの 「しごとボード」で しごとを はじめよう'), 500);
    save();
  });
}

function sleep(bed) {
  const p = G.player;
  if (p.state !== 'move') return;
  p.lieDown(bed);
  const night = SV.time >= 18 || SV.time < 6;
  setTimeout(() => fadeTo(() => {
    if (night) { if (SV.time >= 18) SV.day++; SV.time = 6.2; } else SV.time = Math.min(17.9, SV.time + 2);
    SV.hp = maxHp();
    clearEnemies();
    UI.toast(night ? `${SV.day}にちめの あさ。よく ねむった!` : 'ひるねして げんきに なった', 'big');
    sfx('morning');
    save();
    p.wake();
  }, 600), 1500);
}

function respawn() {
  const lost = Math.floor(SV.coins * 0.1);
  fadeTo(() => {
    SV.coins -= lost;
    SV.hp = Math.round(maxHp() * 0.6);
    clearEnemies();
    placeIn('house', HX, 1.5, Math.PI);
    UI.toast(`たおれて いえに はこばれた……${lost ? ` (${lost} コイン おとした)` : ''}`, 'big');
    save();
  }, 500);
}

const handlers = {
  toTitle() { save(); UI.closeMenu(); location.reload(); },
  quality(q) { E.setQuality(q); },
  sound(on) { setSound(on); },
  decoPick: () => deco.pick,
  decoSelect(id) { setGhost(id); sfx('ui'); },
};

// ---------- 自動の 画質調整 ----------
let fpsT = 0, fpsN = 0, slow = 0;
function autoQuality(dt) {
  fpsT += dt; fpsN++;
  if (fpsT < 2) return;
  const fps = fpsN / fpsT;
  fpsT = 0; fpsN = 0;
  if (SV.opts.quality !== 'auto') return;
  slow = fps < 40 ? slow + 1 : 0;
  if (slow >= 2 && E.Q.level !== 'low') { E.setQuality(E.Q.level === 'high' ? 'mid' : 'low'); slow = 0; }
}

let last = performance.now();
let saveT = 0;
const focusV = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.dt = dt; G.now += dt;
  updateInput();
  if (G.mode === 'play') playFrame(dt);
  else {
    // タイトル: 広場の うえを ゆっくり まわる
    updateDayNight(dt, false);
    const t = G.now * 0.05;
    E.camera.position.set(Math.sin(t) * 34, 15, 22 + Math.cos(t) * 34);
    E.camera.lookAt(0, 2, 12);
    E.sun.target.position.set(0, 0, 10);
    E.sun.position.set(0, 0, 10).addScaledVector(E.sunDir, 70);
    focusV.set(0, 0, 10);
    updateNpcs(dt);
    updateFx(dt, { night: G.night, area: 'town', focus: focusV, time: G.now });
  }
  E.render();
  I.endFrame();
}

function playFrame(dt) {
  const p = G.player;
  const busy = !!G.menu || fading;
  if (!fading) {
    if (I.pressed('menu')) {
      if (G.menu) UI.closeMenu();
      else if (deco.on) { decoEnd(); UI.decoBar(false); }
      else UI.openMenu('pause');
    }
    if (I.pressed('mute')) { SV.opts.sound = !SV.opts.sound; setSound(SV.opts.sound); UI.toast(SV.opts.sound ? 'おと あり' : 'おと なし'); }
  }
  if (!busy) {
    if (I.pressed('deco') && G.area === 'house' && p.state === 'move') {
      if (deco.on) { decoEnd(); UI.decoBar(false); } else { decoStart(); UI.decoBar(true); UI.toast('もようがえ: したの リストから えらんで E で おく'); }
    }
    if (deco.on) {
      if (I.pressed('rotate')) decoRotate();
      if (I.pressed('interact')) { if (decoPlace()) UI.decoBar(true); }
      if (I.pressed('store')) {
        const r = decoStore(p);
        if (r === 'bed') UI.toast('ベッドは ひとつ のこしておこう');
        else if (r) { UI.toast(r ? 'しまった' : ''); UI.decoBar(true); }
      }
    } else if (I.pressed('interact') && G.focus && p.state === 'move') G.focus.act();
    if (I.pressed('eat')) {
      const r = p.eat();
      if (r === 'none') UI.toast('シチューを もっていない (ざっかやで かえるよ)');
      if (r === 'full') UI.toast('いまは げんき いっぱい');
    }
  }
  p.tick(dt, busy);
  if (p.state === 'dead' && p.stateT > 2.2 && !fading && !p.respawning) { p.respawning = true; respawn(); setTimeout(() => { p.respawning = false; }, 1200); }
  if (!G.menu) {
    updateDayNight(dt, !fading && p.state !== 'sleep');
    updateEnemies(dt);
    updateNpcs(dt);
    if (G.area === 'diner') updateDiner(dt);
    for (const d of DUMMIES) {
      d.wob = Math.max(0, d.wob - dt * 2.5);
      const w = Math.sin(d.wob * 18) * d.wob * 0.25;
      d.obj.rotation.set(Math.cos(d.dir || 0) * w, 0, -Math.sin(d.dir || 0) * w);
    }
  }
  decoUpdate(p);
  G.focus = !busy && !deco.on && p.state === 'move' ? p.findFocus() : null;
  focusV.copy(p.pos);
  E.updateCamera(dt, focusV);
  updateFx(dt, { night: G.night, area: G.area, focus: focusV, time: G.now });
  UI.update(dt);
  autoQuality(dt);
  saveT += dt;
  if (saveT > 30) { saveT = 0; save(); }
}

// テスト用 (開発者ツールから さわれる)
window.__lt = {
  G, get SV() { return SV; }, E, enter: (a) => enter(a),
  setTime: (h) => { SV.time = h; }, tp: (x, z) => { G.player.pos.set(x, 0, z); },
  spawn: (t = 'Skeleton_Minion', x = 60, z = 0) => spawn(t, x, z, { rise: false }),
  ff: (sec) => { for (let i = 0; i < sec * 20; i++) { G.dt = 0.05; if (G.area === 'diner') updateDiner(0.05); updateEnemies(0.05); G.player.tick(0.05, false); } },
  fps: () => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }),
};

boot();
