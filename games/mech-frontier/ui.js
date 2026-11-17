/* MECH FRONTIER の画面: アイコン (じまえの SVG)・HUD・ミニマップ・メニュー */
'use strict';
/* アイコンは すべて ここで かいた SVG。文の中の [なまえ] が アイコンに おきかわる。 */
const ICONS = {
  scrap: ['#b9c0c9', '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><circle cx="12" cy="12" r="4" fill="#0008"/>'],
  iron: ['#d9a066', '<path d="M2 10c5-7 15-7 20 0-5-3.4-15-3.4-20 0z"/><rect x="10.8" y="6" width="2.4" height="16" rx="1"/>'],
  core: ['#4fd8ff', '<path d="M12 1l8 11-8 11-8-11z"/><path d="M12 1l3 11-3 11-3-11z" fill="#fff7"/>'],
  rare: ['#c79bff', '<path d="M12 1l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><circle cx="12" cy="12" r="2.2" fill="#fff"/>'],
  money: ['#ffd24a', '<circle cx="12" cy="12" r="10.5"/><circle cx="12" cy="12" r="7.5" fill="#0003"/><rect x="10.8" y="7" width="2.4" height="10" rx="1" fill="#fff9"/>'],
  star: ['#ffd24a', '<path d="M12 1.5l3.1 7.2 7.8.7-5.9 5.2 1.8 7.6L12 18.2l-6.8 4 1.8-7.6L1.1 9.4l7.8-.7z"/>'],
  boom: ['#ff8a3a', '<path d="M12 1l2.5 6 5.5-3.5-2 6 6 1.5-5 3.5 3.5 5.5-6-1.5L15 23l-3-5-3 5-.5-5.5-6 1.5L6 13.5 1 10l6-1.5-2-6L10.5 7z"/>'],
  dealer: ['#b98cff', '<rect x="1" y="8" width="22" height="2"/><path d="M2.5 9H11v4a4.25 4.25 0 01-8.5 0zM13 9h8.5v4a4.25 4.25 0 01-8.5 0z"/>'],
  mech: ['#6fc3ff', '<rect x="5" y="7" width="14" height="13" rx="2"/><rect x="7.5" y="10.5" width="9" height="3" fill="#bff"/><rect x="11" y="2.5" width="2" height="5"/><circle cx="12" cy="2.6" r="1.6"/><rect x="2" y="11" width="3" height="6"/><rect x="19" y="11" width="3" height="6"/>'],
  plane: ['#7fe0e8', '<path d="M12 1c1.2 0 2 2 2 4v4l8 5v2.5l-8-2.5v5l3 2v1.5L12 21l-5 1.5V21l3-2v-5l-8 2.5V14l8-5V5c0-2 .8-4 2-4z"/>'],
  call: ['#7fe0e8', '<rect x="11" y="11" width="2" height="11"/><circle cx="12" cy="10" r="2.6"/><path d="M4 10a8 8 0 0116 0h-2.2a5.8 5.8 0 00-11.6 0z"/>'],
  wrench: ['#ff9a30', '<path d="M21 6.5a5.5 5.5 0 01-7.6 5.1L5.5 19.5a2.1 2.1 0 01-3-3l7.9-7.9A5.5 5.5 0 0117.5 1l-3.3 3.3.8 2.7 2.7.8L21 4.5c.100.6 0 1.3 0 2z"/>'],
  bed: ['#9fb4ff', '<rect x="2" y="11" width="20" height="6" rx="1"/><rect x="2" y="6" width="2.5" height="14"/><rect x="19.5" y="14" width="2.5" height="6"/><rect x="5.5" y="8" width="6" height="3" rx="1.2" fill="#fffa"/>'],
  kit: ['#ff6b6b', '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V4.5A1.5 1.5 0 019.5 3h5A1.5 1.5 0 0116 4.5V7h-2V5h-4v2z"/><path d="M10.7 10h2.6v2.7H16v2.6h-2.7V18h-2.6v-2.7H8v-2.6h2.7z" fill="#fff"/>'],
  food: ['#e8a24a', '<path d="M3 10a9 6.5 0 0118 0z"/><rect x="2" y="11.5" width="20" height="3" rx="1.5" fill="#7a4a2a"/><rect x="3" y="15.5" width="18" height="2" fill="#7c4"/><path d="M3 18.5h18v.5a3 3 0 01-3 3H6a3 3 0 01-3-3z"/>'],
  box: ['#d9a066', '<path d="M12 2l9 4.5v11L12 22l-9-4.5v-11z"/><path d="M12 11.5l9-5M12 11.5l-9-5M12 11.5V22" stroke="#0007" stroke-width="1.5" fill="none"/>'],
  target: ['#ff5a5a', '<path d="M12 1a11 11 0 100 22 11 11 0 000-22zm0 2.6a8.4 8.4 0 110 16.8 8.4 8.4 0 010-16.8zm0 3.4a5 5 0 100 10 5 5 0 000-10zm0 2.6a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z" fill-rule="evenodd"/>'],
  check: ['#5fd068', '<circle cx="12" cy="12" r="11"/><path d="M6 12.5l4 4 8-9" stroke="#fff" stroke-width="3" fill="none"/>'],
  warn: ['#ffcf3a', '<path d="M12 2l11 19H1z"/><rect x="10.9" y="9" width="2.2" height="6.5" fill="#000"/><rect x="10.9" y="17" width="2.2" height="2.2" fill="#000"/>'],
  shield: ['#6fb3ff', '<path d="M12 1l9 3.5V11c0 6-4 10-9 12-5-2-9-6-9-12V4.5z"/><path d="M12 4l6 2.4v4.8c0 4.2-2.6 7-6 8.6z" fill="#fff6"/>'],
  gear: ['#c8ced8', '<path d="M10.5 1h3l.6 3 2.2.9 2.5-1.7 2.1 2.1-1.7 2.5.9 2.2 3 .6v3l-3 .6-.9 2.2 1.7 2.5-2.1 2.1-2.5-1.7-2.2.9-.6 3h-3l-.6-3-2.2-.9-2.5 1.7-2.1-2.1 1.7-2.5-.9-2.2-3-.6v-3l3-.6.9-2.2L3.1 5.3l2.1-2.1 2.5 1.7L9.9 4z"/><circle cx="12" cy="12" r="3.5" fill="#000b"/>'],
  jobs: ['#6cd46c', '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V4.5A1.5 1.5 0 019.5 3h5A1.5 1.5 0 0116 4.5V7h-2V5h-4v2z"/><rect x="2" y="12" width="20" height="1.6" fill="#0006"/>'],
  factory: ['#c8ced8', '<path d="M2 21V10l6 4v-4l6 4V4h6v17z"/><rect x="5" y="16" width="3" height="3" fill="#fff9"/><rect x="11" y="16" width="3" height="3" fill="#fff9"/>'],
  mats: ['#c98bff', '<rect x="2" y="4" width="9" height="4.5"/><rect x="13" y="4" width="9" height="4.5"/><rect x="2" y="15.5" width="9" height="4.5"/><rect x="13" y="15.5" width="9" height="4.5"/><rect x="7" y="9.8" width="10" height="4.5"/><rect x="2" y="9.8" width="3.5" height="4.5"/><rect x="18.5" y="9.8" width="3.5" height="4.5"/>'],
  gun: ['#ff6b6b', '<path d="M2 7h18v2h2v3h-9l-1.5 3H9l-1 6H3l2-9H2z"/>'],
  floor: ['#cfd4dc', '<path d="M12 6l10 6-10 6L2 12z"/>'],
  door: ['#cfd4dc', '<path d="M3 3h18v18h-5V9H8v12H3z"/>'],
  window: ['#cfd4dc', '<path d="M3 3h18v18H3zM7 8v8h10V8z" fill-rule="evenodd"/><rect x="7" y="8" width="10" height="8" fill="#9fd8f0"/>'],
  bigwall: ['#cfd4dc', '<rect x="6" y="1" width="12" height="22"/><path d="M6 8h12M6 15h12" stroke="#0005" stroke-width="1.5"/>'],
  roof: ['#e0795a', '<path d="M12 4l11 9H1z"/><rect x="4" y="14" width="16" height="3" fill="#cfd4dc"/>'],
  stairs: ['#cfd4dc', '<path d="M2 22v-5h5v-5h5V7h5V2h5v20z"/>'],
  lamp: ['#ffe27a', '<circle cx="12" cy="8" r="6.5"/><rect x="9.5" y="14.5" width="5" height="3" fill="#c8ced8"/><rect x="10" y="18.5" width="4" height="3" rx="1" fill="#c8ced8"/>'],
  turret: ['#6fb3ff', '<rect x="5" y="14" width="14" height="8" rx="1"/><rect x="8" y="8" width="8" height="6" rx="1"/><rect x="14" y="9.5" width="9" height="2.6"/>'],
  heart: ['#ff6b8a', '<path d="M12 21C5 15 2 12 2 8a5 5 0 0110-1 5 5 0 0110 1c0 4-3 7-10 13z"/>'],
};
const ic = (n) => { const i = ICONS[n]; return i ? `<svg class="ic" viewBox="0 0 24 24" fill="${i[0]}">${i[1]}</svg>` : ''; };
const fmt = (s) => String(s).replace(/\[(\w+)\]/g, (m, n) => ICONS[n] ? ic(n) : m);

