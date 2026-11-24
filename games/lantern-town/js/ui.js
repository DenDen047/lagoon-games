// 画面の 文字や ボタン: HUD・お知らせ・頭の上の ふきだし・お店・メニュー・ミニマップ・やることリスト。
import * as THREE from 'three';
import * as A from './assets.js';
import { camera, icon, cam } from './engine.js';
import { G, SV, maxHp, save } from './state.js';
import { HERO_CLASSES, CATALOG, ITEM, WEAPON_LV, HP_LV, STEW, BONE_PRICE, QUESTS } from './data.js';
import { MAP, LABELS } from './world.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const v3 = new THREE.Vector3();
const tags = new Map();
const statics = [];
let H = {};        // main.js から もらう 動作 (かう・もようがえ など)

/** 3D モデルの 絵 (小物の 名前で) */
export function propIcon(name, size = 96) { return icon('p:' + name, () => A.prop(name), size); }
function heroIcon(hero) {
  return icon('h:' + hero, () => {
    const b = A.body(hero);
    const show = HERO_CLASSES[hero].show;
    for (const slot of ['handslotr', 'handslotl', 'head', 'chest']) {
      const s = b.getObjectByName(slot);
      if (s) for (const c of s.children) if (!c.isBone) c.visible = show.includes(c.name);
    }
    const m = new THREE.AnimationMixer(b);
    m.clipAction(A.clips.get('Idle')).play();
    m.update(0.3);
    b.rotation.y = -0.35;
    b.updateMatrixWorld(true);
    return b;
  }, 192);
}

