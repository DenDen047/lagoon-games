/* =========================================================================
   ORE TO ARMADA ― 画面
   HUD / 建築パレット / ステーション / 持ち物 / 乗員 / 艦隊 / 地図 / 設計図 / メニュー
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);

const UI = {
  kind: null, tab: null, opts: {}, hudT: 0, buildCat: 'struct',

  init() {
    $('panelClose').onclick = () => this.close();
    document.querySelectorAll('#sidebtns .rbtn').forEach((b) => b.onclick = () => Game.action(b.dataset.act));
    $('confirmNo').onclick = () => { $('confirm').classList.add('hidden'); const f = this.confirmNo; this.confirmNo = null; if (f) f(); };
    $('confirmYes').onclick = () => { $('confirm').classList.add('hidden'); const f = this.confirmYes; this.confirmYes = null; if (f) f(); };
    $('storyOk').onclick = () => { $('story').classList.add('hidden'); if (this.storyThen) { const f = this.storyThen; this.storyThen = null; f(); } };
  },
  get isOpen() { return !!this.kind; },
  open(kind, tab, opts = {}) {
    this.kind = kind; this.tab = tab || null; this.opts = opts;
    $('panelWrap').classList.remove('hidden');
    this.render();
    Sfx.play('ui', 0.5);
  },
  close() {
    const k = this.kind;
    this.kind = null; $('panelWrap').classList.add('hidden'); $('panelBody').innerHTML = '';
    if (k === 'station') Econ.dockShip = null;
    Game.resume();
  },
  render() {
    const body = $('panelBody'), tabs = $('panelTabs');
    body.innerHTML = ''; tabs.innerHTML = '';
    const fn = this['p_' + this.kind];
    if (fn) fn.call(this, body, tabs);
  },
  tabs(tabs, list, cur, onPick) {
    for (const [id, name] of list) tabs.append(el('button', { class: 'tab' + (id === cur ? ' on' : ''), onclick: () => onPick(id) }, name));
  },
  confirm(text, yes, no) { $('confirmText').textContent = text; this.confirmYes = yes; this.confirmNo = no; $('confirm').classList.remove('hidden'); },
  flash() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.9; requestAnimationFrame(() => { f.style.transition = 'opacity 0.9s'; f.style.opacity = 0; }); },
  story(B, then) {
    const texts = [
      'グレイブの旗艦が砕け、外縁の海賊たちは散っていった。残骸の中から、完成品のジャンプドライブが見つかった。これで内側の環へ跳べる。',
      '鉄の要塞艦が沈黙した。中域の航路は、ひさしぶりに安全になった。内域からは、生きた船の群れの気配がする。',
      '群体の女王が崩れ落ちると、内域の群れは統率を失った。残るは、中心核で群れを生み続ける母艦だけ。',
      '群体の母艦が光を失い、中心核の門は静かになった。銀河は救われた。けれど宇宙はまだ広い。好きなだけ掘って、建てて、飛び続けよう。',
    ];
    $('storyTitle').textContent = B.name + ' を倒した';
    $('storyText').textContent = texts[B.ring];
    $('story').classList.remove('hidden');
    Game.pause();
    this.storyThen = () => { Game.resume(); if (then) then(); };
  },
  death(text) { $('deathText').textContent = text; $('death').classList.remove('hidden'); },
  undeath() { $('death').classList.add('hidden'); },

  /* ---------- HUD ---------- */
  setBar(id, v, max, numId, txt, lowAt) {
    const k = max > 0 ? clamp(v / max, 0, 1) : 0;
    const f = $(id); f.style.width = (k * 100).toFixed(1) + '%';
    f.classList.toggle('low', lowAt != null && k < lowAt);
    if (numId) $(numId).textContent = txt != null ? txt : Math.round(v);
  },
  hud(dt) {
    this.hudT -= dt;
    if (this.hudT > 0) return;
    this.hudT = 0.1;
    const p = G.player;
    const modeName = p.dead ? '倒れた' : p.mode === 'seat' ? (p.seat.def.seat === 'pilot' ? '操縦中' : '砲手席') : p.mode === 'walk' ? (p.grid && p.grid.kind === 'station' ? 'ステーション' : p.grid && p.grid.kind === 'ruin' ? '古い基地の跡' : '船内') : p.onGround ? '地上' : '船外 (宇宙服)';
    $('modeLabel').textContent = modeName;
    $('toolLabel').textContent = p.mode !== 'seat' && TOOLS[p.tool] ? TOOLS[p.tool].name : '';
    this.setBar('hpFill', p.hp, p.maxhp, 'hpNum', null, 0.3);
    this.setBar('o2Fill', p.o2, TUNE.suitO2, 'o2Num', breathable(p) ? '呼吸できる' : Math.ceil(p.o2) + '秒', 0.25);
    this.setBar('suitFill', p.suit, TUNE.suitPower, 'suitNum', null, 0.2);
    $('credits').textContent = fmt(G.credits);
    const tday = G.dayT / TUNE.dayLength;
    $('dayLabel').textContent = `${G.day}日目 ${String(Math.floor(tday * 24)).padStart(2, '0')}:${String(Math.floor(tday * 24 * 60) % 60).padStart(2, '0')}`;
    const g = playerShip() || (p.grid && p.grid.faction === 'player' ? p.grid : null) || (p.grid && p.grid.kind === 'station' && Game.berthShip()) || null;
    $('shipBox').style.display = g ? '' : 'none';
    if (g) {
      $('shipName').textContent = g.name + (g.dockedTo ? ' (つながっている)' : '');
      const hull = g.count / (g.bestCount || g.count);
      if (!g.bestCount || g.count > g.bestCount) g.bestCount = g.count;
      let hp = 0, mhp = 0; g.eachBlock((b) => { hp += b.hp; mhp += b.def.hp; });
      this.setBar('hullFill', hp * hull, mhp, 'hullNum', Math.round(hp / Math.max(1, mhp) * hull * 100) + '%', 0.35);
      const P = g.power;
      this.setBar('powFill', P.cap ? P.stored : P.ratio, P.cap || 1, 'powNum', `${Math.round(P.gen)}/${Math.round(P.use)}`, 0.15);
      this.setBar('h2Fill', g.h2, g.h2cap || 1, 'h2Num', g.h2cap ? Math.round(g.h2) : 'なし');
      $('shieldRow').style.display = g.shieldMax ? '' : 'none';
      if (g.shieldMax) this.setBar('shFill', g.shield, g.shieldMax, 'shNum', g.shieldDown > 0 ? '停止' : Math.round(g.shield));
      this.setBar('cargoFill', g.invUsed(), g.invCap() || 1, 'cargoNum', `${g.invUsed()}/${g.invCap()}`);
      const sp = Math.hypot(g.vx, g.vy) * 2.5;
      $('speedLabel').textContent = `速度 ${sp.toFixed(0)} m/s` + (g.jump ? `  ジャンプまで ${Math.ceil(g.jump.t)}秒` : '');
      $('assistLabel').textContent = playerShip() === g ? (g.ctrl.assist ? '飛行アシスト オン' : '飛行アシスト オフ') : '';
    }
    const q = Quest.cur();
    $('quest').style.display = q ? '' : 'none';
    if (q) $('questText').textContent = q.text + (q.n > 1 ? ` (${G.questN || 0}/${q.n})` : '');
    $('warn').classList.toggle('hidden', !S.warn && !(S.meteorT > 0) && !(S.stormT > 0));
    if (S.warn) $('warn').textContent = `⚠ ${S.warn.text.split('。')[0]} (${Math.ceil(S.warn.t)}秒)`;
    else if (S.meteorT > 0) $('warn').textContent = '⚠ 隕石雨が通過中';
    else if (S.stormT > 0) $('warn').textContent = '⚠ 太陽嵐: 電子機器がときどき止まる';
    const surf = Planet.surfAt(Render.cam.x, Render.cam.y);
    $('sysLabel').textContent = (surf ? `${surf.name} の地上 (${PLANET_TYPES[surf.type].name})` : `${S.sys.name} 星系 (${RINGS[S.sys.ring].name})`) + (G.creative ? ' / クリエイティブ' : '');
    this.hotbar();
  },
  hotbar() {
    const p = G.player, hb = $('hotbar');
    const key = p.mode + ':' + p.tool + ':' + (playerShip() ? playerShip().id + ':' + (playerShip().target ? playerShip().target.id : '') : '');
    if (this.hbKey === key) return;
    this.hbKey = key;
    hb.innerHTML = '';
    if (p.mode === 'seat') {
      const g = p.grid; g.updateSys();
      const fixed = g.sys.fixed.map((b) => b.def.name), tur = g.sys.turrets.length;
      hb.append(el('div', { class: 'slot' }, el('div', { class: 'k' }, '左クリック'), el('div', { class: 'n' }, fixed.length ? [...new Set(fixed)].join('・') : '撃つ'), el('div', { class: 'd' }, tur ? `砲塔 ${tur}基はマウスを狙う` : '撃つあいだマウスの方を向く')));
      hb.append(el('div', { class: 'slot' }, el('div', { class: 'k' }, '右クリック'), el('div', { class: 'n' }, '目標を指定'), el('div', { class: 'd' }, g.target && !g.target.dead ? g.target.name : 'なし')));
      hb.append(el('div', { class: 'slot' }, el('div', { class: 'k' }, 'W A S D / Q E'), el('div', { class: 'n' }, '推進と回転'), el('div', { class: 'd' }, 'Z 飛行アシスト')));
      hb.append(el('div', { class: 'slot' }, el('div', { class: 'k' }, 'F'), el('div', { class: 'n' }, '席を降りる'), el('div', { class: 'd' }, 'B 建築 / M 地図')));
    } else {
      for (let k = 1; k <= 4; k++) hb.append(el('div', { class: 'slot' + (p.tool === k ? ' on' : ''), onclick: () => { p.tool = k; this.hbKey = null; } },
        el('div', { class: 'k' }, String(k)), el('div', { class: 'n' }, TOOLS[k].name),
        el('div', { class: 'd' }, ['', '小惑星を掘る', 'ブロックを直す', 'ブロックを外す', '乗り込み戦に'][k])));
    }
  },
  prompt(text) {
    const pr = $('prompt');
    if (!text) { pr.classList.add('hidden'); return; }
    pr.classList.remove('hidden');
    if (pr.dataset.t !== text) { pr.dataset.t = text; pr.innerHTML = text; }
  },

  /* ---------- レーダー ---------- */
  minimap() {
    const cv = $('minimap'), c = cv.getContext('2d'), W = cv.width, R = W / 2;
    const cam = Render.cam, range = this.mapRange || 350, k = R / range;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W);
    c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, TAU); c.clip();
    c.translate(R, R); c.rotate(-cam.a); c.scale(k, k); c.translate(-cam.x, -cam.y);
    const nebula = S.layout.nebulae.some((n) => dist(n.x, n.y, cam.x, cam.y) < n.r);
    if (nebula) { c.restore(); c.fillStyle = '#8fa2b8'; c.font = '13px sans-serif'; c.textAlign = 'center'; c.fillText('星雲の中: レーダーが効かない', R, R); return; }
    const surf = Planet.surfAt(cam.x, cam.y);
    if (surf) { c.fillStyle = PLANET_TYPES[surf.type].ground; c.globalAlpha = 0.5; c.beginPath(); c.arc(surf.sx, surf.sy, TUNE.surfaceR, 0, TAU); c.fill(); c.globalAlpha = 1; }
    c.fillStyle = S.star.c; c.beginPath(); c.arc(0, 0, S.star.r, 0, TAU); c.fill();
    for (const P of S.layout.planets) { c.fillStyle = PLANET_TYPES[P.type].tex[1]; c.globalAlpha = 0.55; c.beginPath(); c.arc(P.x, P.y, P.r, 0, TAU); c.fill(); c.globalAlpha = 1; }
    for (const g of S.grids) {
      if (g.dead || dist2(g.x, g.y, cam.x, cam.y) > (range + g.radius) ** 2) continue;
      let col = '#6b5d52';
      if (g.kind === 'station') col = '#8fd3ff';
      else if (g.kind === 'gate') col = '#ffd24a';
      else if (g.faction === 'player') col = g.kind === 'base' ? '#5fd18a' : '#7dff9a';
      else if (g.faction === 'union') col = '#6ab0ff';
      else if (g.derelict) col = '#b0a080';
      else if (g.faction === 'pirate' || g.faction === 'swarm') col = g.disabled ? '#806060' : '#ff5a5a';
      c.fillStyle = col;
      const r = Math.max(g.radius * 0.7, 3 / k);
      c.beginPath(); c.arc(g.x, g.y, r, 0, TAU); c.fill();
      if (g.boss && !g.disabled) { c.strokeStyle = '#ff5a5a'; c.lineWidth = 2 / k; c.beginPath(); c.arc(g.x, g.y, r + 6 / k, 0, TAU); c.stroke(); }
    }
    for (const m of S.markers) { c.fillStyle = '#ffe35a'; c.beginPath(); c.arc(m.x, m.y, 5 / k, 0, TAU); c.fill(); }
    for (const m of G.missions) if (m.pos && m.sys === S.sys.id) { c.strokeStyle = '#ffe35a'; c.lineWidth = 2 / k; c.beginPath(); c.arc(m.pos.x, m.pos.y, 8 / k, 0, TAU); c.stroke(); }
    c.fillStyle = '#ffd24a';
    for (const p of S.pickups) c.fillRect(p.x - 1.5 / k, p.y - 1.5 / k, 3 / k, 3 / k);
    c.restore();
    c.strokeStyle = 'rgba(143,211,255,0.25)'; c.beginPath(); c.arc(R, R, R * 0.5, 0, TAU); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(R, R - 6); c.lineTo(R + 4, R + 4); c.lineTo(R - 4, R + 4); c.closePath(); c.fill();
    c.fillStyle = '#8fa2b8'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText(`${Math.round(range * 2.5 / 1000 * 10) / 10}km`, R, W - 8);
  },

  /* ---------- 建築 ---------- */
  showBuild(on) {
    $('build').classList.toggle('hidden', !on);
    if (on) this.buildPalette();
  },
  blockIcon(def, size = 32) {
    const cv = el('canvas', { width: size, height: size });
    const c = cv.getContext('2d');
    const [w, h] = def.size, s = size / Math.max(w, h, 1);
    c.setTransform(s, 0, 0, s, (size - w * s) / 2, (size - h * s) / 2);
    try { drawBlock(c, initFake(def), { roomAt: () => ({ leak: false, air: 1, size: 1 }) }, s); } catch (e) { /* noop */ }
    return cv;
  },
  buildPalette() {
    const tabs = $('buildTabs'), list = $('buildList');
    tabs.innerHTML = ''; list.innerHTML = '';
    for (const c of BUILD_CATS) tabs.append(el('button', { class: 'tab' + (c === this.buildCat ? ' on' : ''), onclick: () => { this.buildCat = c; this.buildPalette(); } }, CAT[c].name));
    for (const d of BLOCK_LIST) {
      if (d.cat !== this.buildCat || d.noBuild) continue;
      const locked = !G.unlocked[d.id] && !G.creative;
      const item = el('div', { class: 'bitem' + (Build.sel === d.id ? ' on' : '') + (locked ? ' locked' : ''), title: d.desc, onclick: () => { Build.sel = d.id; this.buildPalette(); } },
        this.blockIcon(d), el('div', null, el('div', null, d.star ? el('span', { class: 'star' }, '★') : null, d.name), el('div', { class: 'note' }, locked ? '設計図が要る' : `${d.size[0]}×${d.size[1]}`)));
      list.append(item);
    }
    this.buildInfo();
    $('mirrorState').textContent = Build.mirror ? 'オン' : 'オフ';
  },
  buildInfo() {
    const d = BLOCKS[Build.sel], box = $('buildInfo');
    box.innerHTML = '';
    const have = (k) => { let n = 0; for (const s of Build.sources()) n += Build.count(s, k); return n; };
    const done = have('B:' + d.id);
    box.append(el('div', { class: 'nm' }, d.name), el('div', { class: 'note' }, d.desc));
    if (G.creative) { box.append(el('div', { class: 'ok' }, 'クリエイティブ: 材料なしで、いくつでも置ける')); return; }
    const cost = el('div', null, '材料: ');
    for (const k in d.cost) { const h = have(k); cost.append(el('span', { class: h >= d.cost[k] ? 'ok' : 'ng' }, `${ITEMS[k].name} ${d.cost[k]} (${h}) `)); }
    box.append(cost);
    if (done) box.append(el('div', { class: 'ok' }, `完成品を ${done} 個持っている`));
    if (Build.hover && !Build.hover.ok && Build.hover.why) box.append(el('div', { class: 'ng' }, '置けない: ' + Build.hover.why));
  },
  buildStats() {
    const box = $('buildStats');
    const g = (Build.hover && Build.hover.g) || Build.target;
    if (!g || g.dead || g.terrain) { box.innerHTML = '<div class="note">自分の船か基地の近くで建てる。何もないところに置くと新しい船になる。固定アンカーは大きな小惑星のとなりに打ちこむ。</div>'; return; }
    g.updateSys(); g.updateMass();
    const s = g.sys, P = g.power;
    const fwd = s.thrCap[0] / g.mass, back = s.thrCap[2] / g.mass, side = Math.min(s.thrCap[1], s.thrCap[3]) / g.mass;
    const solar = s.solars.reduce((t, b) => t + b.def.solar, 0) * Ship.solarFactor(g.x, g.y);
    const gen = solar + s.gens.reduce((t, b) => t + b.def.gen, 0) + s.reactors.reduce((t, b) => t + b.def.gen, 0);
    const use = s.gyros.length + s.o2gens.length * 5 + s.shields.length * 15 + s.medbays.length * 3 + s.thr.flat().reduce((t, b) => t + (b.def.pdraw || 0), 0) + s.turrets.filter((b) => WEAPONS[b.def.weapon].power).reduce((t, b) => t + WEAPONS[b.def.weapon].power, 0);
    const crew = G.crew.filter((c) => c.gridId === g.id).length;
    const rows = [
      ['名前', g.name], ['ブロック', g.count], ['重さ', Math.round(g.mass) + ' t'],
      ['前への加速', (fwd * 2.5).toFixed(1) + ' m/s²'], ['止まる力 (後ろ)', (back * 2.5).toFixed(1)], ['横の力', (side * 2.5).toFixed(1)],
      ['回りやすさ', ((v) => v >= 20 ? 'とても軽い' : v >= 5 ? '軽い' : v >= 1.5 ? 'ふつう' : v >= 0.5 ? '重い' : 'とても重い')(s.torque / g.inertia)], ['発電 / 最大消費', `${gen.toFixed(0)} / ${use.toFixed(0)}`], ['バッテリー', P.cap],
      ['貨物', `${g.invUsed()} / ${g.invCap()}`], ['水素タンク', g.h2cap], ['寝台 / 乗員', `${s.beds.length} / ${crew}`], ['部屋', g.rooms.filter((r) => !r.leak).length + ' (漏れ ' + g.rooms.filter((r) => r.leak).length + ')'],
    ];
    box.innerHTML = '';
    for (const [a, b] of rows) box.append(el('div', { class: 'row' }, el('span', null, a), el('b', null, String(b))));
    const warns = [];
    if (!s.pilotSeats.length && g.kind === 'ship') warns.push('操縦席がない');
    if (!s.thrCap[0] && g.kind === 'ship') warns.push('前へ進む推進器がない (後ろ向きに付ける)');
    if (!s.thrCap[2] && g.kind === 'ship') warns.push('止まるための前向きの推進器がない');
    if (gen + P.cap / 30 < use * 0.5) warns.push('発電が足りない (発電ブロックかバッテリーを足す)');
    if (s.o2gens.length && !g.invTotal('ore_ice')) warns.push('酸素発生器に使う氷がない');
    if (s.thr.flat().some((b) => b.def.h2draw) && !s.tanks.length) warns.push('大型推進器には水素タンクが要る');
    for (const w of warns) box.append(el('div', { class: 'warn' }, '⚠ ' + w));
  },

  /* ---------- ステーション ---------- */
  p_station(body, tabs) {
    const t = this.tab || 'market';
    const list = [['market', '市場'], ['parts', '部品屋'], ['bp', '設計図屋'], ['hire', '求人所'], ['mission', '依頼板'], ['med', '医療室'], ['yard', '造船所'], ['repair', '修理ドック']];
    // 窓口まで歩いて開いたときは、その店の画面だけを出す
    if (this.opts.only) $('panelTitle').textContent = `${S.sys.name} ステーション ― ${list.find(([id]) => id === t)[1]}`;
    else { $('panelTitle').textContent = S.sys.name + ' ステーション'; this.tabs(tabs, list, t, (id) => { this.tab = id; this.render(); }); }
    const h = Econ.holder();
    const hname = h.isPerson ? '背負いかばん' : h.name + ' の貨物庫';
    const hfree = h.isPerson ? h.invCap - invUsedP(h) : h.invFree();
    body.append(el('div', { class: 'note', style: 'margin-bottom:8px' }, `売り買いする場所: ${hname} (空き ${hfree})。お金 ${fmt(G.credits)} ₵。評判 ${G.rep}`));
    this['st_' + t](body, h);
  },
  st_market(body, h) {
    const sys = S.sys, dem = Econ.demand(sys);
    const inv = h.isPerson ? Object.assign({}, h.inv) : h.invAll();
    const sellBox = el('div', { class: 'box' }, el('h3', null, '売る'));
    const tb = el('table', { class: 'list' }, el('tr', null, el('th', null, '品物'), el('th', { class: 'r' }, '持っている'), el('th', { class: 'r' }, '値段'), el('th', null, '')));
    const keys = Object.keys(inv).filter((k) => inv[k] > 0 && k !== 'pkg').sort((a, b) => itemDef(b).price - itemDef(a).price);
    let total = 0;
    for (const k of keys) {
      const d = itemDef(k), pr = Econ.sellPrice(sys, k);
      if (d.kind === 'ore' || d.kind === 'mat') total += pr * inv[k];
      tb.append(el('tr', null, el('td', null, el('span', { class: 'dot', style: 'background:' + d.color }), d.name, dem.includes(k) ? el('span', { class: 'pill good' }, '高く買う') : null),
        el('td', { class: 'r' }, inv[k]), el('td', { class: 'r' }, pr + ' ₵'),
        el('td', null, el('button', { class: 'btn sm', onclick: () => { Econ.sell(k, 1); this.render(); } }, '1'), ' ', el('button', { class: 'btn sm', onclick: () => { Econ.sell(k, inv[k]); this.render(); } }, '全部'))));
    }
    if (!keys.length) tb.append(el('tr', null, el('td', { colspan: 4, class: 'note' }, '売れる物がない')));
    sellBox.append(tb);
    if (total > 0) sellBox.append(el('div', { style: 'margin-top:8px' }, el('button', { class: 'btn primary', onclick: () => { for (const k of keys) { const d = itemDef(k); if (d.kind === 'ore' || d.kind === 'mat') Econ.sell(k, inv[k]); } this.render(); } }, `鉱石と素材を全部売る (+${fmt(total)} ₵)`)));
    const buyBox = el('div', { class: 'box' }, el('h3', null, '買う'));
    const tb2 = el('table', { class: 'list' }, el('tr', null, el('th', null, '品物'), el('th', { class: 'r' }, '値段'), el('th', null, '')));
    for (const k of Econ.marketStock(sys)) {
      const d = itemDef(k);
      tb2.append(el('tr', null, el('td', null, el('span', { class: 'dot', style: 'background:' + d.color }), d.name, d.kind === 'part' && !Econ.localPart(sys, k) ? el('span', { class: 'pill' }, '輸入品') : null),
        el('td', { class: 'r' }, Econ.buyPrice(sys, k) + ' ₵'),
        el('td', null, el('button', { class: 'btn sm', onclick: () => { Econ.buy(k, 1); this.render(); } }, '1'), ' ', el('button', { class: 'btn sm', onclick: () => { Econ.buy(k, 10); this.render(); } }, '10'))));
    }
    buyBox.append(tb2);
    if (!h.isPerson && h.h2cap) buyBox.append(el('div', { style: 'margin-top:8px' }, el('button', { class: 'btn', onclick: () => { Econ.refillH2(); this.render(); } }, `水素を満タンにする (${Math.ceil((h.h2cap - h.h2) * 0.5)} ₵)`)));
    body.append(el('div', { class: 'cols' }, sellBox, buyBox));
  },
  st_parts(body) {
    const list = Econ.shopBlocks(S.sys);
    body.append(el('p', { class: 'note' }, '完成品のブロック。材料から作るより5割高いが、精錬機と組立機がなくてもすぐ建てられる。買った物は貨物に入り、建築モードで置ける。'));
    const tb = el('table', { class: 'list' }, el('tr', null, el('th', null, ''), el('th', null, 'ブロック'), el('th', null, '種類'), el('th', { class: 'r' }, '値段'), el('th', null, '')));
    for (const d of list) {
      const id = 'B:' + d.id, pr = Econ.buyPrice(S.sys, id);
      tb.append(el('tr', null, el('td', null, this.blockIcon(d, 24)), el('td', null, d.star ? '★ ' : '', d.name, el('div', { class: 'note' }, d.desc)), el('td', null, CAT[d.cat].name),
        el('td', { class: 'r' }, pr + ' ₵'), el('td', null, el('button', { class: 'btn sm', onclick: () => { Econ.buy(id, 1); this.render(); } }, '1'), ' ', el('button', { class: 'btn sm', onclick: () => { Econ.buy(id, 5); this.render(); } }, '5'))));
    }
    body.append(tb);
  },
  st_bp(body) {
    const list = Econ.bpForSale(S.sys);
    body.append(el('p', { class: 'note' }, `この環 (${RINGS[S.sys.ring].name}) で買える設計図。手に入れたブロックは、どこでも建てられるようになる。内側の環へ行くほど上の段の設計図が売っている。`));
    if (!list.length) body.append(el('p', null, 'ここで買える設計図はもう全部持っている。'));
    const tb = el('table', { class: 'list' }, el('tr', null, el('th', null, ''), el('th', null, '設計図'), el('th', null, '段'), el('th', { class: 'r' }, '値段'), el('th', null, '評判'), el('th', null, '')));
    for (const d of list) {
      const need = REP_NEED[d.tier] || 0;
      tb.append(el('tr', null, el('td', null, this.blockIcon(d, 24)), el('td', null, d.star ? '★ ' : '', d.name, el('div', { class: 'note' }, d.desc)), el('td', null, 'T' + d.tier),
        el('td', { class: 'r' }, fmt(BP_PRICE[d.tier]) + ' ₵'), el('td', null, need ? `${need} 以上` : '-'),
        el('td', null, el('button', { class: 'btn sm', disabled: G.rep < need || G.credits < BP_PRICE[d.tier], onclick: () => { Econ.buyBlueprint(d); this.render(); } }, '買う'))));
    }
    body.append(tb);
  },
  st_hire(body) {
    const grids = S.grids.filter((g) => g.faction === 'player' && !g.terrain && !g.dead && (g.kind === 'ship' || g.kind === 'base') && (G.creative ? Crew.hasFloor(g) : Crew.freeBeds(g) > 0));
    body.append(el('p', { class: 'note' }, G.creative ? `クリエイティブ: 寝台がなくても、お金がなくても雇える。日給もかからない。いまの乗員 ${G.crew.length}人。` : `雇えるのは空いている寝台の数まで。雇うときに1日ぶんの日給を払い、その後も1日ごとに日給がかかる。いまの乗員 ${G.crew.length}人。`));
    if (!grids.length) body.append(el('p', { class: 'warn' }, G.creative ? '乗員が立てる床のある船がない。建築モードで床を置こう。' : '空いている寝台がない。建築モードの「生活」から寝台を置こう。'));
    const sel = el('select', null, ...grids.map((g) => el('option', { value: g.id }, G.creative ? g.name : `${g.name} (空き寝台 ${Crew.freeBeds(g)})`)));
    if (grids.length) body.append(el('div', { style: 'margin-bottom:8px' }, '乗せる船: ', sel));
    for (const c of Crew.candidates(S.sys)) {
      const sk = SKILLS.map((s) => `${s.name} ${Crew.stars(c.skills[s.id])}`);
      const tr = TRAITS.find((t) => t.id === c.trait);
      body.append(el('div', { class: 'crewCard' },
        el('div', null, el('div', { class: 'nm' }, el('span', { class: 'dot', style: 'background:' + c.color }), c.name, el('span', { class: 'pill' }, Crew.title(c))),
          el('div', { class: 'sk', html: sk.map((s) => s.replace(/(★+)/, '<b>$1</b>')).join('<br>') }), el('div', { class: 'note' }, `性格: ${tr.name} (${tr.desc})`)),
        el('div', { style: 'text-align:right' }, el('div', null, G.creative ? '日給なし' : `日給 ${c.wage} ₵`), el('button', { class: 'btn primary', disabled: !grids.length, style: 'margin-top:8px', onclick: () => { const g = S.grids.find((o) => o.id === +sel.value); if (Crew.hire(c, g)) this.render(); } }, '雇う'))));
    }
  },
  st_mission(body) {
    const cur = G.missions;
    const box1 = el('div', { class: 'box' }, el('h3', null, `受けている依頼 (${cur.length}/5)`));
    if (!cur.length) box1.append(el('p', { class: 'note' }, 'まだない'));
    for (const m of cur) {
      const prog = m.type === 'bounty' ? ` (${m.got || 0}/${m.n})` : '';
      const where = m.type === 'transport' ? `届け先: ${G.galaxy.systems[m.to].name}` : m.type === 'escort' && m.active ? '輸送船を守っている' : `${G.galaxy.systems[m.sys].name} の依頼`;
      box1.append(el('div', { style: 'margin-bottom:6px' }, el('div', null, m.text + prog), el('div', { class: 'note' }, `${where} / 報酬 ${fmt(m.reward)} ₵ `, el('button', { class: 'btn sm bad', onclick: () => { G.missions = G.missions.filter((x) => x !== m); if (m.type === 'transport') Econ.hTake(Econ.holder(), 'pkg', m.size); this.render(); } }, 'やめる'))));
    }
    const box2 = el('div', { class: 'box' }, el('h3', null, '新しい依頼'));
    for (const m of Missions.offers(S.sys)) box2.append(el('div', { style: 'margin-bottom:8px' }, el('div', null, m.text), el('div', { class: 'note' }, `報酬 ${fmt(m.reward)} ₵ `, el('button', { class: 'btn sm primary', onclick: () => { Missions.accept(m); this.render(); } }, '受ける'))));
    body.append(el('div', { class: 'cols' }, box1, box2));
  },
  st_med(body) {
    const p = G.player;
    body.append(el('p', null, `体力 ${Math.round(p.hp)} / ${p.maxhp}`));
    body.append(el('button', { class: 'btn primary', onclick: () => { Econ.heal(); this.render(); } }, '治療して、ここを蘇生地点にする (10 ₵)'));
    body.append(el('p', { class: 'note' }, '倒れたときは、最後に登録した医療室で目を覚ます。自分の船の医療室も、その上に立って F で登録できる。'));
  },
  st_yard(body) {
    const ring = S.sys.ring;
    const box = el('div', { class: 'box' }, el('h3', null, '船を買う'));
    for (const k in SHIPS) {
      const t = SHIPS[k];
      if (t.shop == null || t.shop > ring) continue;
      const g = makeShip(k);
      let v = 0; g.eachBlock((b) => { v += costValue(b.def.cost); });
      const price = Math.round(v * TUNE.markup);
      box.append(el('div', { style: 'margin-bottom:8px' }, el('b', null, t.name), el('span', { class: 'note' }, ` ${g.count} ブロック / ${Math.round(g.mass)} t `), el('button', { class: 'btn sm primary', onclick: () => { if (Econ.spend(price)) { Yard.deliver(makeShip(k)); this.render(); } } }, `${fmt(price)} ₵ で買う`)));
    }
    const box2 = el('div', { class: 'box' }, el('h3', null, '設計図から造る'));
    if (!G.blueprints.length) box2.append(el('p', { class: 'note' }, '設計図がまだない。自分の船を P の設計図画面で保存しよう。'));
    for (const bp of G.blueprints) {
      const locked = !G.creative && bp.blocks.some(([id]) => !G.unlocked[id]);
      const price = G.creative ? 0 : Math.round(costValue(blueprintCost(bp)) * TUNE.markup);
      box2.append(el('div', { style: 'margin-bottom:8px' }, el('b', null, bp.name), el('span', { class: 'note' }, ` ${bp.blocks.length} ブロック `),
        el('button', { class: 'btn sm primary', disabled: locked, onclick: () => { if (!price || Econ.spend(price)) { Yard.deliver(gridFromBlueprint(bp)); this.render(); } } }, price ? `${fmt(price)} ₵ で造る` : '無料で造る'), locked ? el('span', { class: 'note' }, ' 持っていない設計図のブロックがある') : null));
    }
    const box3 = el('div', { class: 'box' }, el('h3', null, '採掘艇を借りる'));
    const canLoan = !Fleet.ownsShip() && G.credits < 300 && !G.loanOut;
    box3.append(el('p', { class: 'note' }, '持ち船が1隻もなく、お金も足りないときは、最初と同じ採掘艇を1隻だけ無料で借りられる。売ったり解体したりはできず、乗り捨てると返したことになる。'));
    box3.append(el('button', { class: 'btn', disabled: !canLoan, onclick: () => { Yard.loan(); this.render(); } }, '借りる'));
    body.append(el('div', { class: 'cols' }, el('div', null, box, box3), box2));
  },
  st_repair(body) {
    const g = Econ.dockShip;
    if (!g || g.dead) { body.append(el('p', null, '船で入港すると、ここで修理できる。')); return; }
    const c = Econ.repairCost(g);
    body.append(el('p', null, `${g.name}: 直すのにかかるお金 ${fmt(c)} ₵`));
    body.append(el('button', { class: 'btn primary', disabled: c <= 0, onclick: () => { Econ.repairAll(g); this.render(); } }, '全部直す'));
    if (g.h2cap) body.append(' ', el('button', { class: 'btn', onclick: () => { Econ.refillH2(); this.render(); } }, `水素を満タンにする (${Math.ceil((g.h2cap - g.h2) * 0.5)} ₵)`));
    if (g.plan && g.plan.length) {
      const pc = Math.round(g.plan.reduce((t, [id]) => t + costValue(BLOCKS[id].cost), 0) * TUNE.markup);
      body.append(el('p', null, `壊れて無くなったブロック (予定図) ${g.plan.length} 個を建て直す: ${fmt(pc)} ₵ `, el('button', { class: 'btn', onclick: () => { if (Econ.spend(pc)) { for (const [id, x, y, r] of g.plan.slice()) { if (g.canPlace(BLOCKS[id], x, y, r)) g.addBlock(id, x, y, r); } g.plan = null; g.updateMass(); Toast.show('建て直した', 'good'); this.render(); } } }, '建て直す')));
    }
    body.append(el('p', { class: 'note' }, '壊れて無くなったブロックは予定図として薄く残る。技師の乗員か溶接機 (2) で、材料を使って建て直せる。'));
  },

  /* ---------- 持ち物と貨物 ---------- */
  p_inv(body, tabs) {
    $('panelTitle').textContent = '持ち物と貨物';
    const p = G.player;
    const g = this.opts.grid || playerShip() || (p.grid && p.grid.faction === 'player' ? p.grid : null) || nearestGridTo(personWorld(p).x, personWorld(p).y, 12, (o) => o.faction === 'player' && !o.terrain);
    const itemRows = (inv, move, moveLabel) => {
      const tb = el('table', { class: 'list' });
      const keys = Object.keys(inv).filter((k) => inv[k] > 0).sort((a, b) => itemDef(a).kind.localeCompare(itemDef(b).kind));
      for (const k of keys) { const d = itemDef(k); tb.append(el('tr', null, el('td', null, el('span', { class: 'dot', style: 'background:' + d.color }), d.name), el('td', { class: 'r' }, inv[k]), el('td', null, move ? el('button', { class: 'btn sm', onclick: () => { move(k, inv[k]); this.render(); } }, moveLabel) : ''))); }
      if (!keys.length) tb.append(el('tr', null, el('td', { class: 'note' }, 'からっぽ')));
      return tb;
    };
    const left = el('div', { class: 'box' }, el('h3', null, `背負いかばん (${invUsedP(p)}/${p.invCap})`));
    left.append(itemRows(p.inv, g ? (k, n) => { const got = invTakeP(p, k, n); const rest = g.invAdd(k, got); if (rest) invAddP(p, k, rest); } : null, '船へ →'));
    const right = el('div', { class: 'box' });
    if (g) {
      right.append(el('h3', null, `${g.name} の貨物 (${g.invUsed()}/${g.invCap()})`));
      right.append(itemRows(g.invAll(), (k, n) => { const got = g.invTake(k, n); const rest = invAddP(p, k, got); if (rest) g.invAdd(k, rest); }, '← かばんへ'));
      // つながっている船
      const linked = S.grids.filter((o) => o !== g && !o.dead && (o.dockedTo === g || g.dockedTo === o));
      for (const o of linked) right.append(el('div', { style: 'margin-top:6px' }, el('button', { class: 'btn sm', onclick: () => { const inv = o.invAll(); for (const k in inv) { const n = o.invTake(k, inv[k]); const r = g.invAdd(k, n); if (r) o.invAdd(k, r); } this.render(); } }, `${o.name} の積み荷を全部こちらへ`)));
      g.updateSys();
      if (g.sys.refineries.length || g.sys.assemblers.length) {
        const prod = el('div', { class: 'box', style: 'margin-top:10px' }, el('h3', null, '生産'));
        if (g.sys.refineries.length) prod.append(el('label', null, el('input', { type: 'checkbox', checked: !g.refineOff || null, onchange: (e) => { g.refineOff = !e.target.checked; } }), ` 精錬機 ${g.sys.refineries.length}台で鉱石を自動で素材にする`));
        if (g.sys.assemblers.length) {
          prod.append(el('div', { class: 'note', style: 'margin:6px 0' }, `組立機 ${g.sys.assemblers.length}台。作りたい物の数を足すと、材料があるぶん順に作る。`));
          const tb = el('table', { class: 'list' });
          ASSEMBLE.forEach((r, idx) => {
            const q = (g.asmQueue || []).find((e) => e.r === idx);
            const ins = Object.keys(r.in).map((k) => `${ITEMS[k].name}${r.in[k]}`).join('+');
            tb.append(el('tr', null, el('td', null, itemDef(r.out).name), el('td', { class: 'note' }, ins), el('td', { class: 'r' }, q ? q.n : 0),
              el('td', null, el('button', { class: 'btn sm', onclick: () => { g.asmQueue = g.asmQueue || []; const e = g.asmQueue.find((x) => x.r === idx); if (e) e.n += 10; else g.asmQueue.push({ r: idx, n: 10 }); this.render(); } }, '+10'),
                ' ', el('button', { class: 'btn sm', onclick: () => { g.asmQueue = (g.asmQueue || []).filter((x) => x.r !== idx); this.render(); } }, '0'))));
          });
          prod.append(tb);
        }
        right.append(prod);
      }
    } else right.append(el('h3', null, '近くに自分の船がない'), el('p', { class: 'note' }, '船の近く (12マス以内) か船の中で開くと、背負いかばんと貨物の間で物を動かせる。'));
    body.append(el('div', { class: 'cols' }, left, right));
  },

  /* ---------- 乗員 ---------- */
  p_crew(body) {
    $('panelTitle').textContent = `乗員 (${G.crew.length}人)`;
    const wages = G.crew.reduce((t, c) => t + c.wage, 0);
    if (G.creative) {
      const add = el('div', { class: 'box', style: 'margin-bottom:10px' }, el('h3', null, '乗員を足す (クリエイティブ)'),
        el('p', { class: 'note' }, 'いつでも、どこでも、無料で1人ずつ足せる。寝台もいらない。乗るのは今いる船か近くの持ち船で、乗員が立てる床のある船。日給はかからない。'));
      const btns = el('div', { style: 'display:flex; flex-wrap:wrap; gap:6px' });
      for (const r of ['pilot', 'gunner', 'engineer', 'miner', 'doctor']) btns.append(el('button', { class: 'btn', onclick: () => { if (Crew.addCreative(r)) this.render(); } }, `${ROLES[r].name}を足す`));
      add.append(btns);
      body.append(add);
    } else body.append(el('p', { class: 'note' }, `1日の日給の合計 ${fmt(wages)} ₵ (のんびりでは半額)。給料が払えないとやる気が下がり、0 になると次に寄ったステーションで辞める。`));
    if (!G.crew.length) body.append(el('p', null, G.creative ? 'まだ誰もいない。上のボタンで足せる。' : 'まだ誰もいない。ステーションの求人所で雇える (寝台が要る)。'));
    for (const c of G.crew) {
      const g = S.grids.find((o) => o.id === c.gridId);
      const where = c.inPod ? '脱出ポッド' : c.sysId !== S.sys.id ? `${G.galaxy.systems[c.sysId].name} 星系` : g ? g.name : '船外';
      const sk = SKILLS.map((s) => `${s.name} <b>${Crew.stars(c.skills[s.id])}</b>`).join('　');
      const role = el('select', { onchange: (e) => { c.role = e.target.value; c.jobKey = null; if (c.seat) standUp(c); } }, ...Object.keys(ROLES).map((r) => el('option', { value: r, selected: c.role === r || null }, ROLES[r].name)));
      const ships = S.grids.filter((o) => o.faction === 'player' && !o.terrain && !o.dead && (o.kind === 'ship' || o.kind === 'base') && ((G.creative ? Crew.hasFloor(o) : Crew.freeBeds(o) > 0) || o.id === c.gridId));
      const shipSel = el('select', { onchange: (e) => { const o = S.grids.find((x) => x.id === +e.target.value); if (o && o.id !== c.gridId) { Crew.board(c, o); } } }, ...ships.map((o) => el('option', { value: o.id, selected: o.id === c.gridId || null }, o.name)));
      body.append(el('div', { class: 'crewCard' },
        el('div', null, el('div', { class: 'nm' }, el('span', { class: 'dot', style: 'background:' + c.color }), c.name, el('span', { class: 'pill' }, ROLES[c.role].name), c.quitting ? el('span', { class: 'pill bad' }, '辞めるつもり') : null),
          el('div', { class: 'sk', html: sk }), el('div', { class: 'note' }, `いる場所: ${where} / 体力 ${Math.round(c.hp)} / やる気 ${Math.round(c.morale)} / ${G.creative ? '日給なし' : `日給 ${c.wage} ₵`} / ${TRAITS.find((t) => t.id === c.trait).name}`)),
        el('div', { style: 'text-align:right; display:flex; flex-direction:column; gap:6px' }, el('div', null, '持ち場 ', role), c.sysId === S.sys.id && ships.length ? el('div', null, '船 ', shipSel) : null,
          el('button', { class: 'btn sm bad', onclick: () => this.confirm(`${c.name} に辞めてもらう？`, () => { Crew.fire(c); this.render(); }) }, '辞めてもらう'))));
    }
  },

  /* ---------- 艦隊 ---------- */
  p_fleet(body) {
    const all = Fleet.all();
    $('panelTitle').textContent = `持ち船と基地 (${all.length})`;
    body.append(el('p', { class: 'note' }, '持ち船を動かすには、操縦士の乗員か AI コアが要る。命令は同じ星系にいる船にだけ出せる。「ついてこい」の船は、ゲートやジャンプで一緒に移る。'));
    for (const e of all) {
      const g = e.g;
      const name = g ? g.name : e.o.name;
      const row = el('div', { class: 'crewCard' });
      const info = el('div', null, el('div', { class: 'nm' }, name, el('span', { class: 'pill' }, e.kind === 'base' ? '基地' : '船'), g && g.loan ? el('span', { class: 'pill' }, '借り物') : null, g && g.abandoned ? el('span', { class: 'pill bad' }, '乗り捨て') : null));
      if (!e.here) { info.append(el('div', { class: 'note' }, `${G.galaxy.systems[e.sys].name} 星系にある`)); row.append(info, el('div')); body.append(row); continue; }
      g.updateSys();
      const pilot = g.crewPilot ? `操縦士 ${g.crewPilot.name}` : g.sys.aicore ? 'AIコア' : g === playerShip() ? 'あなた' : '操縦する人がいない';
      let hp = 0, mhp = 0; g.eachBlock((b) => { hp += b.hp; mhp += b.def.hp; });
      info.append(el('div', { class: 'note' }, `${g.count} ブロック / 耐久 ${Math.round(hp / Math.max(1, mhp) * 100)}% / ${pilot} / 命令: ${g.order ? ORDERS[g.order.type] : 'なし'} / 距離 ${Math.round(dist(g.x, g.y, Render.cam.x, Render.cam.y) * 2.5)} m`));
      const btns = el('div', { style: 'display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-end; max-width:420px' });
      if (e.kind === 'ship' && g !== playerShip()) {
        for (const o of Object.keys(ORDERS)) btns.append(el('button', { class: 'btn sm', onclick: () => { this.orderShip(g, o); } }, ORDERS[o]));
        const pl = G.player;
        const remote = (playerShip() || (pl.grid && pl.grid.faction === 'player' ? pl.grid : null));
        if (remote && remote.sys && remote.sys.remotes.length && g.sys.pilotSeats.length) btns.append(el('button', { class: 'btn sm primary', onclick: () => { this.close(); Game.remoteTo(g); } }, '乗り移る'));
        if (g.dockedTo) btns.append(el('button', { class: 'btn sm', onclick: () => { Fleet.undock(g, true); this.render(); } }, '発進'));
      }
      if (e.kind === 'ship') {
        btns.append(el('button', { class: 'btn sm', onclick: () => { const n = prompt('新しい名前', g.name); if (n) { g.name = n.slice(0, 24); this.render(); } } }, '名前'));
        btns.append(el('button', { class: 'btn sm', onclick: () => { Blueprints.save(g); } }, '設計図に保存'));
        btns.append(el('button', { class: 'btn sm bad', onclick: () => this.abandonMenu(g) }, '捨てる'));
      }
      row.append(info, btns);
      body.append(row);
    }
  },
  orderShip(g, type) {
    if (type === 'attack') {
      const t = playerShip() && playerShip().target && !playerShip().target.dead ? playerShip().target : null;
      Fleet.setOrder(g, 'attack', { targetId: t ? t.id : null });
    } else if (type === 'guard') {
      const t = playerShip() || S.grids.find((o) => o.kind === 'base' && o.faction === 'player');
      Fleet.setOrder(g, 'guard', { targetId: t ? t.id : null });
    } else if (type === 'mine') {
      // 母港と小惑星は、同じ場所 (宇宙か、同じ惑星の地上か) から選ぶ
      const same = (o) => Planet.zone(o.x, o.y) === Planet.zone(g.x, g.y);
      const home = S.grids.find((o) => o.kind === 'base' && o.faction === 'player' && !o.dead && same(o)) || (playerShip() && same(playerShip()) ? playerShip() : null);
      const near = S.asteroids.filter(same).sort((a, b) => dist2(a.x, a.y, g.x, g.y) - dist2(b.x, b.y, g.x, g.y))[0];
      Fleet.setOrder(g, 'mine', { x: near ? near.x : g.x, y: near ? near.y : g.y, homeId: home && home !== g ? home.id : null });
    } else if (type === 'return') {
      const same = (o) => Planet.zone(o.x, o.y) === Planet.zone(g.x, g.y);
      const home = S.grids.filter((o) => o.faction === 'player' && o !== g && !o.dead && !o.terrain && (o.kind === 'base' || (o.sys && o.sys.hangars)) && same(o)).sort((a, b) => dist2(a.x, a.y, g.x, g.y) - dist2(b.x, b.y, g.x, g.y))[0] || (playerShip() && same(playerShip()) ? playerShip() : null);
      Fleet.setOrder(g, 'return', { targetId: home ? home.id : null });
    } else Fleet.setOrder(g, type);
    this.render();
  },
  abandonMenu(g) {
    this.close();
    this.choice(`${g.name} をどうする？<br><span class="note">乗り捨てる: その場に残る (海賊に奪われることがある)。解体: ステーションか基地のそばで材料の8割が戻る。自爆: 10秒後に爆発する。</span>`, [
      ['乗り捨てる', () => Fleet.abandon(g, 'leave')], ['解体する', () => Fleet.abandon(g, 'scrap')], ['自爆する', () => Fleet.abandon(g, 'boom'), 'bad'], ['やめる', null],
    ]);
  },
  /* いくつかのボタンから選ぶ画面 (Esc で閉じる) */
  choice(html, buttons) {
    this.closeChoice();
    const box = el('div', { id: 'choice' }, el('div', { class: 'cbox' }, el('p', { html }),
      el('div', { class: 'cbtns' }, ...buttons.map(([label, fn, cls]) => el('button', { class: 'btn ' + (cls || ''), onclick: () => { this.closeChoice(); if (fn) fn(); } }, label)))));
    document.body.append(box);
    this.choiceOpen = true;
    Game.pause();
  },
  closeChoice() { const c = $('choice'); if (c) c.remove(); if (this.choiceOpen) { this.choiceOpen = false; Game.resume(); } },

  /* ---------- 地図 ---------- */
  p_map(body, tabs) {
    const t = this.tab || 'galaxy';
    const jumpMode = this.opts.jump;
    $('panelTitle').textContent = jumpMode ? 'ジャンプ先を選ぶ' : '地図';
    if (!jumpMode) this.tabs(tabs, [['galaxy', '銀河'], ['system', 'この星系']], t, (id) => { this.tab = id; this.render(); });
    const wrap = el('div', { class: 'mapWrap' });
    const cv = el('canvas', { id: 'mapCanvas' });
    const side = el('div', { class: 'box', style: 'overflow-y:auto' });
    wrap.append(el('div', null, cv), side);
    body.append(wrap);
    requestAnimationFrame(() => {
      const r = cv.getBoundingClientRect();
      cv.width = r.width; cv.height = r.height;
      if (t === 'galaxy' || jumpMode) this.drawGalaxy(cv, side, jumpMode); else this.drawSystem(cv, side);
    });
  },
  drawGalaxy(cv, side, jumpMode) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, R = Math.min(W, H) / 2 - 30;
    const X = (s) => W / 2 + s.mx * R, Y = (s) => H / 2 + s.my * R;
    const sys = G.galaxy.systems;
    const cur = S.sys;
    const reach = new Set(cur.lanes.map((l) => l.to));
    const draw = (hover) => {
      c.clearRect(0, 0, W, H);
      const gr = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 1.1);
      gr.addColorStop(0, 'rgba(154,107,255,0.35)'); gr.addColorStop(0.3, 'rgba(90,58,168,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      RINGS.forEach((rg) => { c.strokeStyle = 'rgba(143,211,255,0.08)'; c.beginPath(); c.arc(W / 2, H / 2, rg.r * R, 0, TAU); c.stroke(); });
      for (const l of G.galaxy.lanes) {
        const a = sys[l.a], b = sys[l.b];
        c.strokeStyle = l.gate ? 'rgba(255,210,74,0.5)' : 'rgba(143,211,255,0.25)'; c.setLineDash(l.gate ? [] : [4, 4]); c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(X(a), Y(a)); c.lineTo(X(b), Y(b)); c.stroke();
      }
      c.setLineDash([]);
      const fleetAt = new Set(Fleet.all().map((e) => e.sys));
      for (const s of sys) {
        const x = X(s), y = Y(s);
        const vis = G.visited[s.id];
        c.fillStyle = s.id === cur.id ? '#fff' : vis ? s.star.c : '#556';
        const rad = s.id === cur.id ? 8 : 5.5;
        c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
        if (jumpMode && reach.has(s.id)) { c.strokeStyle = '#7dff9a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.stroke(); }
        if (hover === s) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 13, 0, TAU); c.stroke(); }
        if (G.galaxy.bossSys[s.ring] === s.id && !G.bossDead[s.ring]) { c.fillStyle = '#ff5a5a'; c.font = 'bold 12px sans-serif'; c.fillText('☠', x + 7, y - 6); }
        if (fleetAt.has(s.id)) { c.fillStyle = '#7dff9a'; c.fillRect(x - 10, y + 7, 4, 4); }
        c.fillStyle = vis ? '#dfe8f4' : '#7a8698'; c.font = '11px sans-serif'; c.textAlign = 'center';
        c.fillText(s.name + (s.station && vis ? ' ⌂' : ''), x, y + 20);
      }
    };
    const info = (s) => {
      side.innerHTML = '';
      if (!s) { side.append(el('h3', null, '銀河'), el('p', { class: 'note' }, '外縁 → 中域 → 内域 → 中心核。内側ほど敵が強く、珍しい鉱石が取れる。金色の線は交易ゲート (通行料)、点線はジャンプドライブが要る航路。☠ はボスのいる星系。⌂ はステーション。緑の四角は持ち船のいる星系。'), el('p', null, `いまいる: ${cur.name} (${RINGS[cur.ring].name})`)); return; }
      const pl = G.visited[s.id] ? systemLayout(s, G.galaxy).planets : null;
      side.append(el('h3', null, s.name), el('p', null, `${RINGS[s.ring].name}${s.station ? ' / ステーションあり' : ''}${s.hideout && G.visited[s.id] ? ' / 海賊の隠れ家' : ''}`), el('p', { class: 'note' }, '取れる鉱石: ' + RINGS[s.ring].ores.map((o) => ITEMS[o].name).join('、')));
      if (pl) side.append(el('p', { class: 'note' }, '惑星: ' + pl.map((P) => `${P.name} (${PLANET_TYPES[P.type].name})`).join('、')));
      if (G.galaxy.bossSys[s.ring] === s.id) side.append(el('p', { class: G.bossDead[s.ring] ? 'note' : 'warn' }, BOSSES[s.ring].name + (G.bossDead[s.ring] ? ' (倒した)' : ' がいる')));
      const lane = cur.lanes.find((l) => l.to === s.id);
      if (jumpMode && lane) side.append(el('button', { class: 'btn primary', onclick: () => { this.close(); Fleet.startJump(s.id); } }, 'ここへジャンプ'));
      else if (lane) side.append(el('p', { class: 'note' }, lane.gate ? '交易ゲートで行ける (ゲートのそばで G)' : 'ジャンプドライブで行ける (操縦中に J)'));
    };
    const pick = (e) => { const r = cv.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; let best = null, bd = 400; for (const s of sys) { const d = dist2(X(s), Y(s), mx, my); if (d < bd) { bd = d; best = s; } } return best; };
    cv.onmousemove = (e) => { const s = pick(e); draw(s); };
    cv.onclick = (e) => { const s = pick(e); info(s); draw(s); };
    draw(null); info(jumpMode ? null : cur);
    if (jumpMode) { side.innerHTML = ''; side.append(el('h3', null, 'ジャンプ先'), el('p', { class: 'note' }, '緑の丸がついた星系へ跳べる。30秒充電してから跳ぶ。'), ...cur.lanes.map((l) => el('div', { style: 'margin:6px 0' }, el('button', { class: 'btn', onclick: () => { this.close(); Fleet.startJump(l.to); } }, sys[l.to].name + ` (${RINGS[sys[l.to].ring].name})`)))); }
  },
  drawSystem(cv, side) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, R = Math.min(W, H) / 2 - 16, k = R / TUNE.sectorRadius;
    const P = (x, y) => [W / 2 + x * k, H / 2 + y * k];
    c.fillStyle = 'rgba(143,211,255,0.06)'; c.beginPath(); c.arc(W / 2, H / 2, R, 0, TAU); c.fill();
    for (const n of S.layout.nebulae) { const [x, y] = P(n.x, n.y); c.fillStyle = n.c + '33'; c.beginPath(); c.arc(x, y, n.r * k, 0, TAU); c.fill(); }
    const [sx, sy] = P(0, 0); c.fillStyle = S.star.c; c.beginPath(); c.arc(sx, sy, Math.max(5, S.star.r * k * 2), 0, TAU); c.fill();
    for (const pl of S.layout.planets) {
      const [x, y] = P(pl.x, pl.y);
      c.fillStyle = PLANET_TYPES[pl.type].tex[1]; c.beginPath(); c.arc(x, y, Math.max(6, pl.r * k), 0, TAU); c.fill();
      c.fillStyle = '#dfe8f4'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillText(`${pl.name} (${PLANET_TYPES[pl.type].name})`, x, y + Math.max(6, pl.r * k) + 13);
    }
    for (const g of S.grids) {
      if (g.dead || Planet.surfAt(g.x, g.y)) continue;
      const [x, y] = P(g.x, g.y);
      let col = null, r = 2, label = null;
      if (g.terrain) { col = g.static ? '#8a7a6a' : '#5a4e44'; r = g.static ? 3 : 1.5; }
      else if (g.kind === 'station') { col = '#8fd3ff'; r = 6; label = null; c.fillStyle = '#8fd3ff'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('ステーション', x, y + 20); }
      else if (g.kind === 'gate') { col = '#ffd24a'; r = 5; label = 'ゲート → ' + G.galaxy.systems[g.gateTo].name; }
      else if (g.faction === 'player') { col = '#7dff9a'; r = 4; label = g === playerShip() ? 'あなた' : g.kind === 'base' ? g.name : null; }
      else if (g.boss) { col = '#ff5a5a'; r = 6; label = g.name; }
      else if (g.hideout) { col = '#ff8a5a'; r = 5; label = '海賊の隠れ家'; }
      else if (g.derelict) { col = '#b0a080'; r = 3; label = '漂流船'; }
      else if (g.faction === 'union') { col = '#6ab0ff'; r = 3; }
      else if (hostile('player', g.faction)) { col = '#ff5a5a'; r = 3; }
      if (!col) continue;
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (label) { c.fillStyle = '#dfe8f4'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillText(label, x, y - r - 4); }
    }
    for (const m of S.markers) { const [x, y] = P(m.x, m.y); c.strokeStyle = '#ffe35a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.stroke(); c.fillStyle = '#ffe35a'; c.fillText('救難信号', x, y - 10); }
    for (const m of G.missions) if (m.pos && m.sys === S.sys.id && !m.rescued) { const [x, y] = P(m.pos.x, m.pos.y); c.strokeStyle = '#ffe35a'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke(); c.fillStyle = '#ffe35a'; c.fillText('依頼', x, y - 12); }
    // 地上にいるときは、その惑星の場所に印を出す
    const w = personWorld(G.player), on = Planet.surfAt(w.x, w.y); const [px, py] = on ? P(on.x, on.y) : P(w.x, w.y);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 8, 0, TAU); c.stroke();
    side.innerHTML = '';
    side.append(el('h3', null, S.sys.name + ' 星系'), el('p', { class: 'note' }, `半径 ${Math.round(TUNE.sectorRadius * 2.5 / 1000 * 10) / 10}km。恒星に近いほど太陽電池がよく発電するが、近すぎると熱で船が傷む。`),
      el('p', { class: 'note' }, '茶色: 小惑星 / 水色: ステーション / 金色: ゲート / 緑: 持ち船 / 赤: 敵 / 黄: 救難信号と依頼'),
      el('p', { class: 'note' }, '大きな丸は惑星。船で惑星の真上まで行き、止まって G を押すと地上に降りられる。地上で G を押すと宇宙へ戻る。'));
  },

  /* ---------- 設計図 ---------- */
  p_bp(body) {
    $('panelTitle').textContent = '設計図';
    const pl = G.player;
    const g = playerShip() || (pl.grid && pl.grid.faction === 'player' ? pl.grid : null);
    const top = el('div', { class: 'box' }, el('h3', null, 'いまの船'));
    if (g) {
      const nm = el('input', { type: 'text', value: g.name, maxlength: 24 });
      top.append(el('div', null, '名前 ', nm, ' ', el('button', { class: 'btn primary', onclick: () => { Blueprints.save(g, nm.value || g.name); this.render(); } }, '設計図に保存')));
      if (g.plan && g.plan.length) top.append(el('p', null, `予定図が重なっている (残り ${g.plan.length} ブロック) `, el('button', { class: 'btn sm', onclick: () => { g.plan = null; this.render(); } }, '予定図を消す')));
    } else top.append(el('p', { class: 'note' }, '自分の船に乗っているか、船の中にいるときに保存できる。'));
    const list = el('div', { class: 'box' }, el('h3', null, `持っている設計図 (${G.blueprints.length})`));
    G.blueprints.forEach((bp, idx) => {
      const cost = blueprintCost(bp);
      list.append(el('div', { style: 'margin-bottom:8px' }, el('b', null, bp.name), el('span', { class: 'note' }, ` ${bp.blocks.length} ブロック / 材料の値打ち ${fmt(costValue(cost))} ₵ `),
        g ? el('button', { class: 'btn sm', onclick: () => { Blueprints.overlay(g, bp); this.close(); } }, '予定図として重ねる') : null, ' ',
        el('button', { class: 'btn sm', onclick: () => { const ta = el('textarea', { readonly: true }, blueprintCode(bp)); list.append(ta); ta.select(); } }, '文字列で書き出す'), ' ',
        el('button', { class: 'btn sm bad', onclick: () => { G.blueprints.splice(idx, 1); this.render(); } }, '消す')));
    });
    const imp = el('div', { class: 'box' }, el('h3', null, '文字列から読み込む'));
    const ta = el('textarea', { placeholder: 'OA1: で始まる文字列を貼りつける' });
    imp.append(ta, el('button', { class: 'btn', style: 'margin-top:6px', onclick: () => { const bp = blueprintFromCode(ta.value); if (!bp) { Toast.show('読めない文字列だった', 'bad'); return; } G.blueprints.push(bp); Toast.show(`設計図「${bp.name}」を読み込んだ`, 'good'); this.render(); } }, '読み込む'));
    body.append(el('div', { class: 'cols' }, el('div', null, top, imp), list));
  },

  /* ---------- メニュー ---------- */
  p_menu(body) {
    $('panelTitle').textContent = 'メニュー';
    const box = el('div', { class: 'box' });
    box.append(
      el('button', { class: 'btn primary', onclick: () => { if (Save.write()) Toast.show('セーブした', 'good'); } }, 'セーブする'), ' ',
      el('button', { class: 'btn', onclick: () => Save.exportFile() }, 'ファイルに書き出す'), ' ',
      el('button', { class: 'btn', onclick: () => { $('fileIn').click(); } }, 'ファイルから読み込む'),
    );
    const opts = el('div', { class: 'box', style: 'margin-top:10px' }, el('h3', null, '設定'));
    opts.append(el('label', null, el('input', { type: 'checkbox', checked: G.opt.rotate || null, onchange: (e) => { G.opt.rotate = e.target.checked; } }), ' 画面を船の向きに合わせて回す'), el('br'),
      el('label', null, el('input', { type: 'checkbox', checked: !Sfx.muted || null, onchange: (e) => { Sfx.muted = !e.target.checked; G.opt.mute = Sfx.muted; } }), ' 効果音'), el('br'),
      el('label', null, el('input', { type: 'checkbox', checked: G.creative || null, onchange: (e) => { G.creative = e.target.checked; Toast.show(G.creative ? 'クリエイティブ オン: ブロックは材料なしで置け、乗員は C の画面でいつでも足せる' : 'クリエイティブ オフ', 'good'); } }), ' クリエイティブ (ブロックが使い放題、乗員をいつでも足せる)'));
    const help = el('div', { class: 'box', style: 'margin-top:10px' }, el('h3', null, '困ったとき'));
    help.append(el('p', { class: 'note' }, '燃料や電気が尽きて動けないときは、救難信号を出す。お金がなくても呼べて、少しすると曳航船が最寄りのステーションまで運んでくれる (サバイバルでは所持金の2割)。'),
      el('button', { class: 'btn', onclick: () => { this.close(); Game.callTow(); } }, '救難信号を出す'), ' ',
      el('button', { class: 'btn', onclick: () => { this.open('help'); } }, '遊びかた'), ' ',
      el('button', { class: 'btn', onclick: () => { Quest.skip(); this.render(); } }, 'いまの目標を飛ばす'));
    const quit = el('div', { class: 'box', style: 'margin-top:10px' }, el('button', { class: 'btn bad', onclick: () => { Save.write(); location.reload(); } }, 'セーブしてタイトルへ'));
    body.append(box, opts, help, quit);
  },
  p_help(body) {
    $('panelTitle').textContent = '遊びかた';
    const rows = [
      ['W A S D', '歩く / ジェットパック / 船の推進 (前後と左右)'], ['Q / E', '船を左右に回す'], ['マウス', '狙う。砲塔はマウスの方を向く'], ['左クリック', '撃つ・採掘レーザー / 道具を使う'],
      ['右クリック', '敵の船を目標にする'], ['F', '乗る・降りる・調べる・店に入る'], ['G', '入港・ゲート・ドッキング・着艦と発進・惑星に降りる/宇宙へ上がる'], ['Space', 'ジェットパックでブレーキ'],
      ['Z', '飛行アシスト (手を離すと自動で止まる)'], ['1〜4', '道具: ドリル・溶接機・解体機・銃'], ['B', '建築モード (R 回す / X 左右対称)'], ['Tab', '持ち物と貨物・生産'],
      ['C / V / M / P', '乗員 / 艦隊 / 地図 / 設計図'], ['J', 'ジャンプ (ジャンプドライブがあるとき)'], ['ホイール', '拡大と縮小'], ['Esc', 'メニュー・画面を閉じる'],
    ];
    const dl = el('dl', { class: 'helpgrid' });
    for (const [a, b] of rows) dl.append(el('dt', null, a), el('dd', null, b));
    body.append(el('div', { class: 'cols' }, el('div', { class: 'box' }, el('h3', null, '操作'), dl), el('div', { class: 'box' }, el('h3', null, 'こつ'),
      el('p', { class: 'note' }, '推進器は向いた方と逆へ船を押す。前へ進むには後ろ向き、止まるには前向き、横に動くには横向きの推進器がいる。重心からずれた推進器は船を回すので、左右の釣り合いを考えて付けよう。'),
      el('p', { class: 'note' }, '床を壁・ガラス・ドアで囲むと部屋になり、酸素発生器が氷から空気を作る。壁が壊れると空気が抜ける。船外に出るときはエアロックを通ると空気が逃げない。'),
      el('p', { class: 'note' }, '宇宙服の酸素は3分。スーツ電力はジェットパックと道具で減る。操縦席と充電台で満たせる。'),
      el('p', { class: 'note' }, '実弾はバリアに弱く装甲に強い。光線はバリアに強く装甲に弱い。ミサイルはどちらにもそこそこ効くが、点防御砲で落とされる。'),
      el('p', { class: 'note' }, '敵の船は操縦席を壊すと動かなくなる。中の乗員を全員倒して操縦席に座ると自分の船になる。'),
      el('p', { class: 'note' }, 'ステーションのそばで G を押すと入港して、中を歩ける。店の窓口で F を押すと店に入れる。船に戻るときは「船の乗り場」で F。'),
      el('p', { class: 'note' }, '惑星の真上で止まって G を押すと地上に降りる。地上は歩けて、宇宙より良い鉱石の岩山や古い基地の跡がある。緑の惑星は空気があって息ができる。'),
      el('p', { class: 'note' }, '雇った操縦士が操縦席に座っていても、その席で F を押せば代わってもらえる。'))));
  },
};

