/* MECH FRONTIER の入口: 入力・メインループ・タイトル・自動の画質調整。
   描画エンジン (gl.js、ES モジュール) が 読みこまれたあとに boot() を 呼ぶ。 */
'use strict';
function fail(msg) { const e = document.getElementById('err'); e.textContent = msg; e.classList.remove('hidden'); }
window.addEventListener('error', (e) => fail('エラー: ' + (e.message || '読みこみに失敗') + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'));
function boot() {
  const $ = (id) => document.getElementById(id);
  const cv = $('game');
  const touch = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
  let demo = [];


  if (!R.init(cv)) { $('title').querySelector('.tBtns').classList.add('hidden'); fail('このブラウザは WebGL2 に対応していないため遊べません。新しい Chrome / Safari / Edge で開いてください。'); return; }
  const had = load();
  R.shadowQ = SV.q.shadow;
  W.build(); UI.init();
  startGame(); G.running = false; G.title = true; P.human.hidden = true;
  [[45, 0, 0], [12, -6, 3], [2, 6, 2], [22, -1, 7], [27, 3, -6]].forEach(([f, x, z], i) => { const m = mkMech(FRAMES[f], 2, x, z); m.parked = true; m.citizen = true; m.yaw = m.aimYaw = i * 1.3; m.load = { main: 'mg', sub: i === 1 ? 'tower' : null, melee: 'sword' }; ents.push(m); demo.push(m); });
  $('btnCont').classList.toggle('hidden', !had);
  $('btnNew').textContent = had ? '最初から' : 'はじめる';

  function begin(fresh) {
    for (const p of SV.pieces) if (p.boxes) for (const b of p.boxes) W.removeBox(b);
    if (fresh) { SV = freshSave(); save(); R.shadowQ = SV.q.shadow; }
    demo = [];
    startGame(); G.title = false;
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); if (touch) $('touch').classList.remove('hidden');
    try { sfx('ui'); if (AC && AC.state === 'suspended') AC.resume(); } catch (e) { /* 音なしで つづける */ }
    if (!touch && cv.requestPointerLock) cv.requestPointerLock();
    if (!had || fresh) UI.toast('黄色い光が次の目標');
  }
  $('btnNew').onclick = function () { if (had && !this.dataset.sure) { this.dataset.sure = 1; this.textContent = '本当に最初から (データは消える)'; return; } begin(true); };
  $('btnCont').onclick = () => begin(false);
  $('btnPause').onclick = () => UI.open('pause');

  // ---------- キーボードと マウス ----------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    if (!G.running) return;
    if (e.code === 'Escape') { if (G.menu) UI.close(); else UI.open('pause'); return; }
    if (G.menu) { if (e.code === 'KeyE' && !e.repeat) UI.close(); else UI.key(e.code); return; }
    if (!e.repeat) IN.hit[e.code] = true;
    IN.k[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { IN.k[e.code] = false; });
  window.addEventListener('blur', () => { IN.k = {}; IN.fire = IN.sub = false; });
  cv.addEventListener('mousedown', (e) => {
    if (!G.running || G.menu) return;
    if (!touch && document.pointerLockElement !== cv) { cv.requestPointerLock(); return; }
    if (e.button === 0) { IN.fire = true; IN.hit.fire = true; } else if (e.button === 2) { IN.sub = true; IN.hit.sub = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) IN.fire = false; else if (e.button === 2) IN.sub = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => { if (document.pointerLockElement === cv && !G.menu) { IN.mdx += e.movementX; IN.mdy += e.movementY; } });
  window.addEventListener('wheel', (e) => { if (G.running && !G.menu) IN.wheel = e.deltaY > 0 ? 1 : -1; }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === cv;
    $('clickHint').classList.toggle('hidden', locked || touch || !G.running || G.menu);
    if (!locked) { IN.fire = IN.sub = false; if (G.running && !G.menu && !touch) UI.open('pause'); }
  });
  const closeMenu = UI.close;
  UI.close = () => { closeMenu(); if (!touch && G.running && cv.requestPointerLock) { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => $('clickHint').classList.remove('hidden')); } };
  $('mClose').onclick = UI.close;

  // ---------- タッチ ----------
  if (touch) {
    let stickId = null, lookId = null, sx0 = 0, sy0 = 0, lx = 0, ly = 0;
    const knob = $('stick').firstElementChild;
    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * .4 && stickId === null) { stickId = t.identifier; sx0 = t.clientX; sy0 = t.clientY; $('stick').style.left = sx0 - 60 + 'px'; $('stick').style.top = sy0 - 60 + 'px'; $('stick').classList.add('on'); }
        else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { let dx = (t.clientX - sx0) / 50, dy = (t.clientY - sy0) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } IN.sx = dx; IN.sy = -dy; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`; }
        else if (t.identifier === lookId) { IN.mdx += (t.clientX - lx) * 2.2; IN.mdy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; }
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === stickId) { stickId = null; IN.sx = IN.sy = 0; knob.style.transform = ''; $('stick').classList.remove('on'); } else if (t.identifier === lookId) lookId = null; } };
    cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
    document.querySelectorAll('#touch [data-k]').forEach((b) => {
      const k = b.dataset.k;
      const down = (e) => { e.preventDefault(); if (k === 'fire') { IN.fire = true; IN.hit.fire = true; } else if (k === 'sub') { IN.sub = true; IN.hit.sub = true; } else { IN.k[k] = true; IN.hit[k] = true; } };
      const up = (e) => { e.preventDefault(); if (k === 'fire') IN.fire = false; else if (k === 'sub') IN.sub = false; else IN.k[k] = false; };
      b.addEventListener('touchstart', down, { passive: false }); b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    });
  }

  // ---------- メインループ ----------
  let last = performance.now(), ft = 16, tuneT = 0, saveT = 0;
  function step(dt) {
    if (G.running && !G.menu) update(dt); else { for (const k in IN.hit) IN.hit[k] = false; IN.mdx = IN.mdy = 0; IN.wheel = 0; }
    render(dt);
    if (G.running) UI.hud(dt);
  }
  function frame(t) {
    requestAnimationFrame(frame);
    const raw = (t - last) / 1000; last = t;
    const dt = Math.min(.05, Math.max(.001, raw));
    step(dt);
    // おそい たんまつでは 解像度を 下げ、それでも おそければ 影を 1 だん 下げる
    ft = ft * .93 + raw * 1000 * .07; tuneT += raw;
    if (tuneT > 1.2 && SV.q.auto && document.hasFocus()) {
      tuneT = 0;
      if (ft > 24 && R.res > .55) R.res = Math.max(.55, R.res - .1);
      else if (ft > 30 && R.shadowQ > 0) R.shadowQ--;
      else if (ft < 17.5 && R.res < 1) R.res = Math.min(1, R.res + .05);
    }
    saveT += raw; if (saveT > 20 && G.running) { saveT = 0; save(); }
    if ($('dbg')) $('dbg').textContent = `${Math.round(1000 / ft)}fps  draw ${R.stats.draws}  inst ${R.stats.inst}  x${R.res.toFixed(2)}`;
  }

  // ---------- 動作テスト (?test=1) と 画面確認 (?shot=なまえ) ----------
  const qs = new URLSearchParams(location.search);
  function debugSetup(name) {
    begin(true); SV.money = 99999; SV.mats = { scrap: 999, iron: 999, core: 999, rare: 99 }; for (const w of WLIST) SV.own[w.id] = 1; SV.quest = 5; SV.time = .42;
    const give = (i) => { const f = FRAMES[i]; SV.mechs.push(Object.assign({ fid: f.id }, f)); SV.active = SV.mechs.length - 1; spawnPlayerMech(P.human.x + 4, P.human.z); enterMech(); };
    const h = P.human;
    if (name === 'mech') { h.x = 30; h.z = 330; give(2); SV.load.main = 'gatling'; SV.load.sub = 'tower'; SV.load.melee = 'saber'; for (let i = 0; i < 4; i++) spawnEnemyMech(30 + i * 9 - 14, 372 + i * 3, 2, false).yaw = Math.PI; cam.yaw = 0; cam.pitch = -.05; }
    else if (name === 'ball') { h.x = -40; h.z = 300; give(13); P.mech.mode = 2; SV.load.main = 'mg'; cam.yaw = .5; }
    else if (name === 'titan') { h.x = 60; h.z = 300; give(48); P.mech.mode = 1; cam.yaw = 2.6; cam.pitch = -.1; spawnEnemyMech(40, 270, 3, false); }
    else if (name === 'rain') { h.x = 30; h.z = 26; cam.yaw = 2.6; cam.pitch = .05; G.rain = 1; G.rainV = 1; G.rainT = 999; SV.time = .55; }
    else if (name === 'hills') { h.x = -420; h.z = 60; h.y = W.h(h.x, h.z); cam.yaw = -1.9; cam.pitch = -.05; }
    else if (name === 'grass') { h.x = -216; h.z = 214; cam.yaw = -2.2; cam.pitch = -.08; SV.time = .34; }
    else if (name === 'night') { SV.time = .9; h.x = 28; h.z = 60; cam.yaw = Math.PI; cam.pitch = .15; }
    else if (name === 'plane') { enterPlane(G.planes[0]); const p = P.plane; p.y = 90; p.x = -120; p.z = 150; p.yaw = -.6; p.speed = 55; p.thr = 1; p.pitch = -.12; }
    else if (name === 'base') {
      h.x = -52; h.z = 262; cam.yaw = -2.3; cam.pitch = -.12;
      const put = (t, gx, gy, gz, rot, col) => { const p = { t, gx: gx - 20, gy, gz: gz + 58, rot, col }; SV.pieces.push(p); addPiece(p); };
      for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) { put(0, x, 0, z, 0, 2); put(5, x, 1, z, 0, 4); }
      for (let x = 0; x < 3; x++) { put(x === 1 ? 2 : 3, x, 0, 0, 0, 0); put(1, x, 0, 1, 2, 0); }
      for (let z = 0; z < 2; z++) { put(1, 0, 0, z, 3, 0); put(3, 2, 0, z, 1, 0); }
      put(7, 0, 0, 1, 0, 0); put(8, -1, 0, 0, 0, 0); put(9, 4, 0, 0, 0, 0); put(10, 4, 0, 2, 0, 0); put(6, -1, 0, 1, 0, 1);
      G.build.on = true; UI.buildBar();
    } else if (name === 'alley') { spawnGroup(true); const a = G.groups[0].alley; h.x = a.x; h.z = a.z + 12; cam.yaw = Math.PI; cam.pitch = -.05; SV.time = .5; }
    else if (name.startsWith('menu')) { give(11); UI.open(name.split('-')[1] || 'workshop'); if (name.split('-')[2]) { UI.tab = name.split('-')[2]; UI.redraw(); } }
    else if (name === 'city') { h.x = 30; h.z = 26; cam.yaw = 2.6; cam.pitch = .05; }
    else if (name === 'town') { h.x = 320; h.z = -420; cam.yaw = .6; cam.pitch = -.05; }
    else if (name === 'house') { const hs = W.houses[0]; h.x = hs.x - 3.5; h.z = hs.z + 2.5 * hs.f; h.y = .15; cam.yaw = hs.f > 0 ? 2.6 : .5; cam.pitch = -.25; }
    else if (name === 'car') { h.x = 31; h.z = 40; enterCar(mkCar(31, 44, Math.PI, false)); cam.yaw = Math.PI; cam.pitch = -.12; }
    else if (name === 'beach') { h.x = 780; h.z = 200; h.y = .5; cam.yaw = 2.4; cam.pitch = -.1; }
    else if (name === 'farm') { h.x = -430; h.z = -330; cam.yaw = 3.4; cam.pitch = -.15; }
    else if (name === 'wanted') { h.x = 30; h.z = 26; cam.yaw = 2.6; addWanted(2); dispatch(); const pc = G.cars[G.cars.length - 1]; pc.x = 40; pc.z = 34; pc.yaw = 1.2; deploy(pc); cam.yaw = .6; }
    else if (name === 'police' || name === 'police2') {      // 警察官になり、警察ロボットを 並べる
      setCareer('police', true); SV.career.solved = 20; syncPoliceMechs(); const s = W.station;
      POLICE_MECHS.forEach((pm, k) => { const m = mkMech(pm, 2, s.x - 22 + k * 11, s.z + 3); m.parked = true; m.show = true; m.yaw = m.aimYaw = 0; m.load = { main: 'ar', sub: null, melee: 'sword' }; ents.push(m); });
      if (P.mech) { const i = ents.indexOf(P.mech); if (i >= 0) ents.splice(i, 1); }
      h.x = s.x + (name === 'police2' ? -14 : 9); h.z = s.z + (name === 'police2' ? 13 : 24); h.y = .2; h.yaw = Math.PI; cam.yaw = Math.PI; cam.pitch = name === 'police2' ? -.15 : .02; SV.time = .45;
    }
    else if (name === 'station') { h.x = 112; h.z = 26; cam.yaw = Math.PI; cam.pitch = .05; dispatch(); }
    else if (name === 'armor') { h.x = 6; h.z = 8; cam.yaw = 2.2; cam.pitch = -.1; SV.mechs = [Object.assign({}, ARMOR)]; SV.active = 0; spawnPlayerMech(9, 6); }
    else if (name === 'blood') { h.x = 30; h.z = 26; cam.yaw = 2.6; cam.pitch = -.25; const t = spawnThug(27, 21, 0, false, { members: [], alley: { x: 0, z: 0 } }); t.group.members.push(t); t.y = .2; SV.load.melee = 'knife'; for (let i = 0; i < 3; i++) { blood(t, 6); } hurt(t, t.maxhp * .8, h); for (let i = 0; i < 6; i++) addDecal(26 + i * .4, 1 + i * .3, 19.9, .17, 0x14141a, 0); }
    for (let i = 0; i < 40; i++) step(.016);
  }
  function selfTest() {
    const log = []; const run = (label, fn) => { try { fn(); log.push('OK   ' + label); } catch (e) { log.push('FAIL ' + label + ': ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')); } };
    const sim = (n, keys) => { for (let i = 0; i < n; i++) { IN.k = {}; for (const k of keys) IN.k[k] = true; if (i % 37 === 0) for (const k of ['Space', 'ShiftLeft', 'KeyQ', 'KeyF', 'KeyR']) IN.hit[k] = true; IN.fire = i % 50 < 30; IN.sub = i % 80 < 20; IN.mdx = Math.sin(i * .05) * 6; step(.016); } };
    run('あるく・うつ', () => { debugSetup('city'); sim(400, ['KeyW']); });
    run('ざいりょうを ほる', () => { const n = W.nodes.find(q => q.type === 'scrap'); P.human.x = n.x + 1; P.human.z = n.z; const s0 = SV.mats.scrap; for (let i = 0; i < 6; i++) { melee(P.human, false); P.human.mcd = 0; } if (SV.mats.scrap <= s0) throw new Error('スクラップが ふえない'); });
    for (let i = 0; i < FRAMES.length; i++) run('メカ ' + FRAMES[i].name, () => {
      debugSetup('city'); const f = FRAMES[i]; SV.mechs.push(Object.assign({ fid: f.id }, f)); SV.active = 0; P.human.x = 0; P.human.z = 330; spawnPlayerMech(4, 330); enterMech();
      SV.load.main = WLIST.filter(w => w.kind === 'gun')[i % 12].id; SV.load.sub = i % 3 ? WLIST.filter(w => w.kind !== 'melee')[i % 15].id : null; if (SV.load.sub === SV.load.main) SV.load.sub = 'shield'; SV.load.melee = WLIST.filter(w => w.kind === 'melee')[i % 6].id;
      spawnEnemyMech(10, 360, i % 7, i % 9 === 0); spawnDrone(-10, 350, 1); sim(260, ['KeyW', 'KeyD']); if (!isFinite(P.mech.x + P.mech.y + P.mech.z)) throw new Error('位置が こわれた');
    });
    run('ひこうき', () => { debugSetup('plane'); sim(500, ['KeyW']); exitVehicle(false); sim(200, []); if (!isFinite(P.human.y)) throw new Error('位置が こわれた'); });
    run('りりく', () => { debugSetup('city'); const p = G.planes[0]; enterPlane(p); for (let i = 0; i < 900; i++) { IN.k = { KeyW: true }; IN.mdy = i > 400 ? -1 : 0; step(.016); } if (p.y < 5) throw new Error('とびたてない y=' + p.y.toFixed(1) + ' v=' + p.speed.toFixed(1)); });
    run('たてる', () => { debugSetup('base'); sim(120, ['KeyS']); const p = SV.pieces[0]; removePiece(p); });
    run('仕事', () => {
      debugSetup('city'); SV.mechs.push(Object.assign({}, FRAMES[0]));
      for (const j of JOBS) {
        startJob(j.id); if (!G.job) throw new Error(j.id + ' が始まらない');
        if (j.id === 'taxi') enterCar(mkCar(P.human.x + 3, P.human.z, 0, false));
        if (G.job.pts) { for (let k = 0; k < 12 && G.job; k++) { const p = jobPoints()[0]; const b = body(); b.x = p.x; b.z = p.z; sim(3, []); } }
        else if (G.job.farm) { for (const n of W.nodes) if (n.type === 'crop' && G.job) mine(n, 1); }
        else if (G.job.target) hurt(G.job.target, 1e9, P.human);
        else for (const e of G.job.group.members.slice()) hurt(e, 1e9, P.human);
        if (G.job) throw new Error(j.id + ' が終わらない');
        if (P.state !== 'foot') exitVehicle(false);
      }
    });
    run('車', () => { debugSetup('car'); sim(500, ['KeyW', 'KeyD']); if (!isFinite(P.car.x + P.car.z)) throw new Error('位置が壊れた'); exitVehicle(false); sim(60, []); for (let i = 0; i < 1500; i++) step(.033); const t = G.cars.filter(c => c.traffic); if (t.length < 8) throw new Error('交通が少ない ' + t.length); for (const c of t) if (Math.abs(c.x) > 205 || Math.abs(c.z) > 205) throw new Error('車が街の外へ出た'); });
    run('住人と手配', () => {
      debugSetup('city'); for (let i = 0; i < 200; i++) step(.033);
      const cs = ents.filter(e => e.citizen && !e.resident && Math.hypot(e.x - P.human.x, e.z - P.human.z) < 200); if (cs.length < 20) throw new Error('近くの住人が少ない ' + cs.length);
      hurt(cs[1], 10, P.human); if (G.wanted) throw new Error('通報の前に手配された'); if (!G.report) throw new Error('目撃されない');
      for (let i = 0; i < 260 && !G.wanted; i++) step(.033); if (G.wanted !== 1) throw new Error('通報されない');
      hurt(cs[2], 999, P.human); if (!cs[2].down) throw new Error('倒れない'); for (let i = 0; i < 260; i++) step(.033); if (G.wanted < 2) throw new Error('手配度が上がらない');
      for (let i = 0; i < 900 && !ents.some(e => e.police && e.kind === 'human'); i++) step(.033); if (!ents.some(e => e.police && e.kind === 'human')) throw new Error('パトカーが着かない');
      hurt(P.human, 1e9, null); sim(260, []); if (G.wanted || ents.some(e => e.police)) throw new Error('逮捕後も手配が残る');
    });
    run('職業と警察', () => {
      debugSetup('city');
      setCareer('courier'); if (jobPay(JOBS[0]) !== Math.round(JOBS[0].pay * 1.5)) throw new Error('配達員の給料が上がらない');
      setCareer('mechanic'); if (careerCost({ scrap: 10 }).scrap !== 7) throw new Error('メカニックの割引がない');
      setCareer('police'); if (!P.mech || !P.mech.spec.police) throw new Error('警察ロボットを借りられない'); if (!P.human.fit.badge) throw new Error('制服を着ていない');
      const duty = G.cars.find(c => c.duty); if (!duty) throw new Error('パトカーがない'); enterCar(duty); if (G.report) throw new Error('自分のパトカーで通報された'); exitVehicle(false);
      cancelJob(); startCase('thief'); const t = G.job.group.members[0], d0 = Math.hypot(t.x - P.human.x, t.z - P.human.z);
      P.human.x = t.x + 8; P.human.z = t.z; IN.k = {}; IN.fire = IN.sub = false; for (let i = 0; i < 60; i++) step(.016); if (Math.hypot(t.x - P.human.x, t.z - P.human.z) < 9) throw new Error('泥棒が逃げない ' + d0.toFixed(0));
      hurt(t, t.maxhp * .8, P.human); if (!t.surrender) throw new Error('泥棒が降参しない');
      t.x = P.human.x + 1; t.z = P.human.z; step(.016); step(.016); if (!G.prompt || !/逮捕/.test(G.prompt.text)) throw new Error('逮捕できない: ' + (G.prompt && G.prompt.text));
      const m0 = SV.money; G.prompt.act(); if (G.job) throw new Error('泥棒の事件が終わらない'); if (SV.career.solved !== 1 || SV.money <= m0) throw new Error('解決が数えられない');
      startCase('gang'); for (const e of G.job.group.members.slice()) hurt(e, 1e9, P.human); if (G.job) throw new Error('闇商人の事件が終わらない');
      SV.career.solved = 2; startCase('mech'); hurt(G.job.target, 1e9, P.human); if (G.job) throw new Error('暴走メカの事件が終わらない');
      if (policeRank() !== 1 || !SV.mechs.some(m => m.name === POLICE_MECHS[1].name)) throw new Error('昇進しない');
      G.wanted = 0; for (let i = 0; i < 200; i++) step(.033);
      const c = ents.find(e => e.citizen && !e.resident && e.kind === 'human' && !e.down); c.x = P.human.x + 2; c.z = P.human.z; hurt(c, 10, P.human);
      if (isPolice() || SV.mechs.some(m => m.police) || (P.mech && P.mech.spec.police) || G.cars.some(o => o.duty)) throw new Error('罪を犯してもクビにならない');
      clearPolice(); G.wanted = 3; dispatch(); const pc = G.cars[G.cars.length - 1]; pc.x = P.human.x + 20; pc.z = P.human.z; deploy(pc);
      if (!ents.some(e => e.police && e.kind === 'mech' && e.spec.police)) throw new Error('警察ロボットが出ない');
      for (const id of ['police', 'jobs']) { UI.open(id); document.querySelectorAll('#mTabs .tab').forEach(b => b.click()); UI.close(); }
    });
    run('目撃者なし', () => { debugSetup('hills'); for (const e of ents.slice()) if (e.citizen) { e.x = 900; } G.report = null; const c = spawnCitizen(0); c.x = P.human.x + 2; c.z = P.human.z; hurt(c, 999, P.human); if (G.report) throw new Error('目撃者がいないのに通報された'); });
    run('捕獲', () => {
      debugSetup('city'); spawnGroup(true); const g = G.groups[0], t = g.members[1]; hurt(t, t.maxhp * .8, P.human); if (!t.surrender) throw new Error('降参しない');
      t.x = P.human.x + 1; t.z = P.human.z; IN.k = {}; IN.fire = IN.sub = false; step(.016); step(.016); if (!G.prompt || !/捕まえる/.test(G.prompt.text)) throw new Error('捕まえられない: ' + (G.prompt && G.prompt.text) + ' d=' + Math.hypot(t.x - P.human.x, t.z - P.human.z).toFixed(1) + ' in=' + ents.includes(t) + ' dead=' + t.dead + ' st=' + P.state); G.prompt.act();
      P.human.x = W.station.x; P.human.z = W.station.z + 3; for (let i = 0; i < 60; i++) step(.016); const m0 = SV.money; if (handover() !== 1 || SV.money <= m0) throw new Error('引き渡せない');
    });
    run('アーマー', () => { debugSetup('armor'); if (!P.mech || !P.mech.spec.armor) throw new Error('アーマーがない'); enterMech(); sim(200, ['KeyW']); if (shots.some(s => s.src === P.mech)) throw new Error('アーマーが銃を撃った'); const n = W.nodes.find(q => q.type === 'scrap'); P.mech.x = n.x + 1; P.mech.z = n.z; const s0 = SV.mats.scrap; P.mech.mcd = 0; melee(P.mech, false); if (SV.mats.scrap <= s0) throw new Error('パンチで掘れない'); });
    run('地形', () => { debugSetup('hills'); const x = -520, z = 40, hh = W.h(x, z); P.human.x = x; P.human.z = z; P.human.y = hh + 5; IN.k = {}; IN.fire = IN.sub = false; for (let i = 0; i < 120; i++) step(.016); if (Math.abs(P.human.y - W.h(P.human.x, P.human.z)) > .3) throw new Error('地面に立てていない'); sim(300, ['KeyW']); if (P.human.y < W.h(P.human.x, P.human.z) - .2) throw new Error('地面にもぐった'); });
    run('家と泥棒', () => {
      debugSetup('house'); const hs = W.houseAt(P.human.x, P.human.z); if (!hs) throw new Error('家の中にいない');
      sim(30, []); const l = hs.loot[0]; if (l) { P.human.x = l.x; P.human.z = l.z + .8; sim(2, []); steal(hs, l); if (!SV.loot) throw new Error('盗めない'); }
      SV.time = .9; for (let i = 0; i < 60; i++) step(.033); const h2 = W.houses.find(h => h.res && !h.sale); if (!h2) throw new Error('夜に住人がいない');
      P.human.x = h2.res.x + 1; P.human.z = h2.res.z; h2.res.asleep = false; for (let i = 0; i < 600 && !G.wanted; i++) step(.033); if (!G.wanted) throw new Error('見つからない');
      const s = W.houses.find(h => h.sale); buyHouse(s); if (SV.home !== s.id) throw new Error('家が買えない'); sleep({ x: s.bed.x, y: .15, z: s.bed.z });
    });
    run('やられる・ふっかつ', () => { debugSetup('city'); hurt(P.human, 1e9, null); sim(260, []); if (P.human.dead || P.human.hp <= 0) throw new Error('ふっかつ しない'); });
    run('メカが こわれる', () => { debugSetup('mech'); hurt(P.mech, 1e9, null); if (P.state !== 'foot') throw new Error('だっしゅつ しない'); for (let i = 0; i < 2700; i++) step(.016); if (P.mech.dead) throw new Error('しゅうり されない'); });
    run('メニュー', () => { debugSetup('city'); for (const id of ['workshop', 'mechshop', 'weapons', 'jobs', 'factory', 'food', 'mats', 'clothes', 'wardrobe', 'fence', 'police', 'pier', 'airport', 'bag', 'pause']) { UI.open(id); const n = document.querySelectorAll('#mTabs .tab').length; for (let t = 0; t < Math.max(1, n); t++) { if (n) document.querySelectorAll('#mTabs .tab')[t].click(); const k = document.querySelectorAll('#mBody .opt').length; for (let i = 0; i < Math.min(k, 40); i++) { const b = document.querySelectorAll('#mBody .opt')[i]; if (b) b.click(); } document.querySelectorAll('#mBody .sw button').forEach((b, i) => { if (i % 7 === 0) b.click(); }); } UI.close(); } });
    run('じさく', () => { debugSetup('city'); SV.mechs = []; UI.open('workshop'); UI.tab = 'custom'; UI.redraw(); document.querySelector('#mBody .btn.big').click(); if (SV.mechs.length !== 1 || !P.mech) throw new Error('メカが できない'); UI.close(); });
    run('よる・ながい じかん', () => { debugSetup('mech'); for (let i = 0; i < 3000; i++) { IN.k = { KeyW: true }; IN.fire = true; step(.033); } });
    const pre = document.createElement('pre'); pre.id = 'testOut'; pre.textContent = log.filter(l => l.startsWith('FAIL')).length + ' FAIL / ' + log.length + '\n' + log.filter(l => l.startsWith('FAIL')).join('\n'); document.body.appendChild(pre);
    document.title = 'TEST ' + log.filter(l => l.startsWith('FAIL')).length + ' FAIL';
  }
  if (qs.get('test')) selfTest(); else if (qs.get('shot')) { debugSetup(qs.get('shot')); const t = qs.get('time'); if (t) SV.time = +t; }
  if (qs.get('dbg')) { const d = document.createElement('div'); d.id = 'dbg'; document.body.appendChild(d); }
  step(.016);   // 読みこみ直後にも 1 コマ 描いておく (サムネイル用)
  requestAnimationFrame(frame);
}
