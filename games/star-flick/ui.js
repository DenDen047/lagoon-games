/* =========================================================================
   STAR FLICK ― 画面
   タイトル / ぼうけん / ハンガー（改造） / ガチャ / ふたりで対戦 / 結果とうばう / 遊びかた
   文字の多い画面は DOM、バトルだけ canvas。
   ========================================================================= */
'use strict';

let P = null;   // 持ちもの（セーブされる）

const Prof = {
  load() {
    const s = Save.read();
    P = s && s.v === 1 ? Object.assign(newProfile(), s) : newProfile();
    P.fleet = P.fleet.filter((id) => this.ship(id));
    if (!P.fleet.length) P.fleet = P.ships.slice(0, 3).map((s) => s.id);
  },
  save() { Save.write(P); },
  ship(id) { return P.ships.find((s) => s.id === id); },
  installed(pid) { let n = 0; for (const s of P.ships) for (const v of Object.values(s.parts)) if (v === pid) n++; return n; },
  free(pid) { return (P.parts[pid] || 0) - this.installed(pid); },
  addPart(pid, n = 1) { P.parts[pid] = (P.parts[pid] || 0) + n; },
  hasHull(id) { return P.hulls.includes(id); },
  /* うばった船を、パーツごと自分のものにする */
  addShip(def) {
    const s = { id: 's' + P.nextId++, name: def.name, hull: def.hull, col: def.col, parts: {} };
    for (const [slot, pid] of Object.entries(def.parts || {})) if (pid) { this.addPart(pid); s.parts[slot] = pid; }
    const newHull = !this.hasHull(def.hull);
    if (newHull) P.hulls.push(def.hull);
    P.ships.push(s);
    return { s, newHull };
  },
  cleared(id) { return !!P.cleared[id]; },
  unlocked(ci, bi) {
    if (ci === 0 && bi === 0) return true;
    const prev = bi > 0 ? CAMPAIGN[ci].battles[bi - 1] : CAMPAIGN[ci - 1].battles[2];
    return this.cleared(prev.id);
  },
};
const MAX_SHIPS = 24;
const copyShip = (s) => JSON.parse(JSON.stringify(s));
const coinHtml = (n) => `<span class="coins"><i class="coin"></i>${n.toLocaleString()}</span>`;
const rarTag = (r) => `<span class="rar r${r}">${r}</span>`;

