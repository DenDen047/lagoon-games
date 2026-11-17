/* MECH FRONTIER の画面: アイコン (自前の SVG)・HUD・ミニマップ・メニュー */
'use strict';
/* アイコンは すべて ここで 描いた SVG。文の中の [名前] が アイコンに 置きかわる。 */
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
  car: ['#ffb24a', '<path d="M4 11l2-5h12l2 5h1.5a1.5 1.5 0 011.5 1.5V17h-2.2a2.8 2.8 0 01-5.6H8.8a2.8 2.8 0 01-5.6H1v-4.5A1.5 1.5 0 012.5 11zm3.4-3l-1.2 3H11V8zm5.6 0v3h5l-1.2-3z" fill-rule="evenodd"/><circle cx="6" cy="17" r="1.8"/><circle cx="18" cy="17" r="1.8"/>'],
  shirt: ['#ff8ac8', '<path d="M8 2l4 2.5L16 2l6 3.5-2.5 5L17 9.5V22H7V9.5L4.5 10.5 2 5.5z"/>'],
  fish: ['#5fc8ff', '<path d="M2 12c3-5 9-6 14-3l5-4-1.5 7L21 19l-5-4c-5 3-11 2-14-3z"/><circle cx="7" cy="11" r="1.2" fill="#024"/>'],
  veg: ['#ff8a3a', '<path d="M9 9c4 0 7 3 5 9-1 3-3 4-5 4s-4-1-5-4C2 12 5 9 9 9z"/><path d="M9 9c0-3 1-5 3-7M9 9C8 6 6 5 4 5M9 9c2-2 4-3 7-2" stroke="#5fd068" stroke-width="2" fill="none"/>'],
  bag: ['#c79bff', '<path d="M5 9h14l2 12H3z"/><path d="M8 9V6a4 4 0 018 0v3h-2V6a2 2 0 00-4 0v3z"/>'],
  police: ['#6fb3ff', '<path d="M12 1l3 2.5 4-.5.5 6c0 6-3.5 10.5-7.5 13C8 19.5 4.5 15 4.5 9L5 3l4 .5z"/><path d="M12 6l1.5 3.2 3.5.4-2.6 2.3.8 3.5L12 13.6 8.8 15.4l.8-3.5L7 9.6l3.5-.4z" fill="#fff"/>'],
  house: ['#ffcf7a', '<path d="M12 2l10 9h-3v10h-5v-6h-4v6H5V11H2z"/>'],
  bolt: ['#ffe14a', '<path d="M13 1L4 14h6l-1 9 9-13h-6z"/>'],
  eye: ['#ff6b6b', '<path d="M12 5c5 0 9 4 11 7-2 3-6 7-11 7S3 15 1 12c2-3 6-7 11-7z"/><circle cx="12" cy="12" r="4" fill="#fff"/><circle cx="12" cy="12" r="2" fill="#000"/>'],
};
const ic = (n) => { const i = ICONS[n]; return i ? `<svg class="ic" viewBox="0 0 24 24" fill="${i[0]}">${i[1]}</svg>` : ''; };
const fmt = (s) => String(s).replace(/\[(\w+)\]/g, (m, n) => ICONS[n] ? ic(n) : m);