export const UI = {
  init(handlers) {
    H = handlers;
    $('btnMenu').onclick = () => UI.openMenu('pause');
    $('menu').addEventListener('click', (e) => { if (e.target.id === 'menu') UI.closeMenu(); });
    for (const el of document.querySelectorAll('[data-icon]')) el.style.backgroundImage = `url(${propIcon(el.dataset.icon, 64)})`;
    for (const l of LABELS) UI.label(l.area, l.text, new THREE.Vector3(l.x, l.y, l.z), true);
  },

  // ---------- タイトル ----------
  showTitle(hasSave, onStart) {
    $('loading').classList.add('hidden');
    $('title').classList.remove('hidden');
    const box = $('heroes');
    box.innerHTML = '';
    let pick = hasSave?.hero || 'Knight';
    const select = (h) => {
      pick = h;
      for (const c of box.children) c.classList.toggle('on', c.dataset.h === h);
      $('heroDesc').innerHTML = `<b>${HERO_CLASSES[h].name}</b> ${HERO_CLASSES[h].desc}<br><small>ひっさつわざ: ${HERO_CLASSES[h].skill.name}</small>`;
      sfx('ui');
    };
    for (const h of Object.keys(HERO_CLASSES)) {
      const c = document.createElement('button');
      c.className = 'hero';
      c.dataset.h = h;
      c.innerHTML = `<img src="${heroIcon(h)}" alt=""><span>${HERO_CLASSES[h].name}</span>`;
      c.onclick = () => select(h);
      box.appendChild(c);
    }
    select(pick);
    $('btnCont').classList.toggle('hidden', !hasSave);
    $('btnNew').textContent = hasSave ? 'あたらしく はじめる' : 'はじめる';
    $('btnCont').onclick = () => onStart(null);
    $('btnNew').onclick = function () {
      if (hasSave && !this.dataset.sure) { this.dataset.sure = 1; this.textContent = 'ほんとうに? (いまの データは きえる)'; return; }
      onStart(pick);
    };
  },
  hideTitle() { $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing'); },
  progress(k) { $('loadBar').style.width = Math.round(k * 100) + '%'; },

  // ---------- お知らせ ----------
  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), cls === 'big' ? 3800 : 2800);
    setTimeout(() => el.remove(), cls === 'big' ? 4400 : 3400);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  },

  // ---------- 3D の 位置に ついていく 文字 ----------
  tag(key, pos, html) {
    let t = tags.get(key);
    if (!t) {
      const el = document.createElement('div'); el.className = 'tag'; $('labels').appendChild(el);
      t = { el, pos: new THREE.Vector3(), area: G.area }; tags.set(key, t);
    }
    t.pos.copy(pos);
    if (html !== null && html !== t.html) { t.el.innerHTML = html; t.html = html; }
  },
  untag(key) { const t = tags.get(key); if (t) { t.el.remove(); tags.delete(key); } },
  label(area, text, pos, sign = false) {
    const el = document.createElement('div'); el.className = sign ? 'sign' : 'tag small'; el.textContent = text; $('labels').appendChild(el);
    statics.push({ el, area, pos: pos.clone(), sign });
  },

  boss(e) {
    $('bossBar').classList.toggle('hidden', !e);
    UI.bossE = e;
  },

  // ---------- メニュー ----------
  openMenu(name, arg) {
    G.menu = name;
    if (document.pointerLockElement) document.exitPointerLock();
    $('menu').classList.remove('hidden');
    sfx('ui');
    UI.render(name, arg);
  },
  closeMenu() { G.menu = null; $('menu').classList.add('hidden'); save(); },
  render(name, arg) {
    const p = $('panel');
    if (name === 'pause') {
      const q = SV.opts.quality;
      p.innerHTML = `<h2>メニュー</h2>
        <div class="row"><button class="btn big" data-a="close">つづける</button></div>
        <h3>がしつ</h3><div class="row seg">${[['auto', 'じどう'], ['high', 'きれい'], ['mid', 'ふつう'], ['low', 'かるい']].map(([k, n]) => `<button class="btn ${q === k ? 'on' : ''}" data-q="${k}">${n}</button>`).join('')}</div>
        <h3>おと</h3><div class="row seg"><button class="btn ${SV.opts.sound ? 'on' : ''}" data-s="1">あり</button><button class="btn ${!SV.opts.sound ? 'on' : ''}" data-s="0">なし</button></div>
        <h3>あそびかた</h3>${HELP}
        <div class="row"><button class="btn" data-a="title">セーブして タイトルへ</button></div>`;
      p.querySelector('[data-a=close]').onclick = UI.closeMenu;
      p.querySelector('[data-a=title]').onclick = () => H.toTitle();
      for (const b of p.querySelectorAll('[data-q]')) b.onclick = () => { SV.opts.quality = b.dataset.q; H.quality(b.dataset.q); UI.render('pause'); };
      for (const b of p.querySelectorAll('[data-s]')) b.onclick = () => { SV.opts.sound = b.dataset.s === '1'; H.sound(SV.opts.sound); UI.render('pause'); };
    } else if (name === 'shop') {
      shopPanel(p, arg || 'furniture');
    }
  },

  // ---------- もようがえの バー ----------
  decoBar(show) {
    const bar = $('decoBar');
    bar.classList.toggle('hidden', !show);
    if (!show) return;
    const items = Object.entries(SV.inv).filter(([, n]) => n > 0);
    bar.querySelector('.items').innerHTML = items.length ? items.map(([id, n]) =>
      `<button class="item ${H.decoPick() === id ? 'on' : ''}" data-id="${id}"><img src="${propIcon(id)}"><span>${ITEM[id].name}</span><b>×${n}</b></button>`).join('')
      : '<p class="empty">もちものが ありません。ざっかやで かぐを かおう!</p>';
    for (const b of bar.querySelectorAll('.item')) b.onclick = () => { H.decoSelect(b.dataset.id); UI.decoBar(true); };
  },

  // ---------- まいフレーム ----------
  update(dt) {
    if (G.mode !== 'play') return;
    const p = G.player;
    $('coins').textContent = SV.coins;
    $('bones').textContent = SV.bones;
    $('stew').textContent = SV.stew;
    const hh = Math.floor(SV.time), mm = Math.floor((SV.time - hh) * 6) * 10;
    $('clock').textContent = `${SV.day}にちめ  ${hh}:${String(mm).padStart(2, '0')}`;
    $('clockIcon').className = G.night > 0.5 ? 'moon' : 'sun';
    const mh = maxHp();
    $('hpBar').style.width = (SV.hp / mh * 100) + '%';
    $('hpText').textContent = `${Math.ceil(SV.hp)} / ${mh}`;
    $('hpWrap').classList.toggle('low', SV.hp < mh * 0.3);
    const sk = p.C.skill;
    $('skillName').textContent = sk.name;
    $('skillCd').style.height = (p.skillCd / sk.cd * 100) + '%';
    $('skillBox').classList.toggle('ready', p.skillCd <= 0);
    $('tSkill').style.setProperty('--cd', (p.skillCd / sk.cd * 100) + '%');
    const armed = G.area === 'town';
    $('skillBox').classList.toggle('hidden', !armed);
    document.body.classList.toggle('indoor', !armed);
    if (UI.bossE) $('bossFill').style.width = Math.max(0, UI.bossE.hp / UI.bossE.maxHp * 100) + '%';

    // E の ヒント
    const f = G.focus;
    const pr = $('prompt');
    if (f && !G.menu) { pr.classList.remove('hidden'); pr.innerHTML = `<kbd>E</kbd>${f.text}`; $('tInteract').textContent = f.text; $('tInteract').classList.remove('dim'); }
    else { pr.classList.add('hidden'); $('tInteract').textContent = 'E'; $('tInteract').classList.add('dim'); }

    // 頭の上の 文字
    const W = innerWidth, Hh = innerHeight;
    const place = (el, pos, maxD) => {
      v3.copy(pos).project(camera);
      const d = camera.position.distanceTo(pos);
      if (v3.z > 1 || d > maxD || Math.abs(v3.x) > 1.2 || Math.abs(v3.y) > 1.2) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * W}px, ${(-v3.y * 0.5 + 0.5) * Hh}px) translate(-50%, -100%)`;
    };
    for (const s of statics) { if (s.area !== G.area) { s.el.style.display = 'none'; continue; } place(s.el, s.pos, s.sign ? 55 : 30); }
    for (const t of tags.values()) place(t.el, t.pos, 40);

    questTick(dt);
    drawMap();
  },
};

const HELP = `<ul class="help">
  <li><kbd>W A S D</kbd> あるく　<kbd>マウス</kbd> みまわす (がめんを クリック)</li>
  <li><kbd>E</kbd> しらべる・はなす・すわる・りょうりを とる/おく</li>
  <li><kbd>ひだりクリック</kbd> こうげき (れんだで 3 れんげき)　<kbd>みぎクリック / Shift</kbd> ガード</li>
  <li><kbd>スペース</kbd> かいひ　<kbd>Q</kbd> ひっさつわざ　<kbd>1</kbd> シチューを たべる</li>
  <li><kbd>B</kbd> いえの なかで もようがえ　<kbd>Esc</kbd> メニュー</li>
