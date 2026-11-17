/* =========================================================================
   SNOW HAUNT ― 画面の ボタンと 小窓
   上の帯 / けんちくの どうぐ / オバケ・かそう・うけつけ・ひろげる・もくひょう / 夜の そうさ / けっか
   ========================================================================= */
'use strict';

const kindChip = (kind) => `<span class="chip kd" style="--c:${KINDS[kind].color}">${KINDS[kind].name}</span>`;
const lockLabel = (star) => `★${star}で かいほう`;

const UI = {
  tool: null,        // 'floor' | 'rail' | 'erase' | 'prop' | 'deco' | 'ghost' | null
  propType: 'candle',
  decoType: 'lantern',
  placing: null,     // おこうと している オバケ
  hover: null,       // ゆびや マウスが ある マス
  sel: null,         // しらべている もの (とどく はんいを 出す)
  painting: false, lastPaint: null, downCell: null, fireArm: null,
  keys: new Set(), pad: { id: null, dx: 0, dy: 0 },

  init() {
    document.querySelectorAll('[data-icon]').forEach((img) => { img.src = Icons.get('tool', img.dataset.icon); img.alt = ''; });
    document.querySelectorAll('#dayBar [data-tool]').forEach((b) => b.addEventListener('click', () => {
      Sound.init();
      const t = b.dataset.tool;
      if (t === 'ghost') return this.openGhosts();
      this.setTool(this.tool === t ? null : t);
    }));
    $('bCostume').onclick = () => this.openCostumes();
    $('bExpand').onclick = () => this.openExpand();
    $('bOpen').onclick = () => { Sound.init(); Game.startNight(); };
    $('banner').onclick = () => this.openMissions();
    $('bMenu').onclick = () => this.openMenu();
    $('bSound').onclick = () => { Sound.on = !Sound.on; Sound.init(); this.refresh(); };
    document.querySelectorAll('#nightBar [data-sp]').forEach((b) => b.addEventListener('click', () => { Game.speed = +b.dataset.sp; this.refresh(); }));
    $('mClose').onclick = () => this.closeModal();
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !this.modalLocked) this.closeModal(); });

    const c = View.c;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointerleave', () => { if (!this.painting) this.hover = null; });
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (!$('modal').classList.contains('hide')) { if (!this.modalLocked) this.closeModal(); } else this.setTool(null); }
      if (Game.mode === 'movie' && (k === ' ' || k === 'enter')) { e.preventDefault(); Movie.next(); return; }
      if (Game.mode !== 'night') return;
      if (k === ' ' || k === 'j' || k === 'enter') { e.preventDefault(); if (!e.repeat) Sim.input.act = true; }
      else if (k === 'p') { Game.speed = Game.speed ? 0 : 1; this.refresh(); }
      else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { e.preventDefault(); this.keys.add(k); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    // スマホの スティックと ばあ! ボタン
    const pad = $('pad'), knob = $('knob');
    const padMove = (e) => {
      const r = pad.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      this.pad.dx = dx; this.pad.dy = dy;
      knob.style.transform = `translate(${dx * R * 0.55}px, ${dy * R * 0.55}px)`;
    };
    pad.addEventListener('pointerdown', (e) => { this.pad.id = e.pointerId; pad.setPointerCapture(e.pointerId); padMove(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === this.pad.id) padMove(e); });
    const padEnd = (e) => { if (e.pointerId !== this.pad.id) return; this.pad.id = null; this.pad.dx = this.pad.dy = 0; knob.style.transform = ''; };
    pad.addEventListener('pointerup', padEnd); pad.addEventListener('pointercancel', padEnd);
    $('act').addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.init(); Sim.input.act = true; });
    addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  },

  /* キーと スティックから あるく むきを きめる (まいフレーム) */
  readInput() {
    const k = this.keys;
    let dx = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    let dy = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
    if (this.pad.id !== null) { dx = this.pad.dx; dy = this.pad.dy; }
    Sim.input.dx = dx; Sim.input.dy = dy;
  },

  /* ------------------------------ どうぐ ------------------------------ */
  setTool(tool, arg) {
    this.tool = tool; this.sel = null;
    if (tool === 'prop' && arg) this.propType = arg;
    if (tool === 'deco' && arg) this.decoType = arg;
    if (tool === 'ghost') this.placing = arg;
    document.querySelectorAll('#dayBar [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    this.renderPick();
    View.fit();
  },
  renderPick() {
    const el = $('pick'), s = Sim.s;
    if (!this.tool || Game.mode !== 'day') { el.classList.add('hide'); return; }
    el.classList.remove('hide');
    let h = '<div class="phead">';
    if (this.tool === 'floor') h += `<span><b>ろうか</b> なぞって いりぐちから でぐちまで つなげよう。おきゃくさんは いちばん ちかい みちを あるくよ。<em>1マス 5${COIN}</em></span>`;
    else if (this.tool === 'rail') h += `<span><b>レール</b> ひろばを なぞって ジェットコースターの レールを ひこう。<b>のりば</b>から はじめて、ぐるっと 1しゅう つなげると はしるよ。<em>1マス ${RAIL_COST}${COIN}</em></span>`;
    else if (this.tool === 'erase') h += '<span><b>けす</b> けしたい ものを タップ。しかけと かざりは はんがくで うれる。オバケは まちあいに もどる。</span>';
    else if (this.tool === 'ghost') h += `<span><b>${this.placing.name}</b> を おく かべの マスを タップしてね。ろうかの となりが おすすめ。</span>`;
    else if (this.tool === 'prop') {
      const d = PROPS[this.propType];
      h += `<span><b>${d.name}</b> ${kindChip(d.kind)} ${d.desc} やしきの かべの マスに おいてね。</span>`;
    } else {
      const d = DECOS[this.decoType];
      h += `<span><b>${d.name}</b> ${d.desc} したの ひろばに おいてね。<em>かわいさ +${d.cute}</em></span>`;
    }
    h += '<button class="btn small" id="pickClose">おわる</button></div>';
    const list = (table, kind, cur) => {
      let o = '<div class="pitems">';
      for (const k in table) {
        const d = table[k], lock = stars(s) < d.star;
        o += `<button class="pitem ${k === cur ? 'on' : ''} ${lock ? 'lock' : ''}" data-${kind}="${k}" ${lock ? 'disabled' : ''}>
          <img src="${Icons.get(kind, k)}" alt=""><span>${d.name}</span><small>${lock ? lockLabel(d.star) : d.cost + COIN}</small>${d.kind ? `<i class="kdot" style="background:${KINDS[d.kind].color}"></i>` : ''}</button>`;
      }
      return o + '</div>';
    };
    if (this.tool === 'prop') h += list(PROPS, 'prop', this.propType);
    if (this.tool === 'deco') h += list(DECOS, 'deco', this.decoType);
    el.innerHTML = h;
    $('pickClose').onclick = () => this.setTool(null);
    el.querySelectorAll('[data-prop]').forEach((b) => b.addEventListener('click', () => this.setTool('prop', b.dataset.prop)));
    el.querySelectorAll('[data-deco]').forEach((b) => b.addEventListener('click', () => this.setTool('deco', b.dataset.deco)));
  },
  canPlace(x, y) {
    if (!this.tool) return null;
    if (this.tool === 'deco') return Sim.isPark(x, y) ? Sim.parkFree(x, y) : null;
    if (this.tool === 'rail') return Sim.isPark(x, y) ? (Sim.railAt(x, y) ? null : Sim.parkFree(x, y)) : null;
    const c = Sim.cell(x, y);
    if (this.tool === 'erase') return Sim.decoAt(x, y) || Sim.railAt(x, y) || (c >= 0 && (Sim.propAt(x, y) || Sim.ghostAt(x, y) || (c === CELL.FLOOR && !Sim.isDoor(x, y)))) ? true : null;
    if (c < 0) return null;
    if (this.tool === 'floor') return c === CELL.FLOOR ? null : Sim.free(x, y);
    return Sim.free(x, y);
  },
  toolRange() {
    if (this.tool === 'prop') return PROPS[this.propType].range;
    if (this.tool === 'ghost') return GHOSTS[this.placing.type].range;
    return 0;
  },

  /* ------------------------------ ゆび と マウス ------------------------------ */
  cellOf(e) { return View.toCell(e.clientX, e.clientY); },
  down(e) {
    Sound.init();
    if (Game.mode === 'movie') { Movie.next(); return; }
    if (Game.mode !== 'day') return;
    const c = this.cellOf(e);
    this.hover = c; this.downCell = c;
    if (this.tool === 'floor' || this.tool === 'erase' || this.tool === 'rail') { this.painting = true; this.lastPaint = null; this.paint(c); }
  },
  move(e) {
    if (Game.mode !== 'day') return;
    const c = this.cellOf(e);
    if (e.pointerType === 'mouse' || this.painting) this.hover = c;
    if (this.painting && (!this.lastPaint || c.x !== this.lastPaint.x || c.y !== this.lastPaint.y)) this.paint(c);
  },
  up(e) {
    if (Game.mode !== 'day') return;
    const wasPaint = this.painting;
    this.painting = false;
    if (e.target !== View.c) return;
    const c = this.cellOf(e);
    if (e.pointerType !== 'mouse') setTimeout(() => { if (!this.painting) this.hover = null; }, 350);
    if (wasPaint) { Game.save(); this.refresh(); return; }
    if (!this.downCell || this.downCell.x !== c.x || this.downCell.y !== c.y) return;
    this.tap(c.x, c.y, e);
  },
  paint(c) {
    this.lastPaint = c;
    if (this.tool === 'floor') { if (Sim.placeFloor(c.x, c.y)) Sound.place(); }
    else if (this.tool === 'rail') { if (Sim.placeRail(c.x, c.y)) Sound.place(); }
    else {
      const r = Sim.erase(c.x, c.y);
      if (r.startsWith('prop:')) { toast(`うった <b>+${r.slice(5)}${COIN}</b>`); Sound.coin(); }
      else if (r === 'ghost') toast('オバケを まちあいに もどしたよ。「オバケ」から また おける');
      else if (r) Sound.place();
    }
    this.refresh();
  },
  tap(x, y, e) {
    if (this.tool === 'prop') {
      if (Sim.placeProp(this.propType, x, y)) { Sound.place(); Game.save(); }
      else Sound.no();
    } else if (this.tool === 'deco') {
      if (Sim.placeDeco(this.decoType, x, y)) { Sound.place(); Game.save(); }
      else Sound.no();
    } else if (this.tool === 'ghost') {
      if (Sim.moveGhost(this.placing, x, y)) { Sound.boo(); toast(`${this.placing.name}を おいたよ`); this.setTool(null); Game.save(); }
      else Sound.no();
    } else if (!this.tool) {
      const gh = Sim.ghostAt(x, y), p = Sim.propAt(x, y), dc = Sim.decoAt(x, y);
      const wx = (e.clientX - View.ox) / View.ts, wy = (e.clientY - View.oy) / View.ts;
      if (gh) { this.sel = { x, y, range: GHOSTS[gh.type].range }; this.ghostInfo(gh); }
      else if (p) { this.sel = { x, y, range: PROPS[p.type].range }; this.propInfo(p); }
      else if (dc) this.decoInfo(dc);
      else if (wx > BOOTH.x0 - 0.6 && wx < BOOTH.x1 + 0.3 && wy > BOOTH.y0 - 0.9 && wy < BOOTH.y1 + 0.2) this.openCounter();
      else if (Sim.cell(x, y) === CELL.LOCK) this.openExpand();
      else this.sel = null;
    }
    this.refresh();
  },

  /* ------------------------------ 帯の 表示 ------------------------------ */
  set(id, v, html) { const el = $(id); if (el._v !== v) { el._v = v; if (html) el.innerHTML = v; else el.textContent = v; } },
  refresh() {
    const s = Sim.s;
    if (!s || Game.mode === 'title' || Game.mode === 'movie') return;
    const st = stars(s);
    this.set('hName', s.park);
    this.set('hDay', `${s.day}日目`);
    this.set('hMoney', fmt(s.coins));
    $('hMoney').classList.toggle('neg', s.coins < 0);
    this.set('hStars', '★'.repeat(st) + '<i>' + '★'.repeat(5 - st) + '</i>', true);
    $('hRep').style.width = (st >= 5 ? 100 : (s.rep % 20) / 20 * 100) + '%';
    this.set('bSound', Sound.on ? 'おと オン' : 'おと オフ');
    const m = MISSIONS[s.mission];
    const ev = s.event ? EVENTS[s.event] : null;
    let b = m ? `<b>もくひょう</b> ${m.text} <em>+${m.reward}${COIN}</em>` : '<b>ゆきやま いちの テーマパーク!</b> もくひょうは ぜんぶ たっせい';
    if (ev) b += `<span class="ev">こんやは ${ev.name}</span>`;
    this.set('banner', b, true);
    if (Game.mode === 'night' || Game.mode === 'result') {
      const n = Sim.n;
      const mins = Math.min(360, Math.floor(n.t / NIGHT_LEN * 360));
      this.set('nClock', n.t >= NIGHT_LEN ? 'しめきり' : `${18 + Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`);
      this.set('nGuests', `${n.served + n.left} / ${n.total}人`);
      const r = n.ratings, f = (k, v) => `<span class="fc"><img src="${Icons.get('face', k)}" alt="">${v}</span>`;
      this.set('nFaces', f(5, r[5]) + f(4, r[4]) + f(3, r[3]) + f(1, r[1]) + f(2, r[2]), true);
      document.querySelectorAll('#nightBar [data-sp]').forEach((x) => x.classList.toggle('on', +x.dataset.sp === Game.speed));
      const serve = Sim.canServe();
      this.set('act', serve ? 'うけつけ' : 'ばあ!');
      $('act').classList.toggle('serve', serve);
      $('act').classList.toggle('cool', !serve && Sim.p.cd > 0);
    }
    $('bOpen').classList.toggle('warn', !Sim.path);
  },

  /* ------------------------------ 小窓 ------------------------------ */
  modalLocked: false,
  modal(title, body, foot = '', locked = false) {
    $('mTitle').innerHTML = title; $('mBody').innerHTML = body; $('mFoot').innerHTML = foot;
    this.modalLocked = locked;
    $('mClose').classList.toggle('hide', locked);
    $('modal').classList.remove('hide');
    $('mBody').scrollTop = 0;
  },
  closeModal() { $('modal').classList.add('hide'); this.sel = null; this.fireArm = null; if (this.onClose) { const f = this.onClose; this.onClose = null; f(); } },

  statLine(d, gh) {
    const pw = gh ? Math.round(ghostPower(gh)) : d.power;
    return kindChip(d.kind) +
      (pw ? `<span class="chip">こわさ ${pw}</span>` : '') +
      (d.aura ? `<span class="chip">ずっと こわい ${d.aura}/びょう</span>` : '') +
      (d.chase ? `<span class="chip">${d.chase}びょう おいかける</span>` : '') +
      (d.stamina ? `<span class="chip">げんき ${gh ? ghostStamina(gh) : d.stamina}かい</span>` : '') +
      (d.range ? `<span class="chip">とどく ${d.range}マス</span>` : '') +
      (d.cd ? `<span class="chip">${d.cd}びょうごとに</span>` : '');
  },

  openGhosts(tab = 'team') {
    const s = Sim.s;
    this.setTool(null);
    const cap = ghostCap(s);
    let h = `<div class="mtabs"><button data-tab="team" class="${tab === 'team' ? 'on' : ''}">なかま ${s.ghosts.length}/${cap}</button><button data-tab="hire" class="${tab === 'hire' ? 'on' : ''}">オバケ</button><button data-tab="robo" class="${tab === 'robo' ? 'on' : ''}">ロボット</button></div>`;
    if (tab === 'team') {
      if (!s.ghosts.length) h += '<p class="mini">まだ なかまが いないよ。「やとう」から なかまに しよう。</p>';
      for (const gh of s.ghosts) {
        const d = GHOSTS[gh.type];
        const where = gh.desk ? '<div class="good mini">うけつけ係。カウンターで おかねを もらってくれる。</div>' : gh.x < 0 ? '<div class="bad mini">まちあい中。おかないと はたらかないよ。</div>' : '';
        h += `<div class="card"><img src="${Icons.get('ghost', gh.type)}" alt="">
          <div class="cbody"><div class="ctitle"><b>${gh.name}</b><small>${d.name}</small><span class="lv">Lv${gh.lv}</span></div>
          <div class="xp"><i style="width:${gh.lv >= 10 ? 100 : gh.exp / expNeed(gh.lv) * 100}%"></i></div>
          <div class="chips">${this.statLine(d, gh)}<span class="chip">${d.robot ? 'でんきだい' : 'きゅうりょう'} ${d.wage}${COIN}</span></div>${where}</div>
          <div class="cbtns"><button class="btn small primary" data-place="${gh.id}">${gh.x < 0 ? 'やしきに おく' : 'うごかす'}</button>
          <button class="btn small" data-desk="${gh.id}" ${gh.desk ? 'disabled' : ''}>うけつけ係</button>
          <button class="btn small" data-fire="${gh.id}">${this.fireArm === gh.id ? 'ほんとうに?' : 'やめる'}</button></div></div>`;
      }
    } else {
      const robo = tab === 'robo';
      h += `<p class="mini">${robo ? 'ロボットは おどかしたあと しばらく おいかける きかい。' : ''}なかまに できるのは ${cap}にんまで (★が ふえると ふえる)。${robo ? 'でんきだい' : 'おきゅうりょう'}は まいばん はらうよ。</p>`;
      for (const k in GHOSTS) {
        const d = GHOSTS[k];
        if (!!d.robot !== robo) continue;
        const lock = stars(s) < d.star, full = s.ghosts.length >= cap;
        h += `<div class="card ${lock ? 'lock' : ''}"><img src="${Icons.get('ghost', k)}" alt="">
          <div class="cbody"><div class="ctitle"><b>${d.name}</b></div><div class="mini">${d.desc}</div>
          <div class="chips">${this.statLine(d)}<span class="chip">${robo ? 'でんきだい' : 'きゅうりょう'} ${d.wage}${COIN}</span></div></div>
          <div class="cbtns"><button class="btn small primary" data-hire="${k}" ${lock || full ? 'disabled' : ''}>${lock ? lockLabel(d.star) : `${robo ? 'つくる' : 'やとう'} ${d.hire}${COIN}`}</button></div></div>`;
      }
    }
    this.modal('なかま', h);
    const body = $('mBody'), find = (id) => s.ghosts.find((g) => g.id === +id);
    body.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => this.openGhosts(b.dataset.tab));
    body.querySelectorAll('[data-place]').forEach((b) => b.onclick = () => { const gh = find(b.dataset.place); this.closeModal(); this.setTool('ghost', gh); });
    body.querySelectorAll('[data-desk]').forEach((b) => b.onclick = () => {
      const gh = find(b.dataset.desk);
      Sim.setDesk(gh); Sound.boo();
      toast(`${gh.name}が うけつけ係に なったよ`);
      Game.save(); this.openGhosts('team');
    });
    body.querySelectorAll('[data-fire]').forEach((b) => b.onclick = () => {
      const id = +b.dataset.fire;
      if (this.fireArm !== id) { this.fireArm = id; return this.openGhosts('team'); }
      const gh = find(id);
      s.ghosts.splice(s.ghosts.indexOf(gh), 1);
      toast(GHOSTS[gh.type].robot ? `${gh.name}を かたづけたよ` : `${gh.name}は ゆきの山頂へ かえっていった。またね!`);
      this.fireArm = null; Game.save(); this.openGhosts('team'); this.refresh();
    });
    body.querySelectorAll('[data-hire]').forEach((b) => b.onclick = () => {
      const type = b.dataset.hire;
      if (!Sim.pay(GHOSTS[type].hire)) return;
      const gh = Sim.makeGhost(s, type);
      s.ghosts.push(gh);
      Sound.boo(); toast(`${GHOSTS[type].name}の <b>${gh.name}</b> が なかまに なった!`, 'good');
      this.closeModal(); this.setTool('ghost', gh); Sim.checkMission(); Game.save(); this.refresh();
    });
  },

  ghostInfo(gh) {
    const d = GHOSTS[gh.type];
    this.modal(`${gh.name} <small>${d.name} Lv${gh.lv}</small>`,
      `<div class="card"><img src="${Icons.get('ghost', gh.type)}" alt=""><div class="cbody"><div class="mini">${d.desc}</div>
       <div class="xp"><i style="width:${gh.lv >= 10 ? 100 : gh.exp / expNeed(gh.lv) * 100}%"></i></div>
       <div class="mini">つぎの レベルまで あと ${gh.lv >= 10 ? '-' : expNeed(gh.lv) - gh.exp}かい おどかす</div>
       <div class="chips">${this.statLine(d, gh)}<span class="chip">${d.robot ? 'でんきだい' : 'きゅうりょう'} ${d.wage}${COIN}</span></div></div></div>`,
      '<button class="btn" id="gMove">うごかす</button><button class="btn" id="gAll">なかま いちらん</button>');
    $('gMove').onclick = () => { this.closeModal(); this.setTool('ghost', gh); };
    $('gAll').onclick = () => this.openGhosts('team');
  },

  propInfo(p) {
    const d = PROPS[p.type], back = Math.floor(d.cost / 2);
    this.modal(d.name,
      `<div class="card"><img src="${Icons.get('prop', p.type)}" alt=""><div class="cbody"><div class="mini">${d.desc}</div>
       <div class="chips">${this.statLine(d)}${d.slow ? '<span class="chip">あしが おそくなる</span>' : ''}${d.multi ? '<span class="chip">みんなを おどかす</span>' : ''}</div></div></div>`,
      `<button class="btn" id="pSell">うる +${back}${COIN}</button>`);
    $('pSell').onclick = () => { Sim.erase(p.x, p.y); Sound.coin(); toast(`うった <b>+${back}${COIN}</b>`); this.closeModal(); Game.save(); this.refresh(); };
  },

  decoInfo(dc) {
    const d = DECOS[dc.type], back = Math.floor(d.cost / 2);
    this.modal(d.name,
      `<div class="card"><img src="${Icons.get('deco', dc.type)}" alt=""><div class="cbody"><div class="mini">${d.desc}</div>
       <div class="chips"><span class="chip">かわいさ +${d.cute}</span>${d.shop ? `<span class="chip">ひとり ${d.shop}${COIN}</span>` : ''}${d.photo ? '<span class="chip">ひょうばん すこし アップ</span>' : ''}${d.scare ? '<span class="chip">コースターの おきゃくさんを おどかす</span>' : ''}</div></div></div>`,
      `<button class="btn" id="dSell">うる +${back}${COIN}</button>`);
    $('dSell').onclick = () => { Sim.erase(dc.x, dc.y); Sound.coin(); toast(`うった <b>+${back}${COIN}</b>`); this.closeModal(); Game.save(); this.refresh(); };
  },

  openCostumes() {
    const s = Sim.s;
    this.setTool(null);
    let h = '<p class="mini">オーナー (あなた) の かそう。よるに「ばあ!」ボタンで おどかすときの こわさが かわるよ。</p>';
    for (const k in COSTUMES) {
      const d = COSTUMES[k], own = s.wardrobe.includes(k), lock = !own && stars(s) < d.star, wear = s.costume === k;
      const btn = wear ? '<button class="btn small" disabled>きている</button>'
        : own ? `<button class="btn small primary" data-wear="${k}">きる</button>`
          : `<button class="btn small primary" data-buy="${k}" ${lock ? 'disabled' : ''}>${lock ? lockLabel(d.star) : `かう ${d.cost}${COIN}`}</button>`;
      h += `<div class="card ${lock ? 'lock' : ''} ${wear ? 'wear' : ''}"><img src="${Icons.get('owner', k)}" alt="">
        <div class="cbody"><div class="ctitle"><b>${d.name}</b></div><div class="mini">${d.desc}</div>
        <div class="chips">${kindChip(d.kind)}<span class="chip">こわさ ${d.power}</span></div></div><div class="cbtns">${btn}</div></div>`;
    }
    this.modal('かそう', h);
    const body = $('mBody');
    body.querySelectorAll('[data-wear]').forEach((b) => b.onclick = () => { s.costume = b.dataset.wear; Sound.pop(); Game.save(); this.openCostumes(); });
    body.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
      const k = b.dataset.buy;
      if (!Sim.pay(COSTUMES[k].cost)) return;
      s.wardrobe.push(k); s.costume = k; Sound.great();
      toast(`${COSTUMES[k].name}の かそうを きたよ!`, 'good');
      Game.save(); this.openCostumes(); this.refresh();
    });
  },

  openCounter() {
    this.setTool(null);
    const s = Sim.s, draw = () => {
      const fair = fairPrice(s), desk = Sim.deskGhost();
      $('mBody').innerHTML = `<p class="mini">おきゃくさんは カウンターで おかねを はらってから やしきに はいるよ。よるに あなたが カウンターへ いって「うけつけ」ボタンを おすか、なかまを「うけつけ係」に すると してくれる。またせすぎると かえって しまうよ。</p>
        <p class="center">うけつけ係: <b>${desk ? desk.name : 'いない (じぶんで する)'}</b></p>
        <h3 class="sub3">にゅうじょうりょう</h3>
        <div class="price"><button class="btn" data-d="-10">−10</button><b>${s.price}${COIN}</b><button class="btn" data-d="10">＋10</button></div>
        <p class="mini center">いまの ★での めやすは <b>${fair}</b>。こんやは やく <b>${Sim.guestEstimate()}人</b> きそう。</p>
        <p class="mini">やすいと おきゃくさんが ふえる。たかいと へるけど、ひとりから たくさん もらえる。めやすより ずっと たかいと (${Math.round(fair * 1.25)}より うえ)、まんぞくも さがるよ。</p>`;
      $('mBody').querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { s.price = clamp(s.price + +b.dataset.d, 10, 300); draw(); this.refresh(); Game.save(); });
    };
    this.modal('うけつけ カウンター', '', '<button class="btn" id="cGhost">うけつけ係を きめる</button>');
    $('cGhost').onclick = () => this.openGhosts('team');
    draw();
  },

  openExpand() {
    this.setTool(null);
    const s = Sim.s, nx = EXPAND[s.expand + 1];
    if (!nx) { this.modal('やしきを ひろげる', '<p>やしきは もう いちばん おおきいよ!</p>'); return; }
    const ok = stars(s) >= nx.star;
    this.modal('やしきを ひろげる',
      `<p>みぎがわの ゆきの ばしょを やしきに して、よこに <b>${nx.cols - EXPAND[s.expand].cols}れつ</b> ひろげる。ろうかを ながくして しかけを ふやせるし、おきゃくさんも すこし ふえるよ。</p>
       <p class="center"><b>${fmt(nx.cost)}${COIN}</b> ${ok ? '' : `<span class="bad">(★${nx.star}に なると ひろげられる)</span>`}</p>`,
      `<button class="btn primary" id="xGo" ${ok ? '' : 'disabled'}>ひろげる</button>`);
    $('xGo').onclick = () => {
      if (!Sim.expandHouse()) return;
      View.fit(); Sound.great(); toast('やしきが ひろくなった!', 'good');
      this.closeModal(); Sim.checkMission(); Game.save(); this.refresh();
    };
  },

  openMissions() {
    const s = Sim.s;
    let h = '<ol class="missions">';
    MISSIONS.forEach((m, i) => {
      const cls = i < s.mission ? 'done' : i === s.mission ? 'now' : 'later';
      h += `<li class="${cls}"><span class="mk">${i < s.mission ? 'クリア' : i === s.mission ? 'いま' : ''}</span><div>${m.text} <em>+${m.reward}${COIN}</em>${i === s.mission ? `<div class="mini">ヒント: ${m.hint}</div>` : ''}</div></li>`;
    });
    h += '</ol>';
    const st = s.stats;
    h += `<p class="mini">これまで: ${st.nights}ばん ・ おきゃくさん ${st.guests}人 ・ さいこう ${st.great}人 ・ にげだした ${st.fled}人 ・ さいだいコンボ ×${st.bestCombo} ・ ひろばの かわいさ ${cuteness(s)}</p>`;
    this.modal('もくひょう', h);
  },

  openMenu() {
    this.modal('メニュー', `<div class="menu">
      <label class="field col"><span>テーマパークの なまえ</span><input id="mPark" maxlength="12" value=""></label>
      <button class="btn" id="mCounter">うけつけ と にゅうじょうりょう</button>
      <button class="btn" id="mHow">あそびかた</button><button class="btn" id="mSnd"></button>
      <button class="btn" id="mMovie">オープニングを みる</button>
      <button class="btn" id="mTitle2">タイトルへ (セーブされます)</button></div>`);
    $('mPark').value = Sim.s.park;
    $('mPark').onchange = () => { const v = $('mPark').value.trim(); if (v) { Sim.s.park = v; Game.save(); this.refresh(); } };
    $('mSnd').textContent = Sound.on ? 'おと: オン' : 'おと: オフ';
    $('mCounter').onclick = () => this.openCounter();
    $('mHow').onclick = () => this.openHow();
    $('mSnd').onclick = () => { Sound.on = !Sound.on; Sound.init(); this.openMenu(); this.refresh(); };
    $('mMovie').onclick = () => { this.closeModal(); Game.replayMovie(); };
    $('mTitle2').onclick = () => { this.closeModal(); Game.toTitle(); };
  },

  openHow() {
    this.modal('あそびかた', `<div class="how">
      <p>ゆきの山頂の ゆきオバケたちと いっしょに、ふるい ゆうえんちを こわくて かわいい テーマパークに しよう。</p>
      <h3>ひるは じゅんび</h3>
      <ul><li><b>ろうか</b>: なぞって ひく。<b>いりぐち</b>から <b>でぐち</b>まで つながっていないと ひらけない。おきゃくさんは いちばん ちかい みちを あるく。</li>
      <li><b>しかけ</b> と <b>なかま</b>: ろうかの となりの <b>かべの マス</b>に おく。とどく はんいに きた おきゃくさんを おどかす。ロボットは おきゃくさんを おいかける。</li>
      <li><b>ひろば</b>: やしきの 下の ひろばに かざり・おみせ・ホテルなどを おく。<b>かわいさ</b>が ふえると おきゃくさんが ふえて、ながく まってくれる。おみせは かえる おきゃくさんが かいものを していく。</li>
      <li><b>レール</b>: ひろばに ジェットコースターの レールを ひく。<b>のりば</b>を おいて、そこから ぐるっと 1しゅう つなげると はしる。レールの そばに こわい かざりを おくと のっている おきゃくさんを おどかすよ。</li>
      <li><b>かそう</b>: あなたの かそうを えらぶ。おどかす こわさが かわる。</li>
      <li><b>うけつけ カウンター</b>を タップすると にゅうじょうりょうを きめられる。</li></ul>
      <h3>よるは かいてん</h3>
      <ul><li>あなたは <b>やじるしキー / WASD</b> (スマホは ひだりしたの スティック) で あるける。</li>
      <li>おきゃくさんは まず <b>カウンター</b>に ならぶ。カウンターで <b>うけつけ</b>ボタン (スペースキー) を おすと おかねを もらえる。なかまを うけつけ係に すれば まかせられる。またせすぎると かえって しまう。</li>
      <li>やしきの 中で おきゃくさんの ちかくで <b>ばあ!</b>ボタン (スペースキー) を おすと、じぶんで おどかせる。</li>
      <li>おきゃくさんの あたまの うえに <b>★</b> と <b>どきどきメーター</b> が でる。おどかすほど ★が ひかって、★5の まま でぐちに つくと「さいこう!」。</li>
      <li>どきどきメーターは おどかすと ふえて、しばらく なにも ないと へっていく。<b>いっぱいに なると にげだして</b> しまう。こわい ものの あいだを あけるのが コツ。</li>
      <li>おきゃくさんには にがてな こわさ (びっくり・ぞくぞく・ひえひえ) が ある。にがてだと 1.6ばい こわい。</li>
      <li>なかまは おなじ おきゃくさんを 1回だけ おどかす。ひとばんに おどかせる 回数 (げんき) も きまっていて、つかれると ねてしまう。</li></ul>
      <h3>ひょうばん</h3>
      <p>まんぞくした おきゃくさんが ふえると ★が ふえて、あたらしい ものが つかえるように なる。そのかわり おきゃくさんの きたいも 大きくなるから、どんどん パークを おおきく していこう。★5の「ゆきやま いちの テーマパーク」を めざそう!</p></div>`);
  },

  showResults(r) {
    const s = Sim.s, R = r.ratings;
    const row = (k, label, n) => `<div class="rrow"><img src="${Icons.get('face', k)}" alt=""><b>${label}</b><i>${n}人</i></div>`;
    let h = `<div class="rgrid">${row(5, 'さいこう!', R[5])}${row(4, 'こわかった', R[4])}${row(3, 'まあまあ', R[3])}${row(1, 'つまらない', R[1])}${row(2, 'にげだした', R[2])}</div>`;
    h += `<div class="money-tbl"><div><span>にゅうじょうりょう</span><b>+${fmt(r.tickets)}</b></div><div><span>チップ</span><b>+${fmt(r.tips)}</b></div>`;
    if (r.shop) h += `<div><span>ひろばの おみせ と のりもの</span><b>+${fmt(r.shop)}</b></div>`;
    if (r.bonus) h += `<div><span>テレビの おれい</span><b>+${fmt(r.bonus)}</b></div>`;
    h += `<div><span>なかまの おきゅうりょう</span><b class="bad">−${fmt(r.wages)}</b></div><div class="sum"><span>こんやの もうけ</span><b class="${r.net >= 0 ? 'good' : 'bad'}">${r.net >= 0 ? '+' : ''}${fmt(r.net)}${COIN}</b></div></div>`;
    const dr = r.repAfter - r.repBefore;
    h += `<p class="center">ひょうばん ${'★'.repeat(r.starsAfter)}<span class="muted">${'★'.repeat(5 - r.starsAfter)}</span> <b class="${dr >= 0 ? 'good' : 'bad'}">(${dr >= 0 ? '+' : ''}${dr.toFixed(1)})</b></p>`;
    if (r.starsAfter > r.starsBefore) h += `<p class="center good"><b>★${r.starsAfter}に なった! あたらしい ものが つかえるかも</b></p>`;
    if (r.starsAfter < r.starsBefore) h += '<p class="center bad"><b>★が へってしまった…</b></p>';
    if (r.lvUps.length) h += `<p class="center">レベルアップ: ${r.lvUps.join('、')}</p>`;
    const extra = [];
    if (r.pScares) extra.push(`あなたが おどかした 回数 ${r.pScares}`);
    if (r.rides) extra.push(`ジェットコースターに のった人 ${r.rides}`);
    if (r.bestCombo >= 2) extra.push(`さいだいコンボ ×${r.bestCombo}`);
    if (extra.length) h += `<p class="center mini">${extra.join(' ・ ')}</p>`;
    const tips = [];
    if (r.left) tips.push(`まちくたびれて かえった おきゃくさんが ${r.left}人 いたよ。カウンターで うけつけ するか、なかまを うけつけ係に しよう。`);
    if (R[1] + R[3] > R[4] + R[5]) tips.push('もっと こわがりたい おきゃくさんが おおいよ。しかけや なかまを ふやそう。');
    if (R[2] > 1) tips.push('にげだす おきゃくさんが いるよ。こわい ものが つづきすぎかも。あいだを あけてみよう。');
    if (r.slept) tips.push('つかれて ねてしまった なかまが いたよ。なかまを ふやそう。');
    if (tips.length) h += `<div class="tipbox"><b>ヒント</b><br>${tips.join('<br>')}</div>`;
    this.modal(`${s.day}日目の よるの けっか`, h, '<button class="btn primary" id="rNext">つぎの日へ</button>', true);
    Sound.great();
    $('rNext').onclick = () => { this.modalLocked = false; this.closeModal(); Game.nextDay(); };
  },
};
