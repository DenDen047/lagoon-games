/* =========================================================================
   NEKO MART ― 画面の部品
   タイトル / お店づくり / 上の帯 / しいれ / 素材 / 商品と値段 / 倉庫 / 棚 /
   工房 / もようがえの帯 / 1日のまとめ / メニュー
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);

const UI = {
  touch: false, panel: null, wz: null, last: {}, moreQty: {}, setup: null,

  init() {
    this.touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    $('btnNew').onclick = () => {
      Sound.init();
      if (Save.read() && !$('newWarn').classList.contains('show')) { $('newWarn').classList.add('show'); return; }
      this.showSetup();
    };
    $('btnCont').onclick = () => { Sound.init(); Main.continueGame(); };
    $('btnHow').onclick = () => { Sound.init(); this.openHelp(); };
    $('btnBack').onclick = () => { $('setup').classList.add('hide'); $('title').classList.remove('hide'); };
    $('btnStart').onclick = () => this.startNew();
    $('bMenu').onclick = () => this.openMenu();
    $('bSpeed').onclick = () => { R.speed = R.speed === 2 ? 1 : 2; Sound.play('click'); };
    $('btnOpen').onclick = () => Day.open();
    $('btnAct').onclick = () => Main.action();
    $('mClose').onclick = () => this.close();
    $('mission').onclick = () => $('mission').classList.toggle('small');
    $('toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      Sound.play('click');
      const p = b.dataset.p;
      if (p === 'order') this.openOrder('all');
      else if (p === 'mats') this.openMats();
      else if (p === 'products') this.openProducts();
      else if (p === 'work') this.goWorkshop();
      else if (p === 'closet') this.openCloset();
      else if (p === 'edit') Editor.open();
    });
    $('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') { this.close(); return; }
      const c = e.target.closest('[data-cl]');
      if (c) { if (this.panel && this.panel.kind === 'closet' && Closet.act(G.hero, c, this.panel.args.st)) this.rerender(); return; }
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) this.act(b.dataset.act, b);
    });
    $('modal').addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.chg) this.act(el.dataset.chg, el);
    });
    $('editBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) { Sound.play('click'); this.editAct(b.dataset.act, b); }
    });
    $('btnCont').disabled = !Save.read();
  },

  /* ------------------------------ お店づくり ------------------------------ */
  showSetup() {
    $('title').classList.add('hide');
    $('setup').classList.remove('hide');
    this.setup = { coat: 'calico', eye: EYES[1], eye2: null, body: 'apron', head: 'none', face: 'none', neck: 'none' };
    this.setupSt = { tab: 'base', mode: 'setup', dir: 'd' };
    const render = () => { $('setupCloset').innerHTML = Closet.html(this.setup, this.setupSt, false); };
    render();
    $('setup').onclick = (e) => {
      const b = e.target.closest('[data-cl]');
      if (b && Closet.act(this.setup, b, this.setupSt)) render();
    };
  },
  tickSetup(t) {
    if ($('setup').classList.contains('hide')) return;
    Closet.drawPreview($('heroPrev'), this.setup, t, 'd');
  },
  startNew() {
    const shop = ($('inShop').value || '').trim() || 'ねこねこマート';
    const name = ($('inHero').value || '').trim() || 'ミケ';
    Sound.init();
    newGame(shop.slice(0, 12), { name: name.slice(0, 8), ...this.setup });
    $('setup').classList.add('hide');
    $('setupCloset').innerHTML = '';
    Main.begin();
    saveGame();
    setTimeout(() => this.openHelp(true), 300);
  },

  /* ------------------------------ 上の帯と下のボタン ------------------------------ */
  showHud() { $('hud').classList.remove('hide'); this.last = {}; this.refreshMission(); },
  margins() {
    const tb = $('top').getBoundingClientRect().bottom;
    const narrow = window.innerWidth < 640;
    const mis = $('mission');
    mis.style.top = tb + 6 + 'px';
    const top = (narrow ? mis.getBoundingClientRect().bottom : tb) + 4;
    const bar = Editor.active ? $('editBar') : $('toolbar');
    const r = bar.getBoundingClientRect();
    return { top, bottom: Math.max(0, window.innerHeight - r.top) + 4 };
  },
  set(id, v, prop = 'textContent') {
    if (this.last[id] === v) return;
    this.last[id] = v;
    $(id)[prop] = v;
  },
  tick() {
    if (!G) return;
    this.set('hShop', G.shopName);
    this.set('hDay', `${G.day}日目`);
    const w = WEATHER[G.weather];
    this.set('hWeather', w.icon);
    let clock;
    if (G.phase === 'prep') clock = 'じゅんび中';
    else if (G.phase === 'open') clock = `${pad2(Math.floor(G.clock / 60))}:${pad2(Math.floor(G.clock % 60 / 10) * 10)}`;
    else if (G.phase === 'closing') clock = '閉店';
    else clock = 'おしまい';
    this.set('hClock', clock);
    this.set('hMoney', yen(G.money));
    const s = stars();
    this.set('hStars', '★'.repeat(s) + '☆'.repeat(5 - s));
    this.set('bSpeed', R.speed === 2 ? '▶▶' : '▶');
    $('btnOpen').classList.toggle('hide', !(G.phase === 'prep' && !Editor.active));
    $('toolbar').classList.toggle('hide', Editor.active);
    const act = this.touch && !Editor.active ? Interact.label(Interact.target()) : null;
    $('btnAct').classList.toggle('hide', !act);
    if (act) this.set('btnAct', act);
    if (this.panel && this.panel.kind === 'closet') Closet.drawPreview($('closetPrev'), G.hero, R.t, this.panel.args.st.dir);
  },
  refresh() { this.last = {}; this.tick(); this.refreshMission(); },
  refreshMission() {
    if (!G) return;
    const m = Missions.current();
    const el = $('mission');
    if (!m) { el.innerHTML = '<b>🏆 ねこの町いちばんのお店!</b>'; return; }
    el.innerHTML = `<b>🎯 目標</b><span>${esc(m.text)}</span>${m.reward ? `<em>ごほうび ${yen(m.reward)}</em>` : ''}`;
  },

  /* ------------------------------ 共通の小窓 ------------------------------ */
  open(kind, title, args) {
    this.panel = { kind, args };
    $('mTitle').textContent = title;
    $('modal').classList.remove('hide');
    this.rerender(true);
  },
  rerender(top) {
    if (!this.panel) return;
    const body = $('mBody');
    const sc = body.scrollTop;
    const r = this['render_' + this.panel.kind](this.panel.args) || {};
    $('mTabs').innerHTML = r.tabs || '';
    body.innerHTML = r.body || '';
    $('mFoot').innerHTML = r.foot || '';
    $('mFoot').classList.toggle('hide', !r.foot);
    $('mTabs').classList.toggle('hide', !r.tabs);
    $('modal').querySelector('.mcard').className = 'mcard ' + (r.cls || '');
    body.scrollTop = top ? 0 : sc;
    if (r.after) r.after();
  },
  close() {
    $('modal').classList.add('hide');
    this.panel = null;
    if (G && G.phase === 'summary') this.showSummary();
  },
  modalOpen() {
    return !$('modal').classList.contains('hide') || (Paint.el && !Paint.el.classList.contains('hide'));
  },
  tabs(list, cur, act) {
    return list.map(([k, label]) => `<button data-act="${act}" data-k="${k}" class="${k === cur ? 'on' : ''}">${label}</button>`).join('');
  },
  stepper(act, id, v, small) {
    return `<div class="stepper"><button data-act="${act}" data-id="${id}" data-d="-${small}">−</button><b>${v}</b><button data-act="${act}" data-id="${id}" data-d="${small}">＋</button></div>`;
  },
  hasStore(store) { return G.furn.some((f) => FURN[f.type].display === store); },

  /* ------------------------------ しいれ ------------------------------ */
  openOrder(tab) { this.open('order', 'しいれ (問屋さん)', { tab }); },
  render_order(a) {
    const tabs = this.tabs([['all', 'ぜんぶ'], ...Object.entries(KINDS).map(([k, v]) => [k, v.icon + ' ' + v.name])], a.tab, 'otab');
    const list = GOODS.filter((g) => a.tab === 'all' || g.kind === a.tab);
    const body = `<p class="tip">ほかの人が作った商品を買って、倉庫に入れる。売れると目安の値段くらいでお金が入るよ。</p>
      <div class="cards">${list.map((g) => {
        const store = KINDS[g.kind].store;
        const warn = this.hasStore(store) ? '' : `<span class="tag warn">${STORES[store].name}が必要</span>`;
        return `<div class="card">
          <div class="ci">${ProdArt.html(g.id)}</div>
          <div class="cb"><b>${g.name}</b>
            <div class="mini">仕入れ ${yen(g.cost)}・目安 ${yen(g.fair)}</div>
            <div class="mini">倉庫 ${G.stock[g.id] || 0}こ ${warn}</div></div>
          <div class="cbtns">
            <button data-act="buy" data-id="${g.id}" data-n="1" ${G.money < g.cost ? 'disabled' : ''}>+1<small>${yen(g.cost)}</small></button>
            <button data-act="buy" data-id="${g.id}" data-n="6" ${G.money < g.cost * 6 ? 'disabled' : ''}>+6<small>${yen(g.cost * 6)}</small></button>
          </div></div>`;
      }).join('')}</div>`;
    return { tabs, body };
  },

  /* ------------------------------ 素材 ------------------------------ */
  openMats() { this.open('mats', '素材屋さん', {}); },
  render_mats() {
    const bench = Shop.count('bench') > 0;
    const body = `<p class="tip">素材は作業台でオリジナル商品を作るのに使う。${bench ? '作業台へ行くと作れるよ。' : '<b>作業台は「もようがえ」で置ける。</b>'}</p>
      <div class="cards">${MATS.map((m) => `<div class="card">
          <div class="ci"><span class="pi emo">${m.emoji}</span></div>
          <div class="cb"><b>${m.name}</b><div class="mini">${yen(m.cost)}・持っている ${G.mats[m.id] || 0}こ</div></div>
          <div class="cbtns">
            <button data-act="mat" data-id="${m.id}" data-n="1" ${G.money < m.cost ? 'disabled' : ''}>+1<small>${yen(m.cost)}</small></button>
            <button data-act="mat" data-id="${m.id}" data-n="5" ${G.money < m.cost * 5 ? 'disabled' : ''}>+5<small>${yen(m.cost * 5)}</small></button>
          </div></div>`).join('')}</div>`;
    return { body };
  },

  /* ------------------------------ 商品と値段 ------------------------------ */
  openProducts() { this.open('products', '商品と値段', {}); },
  allPids() {
    const set = new Set(Object.keys(G.stock));
    for (const f of G.furn) if (f.slots) for (const s of f.slots) if (s.n > 0) set.add(s.pid);
    for (const d of G.designs) set.add(d.id);
    if (R.player.carry) set.add(R.player.carry.pid);
    const kinds = Object.keys(KINDS);
    return [...set].filter((p) => prod(p)).sort((a, b) => (isOrig(b) - isOrig(a)) || (kinds.indexOf(prod(a).kind) - kinds.indexOf(prod(b).kind)));
  },
  render_products() {
    const pids = this.allPids();
    if (!pids.length) return { body: '<p class="empty">まだ商品がない。「しいれ」で買ってこよう。</p>' };
    const body = `<p class="tip">値段は自由に決められる。目安より高いと売れにくく、安いとよく売れるけど、もうけが少なくなる。</p>
      <div class="rows">${pids.map((pid) => {
        const p = prod(pid), price = priceOf(pid), pw = priceWord(price, p.fair);
        const d = p.orig ? designOf(pid) : null;
        const name = d
          ? `<input class="nm" data-chg="rename" data-id="${pid}" value="${esc(d.name)}" maxlength="14">`
          : `<b>${esc(p.name)}</b>`;
        const badge = d ? `<span class="tag orig">オリジナル ${'★'.repeat(d.stars)}</span>` : '';
        return `<div class="prow2">
          <div class="ci">${ProdArt.html(pid)}</div>
          <div class="pinfo">${name}${badge}
            <div class="mini">倉庫 ${G.stock[pid] || 0}・店頭 ${shelfCount(pid)}・原価 ${yen(p.cost)}・目安 ${yen(p.fair)}</div>
            ${d ? `<button class="mini-btn" data-act="redraw" data-id="${pid}">🖌️ 絵をかく</button>` : ''}
          </div>
          <div class="pprice">
            <div class="stepper"><button data-act="pstep" data-id="${pid}" data-d="-10">−</button>
              <input type="number" data-chg="price" data-id="${pid}" value="${price}" min="10" max="99990" step="10">
              <button data-act="pstep" data-id="${pid}" data-d="10">＋</button></div>
            <span class="pw ${pw.c}">${pw.t}</span>
          </div></div>`;
      }).join('')}</div>`;
    return { body };
  },

  /* ------------------------------ 倉庫と棚 ------------------------------ */
  openStock() { this.open('stock', '倉庫だな', {}); },
  render_stock() {
    const pids = Object.keys(G.stock).filter((p) => G.stock[p] > 0 && prod(p));
    if (!pids.length) return { body: '<p class="empty">倉庫はからっぽ。「しいれ」で商品を買うか、作業台で作ろう。</p>' };
    const body = `<p class="tip">箱を1つ持って、売り場へ運ぼう (1箱 ${BOX_MAX}こまで)。</p>
      <div class="cards">${pids.map((pid) => {
        const p = prod(pid);
        const ok = this.hasStore(p.store);
        return `<button class="card pickcard" data-act="take" data-id="${pid}">
          <div class="ci">${ProdArt.html(pid)}</div>
          <div class="cb"><b>${esc(p.name)}</b><div class="mini">×${G.stock[pid]}・${STORES[p.store].name}へ</div>
          ${ok ? '' : `<span class="tag warn">${STORES[p.store].name}がまだない</span>`}</div></button>`;
      }).join('')}</div>`;
    return { body };
  },
  openDisplay(f) { this.open('display', FURN[f.type].name, { f }); },
  render_display(a) {
    const f = a.f, store = FURN[f.type].display;
    const kinds = Object.values(KINDS).filter((k) => k.store === store).map((k) => k.name).join('・');
    const body = `<p class="tip">ここには <b>${kinds}</b> をならべる。倉庫だなで箱をとってきて、ここで「ならべる」。</p>
      <div class="rows">${f.slots.map((s, i) => {
        if (s.n <= 0) return `<div class="prow2 emptyslot"><div class="ci">・</div><div class="pinfo"><b>あき</b></div></div>`;
        const p = prod(s.pid);
        return `<div class="prow2"><div class="ci">${ProdArt.html(s.pid)}</div>
          <div class="pinfo"><b>${esc(p.name)}</b><div class="mini">${s.n}こ・${yen(priceOf(s.pid))}</div></div>
          <button class="btn small" data-act="down" data-i="${i}">倉庫にもどす</button></div>`;
      }).join('')}</div>`;
    return { body };
  },

  /* ------------------------------ 工房 ------------------------------ */
  goWorkshop() {
    const b = G.furn.find((f) => f.type === 'bench');
    if (!b) { Toast.show('作業台がないよ。「もようがえ」で置こう'); return; }
    const acc = Shop.access(b);
    if (acc.some((a) => Math.floor(R.player.x) === a.x && Math.floor(R.player.y) === a.y)) { this.openWorkshop(); return; }
    const a = acc.sort((p, q) => dist(p.x, p.y, R.player.x, R.player.y) - dist(q.x, q.y, R.player.x, R.player.y))[0];
    if (!a || !R.player.walkTo(a.x, a.y, { f: b, kind: 'bench' })) this.openWorkshop();
  },
  openWorkshop() {
    if (!this.wz) this.newWz();
    this.open('work', '工房 (作業台)', { tab: G.designs.length && this.wz.step === 1 ? 'list' : 'new' });
  },
  newWz() { this.wz = { step: 1, form: null, flav: [], shape: 'cat', color: DOLL_COLORS[0], name: '', named: false, wrap: null, ink: 0, colors: 0, price: null, qty: 6, v: 0 }; },
  wzEval() { const w = this.wz; return evalRecipe(w.form, w.flav, w.shape, w.ink, w.colors); },
  wzDesign() { const w = this.wz; return { id: 'tmp', form: w.form, flav: w.flav, shape: w.shape, color: w.color, wrap: w.wrap, colors: w.colors }; },
  render_work(a) {
    const tabs = this.tabs([['new', '✨ 新しく作る'], ['list', `📋 作った商品 (${G.designs.length})`]], a.tab, 'wtab');
    if (a.tab === 'list') return { tabs, ...this.workList() };
    const w = this.wz;
    const steps = ['かたち', '材料', '名前と絵', '値段と数'];
    const prog = `<div class="steps">${steps.map((s, i) => `<span class="${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div>`;
    const r = this['wz' + w.step]();
    return { tabs, body: prog + r.body, foot: r.foot, after: r.after, cls: 'wide' };
  },
  wz1() {
    const body = `<p class="tip">どんな商品を作る? かたちによって、ならべる場所がちがうよ。</p>
      <div class="cards">${FORMS.map((f) => {
        const need = Object.entries(f.need).map(([k, n]) => MAT[k].emoji + (n > 1 ? '×' + n : '')).join(' ') || 'なし';
        const st = KINDS[f.kind].store;
        return `<button class="card pickcard" data-act="wzForm" data-id="${f.id}">
          <div class="ci"><span class="pi emo">${f.emoji}</span></div>
          <div class="cb"><b>${f.name}</b><div class="mini">→ ${STORES[st].name}</div><div class="mini">いつも使う素材: ${need}</div>
          ${this.hasStore(st) ? '' : `<span class="tag warn">${STORES[st].name}がまだない</span>`}</div></button>`;
      }).join('')}</div>`;
    return { body };
  },
  wz2() {
    const w = this.wz, F = FORM[w.form], ev = this.wzEval();
    const need = Object.entries(F.need).map(([k, n]) => `<span class="needm">${MAT[k].emoji} ${MAT[k].name}×${n} <small>(持っている ${G.mats[k] || 0})</small></span>`).join('') || '<span class="needm">なし</span>';
    const slots = Array.from({ length: F.slots }, (_, i) => {
      const m = w.flav[i];
      return `<button class="slot ${m ? 'full' : ''}" data-act="wzClr" data-i="${i}">${m ? `<span class="emo">${MAT[m].emoji}</span>${MAT[m].name}<small>×</small>` : (F.id === 'doll' ? 'かざり' : 'あじ') + (i + 1)}</button>`;
    }).join('');
    const choices = F.choices.map((id) => {
      const m = MAT[id];
      return `<button class="matbtn" data-act="wzAdd" data-id="${id}"><span class="emo">${m.emoji}</span><b>${m.name}</b><small>${yen(m.cost)}・持 ${G.mats[id] || 0}</small></button>`;
    }).join('');
    let doll = '';
    if (F.id === 'doll') {
      doll = `<div class="field"><span>形</span><div class="pickrow">${DOLL_SHAPES.map((s) => `<button class="chip2 ${w.shape === s.id ? 'on' : ''}" data-act="wzShape" data-id="${s.id}">${s.name}</button>`).join('')}</div></div>
        <div class="field"><span>色</span><div class="pickrow">${DOLL_COLORS.map((c) => `<button class="sw ${w.color === c ? 'on' : ''}" data-act="wzColor" data-id="${c}" style="background:${c}"></button>`).join('')}</div></div>`;
    }
    const body = `<div class="wzhead"><span class="emo big">${F.emoji}</span><div><b>${F.name}</b><div class="mini">いつも使う: ${need}</div></div></div>
      ${doll}
      <div class="field"><span>${F.id === 'doll' ? 'かざり' : 'あじ'}</span><div class="slots">${slots}</div></div>
      <p class="mini">${F.minFlavor ? 'あじを1つ以上えらんでね。' : 'えらばなくてもいい。'}組み合わせで人気が変わるよ。</p>
      <div class="matgrid">${choices}</div>
      ${this.evalBox(ev)}`;
    const ok = w.flav.filter(Boolean).length >= F.minFlavor;
    return { body, foot: `<button class="btn" data-act="wzBack">もどる</button><span class="grow"></span><button class="btn primary" data-act="wzNext" ${ok ? '' : 'disabled'}>つぎへ ▶</button>` };
  },
  evalBox(ev) {
    return `<div class="evalbox"><div class="stars">${'★'.repeat(ev.stars)}<span>${'★'.repeat(5 - ev.stars)}</span></div>
      <div class="notes">${ev.notes.map((n) => `<div class="${n.v > 0 ? 'good' : 'bad'}">${n.v > 0 ? '◎' : '△'} ${esc(n.msg)}</div>`).join('') || '<div class="muted">組み合わせを考えてみよう</div>'}</div>
      <div class="mini">1こあたりの原価 ${yen(ev.cost)}・目安の値段 <b>${yen(ev.fair)}</b></div></div>`;
  },
  wz3() {
    const w = this.wz, ev = this.wzEval();
    if (!w.named) w.name = suggestName(w.form, w.flav, w.shape);
    const body = `<div class="wz3">
        <canvas id="wzPrev" width="192" height="192"></canvas>
        <div class="wz3r">
          <label class="field col"><span>商品の名前</span><input id="wzName" data-chg="wzName" maxlength="14" value="${esc(w.name)}"></label>
          <button class="btn small" data-act="wzSuggest">🎲 おまかせで決める</button>
          <button class="btn primary paintbtn" data-act="wzPaint">🖌️ ラッピングに絵を${w.wrap ? 'かきなおす' : 'かく'}</button>
          <p class="mini">絵をかくと「かわいい!」と思われて、売れやすくなるよ。</p>
        </div></div>
      ${this.evalBox(ev)}`;
    return { body, after: () => this.drawWzPrev(),
      foot: `<button class="btn" data-act="wzBack">もどる</button><span class="grow"></span><button class="btn primary" data-act="wzNext">つぎへ ▶</button>` };
  },
  drawWzPrev() {
    const cv = $('wzPrev');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const d = this.wzDesign();
    const paint = (img) => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.save(); ctx.scale(cv.width / ICON, cv.height / ICON); drawPackage(ctx, d, img); ctx.restore(); };
    if (this.wz.wrap) { const img = new Image(); img.onload = () => paint(img); img.src = this.wz.wrap; } else paint(null);
  },
  /* 作るのに必要な素材と、足りない分のお金 */
  craftCost(form, flav, qty) {
    const F = FORM[form], need = {};
    for (const k in F.need) need[k] = (need[k] || 0) + F.need[k] * qty;
    for (const m of flav) if (m) need[m] = (need[m] || 0) + qty;
    let buy = 0;
    for (const k in need) buy += Math.max(0, need[k] - (G.mats[k] || 0)) * MAT[k].cost;
    return { need, buy, cont: F.baseCost * qty, total: buy + F.baseCost * qty };
  },
  doCraft(form, flav, qty, pid) {
    const c = this.craftCost(form, flav, qty);
    if (G.money < c.total) { Sound.play('error'); Toast.show('お金が足りないよ', 'bad'); return false; }
    G.money -= c.total;
    for (const k in c.need) G.mats[k] = Math.max(0, (G.mats[k] || 0) - c.need[k]);
    G.stock[pid] = (G.stock[pid] || 0) + qty;
    Sound.play('craft');
    const b = G.furn.find((f) => f.type === 'bench');
    if (b) FX.sparkle(b.x + 1, b.y + 0.3, 10);
    return true;
  },
  wz4() {
    const w = this.wz, ev = this.wzEval();
    if (w.price == null) w.price = ev.fair;
    const pw = priceWord(w.price, ev.fair);
    const c = this.craftCost(w.form, w.flav, w.qty);
    const needList = Object.entries(c.need).map(([k, n]) => {
      const have = G.mats[k] || 0;
      return `<span class="needm ${have < n ? 'lack' : ''}">${MAT[k].emoji}${MAT[k].name} ${n}こ <small>(持 ${have})</small></span>`;
    }).join('');
    const body = `<div class="wz3"><canvas id="wzPrev" width="128" height="128"></canvas>
      <div class="wz3r"><b class="big">${esc(w.name)}</b>${this.evalBox(ev)}</div></div>
      <div class="field"><span>売る値段</span>
        <div class="stepper"><button data-act="wzPrice" data-d="-10">−</button><input type="number" data-chg="wzPriceIn" value="${w.price}" min="10" step="10"><button data-act="wzPrice" data-d="10">＋</button></div>
        <span class="pw ${pw.c}">${pw.t}</span><span class="mini">目安 ${yen(ev.fair)}</span></div>
      <div class="field"><span>作る数</span>
        <div class="stepper"><button data-act="wzQty" data-d="-1">−</button><b>${w.qty}</b><button data-act="wzQty" data-d="1">＋</button><button data-act="wzQty" data-d="6">+6</button></div></div>
      <div class="field col"><span>使う素材</span><div class="needs">${needList}</div></div>
      <div class="costline">足りない素材 ${yen(c.buy)} ＋ 入れ物代 ${yen(c.cont)} ＝ <b>${yen(c.total)}</b></div>`;
    return { body, after: () => this.drawWzPrev(),
      foot: `<button class="btn" data-act="wzBack">もどる</button><span class="grow"></span><button class="btn primary" data-act="wzMake" ${G.money < c.total ? 'disabled' : ''}>${c.buy ? '素材を買って作る!' : '作る!'} (${yen(c.total)})</button>` };
  },
  makeDesign() {
    const w = this.wz, ev = this.wzEval();
    const id = 'my:' + G.designSeq++;
    const d = { id, name: (w.name || '').trim() || suggestName(w.form, w.flav, w.shape), form: w.form, flav: w.flav.slice(), shape: w.shape,
      color: w.color, wrap: w.wrap, ink: w.ink, colors: w.colors, v: 1,
      cost: ev.cost, fair: ev.fair, appeal: ev.appeal, tags: ev.tags, stars: ev.stars };
    if (!this.doCraft(w.form, w.flav, w.qty, id)) { G.designSeq--; return; }
    G.designs.push(d);
    G.prices[id] = clamp(Math.round(w.price || ev.fair), 10, 99990);
    Toast.show(`「${d.name}」を ${w.qty}こ作った! 倉庫に入れたよ`, 'good');
    this.newWz();
    Missions.check();
    saveGame();
    this.close();
  },
  workList() {
    if (!G.designs.length) return { body: '<p class="empty">まだオリジナル商品がない。「新しく作る」から作ろう。</p>' };
    const body = `<div class="rows">${G.designs.map((d) => {
      const q = this.moreQty[d.id] || 6;
      const c = this.craftCost(d.form, d.flav, q);
      return `<div class="prow2"><div class="ci">${ProdArt.html(d.id)}</div>
        <div class="pinfo"><b>${esc(d.name)}</b> <span class="tag orig">${'★'.repeat(d.stars)}</span>
          <div class="mini">倉庫 ${G.stock[d.id] || 0}・原価 ${yen(d.cost)}・値段 ${yen(priceOf(d.id))}</div>
          <button class="mini-btn" data-act="redraw" data-id="${d.id}">🖌️ 絵をかきなおす</button></div>
        <div class="pprice">
          <div class="stepper"><button data-act="mqty" data-id="${d.id}" data-d="-1">−</button><b>${q}</b><button data-act="mqty" data-id="${d.id}" data-d="1">＋</button></div>
          <button class="btn small primary" data-act="more" data-id="${d.id}" ${G.money < c.total ? 'disabled' : ''}>作る ${yen(c.total)}</button>
        </div></div>`;
    }).join('')}</div>`;
    return { body };
  },
  /* オリジナル商品のラッピングをかく */
  paintWrap(d, onDone) {
    const prevD = { ...d, wrap: null };
    Paint.open({
      w: 160, h: 160, data: d.wrap, prevColors: d.colors || 0, bg: FORM[d.form].color,
      title: 'ラッピングに絵をかこう',
      hint: 'かいた絵が、入れ物の外がわになるよ。',
      preview: (ctx, cv) => drawPackage(ctx, prevD, cv),
      onDone,
    });
  },
  redrawDesign(pid) {
    const d = designOf(pid);
    if (!d) return;
    this.paintWrap(d, (r) => {
      d.wrap = r.data; d.ink = r.ink; d.colors = r.colors; d.v++;
      const ev = evalRecipe(d.form, d.flav, d.shape, d.ink, d.colors);
      Object.assign(d, { appeal: ev.appeal, fair: ev.fair, stars: ev.stars, tags: ev.tags });
      Missions.check();
      saveGame();
      this.rerender();
    });
  },

  /* ------------------------------ きせかえ ------------------------------ */
  openCloset() { this.open('closet', 'きせかえ', { st: { tab: 'body', mode: 'game', dir: 'd' } }); },
  render_closet(a) {
    return { body: `<p class="tip">${esc(G.hero.name)}のおしゃれをえらぼう。値段のついた物は、はじめてえらぶときに買う。おしゃれな店長はお客さんに気づいてもらえるかも。</p>` +
      Closet.html(G.hero, a.st, true), cls: 'wide' };
  },

  /* ------------------------------ アンケート ------------------------------ */
  openSurvey() { G.survey.unread = 0; this.open('survey', 'アンケート', {}); },
  render_survey() {
    const sv = G.survey;
    const topics = [['', 'なんでも'], ...Object.entries(KINDS).map(([k, v]) => [k, v.icon + ' ' + v.name])]
      .map(([k, l]) => `<button class="chip2 ${(sv.topic || '') === k ? 'on' : ''}" data-act="stopic" data-k="${k}">${l}</button>`).join('');
    const open = sv.cards.filter((c) => !c.done);
    const tally = new Map();
    for (const c of open) {
      const k = Survey.key(c.req);
      const e = tally.get(k) || { req: c.req, n: 0 };
      e.n++;
      tally.set(k, e);
    }
    const rank = [...tally.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    const how = (q) => (q.t === 'good' ? '「しいれ」で買って、ならべる' : '作業台で作って、ならべる');
    const q = sv.topic ? `ほしい${KINDS[sv.topic].name}は?` : 'このお店に、ほしい物は?';
    const body = `<p class="tip">紙のしつもん: <b>「${q}」</b><br>しつもんの種類を決めると、その中から「ほしい物」を書いてもらえる。</p>
      <div class="pickrow">${topics}</div>
      ${rank.length ? `<h3 class="sh">ほしい物ランキング</h3><div class="rank">${rank.map((r, i) => `<div class="rrow"><span class="rn">${i + 1}</span><span class="emo ri">${Survey.icon(r.req)}</span>
        <div class="rt"><b>${esc(Survey.name(r.req))}</b><small>${how(r.req)}</small></div><span class="rc">${r.n}まい</span></div>`).join('')}</div>` : ''}
      <h3 class="sh">とどいた紙</h3>
      ${sv.cards.length ? `<div class="papers">${sv.cards.map((c) => `<div class="paper ${c.done ? 'done' : ''}">
        <img src="${Closet.img(c.look)}">
        <div class="ptxt"><small>${esc(c.name)}さん (${SPECIES[c.look.sp].name})・${c.day}日目</small>
          <p>${esc(c.text)}</p><span class="preq"><span class="emo">${Survey.icon(c.req)}</span> ${esc(Survey.name(c.req))}</span></div>
        ${c.done ? '<span class="stamp">かなえた!</span>' : ''}</div>`).join('')}</div>`
        : '<p class="empty">まだ紙がない。お客さんが帰るときに書いてくれるよ。</p>'}`;
    const foot = sv.cards.some((c) => c.done) ? '<span class="grow"></span><button class="btn" data-act="sclear">かなえた紙をかたづける</button>' : '';
    return { body, foot, cls: 'wide' };
  },

  /* ------------------------------ ポスターと看板の絵 ------------------------------ */
  choosePic(kind, cb) {
    const list = Object.entries(G.pics).filter(([, p]) => p.kind === kind);
    if (!list.length) { this.newPic(kind, cb); return; }
    this.picCb = cb;
    this.open('pics', kind === 'poster' ? 'どのポスターをはる?' : 'どの看板を置く?', { kind });
  },
  render_pics(a) {
    const list = Object.entries(G.pics).filter(([, p]) => p.kind === a.kind);
    const body = `<div class="picgrid ${a.kind}">
      <button class="picnew" data-act="newPic" data-k="${a.kind}">＋<br>新しくかく</button>
      ${list.map(([id, p]) => `<button class="pic" data-act="pickPic" data-id="${id}"><img src="${p.data}"></button>`).join('')}</div>`;
    return { body };
  },
  newPic(kind, cb) {
    const sz = PIC_SIZE[kind];
    const shop = G.shopName;
    Paint.open({
      w: sz.w, h: sz.h, bg: kind === 'sign' ? '#fff8e8' : '#ffffff',
      title: kind === 'sign' ? '看板をかこう' : 'ポスターをかこう',
      hint: kind === 'sign' ? 'お店の名前は入れてある。好きにかきかえてね' : 'おすすめの商品や、お店の猫をかいてみよう',
      text: shop,
      init: kind === 'sign' ? (ctx, w, h) => {
        ctx.font = `900 ${shop.length > 7 ? 26 : 34}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.strokeText(shop, w / 2, h / 2, w - 20);
        ctx.fillStyle = '#d0402a'; ctx.fillText(shop, w / 2, h / 2, w - 20);
        ctx.font = `16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.fillText('🐾', 18, 18); ctx.fillText('🐾', w - 18, h - 18);
      } : null,
      onDone: (r) => {
        const id = G.picSeq++;
        G.pics[id] = { kind, data: r.data };
        cb(id);
      },
    });
  },
  drawPic(id, cb) {
    const p = G.pics[id];
    if (!p) return;
    const sz = PIC_SIZE[p.kind];
    Paint.open({
      w: sz.w, h: sz.h, data: p.data, bg: p.kind === 'sign' ? '#fff8e8' : '#ffffff',
      title: p.kind === 'sign' ? '看板をかきなおす' : 'ポスターをかきなおす', text: G.shopName,
      onDone: (r) => { p.data = r.data; if (cb) cb(); },
    });
  },

  /* ------------------------------ ボタンの処理 ------------------------------ */
  act(a, b) {
    const d = b.dataset;
    const w = this.wz;
    switch (a) {
      case 'otab': this.panel.args.tab = d.k; this.rerender(true); return;
      case 'wtab': this.panel.args.tab = d.k; this.rerender(true); return;
      case 'buy': {
        const g = GOOD[d.id], n = +d.n;
        if (G.money < g.cost * n) return;
        G.money -= g.cost * n;
        G.stock[g.id] = (G.stock[g.id] || 0) + n;
        G.stats.ordered += n;
        Sound.play('buy');
        Missions.check();
        break;
      }
      case 'mat': {
        const m = MAT[d.id], n = +d.n;
        if (G.money < m.cost * n) return;
        G.money -= m.cost * n;
        G.mats[m.id] = (G.mats[m.id] || 0) + n;
        Sound.play('buy');
        break;
      }
      case 'pstep': {
        G.prices[d.id] = clamp(priceOf(d.id) + +d.d, 10, 99990);
        Sound.play('click');
        break;
      }
      case 'price': {
        const v = Math.round(+b.value);
        if (v > 0) G.prices[d.id] = clamp(v, 10, 99990);
        b.value = priceOf(d.id);
        this.setPw(b.closest('.prow2').querySelector('.pw'), priceOf(d.id), prod(d.id).fair);
        return;
      }
      case 'rename': {
        const dz = designOf(d.id);
        if (dz && b.value.trim()) { dz.name = b.value.trim().slice(0, 14); dz.v++; }
        return;
      }
      case 'redraw': this.redrawDesign(d.id); return;
      case 'take': {
        Interact.takeBox(d.id);
        const p = prod(d.id);
        this.close();
        Toast.show(`${p.name}の箱を持った。${STORES[p.store].name}へ運ぼう`);
        return;
      }
      case 'down': Interact.takeDown(this.panel.args.f, +d.i); break;
      case 'wzForm':
        w.form = d.id; w.flav = []; w.step = 2; w.named = false; w.price = null; w.wrap = null; w.ink = 0; w.colors = 0;
        w.color = d.id === 'doll' ? DOLL_COLORS[0] : '#ff8fa3';
        this.rerender(true); return;
      case 'wzAdd': {
        const F = FORM[w.form];
        const i = Array.from({ length: F.slots }, (_, k) => k).find((k) => !w.flav[k]);
        if (i == null) { Toast.show('いっぱい。外したいところをタップしてね'); return; }
        w.flav[i] = d.id; w.named = false; w.price = null;
        Sound.play('pick');
        break;
      }
      case 'wzClr': w.flav[+d.i] = null; w.named = false; w.price = null; break;
      case 'wzShape': w.shape = d.id; w.named = false; break;
      case 'wzColor': w.color = d.id; break;
      case 'wzBack': if (w.step > 1) w.step--; this.rerender(true); return;
      case 'wzNext': if (w.step < 4) w.step++; this.rerender(true); return;
      case 'wzName': w.name = b.value.trim().slice(0, 14); w.named = true; return;
      case 'wzSuggest': w.named = false; w.name = ''; break;
      case 'wzPaint':
        this.paintWrap(this.wzDesign(), (r) => {
          w.wrap = r.data; w.ink = r.ink; w.colors = r.colors; w.price = null;
          Missions.check();
          this.rerender();
        });
        return;
      case 'wzPrice': w.price = clamp((w.price || 0) + +d.d, 10, 99990); break;
      case 'wzPriceIn': {
        const v = Math.round(+b.value);
        if (v > 0) w.price = clamp(v, 10, 99990);
        b.value = w.price;
        this.setPw($('mBody').querySelector('.pw'), w.price, this.wzEval().fair);
        return;
      }
      case 'wzQty': w.qty = clamp(w.qty + +d.d, 1, 30); break;
      case 'wzMake': this.makeDesign(); return;
      case 'mqty': this.moreQty[d.id] = clamp((this.moreQty[d.id] || 6) + +d.d, 1, 30); break;
      case 'more': {
        const dz = designOf(d.id), q = this.moreQty[d.id] || 6;
        if (dz && this.doCraft(dz.form, dz.flav, q, dz.id)) Toast.show(`「${dz.name}」を ${q}こ作った!`, 'good');
        break;
      }
      case 'newPic': { const cb = this.picCb; this.picCb = null; this.close(); this.newPic(d.k, cb); return; }
      case 'pickPic': { const cb = this.picCb; this.picCb = null; this.close(); cb(+d.id); return; }
      case 'next': Day.next(); this.close(); return;
      case 'closeHelp': this.close(); return;
      case 'stopic': G.survey.topic = d.k || null; break;
      case 'sclear': G.survey.cards = G.survey.cards.filter((c) => !c.done); break;
      case 'snd': Sound.sfxOn = !Sound.sfxOn; this.savePref(); break;
      case 'mus': Sound.setMusic(!Sound.musicOn); this.savePref(); break;
      case 'save': Toast.show(saveGame() ? '保存した' : '保存できなかった', 'good'); return;
      case 'renameShop': {
        const v = $('menuShop').value.trim().slice(0, 12);
        if (v) { G.shopName = v; Toast.show(`「${v}」になった!`, 'good'); }
        break;
      }
      case 'help': this.openHelp(); return;
      case 'title': saveGame(); location.reload(); return;
    }
    this.rerender();
  },
  setPw(el, price, fair) {
    if (!el) return;
    const pw = priceWord(price, fair);
    el.className = 'pw ' + pw.c;
    el.textContent = pw.t;
  },
  savePref() { Save.setPref({ sfx: Sound.sfxOn, music: Sound.musicOn }); },

  /* ------------------------------ もようがえの帯 ------------------------------ */
  showEditBar() { this.etab = this.etab || 'furn'; $('editBar').classList.remove('hide'); this.renderEditBar(); },
  hideEditBar() { $('editBar').classList.add('hide'); },
  renderEditBar() {
    if (!Editor.active) return;
    const t = Editor.tool, s = Editor.sel;
    let msg = '', items = '';
    if (s) {
      if (s.f) {
        const d = FURN[s.f.type];
        msg = `<b>${d.icon} ${d.name}</b> ${esc(d.desc)}`;
        items = `<button data-act="eMove">✋ うごかす</button>` +
          (d.keep ? '' : `<button data-act="eRemove">🗑️ しまう (+${yen(Math.floor(d.cost / 2))})</button>`) +
          `<button data-act="eCancel">やめる</button>`;
      } else if (s.wall) {
        const it = G.walls[s.wall][s.x];
        msg = `<b>${WALLS[it.type].icon} ${WALLS[it.type].name}</b>`;
        items = (it.type === 'poster' ? `<button data-act="eRedraw">🖌️ かきなおす</button>` : '') +
          `<button data-act="eRemove">🗑️ はずす (+${yen(Math.floor(WALLS[it.type].cost / 2))})</button><button data-act="eCancel">やめる</button>`;
      } else if (s.sign) {
        msg = `<b>🪧 看板</b>`;
        items = `<button data-act="eRedraw">🖌️ かきなおす</button><button data-act="eRemove">🗑️ はずす (+${yen(Math.floor(WALLS.sign.cost / 2))})</button><button data-act="eCancel">やめる</button>`;
      } else if (s.door) {
        msg = `<b>🚪 入り口</b> ${G.door.auto ? '自動ドア' : 'ふつうのドア'}`;
        items = `<button data-act="eDoor">↔ ドアの場所を変える</button>` +
          (G.door.auto ? '' : `<button data-act="eAuto" ${G.money < WALLS.autodoor.cost ? 'disabled' : ''}>自動ドアにする ${yen(WALLS.autodoor.cost)}</button>`) +
          `<button data-act="eCancel">やめる</button>`;
      }
    } else {
      const tabs = [['furn', '家具'], ['wall', 'かべ・外'], ['shop', 'お店']];
      const tabHtml = tabs.map(([k, l]) => `<button data-act="eTab" data-k="${k}" class="${this.etab === k ? 'on' : ''}">${l}</button>`).join('');
      msg = `<div class="etabs">${tabHtml}</div>`;
      const btn = (act, id, icon, name, cost, on, dis) =>
        `<button class="eitem ${on ? 'on' : ''}" data-act="${act}" data-id="${id}" ${dis ? 'disabled' : ''}><i>${icon}</i><span>${name}</span>${cost != null ? `<small>${cost ? yen(cost) : 'ただ'}</small>` : ''}</button>`;
      if (this.etab === 'furn') {
        items = FURN_ORDER.map((k) => btn('eFurn', k, FURN[k].icon, FURN[k].name, FURN[k].cost, t && t.kind === 'furn' && t.type === k, G.money < FURN[k].cost)).join('');
      } else if (this.etab === 'wall') {
        items = btn('eWall', 'window', WALLS.window.icon, '窓', WALLS.window.cost, t && t.kind === 'wall' && t.type === 'window', G.money < WALLS.window.cost) +
          btn('eWall', 'poster', WALLS.poster.icon, 'ポスター', WALLS.poster.cost, t && t.kind === 'wall' && t.type === 'poster', G.money < WALLS.poster.cost) +
          btn('eSign', 'sign', WALLS.sign.icon, '看板', WALLS.sign.cost, t && t.kind === 'sign', G.money < WALLS.sign.cost || G.signs.length >= MAX_SIGNS) +
          btn('eDoor', 'door', '↔', 'ドアの場所', 0, t && t.kind === 'door') +
          (G.door.auto ? '' : btn('eAuto', 'auto', WALLS.autodoor.icon, '自動ドア', WALLS.autodoor.cost, false, G.money < WALLS.autodoor.cost));
      } else {
        const next = SHOP_SIZES[G.lv + 1];
        items = next
          ? `<div class="expand"><div>いまの広さ <b>${Shop.W}×${Shop.H}</b> → <b>${next.w}×${next.h}</b></div>
             <button class="btn primary" data-act="eExpand" ${G.money < next.cost || G.phase !== 'prep' ? 'disabled' : ''}>お店を広げる ${yen(next.cost)}</button>
             <div class="mini">${G.phase !== 'prep' ? '工事は開店前のじゅんび中にできる' : 'お客さんがたくさん入れるようになる'}</div></div>`
          : '<div class="expand">いちばん大きなお店になった!</div>';
      }
    }
    let hint;
    if (s) hint = '';
    else if (!t) hint = '置きたい物をえらぶ。置いてある物をタップすると、動かしたりしまったりできる';
    else if (t.kind === 'furn') hint = FURN[t.type].desc + '。床をタップして置こう';
    else if (t.kind === 'move') hint = '動かす先の床をタップ';
    else if (t.kind === 'wall') hint = (t.type === 'window' ? WALLS.window.desc : WALLS.poster.desc) + '。かべをタップ';
    else if (t.kind === 'sign') hint = WALLS.sign.desc + '。お店の前の歩道をタップ';
    else if (t.kind === 'door') hint = 'お店の前のかべをタップすると、そこがドアになる';
    $('editBar').innerHTML = `<div class="ehead"><div class="emsg">${msg}</div><span class="emoney">${yen(G.money)}</span><button class="btn primary small" data-act="eDone">おわる</button></div>
      ${hint ? `<div class="ehint">${esc(hint)}</div>` : ''}
      <div class="eitems">${items}</div>`;
  },
  editAct(a, b) {
    const d = b.dataset;
    switch (a) {
      case 'eDone': Editor.close(); return;
      case 'eTab': this.etab = d.k; Editor.setTool(null); return;
      case 'eFurn': {
        const t = Editor.tool;
        Editor.setTool(t && t.kind === 'furn' && t.type === d.id ? null : { kind: 'furn', type: d.id });
        return;
      }
      case 'eWall': {
        const t = Editor.tool;
        Editor.setTool(t && t.kind === 'wall' && t.type === d.id ? null : { kind: 'wall', type: d.id });
        return;
      }
      case 'eSign': Editor.setTool({ kind: 'sign' }); return;
      case 'eDoor': Editor.setTool({ kind: 'door' }); return;
      case 'eAuto': Editor.buyAutoDoor(); return;
      case 'eExpand': Editor.expand(); return;
      case 'eMove': { const f = Editor.sel.f; Editor.setTool({ kind: 'move', f }); return; }
      case 'eRemove': Editor.removeSel(); return;
      case 'eRedraw': Editor.redrawSel(); return;
      case 'eCancel': Editor.sel = null; this.renderEditBar(); return;
    }
  },

  /* ------------------------------ 1日のまとめ ------------------------------ */
  showSummary() { this.open('summary', `${G.day}日目 おしまい`, {}); },
  render_summary() {
    const t = G.today;
    const profit = t.sales - t.cost;
    const dr = Math.round(G.rep - t.repStart);
    const top = Object.entries(t.sold).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const quotes = shuffle(t.quotes.slice()).slice(0, 3);
    const s = stars();
    const body = `<div class="sum">
      <div class="sumbig"><span>売り上げ</span><b>${yen(t.sales)}</b></div>
      <div class="sumrow"><span>商品の原価</span><b>${yen(t.cost)}</b></div>
      <div class="sumrow"><span>もうけ</span><b class="${profit >= 0 ? 'good' : 'bad'}">${yen(profit)}</b></div>
      <div class="sumrow"><span>来たお客さん</span><b>${t.customers}人</b><span class="mini">😊 ${t.happy}・😢 ${t.sad}</span></div>
      <div class="sumrow"><span>評判</span><b class="starsy">${'★'.repeat(s)}${'☆'.repeat(5 - s)}</b><span class="mini ${dr >= 0 ? 'good' : 'bad'}">${dr >= 0 ? '+' : ''}${dr}</span></div>
      ${top.length ? `<h3>よく売れた商品</h3><div class="toplist">${top.map(([pid, n], i) => `<div>${['🥇', '🥈', '🥉'][i]} ${ProdArt.html(pid, 'pi sm')} ${esc((prod(pid) || { name: '?' }).name)} <b>${n}こ</b></div>`).join('')}</div>` : ''}
      ${quotes.length ? `<h3>お客さんの声</h3><div class="quotes">${quotes.map((q) => `<div class="quote"><img src="${Closet.img(q.look)}"><div><small>${esc(q.name)}さん</small>「${esc(q.text)}」</div></div>`).join('')}</div>` : ''}
      ${t.sad > t.happy ? '<p class="tip">ヒント: ほしい物がない・高い・待たされる・よごれている と、お客さんはがっかりするよ。</p>' : ''}
    </div>`;
    return { body, foot: `<span class="grow"></span><button class="btn primary" data-act="next">${G.day + 1}日目へ ▶</button>` };
  },

  /* ------------------------------ メニューとあそびかた ------------------------------ */
  openMenu() { this.open('menu', 'メニュー', {}); },
  render_menu() {
    const body = `<div class="menu">
      <div class="rename"><input id="menuShop" maxlength="12" value="${esc(G.shopName)}"><button class="btn" data-act="renameShop">お店の名前を変える</button></div>
      <button class="btn" data-act="snd">効果音: ${Sound.sfxOn ? 'オン' : 'オフ'}</button>
      <button class="btn" data-act="mus">音楽: ${Sound.musicOn ? 'オン' : 'オフ'}</button>
      <button class="btn" data-act="save">いま保存する</button>
      <button class="btn" data-act="help">あそびかた</button>
      <button class="btn ghost" data-act="title">タイトルにもどる</button>
      <p class="mini">開いている間は時間が止まる。セーブは自動で、この端末のブラウザにだけ残る。</p></div>`;
    return { body };
  },
  openHelp(first) { this.open('help', first ? 'ようこそ!' : 'あそびかた', { first }); },
  render_help(a) {
    const body = `<div class="help">
      ${a.first && G ? `<p class="lead2">「${esc(G.shopName)}」の店長、${esc(G.hero.name)}になって、ねこの町でお店をひらこう!</p>` : ''}
      <h3>🐾 うごかしかた</h3>
      <p><b>パソコン</b>: WASD か 矢印キーで歩く。スペースで近くの物を使う。<br><b>スマホ</b>: 行きたい場所や家具をタップ。右下のボタンで使う。</p>
      <h3>🛒 売るまで</h3>
      <ol><li>「しいれ」で商品を買うと、倉庫だなに入る</li>
      <li>倉庫だなで箱をとって、商品だなや冷蔵庫に「ならべる」</li>
      <li>「開店する」を押すと、お客さんがやってくる</li>
      <li>お客さんは店の中を見てまわって、ほしい物をかごに入れる</li>
      <li>レジに並んだら、<b>レジのうしろに立つ</b>とお会計できる</li></ol>
      <h3>✨ オリジナル商品</h3>
      <p>「もようがえ」で作業台を置いて、素材を買えば、自分だけの飲みもの・食べもの・ぬいぐるみが作れる。名前をつけて、ラッピングに絵をかいて、値段も自由に決められる。</p>
      <h3>🏠 お店づくり</h3>
      <p>「もようがえ」で家具・窓・ポスター・看板・自動ドアを置ける。お店を広げることもできる。看板やポスターは自分でかく。</p>
      <h3>🐶 いろいろなお客さん</h3>
      <p>ねこのほかに、いぬ・うさぎ・くま・パンダ・たぬき・きつね・ハムスター・ペンギンも来る。動物によって好きな物がちがうよ。</p>
      <h3>📝 アンケート</h3>
      <p>「もようがえ」でアンケート台を置くと、お客さんが「こんなのがほしい」を紙に書いてくれる。台で紙を読んで、その商品を仕入れたり作ったりして並べると、リクエストがかなって評判が上がる。</p>
      <h3>👗 きせかえ</h3>
      <p>「きせかえ」で店長の服やぼうし、めがね、目の色 (オッドアイも) を変えられる。新しいおしゃれはお金で買う。</p>
      <h3>⭐ 評判</h3>
      <p>お客さんがよろこぶと評判が上がって、お客さんがふえる。ゴミや水たまりはふみに行くと片付く。ゴミ箱がいっぱいになったら中身を出そう。</p></div>`;
    return { body, foot: `<span class="grow"></span><button class="btn primary" data-act="closeHelp">はじめる</button>` };
  },
};
