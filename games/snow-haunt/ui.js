/* =========================================================================
   SNOW HAUNT ― 画面の ボタンと 小窓
   上の帯 / けんちくの どうぐ / オバケ・ねだん・ひろげる・もくひょう / 夜の けっか
   ========================================================================= */
'use strict';

const UI = {
  tool: null,        // 'floor' | 'erase' | 'prop' | 'ghost' | null
  propType: 'candle',
  placing: null,     // おこうと している オバケ
  hover: null,       // ゆびや マウスが ある マス
  sel: null,         // しらべている もの (とどく はんいを 出す)
  painting: false, lastPaint: null, downCell: null, fireArm: null,

  init() {
    document.querySelectorAll('#dayBar [data-tool]').forEach((b) => b.addEventListener('click', () => {
      Sound.init();
      const t = b.dataset.tool;
      if (t === 'ghost') return this.openGhosts();
      this.setTool(this.tool === t ? null : t);
    }));
    $('bPrice').onclick = () => this.openPrice();
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
      if (e.key === 'Escape') { if (!$('modal').classList.contains('hide')) { if (!this.modalLocked) this.closeModal(); } else this.setTool(null); }
      if (Game.mode === 'night' && e.key === ' ') { e.preventDefault(); Game.speed = Game.speed ? 0 : 1; this.refresh(); }
    });
  },

  /* ------------------------------ どうぐ ------------------------------ */
  setTool(tool, arg) {
    this.tool = tool; this.sel = null;
    if (tool === 'prop' && arg) this.propType = arg;
    if (tool === 'ghost') this.placing = arg;
    document.querySelectorAll('#dayBar [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool || (tool === 'ghost' && b.dataset.tool === 'ghost')));
    this.renderPick();
    View.fit();
  },
  renderPick() {
    const el = $('pick'), s = Sim.s;
    if (!this.tool || Game.mode !== 'day') { el.classList.add('hide'); return; }
    el.classList.remove('hide');
    let h = '<div class="phead">';
    if (this.tool === 'floor') h += '<span><b>🧱 ろうか</b> なぞって いりぐちから でぐちまで つなげよう。おきゃくさんは いちばん ちかい みちを あるくよ。<em>1マス 5🪙</em></span>';
    else if (this.tool === 'erase') h += '<span><b>🧹 けす</b> けしたい ものを タップ。しかけは はんがくで うれる。オバケは まちあいに もどる。</span>';
    else if (this.tool === 'ghost') h += `<span><b>👻 ${this.placing.name}</b> を おく かべの マスを タップしてね。ろうかの となりが おすすめ。</span>`;
    else {
      const d = PROPS[this.propType];
      h += `<span><b>${d.name}</b> ${KINDS[d.kind].icon}${KINDS[d.kind].name} ― ${d.desc} かべの マスに おいてね。</span>`;
    }
    h += '<button class="btn small" id="pickClose">おわる</button></div>';
    if (this.tool === 'prop') {
      h += '<div class="pitems">';
      for (const k in PROPS) {
        const d = PROPS[k], lock = stars(s) < d.star;
        h += `<button class="pitem ${k === this.propType ? 'on' : ''} ${lock ? 'lock' : ''}" data-prop="${k}" ${lock ? 'disabled' : ''}>
          <img src="${Icons.get('prop', k)}" alt=""><span>${d.name}</span><small>${lock ? '🔒★' + d.star : d.cost + '🪙'}</small><i class="kd">${KINDS[d.kind].icon}</i></button>`;
      }
      h += '</div>';
    }
    el.innerHTML = h;
    $('pickClose').onclick = () => this.setTool(null);
    el.querySelectorAll('[data-prop]').forEach((b) => b.addEventListener('click', () => this.setTool('prop', b.dataset.prop)));
  },
  canPlace(x, y) {
    const c = Sim.cell(x, y);
    if (!this.tool || c < 0) return null;
    if (this.tool === 'floor') return c === CELL.FLOOR ? null : Sim.free(x, y);
    if (this.tool === 'erase') return Sim.propAt(x, y) || Sim.ghostAt(x, y) || (c === CELL.FLOOR && !Sim.isDoor(x, y)) ? true : null;
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
    if (Game.mode !== 'day') return;
    const c = this.cellOf(e);
    this.hover = c; this.downCell = c;
    if (this.tool === 'floor' || this.tool === 'erase') { this.painting = true; this.lastPaint = null; this.paint(c); }
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
    this.tap(c.x, c.y);
  },
  paint(c) {
    this.lastPaint = c;
    if (this.tool === 'floor') { if (Sim.placeFloor(c.x, c.y)) Sound.place(); }
    else {
      const r = Sim.erase(c.x, c.y);
      if (r.startsWith('prop:')) { toast(`しかけを うった <b>+${r.slice(5)}🪙</b>`); Sound.coin(); }
      else if (r === 'ghost') toast('オバケを まちあいに もどしたよ。「オバケ」から また おける');
      else if (r) Sound.place();
    }
    this.refresh();
  },
  tap(x, y) {
    if (this.tool === 'prop') {
      if (Sim.placeProp(this.propType, x, y)) { Sound.place(); Game.save(); }
      else if (Sim.cell(x, y) >= 0 && !Sim.free(x, y)) Sound.no();
    } else if (this.tool === 'ghost') {
      if (Sim.moveGhost(this.placing, x, y)) { Sound.boo(); toast(`${this.placing.name}を おいたよ`); this.setTool(null); Game.save(); }
      else Sound.no();
    } else if (!this.tool) {
      const gh = Sim.ghostAt(x, y), p = Sim.propAt(x, y);
      if (gh) { this.sel = { x, y, range: GHOSTS[gh.type].range }; this.ghostInfo(gh); }
      else if (p) { this.sel = { x, y, range: PROPS[p.type].range }; this.propInfo(p); }
      else this.sel = null;
    }
    this.refresh();
  },

  /* ------------------------------ 帯の 表示 ------------------------------ */
  set(id, v, html) { const el = $(id); if (el._v !== v) { el._v = v; if (html) el.innerHTML = v; else el.textContent = v; } },
  refresh() {
    const s = Sim.s;
    if (!s || Game.mode === 'title') return;
    const st = stars(s);
    this.set('hDay', `${s.day}日目`);
    this.set('hMoney', fmt(s.coins));
    $('hMoney').classList.toggle('neg', s.coins < 0);
    this.set('hStars', '★'.repeat(st) + '<i>' + '★'.repeat(5 - st) + '</i>', true);
    $('hRep').style.width = (st >= 5 ? 100 : (s.rep % 20) / 20 * 100) + '%';
    this.set('bSound', Sound.on ? '🔊' : '🔇');
    const m = MISSIONS[s.mission];
    const ev = s.event ? EVENTS[s.event] : null;
    let b = m ? `<b>もくひょう</b> ${m.text} <em>+${m.reward}🪙</em>` : '<b>🏆 ゆきやま いちの おばけやしき!</b> もくひょうは ぜんぶ たっせい';
    if (ev) b += `<span class="ev">${ev.icon} こんやは ${ev.name}</span>`;
    this.set('banner', b, true);
    if (Game.mode === 'night' || Game.mode === 'result') {
      const n = Sim.n;
      const mins = Math.min(360, Math.floor(n.t / NIGHT_LEN * 360));
      this.set('nClock', n.t >= NIGHT_LEN ? 'しめきり' : `${18 + Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`);
      this.set('nGuests', `${n.served} / ${n.total}人`);
      const r = n.ratings;
      this.set('nFaces', `😆${r[5]} 😊${r[4]} 🙂${r[3]} 😑${r[1]} 😱${r[2]}`);
      document.querySelectorAll('#nightBar [data-sp]').forEach((x) => x.classList.toggle('on', +x.dataset.sp === Game.speed));
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
    return `<span class="chip" style="--c:${KINDS[d.kind].color}">${KINDS[d.kind].icon} ${KINDS[d.kind].name}</span>` +
      (pw ? `<span class="chip">こわさ ${pw}</span>` : '') +
      (d.aura ? `<span class="chip">ずっと こわい ${d.aura}/びょう</span>` : '') +
      (d.stamina ? `<span class="chip">げんき ${gh ? ghostStamina(gh) : d.stamina}かい</span>` : '') +
      `<span class="chip">とどく ${d.range}マス</span>` +
      (d.cd ? `<span class="chip">${d.cd}びょうごとに</span>` : '');
  },

  openGhosts(tab = 'team') {
    const s = Sim.s;
    this.setTool(null);
    const cap = ghostCap(s);
    let h = `<div class="mtabs"><button data-tab="team" class="${tab === 'team' ? 'on' : ''}">なかま ${s.ghosts.length}/${cap}</button><button data-tab="hire" class="${tab === 'hire' ? 'on' : ''}">やとう</button></div>`;
    if (tab === 'team') {
      if (!s.ghosts.length) h += '<p class="mini">まだ オバケが いないよ。「やとう」から なかまに しよう。</p>';
      for (const gh of s.ghosts) {
        const d = GHOSTS[gh.type];
        h += `<div class="card"><img src="${Icons.get('ghost', gh.type)}" alt="">
          <div class="cbody"><div class="ctitle"><b>${gh.name}</b><small>${d.name}</small><span class="lv">Lv${gh.lv}</span></div>
          <div class="xp"><i style="width:${gh.lv >= 10 ? 100 : gh.exp / expNeed(gh.lv) * 100}%"></i></div>
          <div class="chips">${this.statLine(d, gh)}<span class="chip">きゅうりょう ${d.wage}🪙</span></div>
          ${gh.x < 0 ? '<div class="bad mini">まちあい中。おかないと はたらかないよ。</div>' : ''}</div>
          <div class="cbtns"><button class="btn small primary" data-place="${gh.id}">${gh.x < 0 ? 'おく' : 'うごかす'}</button>
          <button class="btn small" data-fire="${gh.id}">${this.fireArm === gh.id ? 'ほんとうに?' : 'やめる'}</button></div></div>`;
      }
    } else {
      h += `<p class="mini">やとえるのは ${cap}にんまで (★が ふえると ふえる)。おきゅうりょうは まいばん はらうよ。</p>`;
      for (const k in GHOSTS) {
        const d = GHOSTS[k], lock = stars(s) < d.star, full = s.ghosts.length >= cap;
        h += `<div class="card ${lock ? 'lock' : ''}"><img src="${Icons.get('ghost', k)}" alt="">
          <div class="cbody"><div class="ctitle"><b>${d.name}</b></div><div class="mini">${d.desc}</div>
          <div class="chips">${this.statLine(d)}<span class="chip">きゅうりょう ${d.wage}🪙</span></div></div>
          <div class="cbtns"><button class="btn small primary" data-hire="${k}" ${lock || full ? 'disabled' : ''}>${lock ? '🔒 ★' + d.star : `やとう ${d.hire}🪙`}</button></div></div>`;
      }
    }
    this.modal('👻 オバケ', h);
    const body = $('mBody');
    body.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => this.openGhosts(b.dataset.tab));
    body.querySelectorAll('[data-place]').forEach((b) => b.onclick = () => {
      const gh = s.ghosts.find((g) => g.id === +b.dataset.place);
      this.closeModal(); this.setTool('ghost', gh);
    });
    body.querySelectorAll('[data-fire]').forEach((b) => b.onclick = () => {
      const id = +b.dataset.fire;
      if (this.fireArm !== id) { this.fireArm = id; return this.openGhosts('team'); }
      const gh = s.ghosts.find((g) => g.id === id);
      s.ghosts.splice(s.ghosts.indexOf(gh), 1);
      toast(`${gh.name}は ゆきの山頂へ かえっていった。またね!`);
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
    this.modal(`👻 ${gh.name} <small>${d.name} Lv${gh.lv}</small>`,
      `<div class="card"><img src="${Icons.get('ghost', gh.type)}" alt=""><div class="cbody"><div class="mini">${d.desc}</div>
       <div class="xp"><i style="width:${gh.lv >= 10 ? 100 : gh.exp / expNeed(gh.lv) * 100}%"></i></div>
       <div class="mini">つぎの レベルまで あと ${gh.lv >= 10 ? '-' : expNeed(gh.lv) - gh.exp}かい おどかす</div>
       <div class="chips">${this.statLine(d, gh)}<span class="chip">きゅうりょう ${d.wage}🪙</span></div></div></div>`,
      '<button class="btn" id="gMove">うごかす</button><button class="btn" id="gAll">オバケ いちらん</button>');
    $('gMove').onclick = () => { this.closeModal(); this.setTool('ghost', gh); };
    $('gAll').onclick = () => this.openGhosts('team');
  },

  propInfo(p) {
    const d = PROPS[p.type], back = Math.floor(d.cost / 2);
    this.modal(`${d.name}`,
      `<div class="card"><img src="${Icons.get('prop', p.type)}" alt=""><div class="cbody"><div class="mini">${d.desc}</div>
       <div class="chips">${this.statLine(d)}${d.slow ? '<span class="chip">あしが おそくなる</span>' : ''}${d.multi ? '<span class="chip">みんなを おどかす</span>' : ''}</div></div></div>`,
      `<button class="btn" id="pSell">うる +${back}🪙</button>`);
    $('pSell').onclick = () => { Sim.erase(p.x, p.y); Sound.coin(); toast(`うった <b>+${back}🪙</b>`); this.closeModal(); Game.save(); this.refresh(); };
  },

  openPrice() {
    this.setTool(null);
    const s = Sim.s, draw = () => {
      const fair = fairPrice(s);
      $('mBody').innerHTML = `<div class="price"><button class="btn" data-d="-10">−10</button><b>${s.price}🪙</b><button class="btn" data-d="10">＋10</button></div>
        <p class="mini center">いまの ★での めやすは <b>${fair}🪙</b>。こんやは やく <b>${Sim.guestEstimate()}人</b> きそう。</p>
        <p class="mini">やすいと おきゃくさんが ふえる。たかいと へるけど、ひとりから たくさん もらえる。めやすより ずっと たかいと (${Math.round(fair * 1.25)}🪙より うえ)、まんぞくも さがるよ。</p>`;
      $('mBody').querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { s.price = clamp(s.price + +b.dataset.d, 10, 300); draw(); this.refresh(); Game.save(); });
    };
    this.modal('🎟️ にゅうじょうりょう', '');
    draw();
  },

  openExpand() {
    this.setTool(null);
    const s = Sim.s, nx = EXPAND[s.expand + 1];
    if (!nx) { this.modal('🏚️ ひろげる', '<p>やしきは もう いちばん おおきいよ!</p>'); return; }
    const ok = stars(s) >= nx.star;
    this.modal('🏚️ やしきを ひろげる',
      `<p>みぎがわの ゆきの ばしょを やしきに して、よこに <b>${nx.cols - EXPAND[s.expand].cols}れつ</b> ひろげる。ろうかを ながくして しかけを ふやせるし、おきゃくさんも すこし ふえるよ。</p>
       <p class="center"><b>${fmt(nx.cost)}🪙</b> ${ok ? '' : `<span class="bad">(★${nx.star}に なると ひろげられる)</span>`}</p>`,
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
      h += `<li class="${cls}"><span>${i < s.mission ? '✅' : i === s.mission ? '👉' : '・'}</span><div>${m.text} <em>+${m.reward}🪙</em>${i === s.mission ? `<div class="mini">ヒント: ${m.hint}</div>` : ''}</div></li>`;
    });
    h += '</ol>';
    const st = s.stats;
    h += `<p class="mini">これまで: ${st.nights}ばん ・ おきゃくさん ${st.guests}人 ・ さいこう ${st.great}人 ・ にげだした ${st.fled}人 ・ さいだいコンボ ×${st.bestCombo}</p>`;
    this.modal('📜 もくひょう', h);
  },

  openMenu() {
    this.modal('⚙️ メニュー', '<div class="menu"><button class="btn" id="mHow">❓ あそびかた</button><button class="btn" id="mSnd"></button><button class="btn" id="mTitle2">🏠 タイトルへ (セーブされます)</button></div>');
    $('mSnd').textContent = Sound.on ? '🔊 おと: オン' : '🔇 おと: オフ';
    $('mHow').onclick = () => this.openHow();
    $('mSnd').onclick = () => { Sound.on = !Sound.on; Sound.init(); this.openMenu(); this.refresh(); };
    $('mTitle2').onclick = () => { this.closeModal(); Game.toTitle(); };
  },

  openHow() {
    this.modal('❓ あそびかた', `<div class="how">
      <p>ゆきの山頂の ゆきオバケたちと いっしょに、おばけやしきを けいえいしよう。</p>
      <h3>🌞 ひるは じゅんび</h3>
      <ul><li><b>🧱 ろうか</b>: なぞって ひく。<b>いりぐち</b>から <b>でぐち</b>まで つながっていないと ひらけない。おきゃくさんは いちばん ちかい みちを あるく。</li>
      <li><b>🕯️ しかけ</b> と <b>👻 オバケ</b>: ろうかの となりの <b>かべの マス</b>に おく。とどく はんいに きた おきゃくさんを おどかす。</li>
      <li><b>🎟️ ねだん</b>: にゅうじょうりょうを きめる。<b>🏚️ ひろげる</b>: やしきを おおきくする。</li></ul>
      <h3>🌙 よるは かいてん</h3>
      <ul><li>おきゃくさんの あたまの うえに <b>★</b> と <b>どきどきメーター</b> が でる。</li>
      <li>おどかすほど <b>★が ひかって</b>いく。★5の まま でぐちに つくと「さいこう!」で チップも もらえる。</li>
      <li>どきどきメーターは おどかすと ふえて、しばらく なにも ないと へっていく。<b>いっぱいに なると にげだして</b> しまう。こわい ものの あいだを あけて、ほっと させるのが コツ。</li>
      <li>おきゃくさんには <b>にがて</b>な こわさ (❗びっくり 🌀ぞくぞく ❄️ひえひえ) が ある。にがてだと 1.6ばい こわい。</li>
      <li>つづけて おどかすと <b>コンボ</b>で もっと こわくなる。でも どきどきも いっきに ふえる。</li>
      <li>オバケは おなじ おきゃくさんを 1回だけ おどかす。ひとばんに おどかせる 回数 (げんき) も きまっていて、つかれると ねてしまう。</li></ul>
      <h3>⭐ ひょうばん</h3>
      <p>まんぞくした おきゃくさんが ふえると やしきの ★が ふえて、あたらしい しかけや オバケが つかえるように なる。そのかわり おきゃくさんの きたいも 大きくなるから、やしきを ひろげて しかけを ふやしていこう。★5の「ゆきやま いちの おばけやしき」を めざそう!</p></div>`);
  },

  showResults(r) {
    const s = Sim.s, R = r.ratings;
    const row = (face, label, n) => `<div class="rrow"><span>${face}</span><b>${label}</b><i>${n}人</i></div>`;
    let h = `<div class="rgrid">${row('😆', 'さいこう!', R[5])}${row('😊', 'こわかった', R[4])}${row('🙂', 'まあまあ', R[3])}${row('😑', 'つまらない', R[1])}${row('😱', 'にげだした', R[2])}</div>`;
    h += `<div class="money-tbl"><div><span>にゅうじょうりょう</span><b>+${fmt(r.tickets)}</b></div><div><span>チップ</span><b>+${fmt(r.tips)}</b></div>`;
    if (r.bonus) h += `<div><span>テレビの おれい</span><b>+${fmt(r.bonus)}</b></div>`;
    h += `<div><span>オバケの おきゅうりょう</span><b class="bad">−${fmt(r.wages)}</b></div><div class="sum"><span>こんやの もうけ</span><b class="${r.net >= 0 ? 'good' : 'bad'}">${r.net >= 0 ? '+' : ''}${fmt(r.net)}🪙</b></div></div>`;
    const dr = r.repAfter - r.repBefore;
    h += `<p class="center">ひょうばん ${'★'.repeat(r.starsAfter)}<span class="muted">${'★'.repeat(5 - r.starsAfter)}</span> <b class="${dr >= 0 ? 'good' : 'bad'}">(${dr >= 0 ? '+' : ''}${dr.toFixed(1)})</b></p>`;
    if (r.starsAfter > r.starsBefore) h += `<p class="center good"><b>🎉 ★${r.starsAfter}に なった! あたらしい しかけや オバケが つかえるかも</b></p>`;
    if (r.starsAfter < r.starsBefore) h += '<p class="center bad"><b>★が へってしまった…</b></p>';
    if (r.lvUps.length) h += `<p class="center">⬆️ レベルアップ: ${r.lvUps.join('、')}</p>`;
    if (r.bestCombo >= 2) h += `<p class="center mini">こんやの さいだいコンボ ×${r.bestCombo}</p>`;
    const tips = [];
    if (R[1] + R[3] > R[4] + R[5]) tips.push('もっと こわがりたい おきゃくさんが おおいよ。しかけや オバケを ふやそう。');
    if (R[2] > 1) tips.push('にげだす おきゃくさんが いるよ。こわい ものが つづきすぎかも。あいだを あけてみよう。');
    if (r.slept) tips.push('つかれて ねてしまった オバケが いたよ。なかまを ふやそう。');
    if (tips.length) h += `<div class="tipbox">💡 ${tips.join('<br>💡 ')}</div>`;
    this.modal(`🌙 ${s.day}日目の よるの けっか`, h, '<button class="btn primary" id="rNext">つぎの日へ ☀️</button>', true);
    Sound.great();
    $('rNext').onclick = () => { this.modalLocked = false; this.closeModal(); Game.nextDay(); };
  },
};