function initFake(def) {
  const b = { def, x: 0, y: 0, r: 0, w: def.size[0], h: def.size[1], hp: def.hp, i: -1, ta: -Math.PI / 2 };
  return b;
}

/* ステーションの造船所: 買った船をステーションの隣に出す */
const Yard = {
  deliver(g) {
    g.faction = 'player'; g.kind = 'ship';
    // 同じ名前の持ち船があれば番号を付ける
    const names = new Set(Fleet.all().map((e) => (e.g ? e.g.name : e.o.name)));
    if (names.has(g.name)) { let n = 2; while (names.has(`${g.name} ${n}号`)) n++; g.name = `${g.name} ${n}号`; }
    const st = S.station;
    let x = st ? st.x : 0, y = st ? st.y + 50 : 0;
    for (let k = 0; k < 30; k++) {
      const a = k * 0.7, r = 40 + k * 6;
      x = (st ? st.x : 0) + Math.cos(a) * r; y = (st ? st.y : 0) + Math.sin(a) * r;
      if (!S.grids.some((o) => !o.dead && dist(o.x, o.y, x, y) < o.radius + g.radius + 4)) break;
    }
    g.x = x; g.y = y; g.a = 0;
    g.updateSys();
    for (const b of g.sys.batteries) b.charge = b.def.cap;
    for (const b of g.sys.tanks) b.h2 = b.def.h2cap * 0.5;
    S.grids.push(g);
    g.updateRooms();
    for (const r of g.rooms) if (!r.leak) r.air = r.size;
    Toast.show(`${g.name} がステーションの横に届いた`, 'good');
    Quest.checkState();
    return g;
  },
  loan() {
    const g = this.deliver(makeShip('starter'));
    g.loan = true; g.name = '借りた採掘艇';
    G.loanOut = true;
    Toast.show('採掘艇を借りた。掘って売るところからやり直そう');
  },
};
