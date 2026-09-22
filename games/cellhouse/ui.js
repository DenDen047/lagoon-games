/* =========================================================================
   CELLHOUSE ― 画面の部品
   上の帯 / 下の道具箱 / 引き出し / 調べる窓 / 管理パネル (職員・日課・方針・研究・補助金・報告・名簿)
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  g: null,
  drawer: null,
  objCat: 'cell',
  modal: null,
  brush: 'work',
  t: 0, slowT: 0,

  init(g) {
    this.g = g;
    this.bindTitle();
    this.bindHud();
  },

  /* ------------------------------ タイトル ------------------------------ */
  bindTitle() {
    const g = this.g;
    const save = Save.read();
    const cont = $('btnCont');
    cont.disabled = !save;
    if (save) {
      const day = Math.floor(save.t / (HOUR_SEC * 24)) + 1;
      cont.textContent = `つづきから（${day}日目・${yen(save.money)}）`;
    }
    cont.onclick = () => { if (g.load()) g.start(); else Toast.show('セーブデータを読めなかった', 'bad'); };
    let asked = false;
    $('btnNew').onclick = () => {
      if (save && !asked) {
        asked = true;
        $('btnNew').textContent = '本当に最初から始める';
        $('btnNew').classList.add('danger');
        $('newWarn').classList.add('show');
        return;
      }
      g.newGame(); g.start();
      this.openModal('help');
    };
    $('btnHow').onclick = () => { $('titleHelp').classList.toggle('show'); };
  },

  /* ------------------------------ HUD ------------------------------ */
  bindHud() {
    const g = this.g;
    document.querySelectorAll('#speedBox button').forEach((b) => { b.onclick = () => g.setSpeed(+b.dataset.sp); });
    document.querySelectorAll('#toolbar [data-drawer]').forEach((b) => { b.onclick = () => this.toggleDrawer(b.dataset.drawer); });
    document.querySelectorAll('#toolbar [data-modal]').forEach((b) => { b.onclick = () => this.openModal(b.dataset.modal); });
    $('tZones').onclick = () => { g.showZones = !g.showZones; this.refreshToggles(); };
    $('tDanger').onclick = () => { g.showDanger = !g.showDanger; this.refreshToggles(); };
    $('bSave').onclick = () => g.save(false);
    $('bHelp').onclick = () => this.openModal('help');
    $('bLock').onclick = () => {
      const s = g.sim;
      if (!s.research.has('lockdown')) { Toast.show('所長の研究「非常施錠」が必要', 'bad'); return; }
      s.setLockdown(!g.world.lockdown);
      this.refreshTop();
    };
    $('bPolice').onclick = () => {
      const s = g.sim;
      if (!s.callPolice()) Toast.show(s.canAfford(s.policeCost()) ? 'もう向かっている' : `お金が足りない（${yen(s.policeCost())}）`, 'bad');
    };
    $('bSearch').onclick = () => { if (!g.sim.shakedown()) Toast.show('捜索する房がない', 'bad'); };
    $('mClose').onclick = () => this.closeModal();
    $('modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    $('toolCancel').onclick = () => g.setTool(null);
    $('toolRot').onclick = () => { g.rot = (g.rot + 1) % 4; };
    $('btnRestart').onclick = () => { Save.clear(); location.reload(); };
  },

  refreshAll() {
    this.refreshTop(); this.refreshSpeed(); this.refreshTool(); this.refreshToggles(); this.renderLog();
  },
  refreshSpeed() {
    document.querySelectorAll('#speedBox button').forEach((b) => b.classList.toggle('on', +b.dataset.sp === this.g.speed));
  },
  refreshToggles() {
    const g = this.g;
    $('tZones').classList.toggle('on', g.showZones);
    $('tDanger').classList.toggle('on', g.showDanger);
    $('tDanger').style.display = g.sim && g.sim.research.has('danger') ? '' : 'none';
  },

  update(dt) {
    this.t += dt; this.slowT += dt;
    if (this.t >= 0.25) { this.t = 0; this.refreshTop(); if (this.g.sel) this.inspect(this.g.sel, true); }
    if (this.slowT >= 1) {
      this.slowT = 0;
      this.refreshWarns();
      if (this.modal && this.modal !== 'sched' && this.modal !== 'help') this.renderModal(true);
      if (this.drawer) this.refreshDrawerLocks();
    }
  },

  refreshTop() {
    const g = this.g, s = g.sim;
    if (!s) return;
    $('mMoney').textContent = yen(s.money);
    $('mMoney').classList.toggle('neg', s.money < 0);
    const inc = Object.values(s.ledger.inc).reduce((a, b) => a + b, 0);
    const out = Object.values(s.ledger.out).reduce((a, b) => a + b, 0);
    const net = inc - out;
    $('mDelta').textContent = (net >= 0 ? '+' : '') + yen(net).replace('¥', '¥');
    $('mDelta').className = net >= 0 ? 'pos' : 'neg';
    const hf = s.hourF();
    $('mDay').textContent = `${s.day()}日目`;
    $('mTime').textContent = `${pad2(Math.floor(hf))}:${pad2(Math.floor((hf % 1) * 60 / 10) * 10)}`;
    const act = g.world.lockdown ? null : s.act();
    const chip = $('mAct');
    chip.textContent = act ? SCHED[act].name : '非常施錠';
    chip.style.background = act ? SCHED[act].color : '#b83a3a';
    $('mPris').textContent = `${s.prisonerCount()} / ${s.capacity()}`;
    $('mStaff').textContent = s.staffCount();
    $('mPower').textContent = `${s.powerUse} / ${s.powerCap}`;
    $('mPowerWrap').classList.toggle('bad', !s.powerOK);
    let sum = 0, n = 0;
    for (const p of s.people) if (p.kind === 'prisoner' && p.state !== 'arrive' && p.state !== 'release') { sum += p.anger; n++; }
    const avg = n ? sum / n : 0;
    const mood = $('mMood');
    mood.textContent = n ? (avg < 30 ? 'おだやか' : avg < 50 ? 'ふつう' : avg < 70 ? 'ざわつき' : '一触即発') : '―';
    mood.className = avg < 30 ? 'good' : avg < 50 ? '' : avg < 70 ? 'warn' : 'bad';
    const lock = $('bLock');
    lock.classList.toggle('on', g.world.lockdown);
    lock.classList.toggle('locked', !s.research.has('lockdown'));
    $('bPolice').title = `機動隊を呼ぶ（${yen(s.policeCost())}）`;
  },

  refreshWarns() {
    const g = this.g, s = g.sim, w = g.world;
    if (!s) return;
    const list = [];
    const pris = s.prisonerCount();
    const homeless = s.people.filter((p) => p.kind === 'prisoner' && p.state !== 'release' && p.home < 0 && p.state !== 'escape').length;
    if (!w.countRooms('deliveries')) list.push(['warn', '搬入口がない']);
    if (homeless) list.push(['bad', `房のない囚人 ${homeless} 人`]);
    const stuck = s.people.filter((p) => p.kind === 'prisoner' && p.state === 'arrive' && p.waiting && p.home >= 0).length;
    if (stuck) list.push(['bad', `房まで歩いて行けない新入り ${stuck} 人（入口をふさいでいないか）`]);
    if (pris && !w.countRooms('kitchen')) list.push(['warn', '厨房がない']);
    if (pris && !w.countRooms('canteen')) list.push(['warn', '食堂がない']);
    if (pris && !s.staffCount('cook')) list.push(['warn', '調理師がいない']);
    if (pris && !w.countRooms('shower')) list.push(['warn', '浴場がない']);
    if (!s.powerOK) list.push(['bad', '電力が足りない']);
    if (pris > 0 && s.staffCount('guard') < Math.ceil(pris / 8)) list.push(['warn', `看守が足りない（目安 ${Math.ceil(pris / 8)} 人）`]);
    if (pris > 0 && s.perimeterClosed() === false) list.push(['bad', '囚人が外へ歩いて出られる']);
    if (!s.staffCount('worker')) list.push(['warn', '作業員がいない']);
    const riot = s.people.filter((p) => p.state === 'riot').length;
    if (riot) list.push(['bad', `暴動中 ${riot} 人`]);
    const fights = s.people.filter((p) => p.state === 'fight').length;
    if (fights) list.push(['warn', `ケンカ ${Math.ceil(fights / 2)} 件`]);
    const html = list.map(([k, t]) => `<div class="warn ${k}">${esc(t)}</div>`).join('');
    if (html !== this.lastWarns) { $('warns').innerHTML = html; this.lastWarns = html; }
  },

  onLog(e) { this.renderLog(); void e; },
  renderLog() {
    const s = this.g.sim;
    if (!s) return;
    const box = $('logBox');
    box.innerHTML = '';
    for (const e of s.logs.slice(0, 5)) {
      const d = document.createElement('div');
      d.className = 'log ' + e.kind;
      const day = Math.floor(e.t / (HOUR_SEC * 24)) + 1, h = Math.floor((e.t % (HOUR_SEC * 24)) / HOUR_SEC);
      d.innerHTML = `<span class="lt">${day}日 ${pad2(h)}時</span>${esc(e.text)}`;
      if (e.x !== undefined) { d.classList.add('go'); d.onclick = () => this.g.jump(e.x, e.y); }
      box.appendChild(d);
    }
  },
  dayReport() {
    const s = this.g.sim, L = s.lastLedger;
    if (!L) return;
    const inc = Object.values(L.inc).reduce((a, b) => a + b, 0), out = Object.values(L.out).reduce((a, b) => a + b, 0);
    Toast.show(`${s.day() - 1}日目の収支 ${inc - out >= 0 ? '+' : ''}${yen(inc - out)}（収入 ${yen(inc)}・支出 ${yen(out)}）`, inc >= out ? 'good' : 'bad');
  },

  /* ------------------------------ 道具の説明 ------------------------------ */
  toolLabel(t) {
    switch (t.kind) {
      case 'room': return `建物（${WALLS[t.wall].name}）`;
      case 'wall': return WALLS[t.v].name;
      case 'floor': return FLOORS[t.v].name;
      case 'door': return DOORS[t.v].name;
      case 'obj': return OBJECTS[t.key].name;
      case 'zone': return `部屋：${ROOMS[t.key].name}`;
      case 'unzone': return '部屋を消す';
      case 'remove': return '撤去';
      case 'rmFloor': return '床をはがす';
      case 'patrol': return '巡回地点';
    }
    return '';
  },
  toolHelp(t) {
    switch (t.kind) {
      case 'room': return 'ドラッグで四角く囲むと、まわりに壁、中に床を敷く';
      case 'wall': return 'ドラッグで線か四角の外周を引く';
      case 'floor': case 'zone': case 'unzone': case 'remove': case 'rmFloor': return 'ドラッグで範囲を選ぶ';
      case 'door': return '壁の上をクリック';
      case 'obj': return 'クリックで置く。R で回す。黄色い点が使う人の立つ場所';
      case 'patrol': return 'クリックで地点を足す。もう一度押すと消す';
    }
    return '';
  },
  refreshTool() {
    const g = this.g, t = g.tool;
    const bar = $('toolBar');
    if (!t) { bar.classList.add('hide'); $('tip').classList.remove('show'); return; }
    bar.classList.remove('hide');
    $('toolName').textContent = this.toolLabel(t);
    $('toolHelp').textContent = this.toolHelp(t);
    $('toolRot').style.display = t.kind === 'obj' ? '' : 'none';
    document.querySelectorAll('#drawerItems .item').forEach((b) => b.classList.toggle('on', b._tool && this.sameTool(b._tool, t)));
  },
  sameTool(a, b) { return a.kind === b.kind && a.v === b.v && a.key === b.key && a.wall === b.wall; },
  tip(mx, my) {
    const g = this.g, t = g.tool, el = $('tip');
    if (!t || !g.hover || !g.sim) { el.classList.remove('show'); return; }
    const r = g.runTool(true);
    if (!r) { el.classList.remove('show'); return; }
    let text = '';
    if (r.reason) text = `<span class="bad">${esc(r.reason)}</span>`;
    else if (t.kind === 'zone' || t.kind === 'unzone' || t.kind === 'patrol') text = t.kind === 'zone' ? esc(ROOMS[t.key].name) : '';
    else if (r.cost < 0) text = `<span class="good">払い戻し ${yen(-r.cost)}</span>`;
    else if (r.cost > 0) text = `<span class="${g.sim.canAfford(r.cost) ? '' : 'bad'}">${yen(r.cost)}</span>`;
    if (t.kind === 'zone' && g.drag) { const d = g.dragRect(); text += ` ${(d.x1 - d.x0 + 1)}×${(d.y1 - d.y0 + 1)}`; }
    if (!text) { el.classList.remove('show'); return; }
    el.innerHTML = text;
    el.style.left = (mx + 16) + 'px'; el.style.top = (my + 14) + 'px';
    el.classList.add('show');
  },

  /* ------------------------------ 引き出し ------------------------------ */
  toggleDrawer(kind) {
    if (this.drawer === kind) { this.closeDrawer(); return; }
    this.drawer = kind;
    document.querySelectorAll('#toolbar [data-drawer]').forEach((b) => b.classList.toggle('on', b.dataset.drawer === kind));
    $('drawer').classList.remove('hide');
    document.body.classList.add('drawerOpen');
    this.renderDrawer();
  },
  closeDrawer() {
    this.drawer = null;
    $('drawer').classList.add('hide');
    document.body.classList.remove('drawerOpen');
    document.querySelectorAll('#toolbar [data-drawer]').forEach((b) => b.classList.remove('on'));
  },
  drawerItems() {
    const s = this.g.sim;
    const items = [];
    if (this.drawer === 'build') {
      items.push({ tool: { kind: 'room', wall: 1, floor: 1 }, name: '建物（れんが）', cost: '壁+床', thumb: ['room', 1] });
      items.push({ tool: { kind: 'room', wall: 2, floor: 1 }, name: '建物（コンクリート）', cost: '壁+床', thumb: ['room', 2] });
      for (let v = 1; v < WALLS.length; v++) items.push({ tool: { kind: 'wall', v }, name: WALLS[v].name, cost: WALLS[v].cost, thumb: ['wall', v] });
      for (let v = 1; v < DOORS.length; v++) items.push({ tool: { kind: 'door', v }, name: DOORS[v].name, cost: DOORS[v].cost, thumb: ['door', v], desc: DOORS[v].desc });
      for (let v = 1; v < FLOORS.length; v++) items.push({ tool: { kind: 'floor', v }, name: FLOORS[v].name, cost: FLOORS[v].cost, thumb: ['floor', v] });
      items.push({ tool: { kind: 'remove' }, name: '撤去', cost: '半額もどる', thumb: ['icon', '🧨'], desc: '壁・扉・設備を取りこわす' });
      items.push({ tool: { kind: 'rmFloor' }, name: '床をはがす', cost: '', thumb: ['icon', '🧹'] });
    } else if (this.drawer === 'obj') {
      for (const key in OBJECTS) {
        const d = OBJECTS[key];
        if (d.cat !== this.objCat) continue;
        items.push({ tool: { kind: 'obj', key }, name: d.name, cost: d.cost, thumb: ['obj', key], desc: d.desc, lock: d.research && !s.research.has(d.research) ? d.research : null });
      }
    } else if (this.drawer === 'zone') {
      for (const key of ROOM_KEYS) {
        const d = ROOMS[key];
        items.push({ tool: { kind: 'zone', key }, name: d.name, cost: '', thumb: ['zone', key], desc: d.desc + this.reqText(d), lock: d.research && !s.research.has(d.research) ? d.research : null });
      }
      items.push({ tool: { kind: 'unzone' }, name: '部屋を消す', cost: '', thumb: ['icon', '🧽'] });
      items.push({ tool: { kind: 'patrol' }, name: '巡回地点', cost: '', thumb: ['icon', '📍'], desc: '看守が順に回る地点', lock: s.research.has('patrol') ? null : 'patrol' });
    }
    return items;
  },
  reqText(d) {
    const r = Object.entries(d.req).map(([k, n]) => `${OBJECTS[k].name}${n > 1 ? '×' + n : ''}`);
    const extra = [];
    if (d.enclosed) extra.push('壁で囲む');
    if (d.indoor) extra.push('屋内');
    const all = r.concat(extra);
    return all.length ? `\n必要: ${all.join('・')}` : '';
  },
  renderDrawer() {
    const tabs = $('drawerTabs');
    tabs.innerHTML = '';
    if (this.drawer === 'obj') {
      for (const c of OBJ_CATS) {
        const b = document.createElement('button');
        b.textContent = c.name;
        b.className = c.id === this.objCat ? 'on' : '';
        b.onclick = () => { this.objCat = c.id; this.renderDrawer(); };
        tabs.appendChild(b);
      }
    }
    tabs.style.display = this.drawer === 'obj' ? '' : 'none';
    const box = $('drawerItems');
    box.innerHTML = '';
    for (const it of this.drawerItems()) {
      const b = document.createElement('button');
      b.className = 'item' + (it.lock ? ' locked' : '');
      b._tool = it.tool; b._lock = it.lock;
      b.appendChild(this.thumb(it.thumb));
      const n = document.createElement('span'); n.className = 'iname'; n.textContent = it.name; b.appendChild(n);
      const c = document.createElement('span'); c.className = 'icost';
      c.textContent = it.lock ? '🔒 研究' : typeof it.cost === 'number' ? yen(it.cost) : it.cost;
      b.appendChild(c);
      const lockName = it.lock ? RESEARCH.find((r) => r.id === it.lock) : null;
      b.title = (it.desc || it.name) + (lockName ? `\n研究「${lockName.name}」（${STAFF[lockName.by].name}）が必要` : '');
      b.onclick = () => {
        if (b._lock) { Toast.show(`研究「${lockName.name}」が必要`, 'bad'); return; }
        this.g.setTool(it.tool);
        if (it.tool.kind === 'zone' && !this.g.showZones) { this.g.showZones = true; this.refreshToggles(); }
      };
      box.appendChild(b);
    }
    this.refreshTool();
  },
  refreshDrawerLocks() {
    const s = this.g.sim;
    let changed = false;
    document.querySelectorAll('#drawerItems .item').forEach((b) => { if (b._lock && s.research.has(b._lock)) changed = true; });
    if (changed) this.renderDrawer();
  },
  thumb([kind, v]) {
    const cv = document.createElement('canvas');
    const S = 52, dpr = 2;
    cv.width = S * dpr; cv.height = S * dpr;
    cv.style.width = S + 'px'; cv.style.height = S + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    if (kind === 'icon') {
      ctx.font = '28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(v, S / 2, S / 2 + 2);
      return cv;
    }
    if (kind === 'zone') {
      ctx.fillStyle = ROOMS[v].color; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.roundRect(8, 8, S - 16, S - 16, 8); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "Hiragino Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ROOMS[v].name.slice(0, 1), S / 2, S / 2 + 1);
      return cv;
    }
    if (kind === 'obj') {
      const d = OBJECTS[v];
      const span = Math.max(d.w, d.h + (d.use === 'sides' && v === 'table' ? 1.6 : 0)) + 0.3;
      const sc = S / span;
      ctx.translate(S / 2, S / 2); ctx.scale(sc, sc);
      Render.drawObj(ctx, { key: v, def: d, x: -d.w / 2, y: -d.h / 2, rot: 0, w: d.w, h: d.h, hp: 100, food: 12, t: 0 }, null, false);
      return cv;
    }
    const sc = S / 2.2;
    ctx.translate(S / 2 - sc, S / 2 - sc); ctx.scale(sc, sc);
    if (kind === 'floor') {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) Render.floorTile(ctx, v, x, y, 1);
    } else if (kind === 'wall') {
      ctx.fillStyle = '#6a8a50'; ctx.fillRect(0, 0, 2, 2);
      const W_ = WALLS[v];
      if (v === 3) { Render.fence(ctx, 0, 0.5, (dx, dy) => dx !== 0 && dy === 0); Render.fence(ctx, 1, 0.5, (dx, dy) => dx !== 0 && dy === 0); }
      else { ctx.fillStyle = W_.color; ctx.fillRect(0, 0.5, 2, 1); ctx.fillStyle = W_.top; ctx.fillRect(0, 0.62, 2, 0.7); }
    } else if (kind === 'door') {
      ctx.fillStyle = '#b3b0a7'; ctx.fillRect(0, 0, 2, 2);
      ctx.fillStyle = '#8b4a3a'; ctx.fillRect(0, 0.5, 0.5, 1); ctx.fillRect(1.5, 0.5, 0.5, 1);
      ctx.fillStyle = v === 3 ? '#6f777f' : DOORS[v].color; ctx.fillRect(0.5, 0.85, 1, 0.3);
      if (v === 3) { ctx.fillStyle = '#2c3034'; for (let k = 0; k < 5; k++) ctx.fillRect(0.55 + k * 0.2, 0.88, 0.06, 0.24); }
    } else if (kind === 'room') {
      const W_ = WALLS[v];
      ctx.fillStyle = W_.color; ctx.fillRect(0.1, 0.1, 1.8, 1.8);
      ctx.fillStyle = W_.top; ctx.fillRect(0.1, 0.1, 1.8, 1.8);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { ctx.save(); ctx.beginPath(); ctx.rect(0.4, 0.4, 1.2, 1.2); ctx.clip(); Render.floorTile(ctx, 1, 0.4 + x * 0.6, 0.4 + y * 0.6, 1); ctx.restore(); }
    }
    return cv;
  },

  /* ------------------------------ 調べる窓 ------------------------------ */
  inspect(sel, soft) {
    const el = $('insp');
    if (!sel) { el.classList.add('hide'); el.innerHTML = ''; this.inspKey = null; return; }
    let html = '';
    if (sel.type === 'person') html = this.inspPerson(sel.p);
    else if (sel.type === 'obj') html = this.inspObj(sel.o);
    else if (sel.type === 'room') {
      const r = this.g.world.roomByKey.get(sel.key);
      if (!r) { this.g.sel = null; this.inspect(null); return; }
      html = this.inspRoom(r);
    }
    if (soft && html === this.lastInsp) return;
    this.lastInsp = html;
    el.innerHTML = `<button class="x" id="inspClose">✕</button>` + html;
    el.classList.remove('hide');
    $('inspClose').onclick = () => { this.g.sel = null; this.inspect(null); };
    el.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => this.inspAction(b.dataset.act, sel); });
  },
  inspAction(act, sel) {
    const g = this.g, s = g.sim;
    if (act === 'follow') g.follow = sel.p;
    else if (act === 'fire') { s.fire(sel.p); g.sel = null; this.inspect(null); }
    else if (act === 'rmObj') { const r = s.jobs.planRemove(g.world.idx(sel.o.x, sel.o.y), false); if (r < 0) s.spend(r, 'build'); Toast.show('撤去を頼んだ'); }
    else if (act === 'unzone') {
      const r = g.world.roomByKey.get(sel.key);
      if (r) { for (const i of r.tiles) g.world.zone[i] = 0; g.world.roomsDirty = true; }
      g.sel = null; this.inspect(null);
    }
  },
  statusText(p) {
    const s = this.g.sim;
    if (p.carriedBy) return '運ばれている';
    if (p.kind === 'prisoner') {
      const m = { arrive: '入所の手続き中', release: '出所するところ', escape: '脱走中！', riot: '暴れている', fight: 'ケンカ中', ko: '気を失っている' };
      if (m[p.state]) return m[p.state];
      if (p.state === 'solitary') return `懲罰房（あと${Math.max(0, Math.ceil((p.solUntil - s.t) / HOUR_SEC))}時間）`;
      if (p.visit) return '面会';
    } else {
      if (p.mode === 'ko') return '気を失っている';
      if (p.mode === 'subdue') return '取り押さえに向かっている';
      if (p.leaving) return '帰るところ';
      if (p.carrying) return '懲罰房へ連れていく';
      if (p.role === 'worker' && p.job) return { floor: '床を敷く', wall: '壁を建てる', door: '扉をつける', obj: '設備を運ぶ', rmWall: '壁をこわす', rmObj: '設備を片づける', rmFloor: '床をはがす', repair: '修理する' }[p.job.kind] || '作業';
      if (p.atDesk) return '机で仕事中';
    }
    const pose = p.pose;
    if (p.moving) return '歩いている';
    return { lie: '寝ている', sit: '座っている', work: '手を動かしている', shower: 'シャワー', fight: 'もみあい' }[pose] || 'ひと休み';
  },
  bar(v, invert) {
    const pct = clamp(v, 0, 100);
    const t = invert ? 1 - pct / 100 : pct / 100;
    const col = t < 0.4 ? '#5ac06a' : t < 0.7 ? '#e8b040' : '#e05a4a';
    return `<span class="bar"><i style="width:${pct}%;background:${col}"></i></span>`;
  },
  inspPerson(p) {
    const s = this.g.sim, w = this.g.world;
    if (p.kind === 'prisoner') {
      const home = p.homeRoom();
      const left = Math.max(0, p.sentence - p.served);
      const danger = s.research.has('danger');
      const mood = p.anger < 35 ? 'おだやか' : p.anger < 60 ? 'ふつう' : p.anger < 80 ? 'いらいら' : '爆発寸前';
      const needs = NEED_KEYS.map((k) => `<div class="need"><span>${NEEDS[k].name}</span>${this.bar(p.needs[k])}</div>`).join('');
      const traits = p.traits.map((t) => `<span class="trait" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>`).join('');
      const task = { workshop: '作業場', laundry: '洗濯', kitchen: '厨房の手伝い', clean: '掃除', class: '教育課程' }[p.task] || 'なし';
      return `<h3><span class="sec" style="background:${SEC[p.sec].color}">${SEC[p.sec].short}</span>${esc(p.name)}</h3>
        <div class="kv"><span>罪状</span><b>${esc(p.crime)}</b></div>
        <div class="kv"><span>刑期</span><b>${p.sentence}日（あと${left}日）</b></div>
        <div class="kv"><span>いま</span><b>${esc(this.statusText(p))}</b></div>
        <div class="kv"><span>房</span><b>${home ? ROOMS[home.type].name : '<em class="bad">なし</em>'}</b></div>
        <div class="kv"><span>作業</span><b>${task}</b></div>
        <div class="kv"><span>機嫌</span><b>${danger ? `${this.bar(p.anger)} ${Math.round(p.anger)}` : mood}</b></div>
        ${p.study > 0 || p.graduated ? `<div class="kv"><span>学習</span><b>${p.graduated ? '修了' : this.bar(p.study, true)}</b></div>` : ''}
        ${danger ? `<div class="kv"><span>隠し物</span><b>${p.contra.length ? '<em class="bad">あやしい</em>' : 'なさそう'}</b></div>` : ''}
        <div class="kv"><span>体力</span><b>${this.bar(p.hp, true)}</b></div>
        <div class="traits">${traits}</div>
        <div class="needs">${needs}</div>
        <div class="btns"><button data-act="follow">追いかける</button></div>`;
    }
    if (p.kind === 'staff') {
      const d = STAFF[p.role];
      return `<h3><span class="dot" style="background:${d.color}"></span>${esc(p.name)}</h3>
        <div class="kv"><span>仕事</span><b>${d.name}</b></div>
        <div class="kv"><span>給料</span><b>${yen(d.wage)} / 日</b></div>
        <div class="kv"><span>いま</span><b>${esc(this.statusText(p))}</b></div>
        <div class="kv"><span>体力</span><b>${this.bar(p.hp, true)}</b></div>
        <p class="desc">${esc(d.desc)}</p>
        <div class="btns"><button data-act="follow">追いかける</button><button data-act="fire" class="danger">辞めてもらう</button></div>`;
    }
    void w;
    return `<h3>${esc(p.name)}</h3><div class="kv"><span>いま</span><b>${esc(this.statusText(p))}</b></div>`;
  },
  inspObj(o) {
    const w = this.g.world, s = this.g.sim;
    const r = o.room >= 0 ? w.rooms[o.room] : null;
    return `<h3>${esc(o.def.name)}</h3>
      <p class="desc">${esc(o.def.desc)}</p>
      <div class="kv"><span>部屋</span><b>${r ? ROOMS[r.type].name : '屋外'}</b></div>
      <div class="kv"><span>状態</span><b>${o.hp > 0 ? this.bar(o.hp, true) : '<em class="bad">壊れている</em>'}</b></div>
      ${o.def.power ? `<div class="kv"><span>電力</span><b>${o.def.power}${o.powered ? '' : ' <em class="bad">停止中</em>'}</b></div>` : ''}
      ${o.key === 'serving' ? `<div class="kv"><span>料理</span><b>${o.food} 食</b></div>` : ''}
      <div class="btns"><button data-act="rmObj" class="danger">撤去する</button></div>`;
  },
  inspRoom(r) {
    const s = this.g.sim;
    const d = ROOMS[r.type];
    const probs = r.problems.map((p) => `<li>${esc(p)}</li>`).join('');
    let owners = '';
    if (HOME_ROOMS.includes(r.type)) {
      const names = r.owners.map((id) => s.byId.get(id)).filter(Boolean).map((p) => esc(p.name));
      owners = `<div class="kv"><span>定員</span><b>${r.owners.length} / ${r.cap}</b></div>${names.length ? `<p class="desc">${names.join('、')}</p>` : ''}`;
    }
    const objs = Object.entries(r.counts).map(([k, n]) => `${OBJECTS[k].name}×${n}`).join('、');
    return `<h3><span class="dot" style="background:${d.color}"></span>${d.name}</h3>
      <p class="desc">${esc(d.desc)}</p>
      <div class="kv"><span>広さ</span><b>${r.n} マス</b></div>
      <div class="kv"><span>状態</span><b>${r.valid ? '<em class="good">使える</em>' : '<em class="bad">まだ使えない</em>'}</b></div>
      ${probs ? `<ul class="probs">${probs}</ul>` : ''}
      ${owners}
      ${objs ? `<p class="desc">${esc(objs)}</p>` : ''}
      <div class="btns"><button data-act="unzone" class="danger">部屋を消す</button></div>`;
  },

  /* ------------------------------ 管理パネル ------------------------------ */
  modalOpen() { return !!this.modal; },
  openModal(kind) {
    this.modal = kind;
    $('modal').classList.remove('hide');
    this.renderModal(false);
  },
  closeModal() { this.modal = null; $('modal').classList.add('hide'); },
  renderModal(soft) {
    const k = this.modal;
    const titles = { staff: '職員', sched: '日課', policy: '方針', research: '研究', grants: '補助金', report: '報告', list: '囚人名簿', help: '遊びかた' };
    $('mTitle').textContent = titles[k];
    const body = $('mBody');
    const html = this['panel_' + k]();
    if (soft && html === this.lastModal) return;
    const scroll = body.scrollTop;
    this.lastModal = html;
    body.innerHTML = html;
    body.scrollTop = scroll;
    const bind = this['bind_' + k];
    if (bind) bind.call(this, body);
  },

  panel_staff() {
    const s = this.g.sim;
    const rows = STAFF_ORDER.map((role) => {
      const d = STAFF[role];
      const n = s.staffCount(role);
      const why = s.hireBlock(role);
      return `<div class="srow">
        <span class="dot big" style="background:${d.color}"></span>
        <div class="sinfo"><b>${d.name}</b><span>${esc(d.desc)}</span>${why ? `<em>${esc(why)}</em>` : ''}</div>
        <div class="swage">${yen(d.wage)}<small>/日</small></div>
        <div class="scount">${n}<small>人</small></div>
        <div class="sbtn"><button data-hire="${role}" ${why ? 'disabled' : ''}>雇う</button><button data-fire="${role}" ${n ? '' : 'disabled'}>減らす</button></div>
      </div>`;
    }).join('');
    const wages = s.people.filter((p) => p.kind === 'staff' && !p.leaving).reduce((a, p) => a + STAFF[p.role].wage, 0);
    return `<p class="note">雇うと初日分の給料を払う。給料は毎日0時に払う。いまの給料の合計は <b>${yen(wages * (s.research.has('payroll') ? 0.9 : 1))} / 日</b>。</p>${rows}`;
  },
  bind_staff(body) {
    const s = this.g.sim;
    body.querySelectorAll('[data-hire]').forEach((b) => { b.onclick = () => { const e = s.hire(b.dataset.hire); if (e) Toast.show(e, 'bad'); this.renderModal(false); }; });
    body.querySelectorAll('[data-fire]').forEach((b) => {
      b.onclick = () => {
        const list = s.people.filter((p) => p.kind === 'staff' && p.role === b.dataset.fire && !p.leaving);
        if (list.length) s.fire(list[list.length - 1]);
        this.renderModal(false);
      };
    });
  },

  panel_sched() {
    const s = this.g.sim;
    const pal = SCHED_KEYS.map((k) => `<button class="brush ${k === this.brush ? 'on' : ''}" data-brush="${k}" style="--c:${SCHED[k].color}">${SCHED[k].name}</button>`).join('');
    const h = s.hour();
    const cells = s.sched.map((a, i) => `<div class="hcell ${i === h ? 'now' : ''}" data-h="${i}" style="background:${SCHED[a].color}"><small>${i}</small><span>${SCHED[a].name}</span></div>`).join('');
    const desc = {
      sleep: '自分の房で眠る。監房扉は閉まる。', lock: '房にこもる。監房扉は閉まる。', eat: '食堂で食べる。調理師は1時間前から作りはじめる。',
      shower: '浴場でシャワー。', yard: '運動場で体を動かす。', free: '好きに過ごす。娯楽・電話・運動など、いちばん困っていることを満たしに行く。',
      work: '作業場・洗濯・厨房・掃除・教室に割り当てられた囚人が働く。ほかは自由時間。',
    };
    return `<p class="note">色を選んでから時間の枠をなぞる。囚人全員がこの日課で動く。</p>
      <div class="brushes">${pal}</div>
      <div class="hours" id="hours">${cells}</div>
      <div class="sdesc">${SCHED_KEYS.map((k) => `<div><span class="sw" style="background:${SCHED[k].color}"></span><b>${SCHED[k].name}</b> ${desc[k]}</div>`).join('')}</div>
      <div class="btns"><button id="schedReset">元の日課にもどす</button></div>`;
  },
  bind_sched(body) {
    const s = this.g.sim;
    body.querySelectorAll('[data-brush]').forEach((b) => { b.onclick = () => { this.brush = b.dataset.brush; this.renderModal(false); }; });
    let painting = false;
    const paint = (el) => {
      if (!el || el.dataset.h === undefined) return;
      const h = +el.dataset.h;
      if (s.sched[h] === this.brush) return;
      s.sched[h] = this.brush;
      el.style.background = SCHED[this.brush].color;
      el.querySelector('span').textContent = SCHED[this.brush].name;
      if (h === s.hour()) { s.world.jailLocked = s.act() === 'sleep' || s.act() === 'lock'; for (const p of s.people) if (p.kind === 'prisoner' && p.state === 'normal') p.endPlan(); }
    };
    const hours = body.querySelector('#hours');
    hours.addEventListener('pointerdown', (e) => { painting = true; paint(e.target.closest('.hcell')); e.preventDefault(); });
    hours.addEventListener('pointermove', (e) => { if (painting) paint(document.elementFromPoint(e.clientX, e.clientY)?.closest('.hcell')); });
    window.addEventListener('pointerup', () => { painting = false; });
    body.querySelector('#schedReset').onclick = () => { s.sched = DEFAULT_SCHED.slice(); this.renderModal(false); };
  },

  panel_policy() {
    const s = this.g.sim, P = s.policy;
    const seg = (name, vals, cur) => `<div class="seg">${vals.map((v, i) => `<button data-pol="${name}" data-v="${i}" class="${cur === i ? 'on' : ''}">${v}</button>`).join('')}</div>`;
    const intake = SEC.map((sc, i) => {
      const locked = i === 2 && !s.research.has('maxsec');
      return `<div class="cnt ${locked ? 'locked' : ''}"><span class="sec" style="background:${sc.color}">${sc.short}</span>${sc.name}<small>${yen(sc.pay)}/日</small>
        <button data-int="${i}" data-d="-1" ${locked ? 'disabled' : ''}>−</button><b>${locked ? '🔒' : P.intake[i]}</b><button data-int="${i}" data-d="1" ${locked ? 'disabled' : ''}>＋</button></div>`;
    }).join('');
    const work = SEC.map((sc, i) => `<button data-work="${i}" class="${P.workSec[i] ? 'on' : ''}">${sc.name}</button>`).join('');
    const mealCost = FOOD_COST[P.mealQual] * [0.8, 1, 1.3][P.mealQty];
    return `<section><h4>受け入れ</h4>
        <label class="chk"><input type="checkbox" data-chk="intakeOn" ${P.intakeOn ? 'checked' : ''}> 毎朝9時に護送車を受け入れる</label>
        <label class="chk"><input type="checkbox" data-chk="cap" ${P.cap ? 'checked' : ''}> 房の空きより多くは受け入れない</label>
        <div class="cnts">${intake}</div>
        <p class="note">1人あたり毎日0時に支払いがある。重警備は所長の研究「重警備の受け入れ」が要る。</p></section>
      <section><h4>食事</h4>
        <div class="kv2"><span>量</span>${seg('mealQty', ['少なめ', 'ふつう', '多め'], P.mealQty)}</div>
        <div class="kv2"><span>質</span>${seg('mealQual', ['安い', 'ふつう', '上等'], P.mealQual)}</div>
        <p class="note">1食 およそ ${yen(mealCost)}。安い食事は少しずつ苛立ちをためる。</p></section>
      <section><h4>懲罰</h4>
        <label class="chk"><input type="checkbox" data-chk="solitary" ${P.solitary ? 'checked' : ''}> 取り押さえた囚人を懲罰房に入れる</label>
        <div class="kv2"><span>長さ</span>${seg('solHours', ['2時間', '4時間', '6時間', '12時間'], [2, 4, 6, 12].indexOf(P.solHours))}</div></section>
      <section><h4>刑務作業に出す</h4><div class="seg multi">${work}</div></section>
      <section><h4>非常時</h4>
        <div class="btns left"><button id="pSearch">一斉捜索</button><button id="pLock" ${s.research.has('lockdown') ? '' : 'disabled'}>${this.g.world.lockdown ? '非常施錠を解く' : '非常施錠'}</button><button id="pPolice">機動隊を呼ぶ（${yen(s.policeCost())}）</button></div>
        <p class="note">一斉捜索では看守が房を1つずつ調べ、隠し物と床下の穴を探す。囚人は少し苛立つ。</p></section>`;
  },
  bind_policy(body) {
    const s = this.g.sim, P = s.policy;
    body.querySelectorAll('[data-pol]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.pol, v = +b.dataset.v;
        P[k] = k === 'solHours' ? [2, 4, 6, 12][v] : v;
        this.renderModal(false);
      };
    });
    body.querySelectorAll('[data-int]').forEach((b) => { b.onclick = () => { const i = +b.dataset.int; P.intake[i] = clamp(P.intake[i] + +b.dataset.d, 0, 12); this.renderModal(false); }; });
    body.querySelectorAll('[data-work]').forEach((b) => { b.onclick = () => { const i = +b.dataset.work; P.workSec[i] = !P.workSec[i]; this.renderModal(false); }; });
    body.querySelectorAll('[data-chk]').forEach((c) => { c.onchange = () => { P[c.dataset.chk] = c.checked; }; });
    body.querySelector('#pSearch').onclick = () => { if (!s.shakedown()) Toast.show('捜索する房がない', 'bad'); };
    body.querySelector('#pLock').onclick = () => { s.setLockdown(!this.g.world.lockdown); this.renderModal(false); };
    body.querySelector('#pPolice').onclick = () => { if (!s.callPolice()) Toast.show('呼べない（お金か、もう向かっている）', 'bad'); };
  },

  panel_research() {
    const s = this.g.sim;
    const roles = ['warden', 'chief', 'foreman', 'accountant', 'psych'];
    const cols = roles.map((role) => {
      const has = s.staffCount(role) > 0;
      const atDesk = s.people.some((p) => p.role === role && p.atDesk);
      const items = RESEARCH.filter((r) => r.by === role).map((r) => {
        const done = s.research.has(r.id);
        const active = s.resActive[role] === r.id;
        const prog = s.resProg[r.id] || 0;
        const reqOk = !r.req || r.req.every((q) => s.research.has(q));
        let st;
        if (done) st = '<em class="good">完了</em>';
        else if (active) st = `${this.bar(prog * 100, true)} ${Math.floor(prog * 100)}%`;
        else if (!reqOk) st = `<em>先に「${r.req.map((q) => RESEARCH.find((x) => x.id === q).name).join('・')}」</em>`;
        else st = `<button data-res="${r.id}" ${!has || s.resActive[role] ? 'disabled' : ''}>始める ${r.cost ? yen(r.cost) : ''}</button>`;
        return `<div class="res ${done ? 'done' : ''} ${active ? 'active' : ''}"><b>${r.name}</b><span>${esc(r.desc)}</span><small>${r.hours}時間</small><div>${st}</div></div>`;
      }).join('');
      const head = has ? (atDesk ? '<em class="good">机で仕事中</em>' : '<em>机に向かっている</em>') : `<em class="bad">いない</em>`;
      return `<div class="rcol"><h4><span class="dot" style="background:${STAFF[role].color}"></span>${STAFF[role].name} ${head}</h4>${items}</div>`;
    }).join('');
    return `<p class="note">研究は、その幹部が自分の机に座っている間だけ進む。所長は所長室の机、ほかの幹部は事務室の事務机（1人1台）を使う。</p><div class="rcols">${cols}</div>`;
  },
  bind_research(body) {
    const s = this.g.sim;
    body.querySelectorAll('[data-res]').forEach((b) => { b.onclick = () => { const e = s.startResearch(b.dataset.res); if (e) Toast.show(e, 'bad'); this.renderModal(false); }; });
  },

  panel_grants() {
    const s = this.g.sim;
    const ctx = { world: s.world, sim: s, stat: s.stat };
    const total = GRANTS.filter((g) => s.grantsDone.has(g.id)).reduce((a, g) => a + g.reward, 0);
    return `<p class="note">条件をそろえると国からお金が出る。受けとった額 <b>${yen(total)}</b></p>` + GRANTS.map((g) => {
      const done = s.grantsDone.has(g.id);
      const c = done ? null : g.check(ctx);
      return `<div class="grant ${done ? 'done' : ''}"><div><b>${g.name}</b><span>${esc(g.desc)}</span></div><div class="gr"><b>${yen(g.reward)}</b><small>${done ? '受けとり済み' : esc(c.text)}</small></div></div>`;
    }).join('');
  },

  panel_report() {
    const s = this.g.sim, w = s.world;
    const names = { pay: '収容の支払い', goods: '刑務作業', grant: '補助金', loan: '融資', refund: '撤去の払い戻し', wage: '給料', build: '建築', food: '食材', hire: '採用', police: '機動隊', penalty: '罰金・搬送', research: '研究' };
    const table = (L, title) => {
      if (!L) return `<div class="ledger"><h4>${title}</h4><p class="note">まだない</p></div>`;
      const rows = (o, sign) => Object.entries(o).filter(([, v]) => Math.round(v)).map(([k, v]) => `<div class="kv"><span>${names[k] || k}</span><b class="${sign > 0 ? 'good' : 'bad'}">${sign > 0 ? '+' : '−'}${yen(Math.abs(v)).replace('-', '')}</b></div>`).join('');
      const inc = Object.values(L.inc).reduce((a, b) => a + b, 0), out = Object.values(L.out).reduce((a, b) => a + b, 0);
      return `<div class="ledger"><h4>${title}</h4>${rows(L.inc, 1)}${rows(L.out, -1)}<div class="kv total"><span>差し引き</span><b class="${inc - out >= 0 ? 'good' : 'bad'}">${yen(inc - out)}</b></div></div>`;
    };
    const ps = s.people.filter((p) => p.kind === 'prisoner' && p.state !== 'arrive' && p.state !== 'release');
    const avgNeeds = NEED_KEYS.map((k) => {
      const v = ps.length ? ps.reduce((a, p) => a + p.needs[k], 0) / ps.length : 0;
      return `<div class="need"><span>${NEEDS[k].name}</span>${this.bar(v)}</div>`;
    }).join('');
    const st = s.stat;
    const counts = [['収容', s.prisonerCount()], ['定員', s.capacity()], ['入所', st.arrived], ['出所', st.released], ['修了', st.graduates],
      ['ケンカ', st.fights], ['暴動', st.riots], ['脱走', st.escapes], ['搬送', st.hospital], ['押収', st.found], ['面会', st.visits], ['配膳', st.meals], ['看板', st.goods]]
      .map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('');
    return `<div class="rgrid">${table(s.ledger, `今日（${s.day()}日目）`)}${table(s.lastLedger, '昨日')}</div>
      <h4>資金の移りかわり</h4><canvas id="histChart" class="chart"></canvas>
      <h4>数字</h4><div class="stats">${counts}</div>
      <h4>囚人の困りごと（平均）</h4><div class="needs wide">${avgNeeds}</div>
      <p class="note">電力 ${s.powerUse} / ${s.powerCap}。洗濯のゆきとどき ${Math.round(s.laundry)}%。部屋 ${w.rooms.filter((r) => r.valid).length} 室。</p>`;
  },
  bind_report(body) {
    const s = this.g.sim;
    const cv = body.querySelector('#histChart');
    if (!cv) return;
    const W = cv.clientWidth || 600, H = 140, dpr = 2;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const pts = s.history.map((h) => h.money).concat([Math.round(s.money)]);
    if (pts.length < 2) { ctx.fillStyle = '#8a95a5'; ctx.font = '13px sans-serif'; ctx.fillText('1日たつと線が引かれる', 12, 24); return; }
    const mn = Math.min(0, ...pts), mx = Math.max(...pts, 1);
    const X = (i) => 34 + (i / (pts.length - 1)) * (W - 46), Y = (v) => 12 + (1 - (v - mn) / (mx - mn || 1)) * (H - 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(34, Y(0)); ctx.lineTo(W - 12, Y(0)); ctx.stroke();
    ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2;
    ctx.beginPath(); pts.forEach((v, i) => { if (i) ctx.lineTo(X(i), Y(v)); else ctx.moveTo(X(i), Y(v)); }); ctx.stroke();
    ctx.fillStyle = '#8a95a5'; ctx.font = '11px sans-serif';
    ctx.fillText(yen(mx), 2, 16); ctx.fillText(yen(mn), 2, H - 18);
    ctx.fillText(`${s.history[0].day}日目`, 34, H - 4); ctx.textAlign = 'right'; ctx.fillText('いま', W - 12, H - 4);
  },

  panel_list() {
    const s = this.g.sim;
    const ps = s.people.filter((p) => p.kind === 'prisoner');
    const danger = s.research.has('danger');
    ps.sort((a, b) => b.anger - a.anger);
    if (!ps.length) return '<p class="note">まだ囚人はいない。毎朝9時に護送車が来る。</p>';
    const rows = ps.map((p) => {
      const home = p.homeRoom();
      return `<tr data-pid="${p.id}"><td><span class="sec" style="background:${SEC[p.sec].color}">${SEC[p.sec].short}</span>${esc(p.name)}</td><td>${esc(p.crime)}</td>
        <td>${Math.max(0, p.sentence - p.served)}日</td><td>${home ? ROOMS[home.type].name : '<em class="bad">なし</em>'}</td>
        <td>${esc(this.statusText(p))}</td><td>${danger ? this.bar(p.anger) : (p.anger < 35 ? 'おだやか' : p.anger < 60 ? 'ふつう' : p.anger < 80 ? 'いらいら' : '<em class="bad">爆発寸前</em>')}</td></tr>`;
    }).join('');
    return `<table class="plist"><thead><tr><th>名前</th><th>罪状</th><th>残り</th><th>房</th><th>いま</th><th>機嫌</th></tr></thead><tbody>${rows}</tbody></table>`;
  },
  bind_list(body) {
    const g = this.g;
    body.querySelectorAll('[data-pid]').forEach((tr) => {
      tr.onclick = () => {
        const p = g.sim.byId.get(+tr.dataset.pid);
        if (!p) return;
        g.sel = { type: 'person', p }; g.jump(p.x, p.y); this.inspect(g.sel); this.closeModal();
      };
    });
  },

  panel_help() {
    return `<ol class="steps">
      <li><b>建物を建てる。</b>下の「建設」→「建物」を選び、地面をドラッグして四角く囲む。作業員が壁と床をつくっていく。</li>
      <li><b>扉をつける。</b>壁の上に扉を置く。房には「監房扉」、囚人に通ってほしくない所には「職員用扉」。</li>
      <li><b>設備を置く。</b>「設備」から選んでクリック。R キーで回せる。房にはベッドとトイレ。</li>
      <li><b>部屋を決める。</b>「部屋」から用途を選び、中を塗る。条件がそろうと部屋の名前から ✕ が消える。</li>
      <li><b>まずそろえるもの。</b>独房（か雑居房）・仮監房・厨房・食堂・浴場・運動場。外周を壁かフェンスで閉じる。</li>
      <li><b>人を雇う。</b>「職員」から。調理師がいないと食事が出ない。囚人8人に看守1人が目安。</li>
      <li><b>日課と方針。</b>「日課」で1日の流れを、「方針」で受け入れ人数や食事を決める。</li>
      <li><b>所長と研究。</b>所長室をつくって所長を雇うと、研究で監視カメラや刑務作業が解禁される。</li>
    </ol>
    <p class="note">毎朝9時に護送車が囚人を連れてくる。お金は毎日0時に、囚人の人数ぶん入ってくる。3日続けて赤字だと閉鎖される。</p>
    <div class="kgrid">
      <div><b>ドラッグ / 右ドラッグ</b><span>画面を動かす</span></div><div><b>ホイール</b><span>拡大・縮小</span></div>
      <div><b>WASD / 矢印</b><span>画面を動かす</span></div><div><b>R</b><span>設備を回す</span></div>
      <div><b>スペース</b><span>一時停止</span></div><div><b>1 2 3</b><span>速さ</span></div>
      <div><b>右クリック / Esc</b><span>道具をやめる</span></div><div><b>Z</b><span>部屋の色を出す</span></div>
    </div>`;
  },

  showEnd() {
    const s = this.g.sim;
    $('endBody').innerHTML = `<p>${s.day()}日目、資金がマイナスのまま3日がすぎ、刑務所は国に取りあげられた。</p>
      <div class="stats">${[['最大収容', Math.max(0, ...s.history.map((h) => h.pris))], ['出所', s.stat.released], ['修了', s.stat.graduates], ['脱走', s.stat.escapes], ['暴動', s.stat.riots]].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
    $('end').classList.remove('hide');
    Save.clear();
  },
};