const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const ui = { page: null, tab: null };
  const el = (tag, cls, html, on) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = fmt(html); if (on) e.onclick = on; return e; };
  let mapT = 0, labels = [];

  ui.toast = (t) => {
    const d = el('div', 'toast', t); $('toasts').appendChild(d);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => d.classList.add('out'), 3600); setTimeout(() => d.remove(), 4200);
  };
  ui.gain = (t) => {
    const d = el('div', 'gain', t); $('gains').appendChild(d);
    while ($('gains').children.length > 6) $('gains').firstChild.remove();
    setTimeout(() => d.remove(), 1500);
  };

  // ---------- HUD ----------
  const bar = (id, v, m) => { $(id).style.width = clamp(v / m * 100, 0, 100) + '%'; };
  ui.hud = (dt) => {
    const b = body(), h = P.human;
    $('money').textContent = Math.floor(SV.money).toLocaleString();
    for (const k of MAT_KEYS) $('m_' + k).textContent = SV.mats[k];
    $('rank').textContent = SV.rank; bar('xpBar', SV.xp, SV.rank * 120); $('kits').textContent = SV.kits;
    bar('hpBar', h.hp, h.maxhp);
    const veh = P.state !== 'foot';
    $('vehRow').classList.toggle('hidden', !veh);
    if (veh) { bar('vhBar', b.hp, b.maxhp); $('vehName').textContent = b.name + (b.st.kind === 'ball' ? '  [' + BALL_MODES[b.mode] + ']' : b.st.kind === 'titan' ? (b.mode ? '  [たてモード]' : '  [こうげきモード]') : ''); }
    const q = questInfo(), j = G.job;
    let txt = q ? q.text : '', tx = q && !q.none ? q : null;
    if (j) { txt = 'しごと: ' + j.name + (j.type === 'deliver' ? (j.stage ? '  とどけさきへ' : '  にもつを うけとる') + (j.stage ? '  のこり ' + Math.max(0, Math.ceil(j.limit - j.t)) + 'びょうで ボーナス' : '') : ''); tx = G.beacons[G.beacons.length - 1] || null; }
    $('quest').classList.toggle('hidden', !txt);
    if (txt) {
      $('qText').innerHTML = fmt(txt); $('qNav').classList.toggle('hidden', !tx);
      if (tx) { const dx = tx.x - b.x, dz = tx.z - b.z, sn = Math.sin(cam.yaw), cs = Math.cos(cam.yaw); $('qArrow').style.transform = 'rotate(' + Math.atan2(-dx * cs + dz * sn, dx * sn + dz * cs) + 'rad)'; $('qDist').textContent = Math.round(Math.hypot(dx, dz)) + 'm'; }
    }
    const L = G.lock; $('lock').classList.toggle('hidden', !L);
    if (L) { $('lockName').textContent = L.name || ''; bar('lockBar', L.hp, L.maxhp); }
    const pr = G.prompt; $('prompt').classList.toggle('hidden', !pr || G.menu); if (pr) $('prompt').innerHTML = fmt(pr.text);
    const ld = SV.load, nm = (id) => id ? WEAPONS[id].name : 'なし';
    $('weap').innerHTML = P.state === 'plane' ? 'ひだりクリック: きじゅう　みぎクリック: ばくだん　Q: かいてん' : 'メイン: ' + nm(ld.main) + '　サブ: ' + nm(ld.sub) + '　きんきょり: ' + nm(ld.melee);
    $('vig').style.opacity = clamp(G.hitT * 2, 0, .5);
    $('cross').classList.toggle('hidden', G.menu || G.build.on || !!G.preview);
    $('clock').textContent = String(Math.floor(SV.time * 24)).padStart(2, '0') + ':' + String(Math.floor(SV.time * 1440) % 60).padStart(2, '0');
    if (P.state === 'plane') $('clock').textContent += '  こうど ' + Math.round(b.y) + 'm  はやさ ' + Math.round(b.speed * 3.6) + 'km/h';
    // 3D の ふだ
    const want = [];
    for (const f of W.facilities) if (Math.hypot(f.x - b.x, f.z - b.z) < 110) want.push({ x: f.x, y: f.y + 7.5, z: f.z, t: f.icon + ' ' + f.name });
    for (const bc of G.beacons) want.push({ x: bc.x, y: 6, z: bc.z, t: bc.label + ' ' + Math.round(Math.hypot(bc.x - b.x, bc.z - b.z)) + 'm', c: 'bc' });
    const box = $('labels');
    while (labels.length < want.length) { const d = el('div', 'label'); box.appendChild(d); labels.push(d); }
    labels.forEach((d, i) => {
      const w = want[i], p = w && !G.preview && R.project(w.x, w.y, w.z);
      if (!p) { d.style.display = 'none'; return; }
      d.style.display = ''; d.className = 'label ' + (w.c || ''); if (d._t !== w.t) { d.innerHTML = fmt(w.t); d._t = w.t; }
      d.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
    });
    mapT -= dt; if (mapT <= 0) { mapT = .15; drawMap(); }
  };
  function drawMap() {
    const cv = $('map'), c = cv.getContext('2d'), N = cv.width, b = body(), s = N / 520, X = (x) => (x - b.x) * s + N / 2, Y = (z) => (z - b.z) * s + N / 2;
    const rect = (x0, z0, x1, z1, col) => { c.fillStyle = col; c.fillRect(X(x0), Y(z0), (x1 - x0) * s, (z1 - z0) * s); };
    c.fillStyle = '#3c6b38'; c.fillRect(0, 0, N, N);
    rect(-1000, 232, 1000, 1000, '#9a8258'); rect(-150, -1000, 150, -232, '#5c4d40'); rect(-1000, -232, -232, 232, '#6b756b');
    rect(226, -82, 660, 82, '#858a90'); rect(236, -15, 650, 15, '#2c2e33'); rect(-203, -203, 203, 203, '#30333a');
    c.fillStyle = '#6d7480'; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) c.fillRect(X(i * 56 - 22), Y(j * 56 - 22), 44 * s, 44 * s);
    c.fillStyle = '#fff'; for (const p of SV.pieces) c.fillRect(X(p.gx * 4) - 1, Y(p.gz * 4) - 1, 2, 2);
    for (const f of W.facilities) { c.fillStyle = '#' + f.col.toString(16).padStart(6, '0'); c.fillRect(X(f.x) - 2, Y(f.z) - 2, 4, 4); }
    for (const e of ents) {
      if (e.hidden || e.dead || e === b) continue;
      if (e.team === 1) { if (e.group && !e.ai.aggro && !(G.job && G.job.group === e.group)) continue; c.fillStyle = e.boss ? '#ff3bd0' : '#ff4040'; c.fillRect(X(e.x) - 2, Y(e.z) - 2, 4, 4); }
      else if (e === P.mech) { c.fillStyle = '#40d0ff'; c.fillRect(X(e.x) - 3, Y(e.z) - 3, 6, 6); }
      else if (e.kind === 'plane') { c.fillStyle = '#ffffff'; c.fillRect(X(e.x) - 2, Y(e.z) - 2, 5, 5); }
    }
    for (const bc of G.beacons) {
      const x = clamp(X(bc.x), 6, N - 6), y = clamp(Y(bc.z), 6, N - 6);
      c.strokeStyle = '#' + bc.col.toString(16).padStart(6, '0'); c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, 5, 0, 7); c.stroke();
    }
    c.save(); c.translate(N / 2, N / 2); c.rotate(Math.atan2(Math.sin(cam.yaw), -Math.cos(cam.yaw)));
    c.fillStyle = '#ffe94a'; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  ui.buildBar = () => {
    const bb = $('buildbar'), B_ = G.build; bb.classList.toggle('hidden', !B_.on); if (!B_.on) return;
    bb.innerHTML = '';
    const row = el('div', 'bRow');
    PIECES.forEach((p, i) => row.appendChild(el('button', 'bItem' + (i === B_.t ? ' sel' : ''), p.icon + '<small>' + p.name + '</small><small>' + costText(p.cost) + '</small>', () => { B_.t = i; ui.buildBar(); })));
    bb.appendChild(row);
    bb.appendChild(el('div', 'bHelp', `<b>たてるモード</b>　クリック: おく　みぎクリック: けす　ホイール: ぶひん　R: まわす　T / G: かい (いま ${B_.lvl + 1}かい)　C: いろ <i style="background:#${BUILD_COLS[B_.col].toString(16).padStart(6, '0')}"></i>　B: おわる`));
  };

  // ---------- メニュー ----------
  const PAGES = {
    workshop: ['[wrench] こうぼう', [['own', 'もっている メカ'], ['custom', 'じさくする'], ['equip', 'そうび'], ['craft', 'ぶきを つくる']]],
    mechshop: ['[mech] メカショップ', [['shop', 'メカを かう']]], weapons: ['[gun] ぶきや', [['wshop', 'ぶきを かう'], ['equip', 'そうび']]],
    jobs: ['[jobs] しごと あんない', [['jobs', 'しごと']]], factory: ['[factory] こうじょう', [['factory', 'はたらく']]], food: ['[food] しょくどう', [['food', 'メニュー']]],
    mats: ['[mats] ざいりょうや', [['mats', 'うる・かう']]], airport: ['[plane] くうこう', [['airport', 'ひこうき']]], pause: ['ひとやすみ', [['help', 'あそびかた'], ['set', 'せってい']]],
  };
  let cs = { head: 0, body: 0, arms: 0, legs: 0, size: 1, c1: 7, c2: 1 }, shopSel = 0, fac = null;
  ui.open = (id) => {
    if (G.build.on) { G.build.on = false; ui.buildBar(); }
    ui.page = id; ui.tab = PAGES[id][1][0][0]; G.menu = true; if (document.pointerLockElement) document.exitPointerLock();
    $('menu').classList.remove('hidden'); $('hud').classList.add('inMenu'); sfx('ui'); draw();
  };
  ui.close = () => { if (fac) { clearInterval(fac.iv); fac = null; } G.menu = false; G.preview = null; ui.page = null; $('menu').classList.add('hidden'); $('hud').classList.remove('inMenu'); save(); };
  function swapMech() {
    const b = body(), inIt = P.state === 'mech', x = inIt ? b.x : P.human.x + 5, z = inIt ? b.z : P.human.z + 2;
    if (inIt) { P.state = 'foot'; P.human.hidden = false; }
    spawnPlayerMech(x, z, inIt ? b.y : P.human.y); if (inIt && P.mech) { P.state = 'mech'; P.human.hidden = true; P.mech.parked = false; }
  }
  const statLine = (s) => { const st = mechStats(s); return `たいりょく ${st.hp}　はやさ ${Math.round(st.spd * 3.6)}km/h　${PARTS.legs[s.legs].name}・${PARTS.body[s.body].name}` + (st.kind === 'ball' ? '<br><b class="tag">ころがる・ほうだい・コマ に へんけい (R)</b>' : st.kind === 'titan' ? '<br><b class="tag">たてモード に へんけい (R)</b>' : ''); };
  const swatches = (cur, on) => { const d = el('div', 'sw'); PAL.forEach((c, i) => { const b = el('button', i === cur ? 'sel' : '', '', () => on(i)); b.style.background = '#' + c.toString(16).padStart(6, '0'); b.title = PAL_NAMES[i]; d.appendChild(b); }); return d; };
  function buy(price, fn) { if (SV.money < price) { ui.toast('おかねが たりない'); sfx('hit'); return; } SV.money -= price; fn(); sfx('coin'); save(); draw(); }
  function craft(cost, fn) { if (!canPay(cost)) { ui.toast('ざいりょうが たりない'); sfx('hit'); return; } pay(cost); fn(); sfx('build'); save(); draw(); }

  function draw() {
    const [title, tabs] = PAGES[ui.page], bd = $('mBody');
    $('mTitle').innerHTML = fmt(title);
    $('mWallet').innerHTML = fmt('[money]' + Math.floor(SV.money).toLocaleString() + '　' + MAT_KEYS.map(k => MATS[k].icon + SV.mats[k]).join(' '));
    const tb = $('mTabs'); tb.innerHTML = '';
    if (tabs.length > 1) for (const [id, name] of tabs) tb.appendChild(el('button', 'tab' + (id === ui.tab ? ' sel' : ''), name, () => { ui.tab = id; sfx('ui'); draw(); }));
    bd.innerHTML = ''; G.preview = null; if (fac) { clearInterval(fac.iv); fac = null; }
    const add = (cls, html, on) => { const e = el('div', cls, html, on); bd.appendChild(e); return e; };
    const T = ui.tab;
    if (T === 'own') {
      if (!SV.mechs.length) add('note', 'まだ メカを もっていない。<b>「じさくする」</b>で さいしょの 1 だいを つくろう。<br>[scrap]スクラップは きたの スクラップおきばで <b>F</b> を おして あつめる。');
      SV.mechs.forEach((m, i) => {
        const c = add('card' + (i === SV.active ? ' sel' : ''), `<h3>${m.name}${i === SV.active ? ' <b class="tag">つかっている</b>' : ''}</h3><p>${statLine(m)}</p>`);
        c.onmouseenter = () => { G.preview = m; };
        if (i !== SV.active) c.appendChild(el('button', 'btn', 'この メカに のりかえる', () => { SV.active = i; swapMech(); save(); draw(); }));
        c.appendChild(el('p', 'dim', 'メインの いろ')); c.appendChild(swatches(m.c1, (k) => { m.c1 = k; G.preview = m; save(); draw(); G.preview = m; }));
        c.appendChild(el('p', 'dim', 'サブの いろ')); c.appendChild(swatches(m.c2, (k) => { m.c2 = k; save(); draw(); G.preview = m; }));
      });
      if (SV.mechs.length) G.preview = SV.mechs[SV.active];
    } else if (T === 'custom') {
      G.preview = cs;
      add('note', 'ざいりょうで パーツを つくって、じぶんだけの メカを くみたてよう。<br>コックピット → からだ → うで → あし の じゅんに えらぶ。');
      for (const k of PART_KEYS) {
        add('h4', PART_LABEL[k]); const row = add('opts');
        PARTS[k].forEach((p, i) => row.appendChild(el('button', 'opt' + (cs[k] === i ? ' sel' : ''), `${p.name}<small>${costText(p.cost)}</small>`, () => { cs[k] = i; draw(); })));
      }
      add('h4', '大きさ'); const row = add('opts');
      for (const z of [.8, 1, 1.2, 1.4]) row.appendChild(el('button', 'opt' + (cs.size === z ? ' sel' : ''), z === .8 ? '小さい' : z === 1 ? 'ふつう' : z === 1.2 ? '大きい' : 'とても大きい', () => { cs.size = z; draw(); }));
      add('h4', 'いろ'); bd.appendChild(swatches(cs.c1, (k) => { cs.c1 = k; draw(); })); bd.appendChild(swatches(cs.c2, (k) => { cs.c2 = k; draw(); }));
      const base = partsCost(cs), cost = {}; for (const k in base) cost[k] = Math.ceil(base[k] * cs.size * cs.size);
      const c = add('card sel', `<h3>かんせい よそう</h3><p>${statLine(cs)}</p><p>ひつような ざいりょう: <b>${costText(cost)}</b></p>`);
      c.appendChild(el('button', 'btn big' + (canPay(cost) ? '' : ' off'), 'この メカを つくる', () => craft(cost, () => {
        SV.mechs.push(Object.assign({ name: 'じさくメカ ' + (SV.mechs.filter(m => m.custom).length + 1) + 'ごう', custom: 1 }, cs)); SV.active = SV.mechs.length - 1; swapMech();
        ui.toast('[wrench] じさくメカが かんせい！ ちかくに おいたよ'); ui.tab = 'own';
      })));
    } else if (T === 'shop') {
      const f = FRAMES[shopSel], own = SV.mechs.some(m => m.fid === f.id); G.preview = f;
      const c = add('card sel', `<h3>${f.name}</h3><p>${statLine(f)}</p>`);
      c.appendChild(own ? el('p', 'tag', 'もっている') : el('button', 'btn big' + (SV.money >= f.price ? '' : ' off'), `[money]${f.price.toLocaleString()} で かう`, () => buy(f.price, () => {
        SV.mechs.push({ name: f.name, fid: f.id, legs: f.legs, body: f.body, head: f.head, arms: f.arms, size: f.size, c1: f.c1, c2: f.c2 }); SV.active = SV.mechs.length - 1; swapMech(); ui.toast('[mech] ' + f.name + ' を てにいれた！');
      })));
      add('h4', 'メカ 50 しゅるい'); const g = add('grid');
      FRAMES.forEach((m, i) => g.appendChild(el('button', 'opt' + (i === shopSel ? ' sel' : '') + (SV.mechs.some(o => o.fid === m.id) ? ' own' : ''), `${m.name}<small>[money]${m.price.toLocaleString()}</small>`, () => { shopSel = i; draw(); })));
    } else if (T === 'wshop' || T === 'craft') {
      add('note', T === 'craft' ? 'ざいりょうから ぶきや たてを つくる。おかねは いらない。' : 'おかねで ぶきや たてを かう。');
      for (const [kind, label] of [['gun', 'じゅう'], ['melee', 'きんきょり ぶき'], ['shield', 'たて']]) {
        add('h4', label);
        for (const w of WLIST.filter(w => w.kind === kind)) {
          const info = kind === 'gun' ? `いりょく ${w.dmg}${w.n ? '×' + w.n : ''}　れんしゃ ${(1 / w.rate).toFixed(1)}/びょう　きょり ${w.range}m` : kind === 'melee' ? `いりょく ${w.dmg}　とどく ${w.reach}m` : `まえからの ダメージを ${Math.round(w.block * 100)}% へらす`;
          const c = add('card row', `<div><h3>${w.name}</h3><p>${info}</p></div>`);
          if (SV.own[w.id]) c.appendChild(el('span', 'tag', 'もっている'));
          else if (T === 'craft') c.appendChild(el('button', 'btn' + (canPay(w.cost) ? '' : ' off'), 'つくる ' + costText(w.cost), () => craft(w.cost, () => { SV.own[w.id] = 1; ui.toast(w.name + ' を つくった！「そうび」で もちかえよう'); })));
          else c.appendChild(el('button', 'btn' + (SV.money >= w.price ? '' : ' off'), '[money]' + w.price.toLocaleString(), () => buy(w.price, () => { SV.own[w.id] = 1; ui.toast(w.name + ' を かった！「そうび」で もちかえよう'); })));
        }
      }
    } else if (T === 'equip') {
      add('note', 'メカに のっていても、おりていても、おなじ そうびを つかう。<br>ひだりクリック: メイン　みぎクリック: サブ (たては おしている あいだ ふせぐ)　F: きんきょり');
      for (const [slot, label, kinds] of [['main', 'メイン (じゅう)', ['gun']], ['sub', 'サブ (じゅう か たて)', ['gun', 'shield']], ['melee', 'きんきょり', ['melee']]]) {
        add('h4', label); const row = add('opts');
        if (slot === 'sub') row.appendChild(el('button', 'opt' + (!SV.load.sub ? ' sel' : ''), 'なし', () => { SV.load.sub = null; save(); draw(); }));
        for (const w of WLIST) if (SV.own[w.id] && kinds.includes(w.kind) && !(slot === 'sub' && w.id === SV.load.main) && !(slot === 'main' && w.id === SV.load.sub))
          row.appendChild(el('button', 'opt' + (SV.load[slot] === w.id ? ' sel' : ''), w.name, () => { SV.load[slot] = w.id; save(); draw(); }));
      }
    } else if (T === 'jobs') {
      if (G.job) { const c = add('card sel', `<h3>いまの しごと: ${G.job.name}</h3><p>ほうしゅう [money]${G.job.pay}</p>`); c.appendChild(el('button', 'btn', 'この しごとを やめる', () => { if (G.job.target && !G.job.target.dead) G.job.target.ai.keep = false; G.job = null; draw(); })); }
      const J = [['deliver', '[box] はいたつ', 'にもつを うけとって、まちの どこかへ とどける。はやく つくと ボーナス。', 'きょりで かわる'],
        ['bounty', '[target] おたずねもの たいじ', 'みなみの こうやに いる おおきな ならずものメカを たおす。メカが ひつよう。', '[money]' + (700 + 300 * SV.rank)],
        ['dealer', '[dealer] やみしょうにん たいじ', 'マンションの うらで やみしょうばいを している れんちゅうを やっつける。', '[money]' + (400 + 100 * SV.rank) + ' + レアパーツ']];
      for (const j of J) { const c = add('card row', `<div><h3>${j[1]}</h3><p>${j[2]}<br>ほうしゅう: ${j[3]}</p></div>`); c.appendChild(el('button', 'btn' + (G.job ? ' off' : ''), 'うける', () => { startJob(j[0]); if (G.job) ui.close(); })); }
      add('note', 'ほかにも [factory]こうじょうで はたらいたり、あつめた ざいりょうを [mats]ざいりょうやで うって かせげる。');
    } else if (T === 'factory') {
      add('note', 'プレスの しごと。うごく しるしが <b>みどり</b>に かさなった ときに ボタン (または スペースキー) を おす。8 かい。');
      const g = add('fac', '<div id="facBar"><i id="facZone"></i><b id="facCur"></b></div><p id="facMsg"></p>');
      const btn = el('button', 'btn big', 'プレス！', () => press()); g.appendChild(btn);
      fac = { n: 0, hit: 0, pos: 0, t: 0, zone: rnd(.15, .7), sp: 1.1 };
      const zoneEl = $('facZone'), cur = $('facCur'), msg = $('facMsg');
      const setZone = () => { zoneEl.style.left = fac.zone * 100 + '%'; msg.textContent = `${fac.n}/8 かい　せいこう ${fac.hit}`; };
      setZone();
      const press = () => {
        if (!fac || fac.n >= 8) return;
        const ok = fac.pos > fac.zone - .01 && fac.pos < fac.zone + .16; fac.n++; if (ok) fac.hit++; sfx(ok ? 'coin' : 'hit'); fac.zone = rnd(.1, .75); fac.sp += .18; setZone();
        if (fac.n >= 8) { const payAmt = 60 + fac.hit * 45; clearInterval(fac.iv); btn.remove(); msg.innerHTML = fmt(`おつかれさま！ せいこう ${fac.hit}/8　きゅうりょう [money]${payAmt}`); jobDone(payAmt, 'こうじょうの しごと'); $('mWallet').innerHTML = fmt('[money]' + Math.floor(SV.money).toLocaleString()); g.appendChild(el('button', 'btn', 'もういちど はたらく', draw)); }
      };
      fac.press = press;
      fac.iv = setInterval(() => { fac.t += .016 * fac.sp; fac.pos = .5 - .5 * Math.cos(fac.t * 3); cur.style.left = fac.pos * 100 + '%'; }, 16);
    } else if (T === 'food') {
      for (const f of FOODS) { const c = add('card row', `<div><h3>${f.icon === '[food]' ? '[food]' : '[kit]'} ${f.name}</h3><p>${f.text}${f.kit ? '　(いま ' + SV.kits + 'こ)' : ''}</p></div>`); c.appendChild(el('button', 'btn' + (SV.money >= f.price ? '' : ' off'), '[money]' + f.price, () => buy(f.price, () => { if (f.kit) SV.kits++; else { P.human.hp = P.human.maxhp; if (P.mech && !P.mech.dead) P.mech.hp = P.mech.maxhp; ui.toast('[heart] げんき まんたん！'); } }))); }
    } else if (T === 'mats') {
      for (const k of MAT_KEYS) {
        const m = MATS[k], c = add('card row', `<div><h3>${m.icon} ${m.name}　${SV.mats[k]}こ</h3><p>うる [money]${m.sell}${m.buy ? '　かう [money]' + m.buy : '　(うっていない)'}</p></div>`), bx = el('div', 'btns');
        for (const n of [1, 10]) bx.appendChild(el('button', 'btn' + (SV.mats[k] >= n ? '' : ' off'), n + 'こ うる', () => { if (SV.mats[k] < n) return; SV.mats[k] -= n; SV.money += m.sell * n; sfx('coin'); save(); draw(); }));
        if (m.buy) for (const n of [1, 10]) bx.appendChild(el('button', 'btn' + (SV.money >= m.buy * n ? '' : ' off'), n + 'こ かう', () => buy(m.buy * n, () => { SV.mats[k] += n; })));
        c.appendChild(bx);
      }
    } else if (T === 'airport') {
      add('note', 'かっそうろの はしと エプロンに ひこうきが とまっている。ちかづいて <b>E</b> で のれる。<br><b>W</b>: スピードを 上げる　<b>S</b>: 下げる　マウス: むきを かえる　<b>Q</b>: かいてん (バレルロール)<br>ひだりクリック: きじゅう　みぎクリック: ばくだん　<b>E</b>: おりる (そらでは パラシュート)');
      const c = add('card row', '<div><h3>[plane] ジェットき</h3><p>プロペラきより ずっと はやくて がんじょう。エプロンに おかれる。</p></div>');
      if (SV.jet) c.appendChild(el('span', 'tag', 'もっている')); else c.appendChild(el('button', 'btn' + (SV.money >= 15000 ? '' : ' off'), '[money]15,000', () => buy(15000, () => { SV.jet = 1; mkPlane(W.planeSpots[2], true); ui.toast('[plane] ジェットきを かった！'); })));
    } else if (T === 'help') {
      add('note', `<b>うごく</b>　W A S D　　<b>みる</b>　マウス　　<b>ジャンプ</b>　スペース (メカは おしつづけると ふんしゃ)<br>
<b>うつ</b>　ひだりクリック　　<b>サブ・たて</b>　みぎクリック　　<b>きんきょり</b>　F (ざいりょうも これで ほる)<br>
<b>かいてんダッシュ</b>　Shift　　<b>かいてんぎり</b>　Q　　<b>へんけい</b>　R (ボール・タイタン)<br>
<b>のる・おりる・はなす</b>　E　　<b>メカを よぶ</b>　C　　<b>リペアキット</b>　H　　<b>たてる</b>　B　　<b>メニュー</b>　Esc`);
      add('note', '[scrap] ざいりょうを あつめて メカを つくり、[jobs] しごとで かせいで、[mech] メカや [gun] ぶきを そろえよう。<br>まちの そとには ならずものが いる。ランクが あがるほど つよくなり、おわりは ない。<br>まちの そとなら どこにでも いえや きちを たてられる。ベッドを おくと そこが ふっかつちてんに なる。');
    } else if (T === 'set') {
      const q = SV.q, rowS = (label, val, on) => { const c = add('card row', `<div><h3>${label}</h3></div>`); c.appendChild(el('button', 'btn', val, on)); };
      rowS('かげの きれいさ', ['なし (かるい)', 'ふつう', 'きれい'][q.shadow], () => { q.shadow = (q.shadow + 1) % 3; R.shadowQ = q.shadow; save(); draw(); });
      rowS('がめんの こまかさ', q.auto ? 'じどう (おそい ときに 下げる)' : 'いつも さいこう', () => { q.auto = q.auto ? 0 : 1; if (!q.auto) R.res = 1; save(); draw(); });
      rowS('おと', soundOn ? 'ON' : 'OFF', () => { soundOn = !soundOn; draw(); });
      const c = add('card row', '<div><h3>セーブデータを けす</h3><p>さいしょから やりなおす。もとには もどせない。</p></div>');
      c.appendChild(el('button', 'btn danger', 'けす', function () { if (this.dataset.sure) { localStorage.removeItem(SAVE_KEY); location.reload(); } else { this.dataset.sure = 1; this.textContent = 'ほんとうに けす'; } }));
    }
  }
  ui.redraw = () => draw();
  ui.key = (code) => { if (fac && code === 'Space') { fac.press(); return true; } return false; };
  ui.init = () => {
    $('mClose').onclick = ui.close;
    document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = ic(e.dataset.ic) + e.innerHTML; });
  };
  return ui;
})();