</ul>
<p class="note">ひるは まちで のんびり。よるに なると ひがしの ぼちに ガイコツが あらわれる。たたかうかは じぶんで きめよう。まちの なかは あんぜん。</p>`;

function shopPanel(p, tab) {
  const tabs = [['furniture', 'かぐ'], ['decor', 'かざり'], ['power', 'つよくなる'], ['goods', 'どうぐ・うる']];
  let body = '';
  if (tab === 'furniture' || tab === 'decor') {
    body = CATALOG.filter((c) => c.kind === tab && c.price > 0).map((c) => {
      const own = (SV.inv[c.id] || 0) + SV.house.filter((f) => f.id === c.id).length;
      return `<div class="card"><img src="${propIcon(c.id)}"><div class="name">${c.name}</div><small>もっている: ${own}</small>
        <button class="btn buy" data-buy="${c.id}" ${SV.coins < c.price ? 'disabled' : ''}><i class="ci"></i>${c.price}</button></div>`;
    }).join('');
  } else if (tab === 'power') {
    const w = WEAPON_LV[SV.weaponLv + 1], hp = HP_LV[SV.hpLv + 1];
    body = `<div class="card wide"><div class="name">ぶきを きたえる</div><small>いまの つよさ: レベル ${SV.weaponLv + 1} (こうげき ×${WEAPON_LV[SV.weaponLv].mul})</small>
      ${w ? `<button class="btn buy" data-up="weapon" ${SV.coins < w.price ? 'disabled' : ''}><i class="ci"></i>${w.price}</button>` : '<b>さいこう レベル!</b>'}</div>
      <div class="card wide"><div class="name">たいりょくを ふやす</div><small>いまの さいだい HP: ${maxHp()}</small>
      ${hp ? `<button class="btn buy" data-up="hp" ${SV.coins < hp.price ? 'disabled' : ''}><i class="ci"></i>${hp.price}</button>` : '<b>さいこう レベル!</b>'}</div>`;
  } else {
    body = `<div class="card"><img src="${propIcon('food_stew')}"><div class="name">シチュー</div><small>HP が ${STEW.heal} もどる (もっている: ${SV.stew}/${STEW.max})</small>
      <button class="btn buy" data-stew="1" ${SV.coins < STEW.price || SV.stew >= STEW.max ? 'disabled' : ''}><i class="ci"></i>${STEW.price}</button></div>
      <div class="card"><img src="${propIcon('bone_A')}"><div class="name">ほねを うる</div><small>1こ ${BONE_PRICE} コイン (もっている: ${SV.bones})</small>
      <button class="btn buy" data-sell="1" ${SV.bones <= 0 ? 'disabled' : ''}>ぜんぶ うる</button></div>`;
  }
  p.innerHTML = `<h2>ざっかや <span class="wallet"><i class="ci"></i>${SV.coins}</span></h2>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="cards">${body}</div><div class="row"><button class="btn" data-a="close">とじる</button></div>`;
  p.querySelector('[data-a=close]').onclick = UI.closeMenu;
  for (const b of p.querySelectorAll('[data-tab]')) b.onclick = () => { sfx('ui'); shopPanel(p, b.dataset.tab); };
  for (const b of p.querySelectorAll('[data-buy]')) b.onclick = () => {
    const c = ITEM[b.dataset.buy];
    if (SV.coins < c.price) return;
    SV.coins -= c.price; SV.inv[c.id] = (SV.inv[c.id] || 0) + 1; SV.stats.bought++;
    sfx('buy'); UI.toast(c.name + ' を かった! いえで B キーで おけるよ'); shopPanel(p, tab);
  };
  for (const b of p.querySelectorAll('[data-up]')) b.onclick = () => {
    const isW = b.dataset.up === 'weapon';
    const next = isW ? WEAPON_LV[SV.weaponLv + 1] : HP_LV[SV.hpLv + 1];
    if (!next || SV.coins < next.price) return;
    SV.coins -= next.price;
    if (isW) SV.weaponLv++; else { SV.hpLv++; SV.hp = maxHp(); }
    sfx('quest'); shopPanel(p, tab);
  };
  for (const b of p.querySelectorAll('[data-stew]')) b.onclick = () => { if (SV.coins >= STEW.price && SV.stew < STEW.max) { SV.coins -= STEW.price; SV.stew++; sfx('buy'); shopPanel(p, tab); } };
  for (const b of p.querySelectorAll('[data-sell]')) b.onclick = () => { const g = SV.bones * BONE_PRICE; SV.coins += g; SV.bones = 0; sfx('coin'); UI.toast(`ほねを うって ${g} コイン`); shopPanel(p, tab); };
}

// ---------- やることリスト ----------
let qT = 0;
function questTick(dt) {
  qT -= dt;
  if (qT > 0) return;
  qT = 0.4;
  const open = QUESTS.filter((q) => !SV.quests.includes(q.id));
  for (const q of open) {
    const [cur, goal] = q.goal(SV);
    if (cur >= goal) {
      SV.quests.push(q.id);
      if (q.reward) SV.coins += q.reward;
      UI.toast(`やること クリア! 「${q.text}」${q.reward ? ` +${q.reward} コイン` : ''}`, 'quest');
      sfx('quest');
      save();
    }
  }
  const list = QUESTS.filter((q) => !SV.quests.includes(q.id)).slice(0, 3);
  $('quests').innerHTML = list.length ? list.map((q) => {
    const [cur, goal] = q.goal(SV);
    return `<li><span>${q.text}</span><b>${goal > 1 ? `${Math.min(Math.floor(cur), goal)}/${goal}` : ''}</b></li>`;
  }).join('') : '<li>ぜんぶ クリア! すきに くらそう</li>';
}

// ---------- ミニマップ (北が上) ----------
let mapCtx = null;
function drawMap() {
  const cv = $('map');
  if (!mapCtx) mapCtx = cv.getContext('2d');
  const ctx = mapCtx, S = cv.width, sc = 1.25;
  const p = G.player.pos;
  cv.classList.toggle('hidden', G.area !== 'town');
  if (G.area !== 'town') return;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#5f8a44'; ctx.fillRect(0, 0, S, S);
  const tx = (x) => S / 2 + (x - p.x) * sc, tz = (z) => S / 2 + (z - p.z) * sc;
  for (const r of MAP) {
    ctx.fillStyle = r.c;
    if (r.round) { ctx.beginPath(); ctx.arc(tx(r.x), tz(r.z), r.w / 2 * sc, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(tx(r.x - r.w / 2), tz(r.z - r.d / 2), r.w * sc, r.d * sc);
  }
  ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  for (const r of MAP) if (r.tag) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeText(r.tag, tx(r.x), tz(r.z) + 3); ctx.fillText(r.tag, tx(r.x), tz(r.z) + 3); }
  ctx.fillStyle = '#ff4b4b';
  for (const e of G.enemies) if (e.alive) { ctx.beginPath(); ctx.arc(tx(e.pos.x), tz(e.pos.z), e.boss ? 5 : 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ffe9a8';
  for (const n of G.npcs) if (n.a.root.visible) { ctx.beginPath(); ctx.arc(tx(n.a.pos.x), tz(n.a.pos.z), 2.2, 0, Math.PI * 2); ctx.fill(); }
  // プレイヤー (やじるし) と カメラの 向き
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 40, -Math.PI / 2 - cam.yaw - 0.6, -Math.PI / 2 - cam.yaw + 0.6); ctx.fill();
  ctx.rotate(-G.player.yaw + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
}