const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const ui = { page: null, tab: null };
  const el = (tag, cls, html, on) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = fmt(html); if (on) e.onclick = on; return e; };
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  const yen = (n) => Math.floor(n).toLocaleString();
  let mapT = 0, labels = [];

  ui.toast = (t) => {
    const d = el('div', 'toast', t); $('toasts').appendChild(d);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => d.classList.add('out'), 3000); setTimeout(() => d.remove(), 3500);
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
    $('money').textContent = yen(SV.money);
    for (const k of MAT_KEYS) $('m_' + k).textContent = SV.mats[k];
    $('rank').textContent = SV.rank; bar('xpBar', SV.xp, SV.rank * 120);
    bar('hpBar', h.hp, h.maxhp); bar('fdBar', SV.hunger, 100); bar('enBar', SV.energy, 100);
    $('fdRow').classList.toggle('low', SV.hunger < 15); $('enRow').classList.toggle('low', SV.energy < 15);
    const veh = P.state !== 'foot';
    $('vehRow').classList.toggle('hidden', !veh);
    if (veh) { bar('vhBar', b.hp, b.maxhp); $('vehName').textContent = b.name + (b.st.kind === 'ball' ? ' ・ ' + BALL_MODES[b.mode] : b.st.kind === 'titan' ? (b.mode ? ' ・ 盾' : ' ・ 攻撃') : ''); }
    const q = questInfo(), j = G.job;
    let txt = q ? q.text : '';
    if (j) txt = j.name + (j.pts ? '　' + j.pts.filter(p => p.done).length + '/' + j.pts.length : j.farm ? '　' + j.got + '/' + j.need : '');
    const tx = G.beacons[0];
    $('quest').classList.toggle('hidden', !txt);
    if (txt) {
      $('qText').innerHTML = fmt(txt); $('qNav').classList.toggle('hidden', !tx);
      if (tx) { const dx = tx.x - b.x, dz = tx.z - b.z, sn = Math.sin(cam.yaw), cs = Math.cos(cam.yaw); $('qArrow').style.transform = 'rotate(' + Math.atan2(-dx * cs + dz * sn, dx * sn + dz * cs) + 'rad)'; $('qDist').textContent = Math.round(Math.hypot(dx, dz)) + 'm'; }
    }
    $('wanted').classList.toggle('hidden', !G.wanted);
    if (G.wanted && $('wanted').dataset.n !== String(G.wanted)) { $('wanted').dataset.n = G.wanted; $('wanted').innerHTML = ic('police') + ic('star').repeat(G.wanted); }
    $('sus').classList.toggle('hidden', G.sus < .03); bar('susBar', G.sus, 1);
    const rp = G.report; $('rep').classList.toggle('hidden', !rp); if (rp) { bar('repBar', rp.t, rp.max); $('repT').textContent = '通報まで ' + Math.ceil(rp.t) + ' 秒'; }
    const L = G.lock; $('lock').classList.toggle('hidden', !L);
    if (L) { $('lockName').textContent = L.name || ''; bar('lockBar', L.hp, L.maxhp); }
    const pr = G.prompt; $('prompt').classList.toggle('hidden', !pr || G.menu);
    if (pr && $('prompt')._t !== pr.text) { $('prompt')._t = pr.text; $('prompt').innerHTML = '<kbd>E</kbd>' + fmt(pr.text); }
    const ld = SV.load, nm = (id) => id ? WEAPONS[id].name : '―';
    const wt = P.state === 'plane' ? '機銃 / 爆弾 / Q 回転' : P.state === 'car' ? 'W S 加速・ブレーキ / A D ハンドル' : nm(ld.main) + ' / ' + nm(ld.sub) + ' / ' + nm(ld.melee);
    if ($('weap')._t !== wt) { $('weap')._t = wt; $('weap').textContent = wt; }
    $('vig').style.opacity = clamp(G.hitT * 2, 0, .5);
    $('cross').classList.toggle('hidden', G.menu || G.build.on || !!G.preview || P.state === 'car');
    let ck = String(Math.floor(SV.time * 24)).padStart(2, '0') + ':' + String(Math.floor(SV.time * 1440) % 60).padStart(2, '0');
    if (P.state === 'plane') ck += '　' + Math.round(b.y) + 'm　' + Math.round(b.speed * 3.6) + 'km/h';
    else if (P.state === 'car') ck += '　' + Math.round(Math.abs(b.speed) * 3.6) + 'km/h';
    $('clock').textContent = ck;
    $('lootRow').classList.toggle('hidden', !SV.loot); $('loot').textContent = yen(SV.loot);
    // 3D の 札
    const want = [];
    for (const f of W.facilities) if (Math.hypot(f.x - b.x, f.z - b.z) < 90) want.push({ x: f.x, y: f.y + 6.5, z: f.z, t: f.icon + ' ' + f.name });
    for (const bc of G.beacons) want.push({ x: bc.x, y: 6, z: bc.z, t: bc.label + ' ' + Math.round(Math.hypot(bc.x - b.x, bc.z - b.z)) + 'm', c: 'bc' });
    if (W.inTown(b.x, b.z)) for (const s of W.houses) if ((s.sale || s.id === SV.home) && Math.hypot(s.x - b.x, s.z - b.z) < 60) want.push({ x: s.x, y: 6, z: s.z, t: s.sale ? '[house] 売家 [money]' + yen(s.sale) : '[house] 自宅' });
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
    rect(-1400, 232, 1400, 1400, '#9a8258'); rect(-150, -1400, 150, -232, '#5c4d40'); rect(-1400, -1400, -232, 232, '#6b756b'); rect(-604, -624, -256, -296, '#6a4a2c');
    rect(690, -1400, 762, 1400, '#d8c890'); rect(762, -1400, 1400, 1400, '#2a6a9a'); rect(740, 197.5, 810, 202.5, '#9a7a52');
    rect(226, -82, 660, 82, '#858a90'); rect(236, -15, 650, 15, '#2c2e33'); rect(-203, -203, 203, 203, '#30333a');
    rect(236, -564, 624, -124, '#4a4d54'); c.fillStyle = '#4f8a48';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) c.fillRect(X(244 + 76 * i), Y(-556 + 72 * j), 68 * s, 64 * s);
    c.fillStyle = '#6d7480'; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) c.fillRect(X(i * 56 - 22), Y(j * 56 - 22), 44 * s, 44 * s);
    c.fillStyle = '#d8c8b0'; for (const hs of W.houses) if (Math.abs(hs.x - b.x) < 270 && Math.abs(hs.z - b.z) < 270) { c.fillStyle = hs.id === SV.home ? '#ffd24a' : hs.sale ? '#ff7070' : '#d8c8b0'; c.fillRect(X(hs.x - 6), Y(hs.z - 5), 12 * s, 10 * s); }
    c.fillStyle = '#fff'; for (const p of SV.pieces) c.fillRect(X(p.gx * 4) - 1, Y(p.gz * 4) - 1, 2, 2);
    for (const f of W.facilities) { c.fillStyle = hex(f.col); c.fillRect(X(f.x) - 2, Y(f.z) - 2, 4, 4); }
    for (const e of ents) {
      if (e.hidden || e.dead || e === b) continue;
      if (e.team === 1) { if (e.group && !e.ai.aggro && !(G.job && G.job.group === e.group)) continue; c.fillStyle = e.police ? '#4f8cff' : e.boss ? '#ff3bd0' : '#ff4040'; c.fillRect(X(e.x) - 2, Y(e.z) - 2, 4, 4); }
      else if (e === P.mech) { c.fillStyle = '#40d0ff'; c.fillRect(X(e.x) - 3, Y(e.z) - 3, 6, 6); }
      else if (e.kind === 'plane') { c.fillStyle = '#ffffff'; c.fillRect(X(e.x) - 2, Y(e.z) - 2, 5, 5); }
      else if (e.kind === 'car') { c.fillStyle = '#ffb24a'; c.fillRect(X(e.x) - 1.5, Y(e.z) - 1.5, 3, 3); }
    }
    for (const bc of G.beacons) {
      const x = clamp(X(bc.x), 6, N - 6), y = clamp(Y(bc.z), 6, N - 6);
      c.strokeStyle = hex(bc.col); c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, 5, 0, 7); c.stroke();
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
    bb.appendChild(el('div', 'bHelp', `<kbd>左</kbd>置く <kbd>右</kbd>消す <kbd>ホイール</kbd>部品 <kbd>R</kbd>回す <kbd>T</kbd><kbd>G</kbd>${B_.lvl + 1} 階 <kbd>C</kbd>色 <i style="background:${hex(BUILD_COLS[B_.col])}"></i> <kbd>B</kbd>終了`));
  };

  // ---------- メニュー ----------
  const PAGES = {
    workshop: ['[wrench] 工房', [['own', '所持メカ'], ['custom', '自作'], ['equip', '装備'], ['craft', '武器製作']]],
    mechshop: ['[mech] メカショップ', [['shop', '購入']]], weapons: ['[gun] 武器屋', [['wshop', '購入'], ['equip', '装備']]],
    jobs: ['[jobs] 仕事案内', [['jobs', '仕事']]], factory: ['[factory] 工場', [['factory', '働く']]], food: ['[food] 食堂', [['food', 'メニュー']]],
    mats: ['[mats] 買取・素材', [['mats', '売買']]], clothes: ['[shirt] 服屋', [['clothes', '服']]], wardrobe: ['[shirt] クローゼット', [['wardrobe', '着替え']]],
    fence: ['[bag] 裏の買取屋', [['fence', '盗品']]], police: ['[police] 警察署', [['police', '窓口']]], pier: ['[fish] 釣り場', [['fish', '釣る']]], airport: ['[plane] 空港', [['airport', '飛行機']]],
    bag: ['[bag] 持ち物', [['bag', '持ち物']]], pause: ['メニュー', [['help', '操作'], ['bag', '持ち物'], ['set', '設定']]],
  };
  let cs = { head: 0, body: 0, arms: 0, legs: 0, size: 1, c1: 7, c2: 1 }, shopSel = 0, game = null;
  ui.open = (id) => {
    if (G.build.on) { G.build.on = false; ui.buildBar(); }
    ui.page = id; ui.tab = PAGES[id][1][0][0]; G.menu = true; if (document.pointerLockElement) document.exitPointerLock();
    $('menu').classList.remove('hidden'); $('hud').classList.add('inMenu'); sfx('ui'); draw();
  };
  ui.close = () => { if (game) { clearInterval(game.iv); game = null; } G.menu = false; G.preview = null; ui.page = null; $('menu').classList.add('hidden'); $('hud').classList.remove('inMenu'); save(); };
  function swapMech() {
    const b = body(), inIt = P.state === 'mech', x = inIt ? b.x : P.human.x + 5, z = inIt ? b.z : P.human.z + 2;
    if (inIt) { P.state = 'foot'; P.human.hidden = false; }
    spawnPlayerMech(x, z, inIt ? b.y : P.human.y); if (inIt && P.mech) { P.state = 'mech'; P.human.hidden = true; P.mech.parked = false; }
  }
  const chips = (a) => '<p class="chips">' + a.filter(Boolean).map(t => '<span>' + t + '</span>').join('') + '</p>';
  const statLine = (s) => { const st = mechStats(s); return chips(['体力 ' + st.hp, '速さ ' + Math.round(st.spd * 3.6), PARTS.legs[s.legs].name, s.armor ? '<b>パンチ専用</b>' : '', st.kind === 'ball' ? '<b>R: 回転・砲台・コマ</b>' : st.kind === 'titan' ? '<b>R: 盾モード</b>' : '']); };
  const swatches = (cols, cur, on) => { const d = el('div', 'sw'); cols.forEach((c, i) => { const b = el('button', (typeof cur === 'number' && cur === (cols === PAL ? i : c)) ? 'sel' : '', '', () => on(cols === PAL ? i : c)); b.style.background = hex(c); d.appendChild(b); }); return d; };
  function buy(price, fn) { if (SV.money < price) { ui.toast('お金が足りない'); sfx('hit'); return; } SV.money -= price; fn(); sfx('coin'); save(); draw(); }
  function craft(cost, fn) { if (!canPay(cost)) { ui.toast('素材が足りない'); sfx('hit'); return; } pay(cost); fn(); sfx('build'); save(); draw(); }
  /* タイミングを 合わせる ミニゲーム (工場・釣り) */
  function timing(parent, rounds, btnText, onEnd) {
    const g = el('div', 'fac', '<div id="facBar"><i id="facZone"></i><b id="facCur"></b></div><p id="facMsg"></p>'); parent.appendChild(g);
    const btn = el('button', 'btn big', btnText, () => press()); g.appendChild(btn);
    game = { n: 0, hit: 0, pos: 0, t: 0, zone: rnd(.15, .7), sp: 1.1 };
    const zoneEl = g.querySelector('#facZone'), cur = g.querySelector('#facCur'), msg = g.querySelector('#facMsg');
    const show = () => { zoneEl.style.left = game.zone * 100 + '%'; msg.textContent = `${game.n} / ${rounds}　成功 ${game.hit}`; };
    const press = () => {
      if (!game || game.n >= rounds) return;
      const ok = game.pos > game.zone - .01 && game.pos < game.zone + .16; game.n++; if (ok) game.hit++; sfx(ok ? 'coin' : 'hit'); game.zone = rnd(.1, .75); game.sp += .18; show();
      if (game.n >= rounds) { clearInterval(game.iv); btn.remove(); const hits = game.hit; msg.innerHTML = fmt(onEnd(hits)); g.appendChild(el('button', 'btn', 'もう一度', draw)); }
    };
    game.press = press; show();
    game.iv = setInterval(() => { game.t += .016 * game.sp; game.pos = .5 - .5 * Math.cos(game.t * 3); cur.style.left = game.pos * 100 + '%'; }, 16);
  }

  function draw() {
    const [title, tabs] = PAGES[ui.page], bd = $('mBody');
    $('mTitle').innerHTML = fmt(title);
    $('mWallet').innerHTML = fmt('[money]' + yen(SV.money) + '　' + MAT_KEYS.map(k => MATS[k].icon + SV.mats[k]).join(' '));
    const tb = $('mTabs'); tb.innerHTML = '';
    if (tabs.length > 1) for (const [id, name] of tabs) tb.appendChild(el('button', 'tab' + (id === ui.tab ? ' sel' : ''), name, () => { ui.tab = id; sfx('ui'); draw(); }));
    bd.innerHTML = ''; G.preview = null; if (game) { clearInterval(game.iv); game = null; }
    const add = (cls, html, on) => { const e = el('div', cls, html, on); bd.appendChild(e); return e; };
    const T = ui.tab;
    if (T === 'own') {
      if (!SV.mechs.length) add('note', 'メカがない。<b>自作</b>タブで最初の 1 機を作ろう。');
      SV.mechs.forEach((m, i) => {
        const c = add('card' + (i === SV.active ? ' sel' : ''), `<h3>${m.name}${i === SV.active ? ' <b class="tag">使用中</b>' : ''}</h3>${statLine(m)}`);
        c.onmouseenter = () => { G.preview = m; };
        if (i !== SV.active) c.appendChild(el('button', 'btn', '乗り換える', () => { SV.active = i; swapMech(); save(); draw(); }));
        c.appendChild(swatches(PAL, m.c1, (k) => { m.c1 = k; save(); draw(); G.preview = m; }));
        c.appendChild(swatches(PAL, m.c2, (k) => { m.c2 = k; save(); draw(); G.preview = m; }));
      });
      if (SV.mechs.length) G.preview = SV.mechs[SV.active];
    } else if (T === 'custom') {
      G.preview = cs;
      for (const k of PART_KEYS) {
        add('h4', PART_LABEL[k]); const row = add('opts');
        PARTS[k].forEach((p, i) => row.appendChild(el('button', 'opt' + (cs[k] === i ? ' sel' : ''), `${p.name}<small>${costText(p.cost)}</small>`, () => { cs[k] = i; draw(); })));
      }
      add('h4', 'サイズ'); const row = add('opts');
      for (const z of [.8, 1, 1.2, 1.4]) row.appendChild(el('button', 'opt' + (cs.size === z ? ' sel' : ''), z === .8 ? '小' : z === 1 ? '中' : z === 1.2 ? '大' : '特大', () => { cs.size = z; draw(); }));
      add('h4', '色'); bd.appendChild(swatches(PAL, cs.c1, (k) => { cs.c1 = k; draw(); })); bd.appendChild(swatches(PAL, cs.c2, (k) => { cs.c2 = k; draw(); }));
      const base = partsCost(cs), cost = {}; for (const k in base) cost[k] = Math.ceil(base[k] * cs.size * cs.size);
      const c = add('card sel', `${statLine(cs)}<p>必要な素材　<b>${costText(cost)}</b></p>`);
      c.appendChild(el('button', 'btn big' + (canPay(cost) ? '' : ' off'), '組み立てる', () => craft(cost, () => {
        SV.mechs.push(Object.assign({ name: '自作メカ ' + (SV.mechs.filter(m => m.custom).length + 1) + '号', custom: 1 }, cs)); SV.active = SV.mechs.length - 1; swapMech();
        ui.toast('[wrench] 自作メカが完成'); ui.tab = 'own';
      })));
    } else if (T === 'shop') {
      const f = FRAMES[shopSel], own = SV.mechs.some(m => m.fid === f.id); G.preview = f;
      const c = add('card sel', `<h3>${f.name}</h3>${statLine(f)}`);
      c.appendChild(own ? el('p', 'tag', '所持') : el('button', 'btn big' + (SV.money >= f.price ? '' : ' off'), `[money]${yen(f.price)}`, () => buy(f.price, () => {
        SV.mechs.push({ name: f.name, fid: f.id, legs: f.legs, body: f.body, head: f.head, arms: f.arms, size: f.size, c1: f.c1, c2: f.c2 }); SV.active = SV.mechs.length - 1; swapMech(); ui.toast('[mech] ' + f.name + ' を入手');
      })));
      const g = add('grid');
      FRAMES.forEach((m, i) => g.appendChild(el('button', 'opt' + (i === shopSel ? ' sel' : '') + (SV.mechs.some(o => o.fid === m.id) ? ' own' : ''), `${m.name}<small>[money]${yen(m.price)}</small>`, () => { shopSel = i; draw(); })));
    } else if (T === 'wshop' || T === 'craft') {
      for (const [kind, label] of [['gun', '銃'], ['melee', '近接武器'], ['shield', '盾']]) {
        add('h4', label);
        for (const w of WLIST.filter(w => w.kind === kind && !w.hidden)) {
          const info = kind === 'gun' ? chips(['威力 ' + w.dmg + (w.n ? '×' + w.n : ''), '連射 ' + (1 / w.rate).toFixed(1), '射程 ' + w.range + 'm']) : kind === 'melee' ? chips(['威力 ' + w.dmg, 'リーチ ' + w.reach + 'm']) : chips(['防御 ' + Math.round(w.block * 100) + '%']);
          const c = add('card row', `<div><h3>${w.name}</h3>${info}</div>`);
          if (SV.own[w.id]) c.appendChild(el('span', 'tag', '所持'));
          else if (T === 'craft') c.appendChild(el('button', 'btn' + (canPay(w.cost) ? '' : ' off'), costText(w.cost), () => craft(w.cost, () => { SV.own[w.id] = 1; ui.toast(w.name + ' を製作'); })));
          else c.appendChild(el('button', 'btn' + (SV.money >= w.price ? '' : ' off'), '[money]' + yen(w.price), () => buy(w.price, () => { SV.own[w.id] = 1; ui.toast(w.name + ' を購入'); })));
        }
      }
    } else if (T === 'equip') {
      for (const [slot, label, kinds] of [['main', 'メイン　左クリック', ['gun']], ['sub', 'サブ　右クリック', ['gun', 'shield']], ['melee', '近接　F', ['melee']]]) {
        add('h4', label); const row = add('opts');
        if (slot === 'sub') row.appendChild(el('button', 'opt' + (!SV.load.sub ? ' sel' : ''), 'なし', () => { SV.load.sub = null; save(); draw(); }));
        for (const w of WLIST) if (SV.own[w.id] && kinds.includes(w.kind) && !(slot === 'sub' && w.id === SV.load.main) && !(slot === 'main' && w.id === SV.load.sub))
          row.appendChild(el('button', 'opt' + (SV.load[slot] === w.id ? ' sel' : ''), w.name, () => { SV.load[slot] = w.id; save(); draw(); }));
      }
    } else if (T === 'jobs') {
      if (G.job) { const c = add('card sel row', `<div><h3>進行中: ${G.job.name}</h3>${chips(['[money]' + yen(G.job.pay)])}</div>`); c.appendChild(el('button', 'btn danger', 'やめる', () => { if (G.job.target && !G.job.target.dead) G.job.target.ai.keep = false; G.job = null; draw(); })); }
      for (const j of JOBS) {
        const lv = SV.jobLv[j.id] || 0, payT = j.id === 'bounty' ? 700 + 300 * SV.rank : j.id === 'dealer' ? 400 + 100 * SV.rank : Math.round(j.pay * (1 + Math.min(1, lv * .05)));
        const c = add('card row', `<div><h3>${j.icon} ${j.name}</h3><p>${j.text}</p>${chips(['[money]' + yen(payT), lv ? '経験 ' + lv + ' 回' : ''])}</div>`);
        c.appendChild(el('button', 'btn' + (G.job ? ' off' : ''), '受ける', () => { startJob(j.id); if (G.job) ui.close(); }));
      }
      add('note', '[factory] 工場と [fish] 釣り場は、その場所で直接働ける。');
    } else if (T === 'factory') {
      add('note', '印が<b>緑</b>に重なった瞬間に押す (スペースキーでも可)');
      timing(bd, 8, 'プレス', (hits) => { const p = 60 + hits * 45; jobDone(p, '工場の仕事', 'factory'); return `成功 ${hits}/8　給料 [money]${p}`; });
    } else if (T === 'fish') {
      add('note', '印が<b>緑</b>に重なった瞬間に引き上げる');
      timing(bd, 6, '引く', (hits) => { SV.bag.fish += hits; if (hits) jobDone(hits * 20, '釣り', 'fish'); return `[fish] ${hits} 匹釣れた (持ち物に入った)`; });
    } else if (T === 'food') {
      for (const f of FOODS) { const c = add('card row', `<div><h3>${f.icon} ${f.name}${f.kit ? '　× ' + SV.kits : ''}</h3><p>${f.text}</p></div>`); c.appendChild(el('button', 'btn' + (SV.money >= f.price ? '' : ' off'), '[money]' + f.price, () => buy(f.price, () => { if (f.kit) SV.kits++; else { P.human.hp = P.human.maxhp; eat(f.hunger); if (P.mech && !P.mech.dead) P.mech.hp = P.mech.maxhp; } }))); }
    } else if (T === 'mats') {
      const rowM = (icon, name, n, sell, buyP, onSell, onBuy) => {
        const c = add('card row', `<div><h3>${icon} ${name}　× ${n}</h3>${chips(['売 [money]' + sell, buyP ? '買 [money]' + buyP : ''])}</div>`), bx = el('div', 'btns');
        for (const k of [1, 10]) bx.appendChild(el('button', 'btn' + (n >= k ? '' : ' off'), '売る ' + k, () => { if (n < k) return; onSell(k); SV.money += sell * k; sfx('coin'); save(); draw(); }));
        if (buyP) for (const k of [1, 10]) bx.appendChild(el('button', 'btn' + (SV.money >= buyP * k ? '' : ' off'), '買う ' + k, () => buy(buyP * k, () => onBuy(k))));
        c.appendChild(bx);
      };
      for (const k of MAT_KEYS) rowM(MATS[k].icon, MATS[k].name, SV.mats[k], MATS[k].sell, MATS[k].buy, (n) => { SV.mats[k] -= n; }, (n) => { SV.mats[k] += n; });
      rowM('[veg]', '野菜', SV.bag.veg, 40, 0, (n) => { SV.bag.veg -= n; }); rowM('[fish]', '魚', SV.bag.fish, 90, 0, (n) => { SV.bag.fish -= n; });
    } else if (T === 'clothes' || T === 'wardrobe') {
      G.preview = { human: 1 }; const o = SV.outfit, shop = T === 'clothes';
      for (const [slot, label, ck] of CLOTH_SLOTS) {
        add('h4', label); const row = add('opts');
        CLOTHES[slot].forEach(([name, price], i) => {
          const own = SV.closet[slot][i] || !price; if (!own && !shop) return;
          row.appendChild(el('button', 'opt' + (o[slot] === i ? ' sel' : '') + (own ? '' : ' lock'), name + (own ? '' : `<small>[money]${price}</small>`), () => {
            if (own) { o[slot] = i; save(); draw(); } else buy(price, () => { SV.closet[slot][i] = 1; o[slot] = i; });
          }));
        });
        if (ck) bd.appendChild(swatches(CLOTH_COLS, o[ck], (c) => { o[ck] = c; save(); draw(); }));
      }
      add('h4', '靴'); bd.appendChild(swatches(CLOTH_COLS, o.shoeC, (c) => { o.shoeC = c; save(); draw(); }));
      add('h4', '肌'); bd.appendChild(swatches(SKINS, o.skin, (c) => { o.skin = c; save(); draw(); }));
    } else if (T === 'fence') {
      const c = add('card row', `<div><h3>[bag] 盗品</h3>${chips(['[money]' + yen(SV.loot)])}</div>`);
      c.appendChild(el('button', 'btn' + (SV.loot ? '' : ' off'), '売る', () => { if (!SV.loot) return; SV.money += SV.loot; ui.toast('[money]+' + yen(SV.loot)); SV.loot = 0; sfx('coin'); save(); draw(); }));
      add('note', '住宅街の家に入って物を盗める。住人に見つかると手配される。');
    } else if (T === 'police') {
      const caps = ents.filter(e => e.captive).length, fine = 600 * G.wanted;
      const c = add('card row', `<div><h3>[police] 捕まえた相手</h3>${chips([caps + ' 人', '報酬は倒すより多い'])}</div>`);
      c.appendChild(el('button', 'btn' + (caps ? '' : ' off'), '引き渡す', () => { handover(); draw(); }));
      const c2 = add('card row', `<div><h3>[star] 手配度 ${G.wanted}</h3>${chips([G.wanted ? '罰金 [money]' + yen(fine) : '手配されていない'])}</div>`);
      c2.appendChild(el('button', 'btn' + (G.wanted && SV.money >= fine ? '' : ' off'), '罰金を払う', () => { if (!G.wanted) return; buy(fine, () => { clearPolice('罰金を払って手配が解けた'); }); }));
      add('note', '弱った闇商人や用心棒は降参する。近づいて捕まえ、ここへ連れて来ると逮捕になる。');
    } else if (T === 'bag') {
      const food = (icon, name, key, v) => { const c = add('card row', `<div><h3>${icon} ${name}　× ${SV.bag[key]}</h3>${chips(['満腹度 +' + v])}</div>`); c.appendChild(el('button', 'btn' + (SV.bag[key] ? '' : ' off'), '食べる', () => { if (!SV.bag[key]) return; SV.bag[key]--; eat(v); save(); draw(); })); };
      food('[veg]', '野菜', 'veg', 15); food('[fish]', '魚', 'fish', 25);
      add('card row', `<div><h3>[kit] リペアキット　× ${SV.kits}</h3>${chips(['H キーで使用'])}</div>`);
      add('card row', `<div><h3>[bag] 盗品</h3>${chips(['[money]' + yen(SV.loot), '裏の買取屋で売る'])}</div>`);
      add('card', chips(['[food] 満腹度 ' + Math.round(SV.hunger), '[bolt] 元気 ' + Math.round(SV.energy), '[jobs] 仕事 ' + SV.jobs + ' 回', '[star] ランク ' + SV.rank]));
    } else if (T === 'airport') {
      add('note', '滑走路とエプロンの機体に <kbd>E</kbd> で乗る。<br><kbd>W</kbd><kbd>S</kbd> 加速・減速　<kbd>マウス</kbd> 操縦　<kbd>Q</kbd> ロール　<kbd>左</kbd> 機銃　<kbd>右</kbd> 爆弾');
      const c = add('card row', `<div><h3>[plane] ジェット機</h3>${chips(['速い', '頑丈'])}</div>`);
      if (SV.jet) c.appendChild(el('span', 'tag', '所持')); else c.appendChild(el('button', 'btn' + (SV.money >= 15000 ? '' : ' off'), '[money]15,000', () => buy(15000, () => { SV.jet = 1; mkPlane(W.planeSpots[2], true); })));
    } else if (T === 'help') {
      const K = [['W A S D', '移動'], ['マウス', '視点'], ['スペース', 'ジャンプ / 噴射'], ['左クリック', '射撃'], ['右クリック', 'サブ・盾'], ['F', '近接 / 採掘 / 収穫'], ['Shift', '回転ダッシュ'], ['Q', '回転斬り'], ['R', '変形'], ['E', '乗る・話す・使う'], ['C', 'メカを呼ぶ'], ['H', 'リペアキット'], ['B', '建築'], ['Esc', 'メニュー']];
      add('keys', K.map(k => `<div><kbd>${k[0]}</kbd><span>${k[1]}</span></div>`).join(''));
      add('note', '[scrap] 素材を集めてメカを作り、[jobs] 仕事で稼ぎ、[house] 家を買い、[shirt] 服を着替える。<br>[bag] 泥棒や住人への攻撃は、目撃されると通報される。[police] 警察署からパトカーが来る。');
    } else if (T === 'set') {
      const q = SV.q, rowS = (label, val, on) => { const c = add('card row', `<div><h3>${label}</h3></div>`); c.appendChild(el('button', 'btn', val, on)); };
      rowS('影', ['なし', '標準', '高品質'][q.shadow], () => { q.shadow = (q.shadow + 1) % 3; R.shadowQ = q.shadow; save(); draw(); });
      rowS('解像度', q.auto ? '自動' : '最高', () => { q.auto = q.auto ? 0 : 1; if (!q.auto) R.res = 1; save(); draw(); });
      rowS('音', soundOn ? 'ON' : 'OFF', () => { soundOn = !soundOn; draw(); });
      rowS('流血の表現', q.blood ? 'あり' : 'なし', () => { q.blood = q.blood ? 0 : 1; save(); draw(); });
      const c = add('card row', '<div><h3>セーブデータを消す</h3></div>');
      c.appendChild(el('button', 'btn danger', '消す', function () { if (this.dataset.sure) { localStorage.removeItem(SAVE_KEY); location.reload(); } else { this.dataset.sure = 1; this.textContent = '本当に消す'; } }));
    }
  }
  ui.redraw = () => draw();
  ui.key = (code) => { if (game && code === 'Space') { game.press(); return true; } return false; };
  ui.init = () => {
    $('mClose').onclick = ui.close;
    document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = ic(e.dataset.ic) + e.innerHTML; });
  };
  return ui;
})();