const UI = {
  live: [],          // 毎フレーム描き直す小さなキャンバス
  back: null,
  lastBattle: null,

  init() {
    el('btnCamp').onclick = () => { Sfx.ui(); this.campaign(); };
    el('btnVs').onclick = () => { Sfx.ui(); this.vsSetup(); };
    el('btnHangar').onclick = () => { Sfx.ui(); this.hangar(); };
    el('btnGacha').onclick = () => { Sfx.ui(); this.gacha(); };
    el('btnHelp').onclick = () => { Sfx.ui(); this.help(); };
    el('btnBack').onclick = () => { Sfx.ui(); (this.back || (() => this.title()))(); };
    el('btnPause').onclick = () => this.pause();
    el('spinL').onclick = () => Battle.changeSpin(-1);
    el('spinR').onclick = () => Battle.changeSpin(1);
    el('btnBarrier').onclick = () => Battle.toggleBarrier();
    el('btnJet').addEventListener('pointerdown', (ev) => { ev.preventDefault(); Battle.jet(); });
    addEventListener('resize', () => { if (G.mode === 'battle') Battle.fitCam(); });
  },

  /* ------------------------------ 共通 ------------------------------ */
  hideAll() {
    if (Battle.phase !== 'off') Battle.stop();
    this.gachaRun = null;
    el('titleScreen').classList.add('hidden');
    el('screen').classList.add('hidden');
    this.closeModal();
    this.live = [];
  },
  showHud(on) { el('hud').classList.toggle('hidden', !on); },
  screen(title, back) {
    this.hideAll();
    G.mode = 'menu';
    el('screen').classList.remove('hidden');
    el('scrTitle').textContent = title;
    this.back = back;
    this.coins();
    const body = el('scrBody');
    body.innerHTML = '';
    body.scrollTop = 0;
    return body;
  },
  coins() { el('coinBox').innerHTML = coinHtml(P.coins); },
  modal(title, body, buttons = [], opt = {}) {
    el('modal').classList.remove('hidden');
    el('modal').classList.toggle('wide', !!opt.wide);
    el('mTitle').innerHTML = title;
    const mb = el('mBody');
    mb.innerHTML = '';
    if (typeof body === 'string') mb.innerHTML = body; else if (body) mb.appendChild(body);
    const foot = el('mFoot');
    foot.innerHTML = '';
    for (const b of buttons) {
      const btn = h('button', 'btn ' + (b.cls || ''), b.text);
      btn.onclick = () => { Sfx.ui(); b.fn(); };
      if (b.disabled) btn.disabled = true;
      foot.appendChild(btn);
    }
  },
  closeModal() { el('modal').classList.add('hidden'); },
  liveCanvas(cv, fn) { this.live.push({ cv, fn }); fn(cv, G.time); },
  tick() {
    this.live = this.live.filter((l) => l.cv.isConnected);
    for (const l of this.live) l.fn(l.cv, G.time);
  },

  /* 船のカード（キャンバスつき） */
  shipCard(ship, opt = {}) {
    const c = h('div', 'shipCard' + (opt.cls ? ' ' + opt.cls : ''));
    const cv = h('canvas', 'scv');
    c.appendChild(cv);
    const info = h('div', 'sinfo');
    const hl = HULLS[ship.hull];
    info.innerHTML = `<b>${ship.name}</b><span>${rarTag(hl.rar)} ${hl.name}</span>`;
    const pr = h('div', 'pdots');
    for (const sl of SLOTS) {
      const pid = ship.parts && ship.parts[sl.id];
      const d = h('i', 'pdot ' + (pid ? 'r' + PARTS[pid].rar : 'empty'));
      d.title = `${sl.name}: ${pid ? PARTS[pid].name : 'なし'}`;
      d.textContent = sl.mark;
      pr.appendChild(d);
    }
    info.appendChild(pr);
    c.appendChild(info);
    setTimeout(() => this.liveCanvas(cv, (cv2, t) => paintShipCanvas(cv2, ship, { t, team: opt.team })), 0);
    return c;
  },

  /* ------------------------------ タイトル ------------------------------ */
  title() {
    this.hideAll();
    G.mode = 'title';
    el('titleScreen').classList.remove('hidden');
    el('titleCoins').innerHTML = `${coinHtml(P.coins)}　<span class="dim">船 ${P.ships.length}隻・クリア ${Object.keys(P.cleared).length}/18</span>`;
    el('gachaBadge').classList.toggle('hidden', P.stats.pulls > 0);
  },

  /* ------------------------------ ぼうけん ------------------------------ */
  campaign() {
    const body = this.screen('ぼうけん', () => this.title());
    const wrap = h('div', 'campList');
    CAMPAIGN.forEach((ch, ci) => {
      const st = STAGES[ch.stage];
      const open = Prof.unlocked(ci, 0);
      const card = h('div', 'stageCard t-' + st.theme + (open ? '' : ' locked'));
      card.innerHTML = `<div class="sthead"><span class="stno">STAGE ${ci + 1}</span><b>${st.name}</b><small>${st.place}</small></div><p class="stdesc">${open ? st.desc : '前のステージのボスをたおすと行ける'}</p>`;
      const row = h('div', 'battleRow');
      ch.battles.forEach((bt, bi) => {
        const ok = Prof.unlocked(ci, bi), done = Prof.cleared(bt.id);
        const b = h('button', 'bnode' + (bt.boss ? ' boss' : '') + (done ? ' done' : ''));
        b.disabled = !ok;
        b.innerHTML = `<span class="bid">${bt.id}</span><span class="bname">${ok ? bt.name : '？？？'}</span><span class="bmeta">${done ? '✓ クリア' : ok ? `${'★'.repeat(bt.ai)} ${coinHtml(bt.coins)}` : '🔒'}</span>`;
        b.onclick = () => { Sfx.ui(); this.preBattle(bt); };
        row.appendChild(b);
      });
      card.appendChild(row);
      wrap.appendChild(card);
    });
    body.appendChild(wrap);
  },
  preBattle(bt) {
    const box = h('div', 'pre');
    box.innerHTML = `<p class="dim">${STAGES[bt.stage].name}・強さ ${'★'.repeat(bt.ai)}${bt.boss ? '・<b class="bossTxt">ボス戦</b>' : ''}</p><p>相手の船:</p>`;
    const g = h('div', 'cardGrid small');
    for (const s of bt.fleet) g.appendChild(this.shipCard(s, { team: 1 }));
    box.appendChild(g);
    box.appendChild(h('p', 'dim', '勝つと、たおした船を1隻うばえる。'));
    this.modal(bt.name, box, [
      { text: 'やめる', cls: 'ghost', fn: () => this.closeModal() },
      { text: '出撃メンバーを選ぶ', cls: 'primary', fn: () => this.fleetPick('出撃メンバー（3隻まで）', P.fleet, (ids) => { P.fleet = ids; Prof.save(); this.startCamp(bt); }) },
    ], { wide: true });
  },
  startCamp(bt) {
    this.lastBattle = { mode: 'camp', bt };
    this.hideAll();
    Battle.start({
      mode: 'camp', battle: bt, stage: bt.stage, title: bt.name,
      sides: [
        { label: 'あなた', ai: 0, ships: P.fleet.map((id) => copyShip(Prof.ship(id))) },
        { label: bt.boss ? 'ボス' : '相手', ai: bt.ai, ships: bt.fleet.map(copyShip) },
      ],
    });
  },

  /* 船を3隻まで選ぶ */
  fleetPick(title, initial, done, opt = {}) {
    let picked = initial.filter((id) => Prof.ship(id)).slice(0, 3);
    const box = h('div');
    const g = h('div', 'cardGrid');
    const render = () => {
      for (const c of g.children) {
        const i = picked.indexOf(c.dataset.id);
        c.classList.toggle('picked', i >= 0);
        c.querySelector('.pickNo').textContent = i >= 0 ? i + 1 : '';
      }
      const go = el('mFoot').querySelector('.primary');
      if (go) go.disabled = picked.length === 0;
    };
    for (const s of P.ships) {
      const c = this.shipCard(s, { team: opt.team || 0 });
      c.dataset.id = s.id;
      c.appendChild(h('span', 'pickNo'));
      c.onclick = () => {
        Sfx.select();
        const i = picked.indexOf(s.id);
        if (i >= 0) picked.splice(i, 1);
        else if (picked.length < 3) picked.push(s.id);
        else { picked.shift(); picked.push(s.id); }
        render();
      };
      g.appendChild(c);
    }
    box.appendChild(h('p', 'dim', 'タップで選ぶ。選んだ順に並ぶ。改造はハンガーでできる。'));
    box.appendChild(g);
    this.modal(title, box, [
      { text: 'もどる', cls: 'ghost', fn: () => (opt.cancel ? opt.cancel() : this.closeModal()) },
      { text: opt.okText || '出撃！', cls: 'primary', fn: () => { if (picked.length) done(picked.slice()); } },
    ], { wide: true });
    render();
  },

  /* ------------------------------ ふたりで対戦 ------------------------------ */
  vsSetup() {
    this.hideAll();
    G.mode = 'title';
    el('titleScreen').classList.remove('hidden');
    const p1 = P.fleet.slice();
    this.fleetPick('P1（青）の船を選ぼう', p1, (a) => {
      const rest = P.ships.filter((s) => !a.includes(s.id)).concat(P.ships.filter((s) => a.includes(s.id)));
      this.fleetPick('P2（赤）の船を選ぼう', rest.slice(0, 3).map((s) => s.id), (b) => {
        this.stagePick((stage) => this.startVs(a, b, stage));
      }, { team: 1, okText: 'つぎへ', cancel: () => this.vsSetup() });
    }, { okText: 'つぎへ', cancel: () => this.title() });
  },
  stagePick(done) {
    const g = h('div', 'stagePick');
    for (const id of STAGE_ORDER) {
      const st = STAGES[id];
      const b = h('button', 'stBtn t-' + st.theme, `<b>${st.name}</b><small>${st.desc}</small>`);
      b.onclick = () => { Sfx.ui(); done(id); };
      g.appendChild(b);
    }
    const r = h('button', 'stBtn t-random', '<b>おまかせ</b><small>ランダムで選ぶ</small>');
    r.onclick = () => { Sfx.ui(); done(pick(STAGE_ORDER)); };
    g.appendChild(r);
    this.modal('ステージを選ぼう', g, [{ text: 'もどる', cls: 'ghost', fn: () => this.vsSetup() }], { wide: true });
  },
  startVs(a, b, stage) {
    this.lastBattle = { mode: 'vs', a, b, stage };
    this.hideAll();
    Battle.start({
      mode: 'vs', stage, title: 'ふたりで対戦',
      sides: [
        { label: 'P1', ai: 0, ships: a.map((id) => copyShip(Prof.ship(id))) },
        { label: 'P2', ai: 0, ships: b.map((id) => copyShip(Prof.ship(id))) },
      ],
    });
  },

  /* ------------------------------ 結果 ------------------------------ */
  battleOver(winner) {
    const cfg = Battle.cfg;
    if (cfg.mode === 'vs') {
      const t = winner === -1 ? 'ひきわけ' : `${cfg.sides[winner].label} の勝ち！`;
      this.modal(t, `<p>うち落とした数　P1: <b>${Battle.kos[1].length}</b>　P2: <b>${Battle.kos[0].length}</b></p>`, [
        { text: 'メニューへ', cls: 'ghost', fn: () => this.title() },
        { text: 'もう一回', cls: 'primary', fn: () => { const l = this.lastBattle; this.startVs(l.a, l.b, l.stage); } },
      ]);
      return;
    }
    const bt = cfg.battle;
    P.stats.kos += Battle.kos[1].length;
    if (winner !== 0) {
      P.coins += 30;
      Prof.save();
      this.modal(winner === -1 ? 'ひきわけ…' : 'まけ…', `<p>なぐさめの ${coinHtml(30)} をもらった。</p><p class="dim">ヒント: ガチャでパーツを手に入れて、ハンガーで船につけると強くなる。重い形（タンクなど）は落ちにくい。</p>`, [
        { text: 'ぼうけんへ', cls: 'ghost', fn: () => this.campaign() },
        { text: 'ハンガー', fn: () => this.hangar() },
        { text: 'もう一回', cls: 'primary', fn: () => this.startCamp(bt) },
      ]);
      return;
    }
    const first = !Prof.cleared(bt.id);
    const coins = first ? bt.coins : Math.round(bt.coins * 0.4);
    P.coins += coins;
    P.cleared[bt.id] = true;
    P.stats.wins++;
    Prof.save();
    const box = h('div');
    box.innerHTML = `<p>${coinHtml(coins)} を手に入れた！${first ? '<span class="tag">はじめてクリア</span>' : ''}</p>`;
    if (P.ships.length >= MAX_SHIPS) {
      box.appendChild(h('p', 'dim', `ハンガーがいっぱい（${MAX_SHIPS}隻）なので、船はうばえなかった。ハンガーで船を手放すと空きができる。`));
      this.modal('勝利！', box, this.afterWinButtons(bt));
      return;
    }
    const downed = Battle.kos[1].map((b) => b.ship);
    if (!downed.length) {
      box.appendChild(h('p', 'dim', '落とした船がないので、うばえる船はなかった。'));
      this.modal('勝利！', box, this.afterWinButtons(bt));
      return;
    }
    box.appendChild(h('p', 'big', 'うばう船を1隻えらぼう！'));
    const g = h('div', 'cardGrid');
    for (const def of downed) {
      const c = this.shipCard(def, { team: 1, cls: 'capture' });
      const isNew = !Prof.hasHull(def.hull);
      if (isNew) c.appendChild(h('span', 'newTag', 'NEW 形'));
      c.onclick = () => {
        const { s, newHull } = Prof.addShip(def);
        P.stats.captures++;
        Prof.save();
        Sfx.good();
        const msg = h('div');
        msg.innerHTML = `<p><b>${s.name}</b> をうばった！ ハンガーに入ったよ。</p>${newHull ? `<p class="tag">新しい形「${HULLS[s.hull].name}」が使えるようになった！</p>` : ''}${Object.values(s.parts).length ? '<p class="dim">付いていたパーツも手に入った。</p>' : ''}`;
        const cg = h('div', 'cardGrid small');
        cg.appendChild(this.shipCard(s, { team: 0 }));
        msg.appendChild(cg);
        this.modal('うばった！', msg, this.afterWinButtons(bt));
      };
      g.appendChild(c);
    }
    box.appendChild(g);
    this.modal('勝利！', box, [], { wide: true });
  },
  afterWinButtons(bt) {
    const all = CAMPAIGN.flatMap((c) => c.battles);
    const next = all[all.indexOf(bt) + 1];
    const btns = [{ text: 'ぼうけんへ', cls: 'ghost', fn: () => this.campaign() }, { text: 'ハンガー', fn: () => this.hangar() }];
    if (next) btns.push({ text: 'つぎのバトル', cls: 'primary', fn: () => { this.campaign(); this.preBattle(next); } });
    else btns.push({ text: 'エンディング', cls: 'primary', fn: () => this.ending() });
    return btns;
  },
  ending() {
    this.modal('宇宙に平和がもどった！', `<p>皇帝艦エンペラーをたおして、宇宙いちばんの消しピン乗りになった。</p><p>うばった船 ${P.stats.captures}隻・たおした船 ${P.stats.kos}隻・ガチャ ${P.stats.pulls}回</p><p class="dim">まだ集めていない形やパーツがあるかも。ガチャとふたりで対戦はずっと遊べる。</p>`, [
      { text: 'タイトルへ', cls: 'primary', fn: () => this.title() },
    ]);
  },

  pause() {
    if (G.mode !== 'battle' || Battle.phase === 'over') return;
    /* 引っぱっている途中で止めたら、その操作は取り消す（離したときに発射されないように） */
    Battle.drag = null; Battle.barDraft = null;
    const cfg = Battle.cfg;
    this.modal('ひと休み', '<p class="dim">操作: 船をうしろに引っぱって離すと発射。回転は ⟲ ⟳（Q/E キー）。バリアは 🛡（B キー）。動いているあいだにタップか Space でジェット。</p>', [
      { text: 'やめる', cls: 'ghost', fn: () => { Battle.stop(); cfg.mode === 'vs' ? this.title() : this.campaign(); } },
      { text: 'やりなおす', fn: () => { this.closeModal(); const l = this.lastBattle; l.mode === 'vs' ? this.startVs(l.a, l.b, l.stage) : this.startCamp(l.bt); } },
      { text: 'つづける', cls: 'primary', fn: () => this.closeModal() },
    ]);
  },

  /* ------------------------------ ハンガー ------------------------------ */
  hangar(selId) {
    const body = this.screen('ハンガー（船の改造）', () => this.title());
    const sel = Prof.ship(selId) || Prof.ship(P.fleet[0]) || P.ships[0];
    const wrap = h('div', 'hangar');
    const list = h('div', 'shipList');
    for (const s of P.ships) {
      const c = this.shipCard(s, { cls: s === sel ? 'sel' : '' });
      if (P.fleet.includes(s.id)) c.appendChild(h('span', 'fleetTag', '出撃'));
      c.onclick = () => { Sfx.select(); this.hangar(s.id); };
      list.appendChild(c);
    }
    wrap.appendChild(list);
    wrap.appendChild(this.editor(sel));
    body.appendChild(wrap);
    const selEl = list.querySelector('.sel');
    if (selEl) setTimeout(() => selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 0);
  },
  editor(ship) {
    const ed = h('div', 'editor');
    const top = h('div', 'edTop');
    const cv = h('canvas', 'bigShip');
    top.appendChild(cv);
    this.liveCanvas(cv, (c, t) => paintShipCanvas(c, ship, { t, angle: -Math.PI / 2 + Math.sin(t * 0.8) * 0.25, team: 0, jet: Math.sin(t * 2) > 0.6 }));
    const stats = h('div', 'stats');
    const st = shipStats(ship);
    const bars = [
      ['はやさ', st.vmax / 950 / 1.6, 'どこまで遠くへ飛べるか'],
      ['おもさ', st.mass / 2.7, '重いと押されても落ちにくい'],
      ['いりょく', st.punch / 0.9, '当てた相手をどれだけ飛ばすか'],
      ['すべり', (1 / st.grip) / 1.65, 'よくすべると遠くまで行くが、止まりにくい'],
      ['かいてん', (st.spinLv * st.spinPer) / 60, 'かけられる回転の強さ'],
    ];
    for (const [n, v, tip] of bars) {
      const r = h('div', 'stat');
      r.title = tip;
      r.innerHTML = `<span>${n}</span><div class="track"><i style="width:${Math.round(clamp(v, 0.04, 1) * 100)}%"></i></div>`;
      stats.appendChild(r);
    }
    top.appendChild(stats);
    ed.appendChild(top);

    /* 名前 */
    const nm = h('div', 'edRow');
    nm.innerHTML = '<label>名前</label>';
    const inp = h('input', 'nameIn');
    inp.maxLength = 10; inp.value = ship.name;
    inp.onchange = () => { ship.name = inp.value.trim() || ship.name; Prof.save(); this.hangar(ship.id); };
    nm.appendChild(inp);
    ed.appendChild(nm);

    /* 形 */
    ed.appendChild(h('h3', '', '形（船体）<small>形を変えると、大きさ・重さ・速さが変わる</small>'));
    const hg = h('div', 'hullGrid');
    for (const [id, hl] of Object.entries(HULLS)) {
      const own = Prof.hasHull(id);
      const b = h('button', 'hullBtn' + (ship.hull === id ? ' on' : '') + (own ? '' : ' lock'));
      const icv = h('canvas', 'hcv');
      b.appendChild(icv);
      b.appendChild(h('span', '', own ? hl.name : '？？？'));
      b.title = own ? `${hl.name}: ${hl.desc}` : hl.enemy ? '敵をたおしてうばうと手に入る' : 'ガチャで手に入る';
      if (own) this.liveCanvas(icv, (c, t) => paintIconCanvas(c, { kind: 'hull', id, col: ship.col }, t));
      else this.liveCanvas(icv, (c) => paintIconCanvas(c, { kind: 'hull', id, col: '#2a3140' }, 0));
      b.onclick = () => {
        if (!own) { toast(hl.enemy ? 'この形は、持っている敵をたおしてうばうと使える' : 'この形はガチャで手に入る'); Sfx.bad(); return; }
        ship.hull = id; Prof.save(); Sfx.select(); this.hangar(ship.id);
      };
      hg.appendChild(b);
    }
    ed.appendChild(hg);
    ed.appendChild(h('p', 'hullDesc', `<b>${HULLS[ship.hull].name}</b>：${HULLS[ship.hull].desc}`));

    /* 色 */
    ed.appendChild(h('h3', '', '色'));
    const cg = h('div', 'colors');
    for (const col of COLORS.concat(ship.col && !COLORS.includes(ship.col) ? [ship.col] : [])) {
      const b = h('button', 'sw' + (ship.col === col ? ' on' : ''));
      b.style.background = col;
      b.onclick = () => { ship.col = col; Prof.save(); Sfx.select(); this.hangar(ship.id); };
      cg.appendChild(b);
    }
    ed.appendChild(cg);

    /* パーツ */
    ed.appendChild(h('h3', '', 'パーツ<small>4つの場所に1つずつ付けられる</small>'));
    const pg = h('div', 'slotGrid');
    for (const sl of SLOTS) {
      const pid = ship.parts[sl.id];
      const b = h('button', 'slotBtn' + (pid ? ' r' + PARTS[pid].rar : ''));
      const icv = h('canvas', 'pcv');
      b.appendChild(icv);
      const txt = h('div', 'stxt');
      txt.innerHTML = `<small>${sl.name}</small><b>${pid ? PARTS[pid].name : 'なし'}</b><span>${pid ? partDesc(pid) : sl.desc}</span>`;
      b.appendChild(txt);
      if (pid) this.liveCanvas(icv, (c, t) => paintIconCanvas(c, { kind: 'part', id: pid }, t));
      b.onclick = () => { Sfx.ui(); this.partPick(ship, sl); };
      pg.appendChild(b);
    }
    ed.appendChild(pg);

    const foot = h('div', 'edFoot');
    const rel = h('button', 'btn ghost small', 'この船を手放す');
    rel.onclick = () => this.release(ship);
    foot.appendChild(rel);
    ed.appendChild(foot);
    return ed;
  },
  partPick(ship, sl) {
    const box = h('div', 'partList');
    box.appendChild(h('p', 'dim', sl.desc));
    const owned = Object.keys(PARTS).filter((id) => PARTS[id].slot === sl.id && (P.parts[id] || 0) > 0);
    const cur = ship.parts[sl.id];
    if (!owned.length) box.appendChild(h('p', '', 'まだ持っていない。ガチャで手に入れるか、パーツ付きの敵をたおしてうばおう。'));
    for (const id of owned.sort((a, b) => Object.keys(RARITY).indexOf(PARTS[b].rar) - Object.keys(RARITY).indexOf(PARTS[a].rar))) {
      const free = Prof.free(id) + (cur === id ? 1 : 0);
      const b = h('button', 'partRow r' + PARTS[id].rar + (cur === id ? ' on' : ''));
      const icv = h('canvas', 'pcv');
      b.appendChild(icv);
      const txt = h('div', 'stxt');
      txt.innerHTML = `<b>${rarTag(PARTS[id].rar)} ${PARTS[id].name}</b><span>${partDesc(id)}</span><small>${cur === id ? '付けている' : `あと ${free} 個`}／持っている数 ${P.parts[id]}</small>`;
      b.appendChild(txt);
      this.liveCanvas(icv, (c, t) => paintIconCanvas(c, { kind: 'part', id }, t));
      b.disabled = free <= 0;
      b.onclick = () => { ship.parts[sl.id] = id; Prof.save(); Sfx.good(); this.hangar(ship.id); };
      box.appendChild(b);
    }
    const btns = [{ text: 'もどる', cls: 'ghost', fn: () => this.closeModal() }];
    if (cur) btns.push({ text: 'はずす', fn: () => { delete ship.parts[sl.id]; Prof.save(); this.hangar(ship.id); } });
    this.modal(`${sl.name}を選ぶ`, box, btns, { wide: true });
  },
  release(ship) {
    if (P.ships.length <= 3) { toast('船は3隻より少なくできない'); Sfx.bad(); return; }
    this.modal('船を手放す', `<p><b>${ship.name}</b> を手放して ${coinHtml(50)} をもらう？</p><p class="dim">付いていたパーツは持ちものにもどる。形も使えるまま。</p>`, [
      { text: 'やめる', cls: 'ghost', fn: () => this.closeModal() },
      { text: '手放す', cls: 'danger', fn: () => {
        P.ships = P.ships.filter((s) => s !== ship);
        P.fleet = P.fleet.filter((id) => id !== ship.id);
        if (!P.fleet.length) P.fleet = P.ships.slice(0, 3).map((s) => s.id);
        P.coins += 50; Prof.save(); this.hangar();
      } },
    ]);
  },

  /* ------------------------------ ガチャ ------------------------------ */
  gacha() {
    const body = this.screen('ガチャ', () => this.title());
    const g = h('div', 'gacha');
    const machine = h('div', 'machine');
    machine.innerHTML = '<div class="dome">' + Array.from({ length: 14 }, (_, i) => `<i class="ball b${i % 4}" style="--x:${(i * 37) % 100};--y:${(i * 53) % 100};--d:${(i % 5) * 0.3}s"></i>`).join('') + '</div><div class="mbody"><div class="slot"></div><div class="knob"></div></div>';
    g.appendChild(machine);
    const side = h('div', 'gside');
    side.innerHTML = `<p class="lead">船の形やパーツが出るカプセル。同じパーツが出たら数がふえて、ほかの船にも付けられる。</p>
      <div class="gbtns">
        <button class="btn primary big" id="g1">1回 ${coinHtml(GACHA.one)}</button>
        <button class="btn primary big" id="g10">10回 ${coinHtml(GACHA.ten)}<small>SR以上1つ確定</small></button>
      </div>
      <p class="rates">出る確率　${Object.entries(RARITY).map(([k, v]) => `${rarTag(k)} ${v.w}%`).join('　')}</p>
      <p class="dim">同じ形がもう一度出たら、コインにかわる。コインはバトルに勝つともらえる。</p>`;
    g.appendChild(side);
    body.appendChild(g);
    el('g1').onclick = () => this.pull(1);
    el('g10').onclick = () => this.pull(10);
    el('g1').disabled = P.coins < GACHA.one;
    el('g10').disabled = P.coins < GACHA.ten;
    body.appendChild(this.collection());
  },
  collection() {
    const box = h('div', 'collect');
    box.appendChild(h('h3', '', 'もちもの'));
    const g = h('div', 'colGrid');
    const items = [
      ...Object.keys(HULLS).map((id) => ({ kind: 'hull', id, have: Prof.hasHull(id) })),
      ...Object.keys(PARTS).map((id) => ({ kind: 'part', id, have: (P.parts[id] || 0) > 0, n: P.parts[id] || 0 })),
    ];
    for (const it of items) {
      const def = it.kind === 'hull' ? HULLS[it.id] : PARTS[it.id];
      const c = h('div', 'colItem r' + def.rar + (it.have ? '' : ' none'));
      const cv = h('canvas', 'ccv');
      c.appendChild(cv);
      c.appendChild(h('span', '', it.have ? def.name : '？？？'));
      if (it.kind === 'part' && it.have) c.appendChild(h('b', 'cnt', '×' + it.n));
      c.title = it.have ? (it.kind === 'hull' ? def.desc : partDesc(it.id)) : (def.enemy ? '敵からうばうと手に入る' : 'ガチャで出る');
      if (it.have) this.liveCanvas(cv, (cc, t) => paintIconCanvas(cc, { kind: it.kind, id: it.id, col: '#9fd8ff' }, t));
      else this.liveCanvas(cv, (cc) => { const x = cc.getContext('2d'); paintIconCanvas(cc, { kind: it.kind, id: it.id, col: '#20283a' }, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(20,26,40,0.9)'; x.fillRect(0, 0, cc.width, cc.height); x.globalCompositeOperation = 'source-over'; });
      g.appendChild(c);
    }
    box.appendChild(g);
    return box;
  },
  rollOne(minRar) {
    const keys = Object.keys(RARITY).filter((k) => !minRar || Object.keys(RARITY).indexOf(k) >= Object.keys(RARITY).indexOf(minRar));
    let sum = 0; for (const k of keys) sum += RARITY[k].w;
    let r = Math.random() * sum, rar = keys[keys.length - 1];
    for (const k of keys) { r -= RARITY[k].w; if (r <= 0) { rar = k; break; } }
    return Object.assign({ rar }, pick(GACHA_POOL[rar]));
  },
  pull(n) {
    const cost = n === 10 ? GACHA.ten : GACHA.one;
    if (P.coins < cost) { Sfx.bad(); return; }
    P.coins -= cost;
    P.stats.pulls += n;
    const got = [];
    for (let i = 0; i < n; i++) got.push(this.rollOne());
    const order = Object.keys(RARITY);
    if (n === 10 && !got.some((g) => order.indexOf(g.rar) >= 2)) got[9] = this.rollOne('SR');
    /* もらう。形のダブりはコインに */
    for (const g of got) {
      if (g.kind === 'hull') {
        if (Prof.hasHull(g.id)) { g.dup = RARITY[g.rar].dup; P.coins += g.dup; } else { P.hulls.push(g.id); g.isNew = true; }
      } else {
        g.isNew = !(P.parts[g.id] > 0);
        Prof.addPart(g.id);
      }
    }
    Prof.save();
    this.coins();
    const best = got.reduce((a, g) => Math.max(a, order.indexOf(g.rar)), 0);
    this.gachaShow(got, order[best]);
  },
  gachaShow(got, best) {
    const box = h('div', 'gshow');
    const cap = h('div', 'capsule c' + best);
    cap.innerHTML = '<i class="top"></i><i class="bot"></i>';
    box.appendChild(cap);
    this.modal('ガチャ', box, [], { wide: true });
    /* 演出の途中でほかの画面へ移ったら、あとから結果の窓を出さない */
    const run = this.gachaRun = {};
    const alive = () => this.gachaRun === run && !el('modal').classList.contains('hidden');
    let k = 0;
    const drum = setInterval(() => { if (!alive() || ++k > 5) { clearInterval(drum); return; } Sfx.drum(); }, 140);
    setTimeout(() => {
      if (!alive()) return;
      cap.classList.add('open');
      Sfx.reveal(best);
      setTimeout(() => {
        if (!alive()) return;
        box.innerHTML = '';
        const g = h('div', 'gres' + (got.length === 1 ? ' one' : ''));
        got.forEach((it, i) => {
          const def = it.kind === 'hull' ? HULLS[it.id] : PARTS[it.id];
          const c = h('div', 'gcard r' + it.rar);
          c.style.animationDelay = i * 0.12 + 's';
          const cv = h('canvas', 'gcv');
          c.appendChild(cv);
          c.insertAdjacentHTML('beforeend', `${rarTag(it.rar)}<b>${def.name}</b><small>${it.kind === 'hull' ? '船の形' : SLOTS.find((s) => s.id === def.slot).name}</small>`);
          if (it.isNew) c.appendChild(h('span', 'newTag', 'NEW'));
          if (it.dup) c.appendChild(h('span', 'dupTag', `+${it.dup}コイン`));
          this.liveCanvas(cv, (cc, t) => paintIconCanvas(cc, { kind: it.kind, id: it.id, col: '#9fd8ff' }, t));
          setTimeout(() => { if (it.rar === 'SR' || it.rar === 'UR') Sfx.reveal(it.rar); }, i * 120 + 200);
          g.appendChild(c);
        });
        box.appendChild(g);
        const btns = [{ text: 'とじる', cls: 'ghost', fn: () => this.gacha() }, { text: 'ハンガーで付ける', fn: () => this.hangar() }];
        if (P.coins >= GACHA.one) btns.push({ text: 'もう1回', cls: 'primary', fn: () => { this.gacha(); this.pull(1); } });
        this.modal('ゲット！', box, btns, { wide: true });
      }, 450);
    }, 950);
  },

  /* ------------------------------ 遊びかた ------------------------------ */
  help() {
    const body = this.screen('遊びかた', () => this.title());
    body.appendChild(h('div', 'help', `
      <section><h3>はじきかた</h3><p>自分の船をうしろへ引っぱって、はなすと発射。長く引くほど強い。相手の船をステージの外（宇宙）へ落とせば KO。先に相手を全部落としたほうの勝ち。自分が落ちてもアウトなので、強すぎに注意。</p><p>船が何隻かあるときは、動かしたい船をタップしてから引っぱる。船から離れた場所を引っぱっても、選んでいる船を打てる。</p></section>
      <section><h3>回転</h3><p>打つ前に ⟲ ⟳ ボタン（Q / E キー）で回転をかける。回転した船はカーブして進み、当たった相手を横にはじく。ジャイロのパーツを付けると強い回転がかけられる。</p></section>
      <section><h3>ジェット</h3><p>ジェットを付けた船は、動いているあいだに画面をタップ（Space キー）すると、進んでいる向きにぐんと加速する。とどかない相手に追いつける。</p></section>
      <section><h3>バリア</h3><p>バリアを付けた船は、打つ前に 🛡 ボタン（B キー）を押して、画面をなぞるとバリアのカベを置ける。バリアは<b>ぜったいにこわれない</b>。はしに置けば落ちにくくなり、相手の通り道をふさぐこともできる。決まったターンがたつと消える。</p></section>
      <section><h3>改造</h3><p>ハンガーで船の形を変えたり、コア（威力と速さ）・ジェット・ジャイロ・バリアのパーツを付けたりできる。重い形は押し出されにくく、軽い形は速くて遠くまで飛ぶ。</p></section>
      <section><h3>ガチャとうばう</h3><p>バトルに勝つとコインがもらえる。コインでガチャを回すと、形やパーツが出る。勝ったあとは、たおした相手の船を1隻うばえる。敵しか持っていない形は、うばうしか手に入らない。</p></section>
      <section><h3>ステージ</h3><p>宇宙ステーションの甲板、小惑星、月面、宇宙都市、母艦の格納庫、ブラックホールの6つ。クレーターの砂は止まりやすく、ネオンのバンパーは強くはね返し、ブラックホールは近づくと吸いこまれる。</p></section>
      <section><h3>ふたりで対戦</h3><p>1つの画面を2人で交代に使う。ハンガーの船からそれぞれ3隻まで選んで戦う。</p></section>
    `));
  },
};
