/* =========================================================================
   SNOW HAUNT ― 画面の ボタンと 小窓
   上の帯 / けんちくの どうぐ / オバケ・きせかえ・うけつけ・ひろげる・もくひょう / 夜の そうさ / けっか
   ========================================================================= */
'use strict';

const kindChip = (kind) => `<span class="chip kd" style="--c:${KINDS[kind].color}">${KINDS[kind].name}</span>`;
const lockLabel = (star) => `★${star}で かいほう`;
const priceOf = (d) => (d.soul ? d.soul + SOUL : d.cost + COIN);

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
    $('bSoul').onclick = () => this.openGhostShop();
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
      if (Game.mode !== 'night' && Game.mode !== 'day') return;
      if (Game.mode === 'day' && this.tool) return;
      if (k === ' ' || k === 'j' || k === 'enter') { e.preventDefault(); if (!e.repeat) Sim.input.act = true; }
      else if (k === 'p' && Game.mode === 'night') { Game.speed = Game.speed ? 0 : 1; this.refresh(); }
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
    $('ctrl').classList.toggle('hide', !(Game.mode === 'night' || (Game.mode === 'day' && !tool)));
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
          <img src="${Icons.get(kind, k)}" alt=""><span>${d.name}</span><small>${lock ? lockLabel(d.star) : priceOf(d)}</small>${d.kind ? `<i class="kdot" style="background:${KINDS[d.kind].color}"></i>` : ''}</button>`;
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
      else if (dc) { if (dc.type === 'foodshop') this.openFoodShop(); else this.decoInfo(dc); }
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
    this.set('hSoul', fmt(s.soul));
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
    }
    if (Sim.p && Sim.n && (Game.mode === 'night' || Game.mode === 'day')) {
      const serve = Sim.canServe(), sell = !serve && Sim.canSell();
      this.set('act', serve ? 'うけつけ' : sell ? 'うる' : 'ばあ!');
      $('act').classList.toggle('serve', serve || sell);
      $('act').classList.toggle('cool', !serve && !sell && Sim.p.cd > 0);
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
        const where = gh.desk ? '<div class="good mini">うけつけ係。カウンターで おかねを もらってくれる。</div>' : gh.clerk ? '<div class="good mini">おみせ係。たべものやさんで たべものを うってくれる。</div>' : gh.x < 0 ? '<div class="bad mini">まちあい中。おかないと はたらかないよ。</div>' : '';
        h += `<div class="card"><img src="${Icons.get('ghost', gh.type)}" alt="">
          <div class="cbody"><div class="ctitle"><b>${gh.name}</b><small>${d.name}</small><span class="lv">Lv${gh.lv}</span></div>
          <div class="xp"><i style="width:${gh.lv >= 10 ? 100 : gh.exp / expNeed(gh.lv) * 100}%"></i></div>
          <div class="chips">${this.statLine(d, gh)}<span class="chip">${d.robot ? 'でんきだい' : 'きゅうりょう'} ${d.wage}${COIN}</span></div>${where}</div>
          <div class="cbtns"><button class="btn small primary" data-place="${gh.id}">${gh.x < 0 ? 'やしきに おく' : 'うごかす'}</button>
          <button class="btn small" data-desk="${gh.id}" ${gh.desk ? 'disabled' : ''}>うけつけ係</button>
          <button class="btn small" data-clerk="${gh.id}" ${gh.clerk ? 'disabled' : ''}>おみせ係</button>
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
    body.querySelectorAll('[data-clerk]').forEach((b) => b.onclick = () => {
      const gh = find(b.dataset.clerk);
      Sim.setClerk(gh); Sound.boo();
      toast(`${gh.name}が おみせ係に なったよ${Sim.foodShop() ? '' : '。ひろばに たべものやさんを たてよう'}`);
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
    const d = DECOS[dc.type], back = Math.floor((d.cost || 0) / 2);
    this.modal(d.name,
      `<div class="card"><img src="${Icons.get('deco', dc.type)}" alt=""><div class="cbody"><div class="mini">${d.desc}</div>
       <div class="chips"><span class="chip">かわいさ +${d.cute}</span>${d.shop ? `<span class="chip">ひとり ${d.shop}${COIN}</span>` : ''}${d.photo ? '<span class="chip">ひょうばん すこし アップ</span>' : ''}${d.scare ? '<span class="chip">コースターの おきゃくさんを おどかす</span>' : ''}</div></div></div>`,
      `<button class="btn" id="dSell">うる +${back}${COIN}</button>`);
    $('dSell').onclick = () => { Sim.erase(dc.x, dc.y); Sound.coin(); toast(`うった <b>+${back}${COIN}</b>`); this.closeModal(); Game.save(); this.refresh(); };
  },

  /* いろ と かお の えらぶ ボタン (なまえを きめる がめん でも つかう) */
  lookPicker(look, owned = []) {
    let h = '<div class="lookrow">';
    for (const k in LOOK_COLORS) {
      const c = LOOK_COLORS[k], lock = c.soul && !owned.includes(k);
      h += `<button class="sw ${look.color === k ? 'on' : ''} ${lock ? 'locked' : ''}" ${lock ? `data-soulcolor="${k}"` : `data-color="${k}"`} title="${c.name}" style="background:${c.c[0]};border-color:${c.c[1]}"></button>`;
    }
    h += '</div><div class="lookrow">';
    for (const k in LOOK_FACES) h += `<button class="facebtn ${look.face === k ? 'on' : ''}" data-face="${k}"><img src="${Icons.get('look', 'face:' + k)}" alt=""><span>${LOOK_FACES[k]}</span></button>`;
    return h + '</div>';
  },
  bindLookPicker(root, look, redraw) {
    root.querySelectorAll('[data-color]').forEach((b) => b.onclick = () => { look.color = b.dataset.color; Sound.pop(); redraw(); });
    root.querySelectorAll('[data-face]').forEach((b) => b.onclick = () => { look.face = b.dataset.face; Sound.pop(); redraw(); });
    root.querySelectorAll('[data-soulcolor]').forEach((b) => b.onclick = () => { toast(`${LOOK_COLORS[b.dataset.soulcolor].name}は おばけショップで おばけだまと こうかん できるよ`); Sound.no(); });
  },
  previewOwner(canvas, look) {
    const g = canvas.getContext('2d'), w = canvas.width;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, w);
    drawOwner(g, w / 2, w * 0.86, w * 0.62, look, { t: Game.t });
  },

  openCostumes() {
    const s = Sim.s;
    this.setTool(null);
    let h = `<div class="lookhead"><canvas id="lookPrev" width="140" height="140"></canvas><p class="mini">あなたの オバケの きせかえ。<b>いろ</b> と <b>かお</b> は じゆうに かえられる。<b>アクセサリー</b>で よるに「ばあ!」と おどかすときの こわさが かわるよ。</p></div>`;
    h += '<h3 class="sub3">いろ と かお</h3>' + this.lookPicker(s.look, s.colorsOwned) + '<h3 class="sub3">アクセサリー</h3>';
    for (const k in COSTUMES) {
      const d = COSTUMES[k], own = s.wardrobe.includes(k), lock = !own && stars(s) < d.star, wear = s.costume === k;
      const btn = wear ? '<button class="btn small" disabled>つけている</button>'
        : own ? `<button class="btn small primary" data-wear="${k}">つける</button>`
          : `<button class="btn small primary" data-buy="${k}" ${lock ? 'disabled' : ''}>${lock ? lockLabel(d.star) : `かう ${priceOf(d)}`}</button>`;
      h += `<div class="card ${lock ? 'lock' : ''} ${wear ? 'wear' : ''}"><img src="${Icons.get('owner', k)}" alt="">
        <div class="cbody"><div class="ctitle"><b>${d.name}</b></div><div class="mini">${d.desc}</div>
        <div class="chips">${kindChip(d.kind)}<span class="chip">こわさ ${d.power}</span></div></div><div class="cbtns">${btn}</div></div>`;
    }
    const top = $('mBody').scrollTop;
    this.modal('きせかえ', h);
    $('mBody').scrollTop = top;
    const body = $('mBody');
    this.previewOwner($('lookPrev'), Sim.ownerLook());
    this.bindLookPicker(body, s.look, () => { Game.save(); this.openCostumes(); });
    body.querySelectorAll('[data-wear]').forEach((b) => b.onclick = () => { s.costume = b.dataset.wear; Sound.pop(); Game.save(); this.openCostumes(); });
    body.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
      const k = b.dataset.buy;
      if (!Sim.payItem(COSTUMES[k])) return;
      s.wardrobe.push(k); s.costume = k; Sound.great();
      toast(`${COSTUMES[k].name}を つけたよ!`, 'good');
      Game.save(); this.openCostumes(); this.refresh();
    });
  },

  openFoodShop() {
    this.setTool(null);
    const s = Sim.s, menu = Sim.menu(), clerk = Sim.clerkGhost();
    let h = `<p class="mini">おきゃくさんが おみせの まえに ならんで、メニューから ひとつ ちゅうもんするよ。あなたが おみせの まえで「うる」ボタンを おすか、なかまを おみせ係に すると うれる。ひるの おさんぽの おきゃくさんも かいに くるよ。</p>
      <p class="center">おみせ係: <b>${clerk ? clerk.name : 'いない (じぶんで うる)'}</b></p><h3 class="sub3">メニュー</h3>`;
    for (const k in FOODS) {
      const d = FOODS[k], on = menu.includes(k);
      const note = on ? '<span class="good mini">うっている</span>' : d.soul ? `<span class="mini">おばけショップで ${d.soul}${SOUL}</span>` : `<span class="mini">${lockLabel(d.star)}</span>`;
      h += `<div class="card ${on ? '' : 'lock'}"><img src="${Icons.get('food', k)}" alt=""><div class="cbody"><div class="ctitle"><b>${d.name}</b><small>${d.price}${COIN}</small></div>${note}</div></div>`;
    }
    const dc = Sim.foodShop();
    this.modal('たべものやさん', h, `<button class="btn" id="fClerk">おみせ係を きめる</button><button class="btn" id="fSell">うる +${Math.floor(DECOS.foodshop.cost / 2)}${COIN}</button>`);
    $('fClerk').onclick = () => this.openGhosts('team');
    $('fSell').onclick = () => { Sim.erase(dc.x, dc.y); Sound.coin(); this.closeModal(); Game.save(); this.refresh(); };
  },

  /* おばけだまで こうかんする オバケだけの おみせ */
  openGhostShop() {
    this.setTool(null);
    const s = Sim.s;
    let h = `<p class="mini"><b>おばけだま</b>は オバケだけの おかね。ひるも よるも、あなたが じぶんで「ばあ!」と おどかすと もらえるよ。さいこうの おきゃくさんが でても すこし もらえる。</p>
      <p class="center soulnow">いま もっている おばけだま <b>${fmt(s.soul)}</b>${SOUL}</p>`;
    const row = (img, name, desc, btn) => `<div class="card"><img src="${img}" alt=""><div class="cbody"><div class="ctitle"><b>${name}</b></div><div class="mini">${desc}</div></div><div class="cbtns">${btn}</div></div>`;
    h += '<h3 class="sub3">オバケの いろ</h3>';
    for (const k in LOOK_COLORS) {
      const c = LOOK_COLORS[k]; if (!c.soul) continue;
      const own = s.colorsOwned.includes(k);
      h += row(Icons.get('look', 'color:' + k), c.name, 'あなたの オバケを この いろに できる。', own ? '<button class="btn small" disabled>もっている</button>' : `<button class="btn small primary" data-scolor="${k}">こうかん ${c.soul}${SOUL}</button>`);
    }
    h += '<h3 class="sub3">アクセサリー</h3>';
    for (const k in COSTUMES) {
      const d = COSTUMES[k]; if (!d.soul) continue;
      const own = s.wardrobe.includes(k);
      h += row(Icons.get('owner', k), d.name, `${KINDS[d.kind].name} ・ こわさ ${d.power}`, own ? '<button class="btn small" disabled>もっている</button>' : `<button class="btn small primary" data-swear="${k}">こうかん ${d.soul}${SOUL}</button>`);
    }
    h += '<h3 class="sub3">たべものやさんの メニュー</h3>';
    for (const k in FOODS) {
      const d = FOODS[k]; if (!d.soul) continue;
      const own = s.menuOwned.includes(k);
      h += row(Icons.get('food', k), d.name, `ひとつ ${d.price}${COIN} で うれる`, own ? '<button class="btn small" disabled>もっている</button>' : `<button class="btn small primary" data-sfood="${k}">こうかん ${d.soul}${SOUL}</button>`);
    }
    h += '<h3 class="sub3">ひろばの かざり</h3>';
    for (const k in DECOS) {
      const d = DECOS[k]; if (!d.soul) continue;
      h += row(Icons.get('deco', k), d.name, d.desc, `<button class="btn small primary" data-sdeco="${k}">おく ${d.soul}${SOUL}</button>`);
    }
    const top = $('modal').classList.contains('hide') ? 0 : $('mBody').scrollTop;
    this.modal('おばけショップ', h);
    $('mBody').scrollTop = top;
    const body = $('mBody'), done = (msg) => { Sound.great(); toast(msg, 'good'); Game.save(); this.refresh(); this.openGhostShop(); };
    body.querySelectorAll('[data-scolor]').forEach((b) => b.onclick = () => { const k = b.dataset.scolor; if (!Sim.paySoul(LOOK_COLORS[k].soul)) return; s.colorsOwned.push(k); s.look.color = k; done(`${LOOK_COLORS[k].name}に なったよ!`); });
    body.querySelectorAll('[data-swear]').forEach((b) => b.onclick = () => { const k = b.dataset.swear; if (!Sim.paySoul(COSTUMES[k].soul)) return; s.wardrobe.push(k); s.costume = k; done(`${COSTUMES[k].name}を つけたよ!`); });
    body.querySelectorAll('[data-sfood]').forEach((b) => b.onclick = () => { const k = b.dataset.sfood; if (!Sim.paySoul(FOODS[k].soul)) return; s.menuOwned.push(k); done(`メニューに ${FOODS[k].name}が ふえたよ!`); });
    body.querySelectorAll('[data-sdeco]').forEach((b) => b.onclick = () => { this.closeModal(); this.setTool('deco', b.dataset.sdeco); });
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
      <p>あなたも ゆきオバケの なかま。ゆきの山頂の ゆきオバケたちと いっしょに、ふるい ゆうえんちを こわくて かわいい テーマパークに しよう。</p>
      <h3>ひるは じゅんび</h3>
      <ul><li><b>ろうか</b>: なぞって ひく。<b>いりぐち</b>から <b>でぐち</b>まで つながっていないと ひらけない。おきゃくさんは いちばん ちかい みちを あるく。</li>
      <li><b>しかけ</b> と <b>なかま</b>: ろうかの となりの <b>かべの マス</b>に おく。とどく はんいに きた おきゃくさんを おどかす。ロボットは おきゃくさんを おいかける。</li>
      <li><b>ひろば</b>: やしきの 下の ひろばに かざり・おみせ・ホテルなどを おく。<b>かわいさ</b>が ふえると おきゃくさんが ふえて、ながく まってくれる。おみせは かえる おきゃくさんが かいものを していく。</li>
      <li><b>レール</b>: ひろばに ジェットコースターの レールを ひく。<b>のりば</b>を おいて、そこから ぐるっと 1しゅう つなげると はしる。レールの そばに こわい かざりを おくと のっている おきゃくさんを おどかすよ。</li>
      <li><b>きせかえ</b>: あなたの オバケの いろ・かお・アクセサリーを えらぶ。アクセサリーで おどかす こわさが かわる。</li>
      <li><b>うけつけ カウンター</b>を タップすると にゅうじょうりょうを きめられる。</li>
      <li>ひるも あなたの オバケは うごける。ひろばに くる <b>おさんぽの おきゃくさん</b>を「ばあ!」と おどかしてみよう。</li>
      <li><b>たべものやさん</b>を ひろばに たてると、おきゃくさんが ならんで たべものを かう。おみせの まえで「うる」ボタンで うれる。</li>
      <li><b>おばけだま</b>は オバケだけの おかね。じぶんで おどかすと たまる。上の おばけだまを タップすると <b>おばけショップ</b>で とくべつな ものと こうかん できる。</li></ul>
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
    if (r.food) h += `<div><span>たべものやさん</span><b>+${fmt(r.food)}</b></div>`;
    if (r.bonus) h += `<div><span>テレビの おれい</span><b>+${fmt(r.bonus)}</b></div>`;
    h += `<div><span>なかまの おきゅうりょう</span><b class="bad">−${fmt(r.wages)}</b></div><div class="sum"><span>こんやの もうけ</span><b class="${r.net >= 0 ? 'good' : 'bad'}">${r.net >= 0 ? '+' : ''}${fmt(r.net)}${COIN}</b></div></div>`;
    const dr = r.repAfter - r.repBefore;
    h += `<p class="center">ひょうばん ${'★'.repeat(r.starsAfter)}<span class="muted">${'★'.repeat(5 - r.starsAfter)}</span> <b class="${dr >= 0 ? 'good' : 'bad'}">(${dr >= 0 ? '+' : ''}${dr.toFixed(1)})</b></p>`;
    if (r.starsAfter > r.starsBefore) h += `<p class="center good"><b>★${r.starsAfter}に なった! あたらしい ものが つかえるかも</b></p>`;
    if (r.starsAfter < r.starsBefore) h += '<p class="center bad"><b>★が へってしまった…</b></p>';
    if (r.lvUps.length) h += `<p class="center">レベルアップ: ${r.lvUps.join('、')}</p>`;
    const extra = [];
    if (r.pScares) extra.push(`あなたが おどかした 回数 ${r.pScares}`);
    if (r.soul) extra.push(`おばけだま +${r.soul}`);
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
