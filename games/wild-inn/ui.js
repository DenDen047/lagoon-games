/* =========================================================================
   WILD INN ― 画面の部品
   タイトル / ホテルづくり / 上の帯 / 電話 / 受付 (チェックイン・お見送り) /
   えさ / ペットのようす / あずかり中の一覧 / えさの注文 / 料金 / ずかん /
   もようがえの帯 / 1日のまとめ / メニュー / あそびかた
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const APRONS = ['#ff8fa3', '#6cb6e8', '#8fd27e', '#ffd25e', '#b59ae8', '#ff9f5a'];
const HS_NAMES = ['みじかい', 'ながい', 'おだんご', 'まえがみ'];

const UI = {
  touch: false, panel: null, last: {}, setup: null, actsKey: '',

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
    $('ring').onclick = () => this.answer();
    $('mClose').onclick = () => this.close();
    $('mission').onclick = () => $('mission').classList.toggle('small');
    $('toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !G || G.phase !== 'day') return;
      Sound.play('click');
      const p = b.dataset.p;
      if (p === 'phone') { if (R.call) this.answer(); else this.openGuests('book'); }
      else if (p === 'guests') this.openGuests('stay');
      else if (p === 'food') this.openFood();
      else if (p === 'price') this.openPrices();
      else if (p === 'edit') Editor.open();
      else if (p === 'book') this.openBook();
    });
    $('hFloors').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      Sound.play('click');
      this.goFloor(+b.dataset.f);
    });
    $('acts').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) Interact.use(b.dataset.id);
    });
    $('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') { this.close(); return; }
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled || !this.panel) return;
      const fn = this.panel.on[b.dataset.act];
      if (fn) { Sound.play('click'); fn(b.dataset.v, b); }
    });
    $('modal').addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.chg && this.panel && this.panel.on[el.dataset.chg]) this.panel.on[el.dataset.chg](el.value, el);
    });
    $('editBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) { Sound.play('click'); Editor.act(b.dataset.act, b); }
    });
    $('editBar').addEventListener('change', (e) => { if (e.target.dataset.chg === 'rename') { Editor.rename(e.target.value); this.renderEditBar(); } });
    $('btnCont').disabled = !Save.read();
    if (this.touch) $('ring').querySelector('small').textContent = 'タップで出る';
  },

  /* ------------------------------ ホテルづくり ------------------------------ */
  showSetup() {
    $('title').classList.add('hide');
    $('setup').classList.remove('hide');
    this.setup = { look: { skin: SKINS[0], hair: HAIRS[0], hs: 0, shirt: '#ffffff', pants: '#4a5a7a', apron: APRONS[0] }, price: HABITATS.town.market };
    this.renderSetup();
    $('setup').onclick = (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      Sound.play('click');
      const k = b.dataset.k, v = b.dataset.v, L = this.setup.look;
      if (k === 'skin') L.skin = v;
      else if (k === 'hair') L.hair = v;
      else if (k === 'hs') L.hs = +v;
      else if (k === 'apron') L.apron = v;
      else if (k === 'price') this.setup.price = clamp(this.setup.price + +v, 300, 9900);
      this.renderSetup();
    };
  },
  renderSetup() {
    const L = this.setup.look;
    const sw = (k, arr, cur) => arr.map((c) => `<button class="sw${c === cur ? ' on' : ''}" data-k="${k}" data-v="${c}" style="background:${c}"></button>`).join('');
    $('setLook').innerHTML = `
      <div class="field"><span>はだ</span><div class="pickrow">${sw('skin', SKINS, L.skin)}</div></div>
      <div class="field"><span>かみの色</span><div class="pickrow">${sw('hair', HAIRS, L.hair)}</div></div>
      <div class="field"><span>かみがた</span><div class="pickrow">${HS_NAMES.map((n, i) => `<button class="chip2${i === L.hs ? ' on' : ''}" data-k="hs" data-v="${i}">${n}</button>`).join('')}</div></div>
      <div class="field"><span>エプロン</span><div class="pickrow">${sw('apron', APRONS, L.apron)}</div></div>
      <div class="field"><span>おうちの部屋<br><small>1泊の料金</small></span><div class="stepper">
        <button data-k="price" data-v="-500">−500</button><button data-k="price" data-v="-100">−</button>
        <b class="pricev">${yen(this.setup.price)}</b>
        <button data-k="price" data-v="100">＋</button><button data-k="price" data-v="500">＋500</button></div></div>
      <p class="mini">相場は ${yen(HABITATS.town.market)}。高くするともうかるけれど、電話でことわられやすくなるよ。あとからいつでも変えられる。</p>`;
  },
  tickSetup(t) {
    if ($('setup').classList.contains('hide') || !this.setup) return;
    const c = $('ownerPrev'), ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.save(); ctx.translate(55, 96); ctx.scale(1.6, 1.6);
    drawPerson(ctx, 0, 0, this.setup.look, { dir: 'd', t, wave: Math.sin(t * 0.8) > 0.6 });
    ctx.restore();
    drawPet(ctx, 26, 100, { sp: 'dog', c: 0 }, { dir: 'r', t, happy: true, hop: Math.abs(Math.sin(t * 5)) * 2 });
    drawPet(ctx, 86, 100, { sp: 'cat', c: 1 }, { dir: 'l', t });
  },
  startNew() {
    const hotel = ($('inHotel').value || '').trim() || 'どうぶつホテル';
    const name = ($('inOwner').value || '').trim() || 'オーナー';
    Sound.init();
    newGame(hotel.slice(0, 12), { name: name.slice(0, 8), look: { ...this.setup.look } }, this.setup.price);
    $('setup').classList.add('hide');
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
    return { top, bottom: Math.max(0, window.innerHeight - r.top) + (Editor.active ? 4 : 58) };
  },
  set(id, v, prop = 'textContent') {
    if (this.last[id] === v) return;
    this.last[id] = v;
    $(id)[prop] = v;
  },
  tick() {
    if (!G) return;
    this.set('hName', G.hotel);
    this.set('hDay', `${G.day}日目`);
    this.set('hClock', G.phase === 'night' ? 'よる' : clockText(G.clock));
    this.set('hMoney', yen(G.money));
    const s = stars();
    this.set('hStars', '★'.repeat(s) + '☆'.repeat(5 - s));
    this.set('bSpeed', R.speed === 2 ? '▶▶' : '▶');
    const fkey = [G.floors, Render.floor(), Editor.active, ...R.pets.map((p) => p.g && p.floor + ':' + (p.g.hunger < 25 ? 1 : 0))].join(',');
    if (fkey !== this.last.floors) {
      this.last.floors = fkey;
      let h = '';
      for (let f = G.floors - 1; f >= 0; f--) {
        const pets = R.pets.filter((p) => p.g && p.floor === f);
        const hungry = pets.some((p) => p.g.hunger < 25);
        h += `<button data-f="${f}" class="${f === Render.floor() ? 'on' : ''}">${f + 1}F${pets.length ? `<small>🐾${pets.length}</small>` : ''}${hungry ? '<i class="dot"></i>' : ''}</button>`;
      }
      $('hFloors').innerHTML = h;
      $('hFloors').classList.toggle('hide', G.floors < 2);
    }
    const modal = this.modalOpen();
    $('ring').classList.toggle('hide', !R.call || modal || Editor.active || G.phase !== 'day');
    $('toolbar').classList.toggle('hide', Editor.active);
    const acts = Editor.active || modal ? [] : Interact.actions(Interact.target());
    const key = acts.map((a) => a.id + a.label).join('|');
    if (key !== this.actsKey) {
      this.actsKey = key;
      $('acts').innerHTML = acts.map((a) => `<button data-id="${a.id}"><i class="emo">${a.icon}</i><span>${a.label}</span>${this.touch ? '' : `<kbd>${a.key}</kbd>`}</button>`).join('');
      $('acts').classList.toggle('hide', !acts.length);
    }
  },
  refresh() { this.last = {}; this.actsKey = '-'; this.tick(); this.refreshMission(); },
  refreshMission() {
    if (!G) return;
    const m = Missions.current();
    const el = $('mission');
    if (!m) { el.innerHTML = '<b>🏆 世界一のどうぶつホテル!</b>'; return; }
    el.innerHTML = `<b>🎯 目標</b><span>${esc(m.text)}</span>${m.reward ? `<em>ごほうび ${yen(m.reward)}</em>` : ''}`;
  },
  /* 階のボタン: 階段まで歩いて、その階へ */
  goFloor(f) {
    if (Editor.active) { Editor.setFloor(f); this.last.floors = ''; return; }
    const p = R.player;
    if (f === p.floor) return;
    const s = Hotel.stairs();
    if (!p.goTo(f, s.x + 2, s.y + 1)) p.useStairs(f);
  },
  answer() {
    if (!R.call || this.modalOpen() || Editor.active) return;
    Sound.play('pickup');
    this.openCall(R.call.offer);
  },

  /* ------------------------------ 小窓 ------------------------------ */
  open(kind, title, body, foot, on = {}, opts = {}) {
    const keep = this.panel && this.panel.kind === kind ? $('mBody').scrollTop : 0;
    this.panel = { kind, on, onClose: opts.onClose || null, render: opts.render || null };
    $('mTitle').innerHTML = title;
    $('mBody').innerHTML = body;
    $('mFoot').innerHTML = foot || '';
    $('mFoot').classList.toggle('hide', !foot);
    $('mCard').classList.toggle('wide', !!opts.wide);
    $('modal').classList.remove('hide');
    document.body.classList.add('mopen');
    $('mBody').scrollTop = keep;
    Input.keys.clear();
  },
  close() {
    if (!this.panel) return;
    const p = this.panel;
    this.panel = null;
    $('modal').classList.add('hide');
    document.body.classList.remove('mopen');
    if (p.onClose) p.onClose();
    this.actsKey = '-';
  },
  modalOpen() { return !!this.panel; },
  rerender() { if (this.panel && this.panel.render) this.panel.render(); },

  meter(v, col) {
    return `<span class="meter"><i style="width:${clamp(v, 0, 100).toFixed(0)}%;background:${col}"></i></span>`;
  },
  moodCol(v) { return v >= 65 ? '#3fae6a' : v >= 40 ? '#e3b21a' : '#e0504a'; },
  starsHtml(n) { return `<span class="stars">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>`; },
  habTag(h) { return `<span class="tag hab" style="background:${rgba(HABITATS[h].floor, 0.45)};border-color:${HABITATS[h].trim}">${HABITATS[h].icon} ${HABITATS[h].name}</span>`; },
  foodList(list, fav) { return list.map((f) => `<span class="food${f === fav ? ' fav' : ''}">${FOODS[f].icon}${FOODS[f].name}${f === fav ? '★' : ''}</span>`).join(''); },

  /* ------------------------------ 電話 ------------------------------ */
  openCall(o) {
    const S = SPECIES[o.sp], H = HABITATS[S.hab], r = Calls.reaction(o);
    const free = G.rooms.some((rm) => rm.hab === S.hab && Hotel.cap(rm) - Hotel.used(rm) >= S.slots);
    const anyFree = G.rooms.some((rm) => Hotel.cap(rm) - Hotel.used(rm) >= S.slots);
    const say = {
      ok: 'その料金なら、ぜひおねがいします!',
      haggle: `うーん、ちょっと高いなあ…。1泊 ${yen(r.ask)} にしてもらえませんか?`,
      no: 'えっ、そんなに高いんですか!? ほかのホテルをさがします…',
    }[r.kind];
    const body = `
      <div class="talk">
        <div class="who"><img src="${Icons.person(o.owner)}" alt=""><small>${esc(o.caller)}</small></div>
        <div class="say">
          <p>もしもし、${esc(G.hotel)}さんですか? ${esc(o.caller)}です。</p>
          <p>${esc(o.reason)}、${S.name}の「${esc(o.name)}」を <b>${o.nights}泊</b> あずかってほしいんです。</p>
          <p>${H.phone}${FOODS[S.fav].name}が大好物です。${FURN[S.likes].name}があると、よろこびます。</p>
        </div>
        <div class="who pet"><img src="${Icons.pet(o.sp, o.look.c)}" alt=""><small>${esc(o.name)}</small></div>
      </div>
      <div class="facts">
        <div>🐾 ${S.name} ${this.habTag(S.hab)}${S.slots > 1 ? ' <span class="tag warn">大きい動物 (2ひき分)</span>' : ''}</div>
        <div>💴 料金 1泊 ${yen(G.prices[S.hab])}${S.slots > 1 ? ' ×2' : ''} × ${o.nights}泊 = <b>${yen(r.fee * o.nights)}</b></div>
        <div>🚪 ${free ? `<span class="good">◎ ${H.room}に空きがある</span>` : anyFree ? `<span class="bad">△ ${H.room}に空きがない</span> <small>(ほかの部屋だと元気がなくなるよ)</small>` : '<span class="bad">✕ 空いている部屋がない</span> <small>(来るまでに部屋をつくろう)</small>'}</div>
      </div>
      <div class="reply ${r.kind}">「${say}」</div>
      ${r.kind === 'no' ? '<p class="mini">料金は 💴料金 で変えられるよ。</p>' : ''}`;
    let foot;
    if (r.kind === 'ok') foot = '<button class="btn" data-act="no">ことわる</button><span class="grow"></span><button class="btn primary" data-act="yes">引き受ける!</button>';
    else if (r.kind === 'haggle') foot = `<button class="btn" data-act="no">ことわる</button><span class="grow"></span><button class="btn primary" data-act="haggle">${yen(r.ask)}で引き受ける</button>`;
    else foot = '<span class="grow"></span><button class="btn" data-act="no">電話を切る</button>';
    let decided = false;
    const done = (fn) => () => { decided = true; fn(); this.close(); };
    this.open('call', '📞 でんわ', body, foot, {
      yes: done(() => Calls.accept(o, r.fee)),
      haggle: done(() => Calls.accept(o, r.ask)),
      no: done(() => Calls.decline()),
    }, { onClose: () => { if (!decided) Calls.decline(); } });
  },

  /* ------------------------------ 受付 ------------------------------ */
  openDesk(v) {
    if (v.kind === 'in') this.openCheckin(v);
    else this.openCheckout(v);
  },
  roomRows(sp, act, exceptId) {
    const S = SPECIES[sp];
    const rooms = G.rooms.slice().sort((a, b) => (b.hab === S.hab) - (a.hab === S.hab) || a.floor - b.floor);
    if (!rooms.length) return '<p class="empty">部屋がひとつもないよ</p>';
    return `<div class="rows">${rooms.map((rm) => {
      const left = Hotel.cap(rm) - Hotel.used(rm), fits = left >= S.slots || rm.id === exceptId;
      const scary = S.prey && Hotel.guestsIn(rm).some((g) => SPECIES[g.sp].pred);
      const match = rm.hab === S.hab;
      const pets = Hotel.guestsIn(rm).map((g) => `<img class="pi sm" src="${Icons.pet(g.sp, g.look.c)}" alt="">`).join('');
      return `<div class="prow2${fits ? '' : ' dim'}">
        <div class="pinfo"><b>${HABITATS[rm.hab].icon} ${esc(rm.name)}</b> <small class="muted">${rm.floor + 1}階</small><br>
          ${match ? '<span class="tag ok">◎ ぴったり</span>' : '<span class="tag warn">△ 生息地がちがう</span>'}
          ${scary ? '<span class="tag bad">⚠ こわい動物がいる</span>' : ''}
          <span class="mini">${Hotel.used(rm)}/${Hotel.cap(rm)}ひき</span> ${pets}</div>
        ${rm.id === exceptId ? '<span class="mini">いまの部屋</span>' : `<button class="btn small${match && !scary ? ' primary' : ''}" data-act="${act}" data-v="${rm.id}" ${fits ? '' : 'disabled'}>${fits ? 'ここにする' : 'いっぱい'}</button>`}
      </div>`;
    }).join('')}</div>`;
  },
  openCheckin(v) {
    const b = v.booking, S = SPECIES[b.sp];
    const body = `
      <div class="talk">
        <div class="who"><img src="${Icons.person(b.owner)}" alt=""><small>${esc(b.caller)}</small></div>
        <div class="say"><p>「${esc(b.name)}」を ${b.nights}泊、よろしくおねがいします! ${FOODS[S.fav].icon}${FOODS[S.fav].name}が大好物です。</p></div>
        <div class="who pet"><img src="${Icons.pet(b.sp, b.look.c)}" alt=""><small>${S.name}</small></div>
      </div>
      <h3 class="sh">どの部屋に案内する? ${this.habTag(S.hab)}${S.slots > 1 ? ' <span class="tag warn">2ひき分</span>' : ''}</h3>
      ${this.roomRows(b.sp, 'room')}
      <p class="mini">生まれた場所に合った部屋で、好きな家具 (${FURN[S.likes].name}) があると、ごきげんになるよ。</p>`;
    this.open('desk', '🛎️ チェックイン', body, '<button class="btn" data-act="edit">🛠️ 部屋をつくる</button><span class="grow"></span><button class="btn" data-act="later">あとで</button>', {
      room: (id) => {
        const rm = Hotel.roomById(+id);
        if (!rm) return;
        this.close();
        Desk.checkin(v, rm);
      },
      edit: () => { this.close(); Editor.open(); },
      later: () => this.close(),
    });
  },
  openCheckout(v) {
    const g = v.guest, S = SPECIES[g.sp];
    const r = Guests.rate(g, false);
    const avg = g.moodN > 0 ? g.moodSum / g.moodN : g.mood;
    const here = R.pets.some((p) => p.g === g && p.mode === 'wait');
    const body = `
      <div class="talk">
        <div class="who"><img src="${Icons.person(g.owner.look)}" alt=""><small>${esc(g.owner.name)}</small></div>
        <div class="say"><p>「${esc(g.name)}」をむかえに来ました!</p><p class="quote">${esc(r.line)}</p></div>
        <div class="who pet"><img src="${Icons.pet(g.sp, g.look.c, r.stars >= 4 ? 'happy' : '')}" alt=""><small>${esc(g.name)}</small></div>
      </div>
      <div class="facts">
        <div>評価 ${this.starsHtml(r.stars)}</div>
        <div>とまっている間のごきげん ${this.meter(avg, this.moodCol(avg))}</div>
        <div>料金 ${yen(g.fee)} × ${g.nights}泊 = ${yen(r.base)}${r.tip ? ` <span class="good">+ チップ ${yen(r.tip)}</span>` : ''}</div>
      </div>
      ${here ? '' : '<p class="mini">スタッフが部屋からつれてくるよ。</p>'}`;
    this.open('desk', '👋 お見送り', body, `<span class="grow"></span><button class="btn primary" data-act="ok">${yen(r.total)} を受け取る</button>`, {
      ok: () => { this.close(); Desk.checkout(v, false, r); },
    });
  },

  /* ------------------------------ えさ ------------------------------ */
  openFeed(p) {
    const g = p.g, S = SPECIES[g.sp];
    const body = `
      <div class="memo">📝 飼い主さんのメモ:「${FOODS[S.fav].icon}${FOODS[S.fav].name}が大好物です」</div>
      <div class="matgrid">${FOOD_ORDER.map((f) => `<button class="matbtn" data-act="give" data-v="${f}" ${G.food[f] > 0 ? '' : 'disabled'}>
        <span class="emo">${FOODS[f].icon}</span><b>${FOODS[f].name}</b><small>のこり ${G.food[f] || 0}</small></button>`).join('')}</div>
      <p class="mini">おなか ${this.meter(g.hunger, this.moodCol(g.hunger))} 合わないえさは食べないよ。何を食べるかは 📖ずかん で調べられる。</p>`;
    this.open('feed', `🍖 ${esc(g.name)}にえさをあげる`, body, '<button class="btn" data-act="shop">えさを注文する</button>', {
      give: (f) => { this.close(); Guests.feed(p, f); },
      shop: () => this.openFood(),
    });
  },

  /* ------------------------------ ペットのようす ------------------------------ */
  openPet(p) {
    const render = () => {
      const g = p.g;
      if (!g) { this.close(); return; }
      const S = SPECIES[g.sp], c = Guests.comfort(g), room = Hotel.roomById(g.roomId);
      const left = g.outDay - G.day;
      const ok = (b, t) => `<div class="${b ? 'good' : 'bad'}">${b ? '✓' : '✗'} ${t}</div>`;
      const body = `
        <div class="pethead">
          <img class="big" src="${Icons.pet(g.sp, g.look.c, g.mood >= 65 ? 'happy' : '')}" alt="">
          <div><b class="big">${esc(g.name)}</b> <span class="mini">${S.name}</span> ${this.habTag(S.hab)}<br>
            <span class="mini">飼い主: ${esc(g.owner.name)} / ${room ? esc(room.name) + `(${room.floor + 1}階)` : '部屋なし'} / ${left <= 0 ? 'きょうお迎え' : `あと${left}泊`}</span></div>
        </div>
        <div class="bars">
          <div><span>おなか</span>${this.meter(g.hunger, this.moodCol(g.hunger))}</div>
          <div><span>ごきげん</span>${this.meter(g.mood, this.moodCol(g.mood))}</div>
          <div><span>なかよし</span>${this.meter(g.love, '#ff8fa3')}</div>
        </div>
        <h3 class="sh">いごこち ${this.meter(c.s, this.moodCol(c.s))}</h3>
        <div class="checks">
          ${ok(!c.why.includes('room'), `${HABITATS[S.hab].room}にいる`)}
          ${ok(c.fav, `好きな家具: ${FURN[S.likes].name}`)}
          ${ok(c.water, '水のみ場がある')}
          ${ok(c.items >= 2, `${HABITATS[S.hab].fname}の家具 ${c.items}こ (4こまでうれしい)`)}
          ${c.why.includes('crowd') ? ok(false, '部屋がきゅうくつ') : ''}
          ${c.why.includes('scary') ? ok(false, '同じ部屋にこわい動物がいる') : ''}
        </div>
        <h3 class="sh">食べるもの</h3><div>${this.foodList(S.foods, S.fav)}</div>
        <p class="mini">${S.desc}${S.pet < 0.5 ? ' なでられるのは少しにがて。' : ''}</p>`;
      this.open('pet', `🔍 ${esc(g.name)}のようす`, body,
        '<button class="btn" data-act="pet">🤚 なでる</button><button class="btn" data-act="feed">🍖 えさ</button><span class="grow"></span><button class="btn" data-act="move">🚪 部屋をかえる</button>', {
          pet: () => { this.close(); Guests.pet(p); },
          feed: () => this.openFeed(p),
          move: () => this.openMove(p),
        }, { render });
    };
    render();
  },
  openMove(p) {
    const g = p.g;
    this.open('move', `🚪 ${esc(g.name)}の部屋をかえる`, this.roomRows(g.sp, 'room', g.roomId), '<button class="btn" data-act="back">もどる</button>', {
      room: (id) => {
        const rm = Hotel.roomById(+id);
        if (!rm) return;
        this.close();
        Guests.move(p, rm);
        Toast.show(`${g.name}が ${rm.name}へ引っこすよ`);
      },
      back: () => this.openPet(p),
    });
  },

  /* ------------------------------ あずかり中と予約 ------------------------------ */
  openGuests(tab) {
    const render = () => {
      const tabs = `<div class="mtabs in"><button class="${tab === 'stay' ? 'on' : ''}" data-act="tab" data-v="stay">🐾 あずかり中 ${G.guests.length}</button><button class="${tab === 'book' ? 'on' : ''}" data-act="tab" data-v="book">📒 予約 ${G.bookings.length}</button></div>`;
      let body;
      if (tab === 'stay') {
        body = !G.guests.length ? '<p class="empty">まだだれもいないよ。電話を待とう</p>' : `<div class="rows">${G.guests.map((g) => {
          const room = Hotel.roomById(g.roomId), left = g.outDay - G.day;
          return `<div class="prow2"><img class="pi" src="${Icons.pet(g.sp, g.look.c)}" alt="">
            <div class="pinfo"><b>${esc(g.name)}</b> <span class="mini">${SPECIES[g.sp].name} / ${room ? esc(room.name) + ` ${room.floor + 1}階` : ''} / ${left <= 0 ? '🔔きょうお迎え' : `あと${left}泊`}</span>
              <div class="mrow"><span>おなか</span>${this.meter(g.hunger, this.moodCol(g.hunger))}</div>
              <div class="mrow"><span>ごきげん</span>${this.meter(g.mood, this.moodCol(g.mood))}</div></div>
            <button class="btn small" data-act="go" data-v="${g.id}">ここへ行く</button></div>`;
        }).join('')}</div>`;
      } else {
        body = !G.bookings.length ? '<p class="empty">予約はないよ</p>' : `<div class="rows">${G.bookings.map((b) => `<div class="prow2"><img class="pi" src="${Icons.pet(b.sp, b.look.c)}" alt="">
          <div class="pinfo"><b>${esc(b.name)}</b> <span class="mini">${SPECIES[b.sp].name} ${b.nights}泊 / ${esc(b.caller)}</span><br>
          <span class="mini">${b.day === G.day ? `きょう ${clockText(b.time)}ごろ 来る` : b.day > G.day ? 'あしたの朝に来る' : 'もうすぐ来る'}</span> ${this.habTag(SPECIES[b.sp].hab)}</div></div>`).join('')}</div>`;
        body += `<p class="mini">きょうの電話 ${G.today.calls}本 (出られなかった ${G.today.missed}本)</p>`;
      }
      this.open('guests', '🐾 ペット', tabs + body, '', {
        tab: (v) => { tab = v; render(); },
        go: (id) => {
          const p = R.pets.find((x) => x.g && x.g.id === +id);
          this.close();
          if (p && !R.player.goTo(p.floor, Math.floor(p.x), Math.floor(p.y))) Toast.show('そこへは行けないみたい', 'bad');
        },
      }, { render });
    };
    render();
  },

  /* ------------------------------ えさの注文 ------------------------------ */
  openFood() {
    const render = () => {
      const eaters = (f) => SP_ORDER.filter((s) => SPECIES[s].foods.includes(f)).map((s) => `<img class="pi sm" src="${Icons.pet(s)}" alt="" title="${SPECIES[s].name}">`).join('');
      const body = `<p class="tip">えさは1回分ずつ。動物によって食べる物がちがうよ。</p><div class="rows">${FOOD_ORDER.map((f) => {
        const F = FOODS[f];
        return `<div class="prow2"><span class="emo big">${F.icon}</span>
          <div class="pinfo"><b>${F.name}</b> <span class="mini">1回分 ${yen(F.cost)} / のこり <b>${G.food[f] || 0}</b></span><br>${eaters(f)}</div>
          <div class="cbtns"><button data-act="buy" data-v="${f}:5" ${G.money < F.cost * 5 ? 'disabled' : ''}>+5<small>${yen(F.cost * 5)}</small></button>
          <button data-act="buy" data-v="${f}:20" ${G.money < F.cost * 20 ? 'disabled' : ''}>+20<small>${yen(F.cost * 20)}</small></button></div></div>`;
      }).join('')}</div>`;
      this.open('food', `🍖 えさの注文 <small class="emoney">${yen(G.money)}</small>`, body, '', {
        buy: (v) => {
          const [f, n] = v.split(':'), cost = FOODS[f].cost * +n;
          if (G.money < cost) { Sound.play('error'); return; }
          G.money -= cost; G.today.cost += cost;
          G.food[f] = (G.food[f] || 0) + +n;
          Sound.play('buy');
          render();
        },
      }, { render });
    };
    render();
  },

  /* ------------------------------ 料金 ------------------------------ */
  openPrices() {
    const render = () => {
      const body = `<p class="tip">部屋の種類ごとに、1泊の料金を決めよう。大きい動物 (2ひき分) は2倍になる。高すぎると電話でことわられて、安すぎるともうからないよ。</p>
        <div class="rows">${HAB_ORDER.map((h) => {
          const H = HABITATS[h], p = G.prices[h], k = p / H.market;
          const [cls, txt] = k < 0.85 ? ['good', '安い'] : k <= 1.15 ? ['ok', 'ふつう'] : k <= 1.35 ? ['warn', '高め'] : ['bad', '高すぎ'];
          return `<div class="prow2${habOpen(h) ? '' : ' dim'}"><span class="emo big">${H.icon}</span>
            <div class="pinfo"><b>${H.room}</b><br><span class="mini">相場 ${yen(H.market)}</span> <span class="pw ${cls}">${txt}</span>${habOpen(h) ? '' : ` <span class="mini">🔒★${H.star}から電話が来る</span>`}</div>
            <div class="stepper"><button data-act="p" data-v="${h}:-500">−500</button><button data-act="p" data-v="${h}:-100">−</button>
            <b class="pricev">${yen(p)}</b><button data-act="p" data-v="${h}:100">＋</button><button data-act="p" data-v="${h}:500">＋500</button></div></div>`;
        }).join('')}</div>`;
      this.open('price', '💴 料金', body, '', {
        p: (v) => { const [h, d] = v.split(':'); G.prices[h] = clamp(G.prices[h] + +d, 300, 19900); render(); },
      }, { render });
    };
    render();
  },

  /* ------------------------------ ずかん ------------------------------ */
  openBook(tab = 'town') {
    const render = () => {
      const tabs = `<div class="mtabs in">${HAB_ORDER.map((h) => `<button class="${h === tab ? 'on' : ''}" data-act="tab" data-v="${h}">${HABITATS[h].icon} ${HABITATS[h].name}</button>`).join('')}</div>`;
      const H = HABITATS[tab];
      const body = `${tabs}<p class="tip">${H.icon} <b>${H.name}</b>: ${H.desc}${habOpen(tab) ? '' : ` <span class="tag warn">★${H.star}から電話が来る</span>`}</p>
        <div class="cards">${SP_ORDER.filter((s) => SPECIES[s].hab === tab).map((s) => {
          const S = SPECIES[s];
          return `<div class="card book"><img class="pi bigpi" src="${Icons.pet(s)}" alt="">
            <div class="cb"><b>${S.name}</b>${G.seen[s] ? ' <span class="tag ok">あずかった</span>' : ''}${S.slots > 1 ? ' <span class="tag warn">2ひき分</span>' : ''}<br>
            <span class="mini">${S.desc}</span><br>
            <span class="mini">食べる:</span> ${this.foodList(S.foods, S.fav)}<br>
            <span class="mini">好きな家具:</span> <img class="pi sm" src="${Icons.furn(S.likes)}" alt=""><span class="mini">${FURN[S.likes].name}</span>
            ${S.pred ? '<br><span class="mini bad">小さな動物をこわがらせることがある</span>' : ''}${S.prey ? '<br><span class="mini">こわい動物と同じ部屋はにがて</span>' : ''}</div></div>`;
        }).join('')}</div>`;
      this.open('book', '📖 どうぶつずかん', body, '', { tab: (v) => { tab = v; render(); } }, { render, wide: true });
    };
    render();
  },

  /* ------------------------------ もようがえの帯 ------------------------------ */
  showEditBar() { $('editBar').classList.remove('hide'); this.renderEditBar(); },
  hideEditBar() { $('editBar').classList.add('hide'); },
  renderEditBar() {
    const E = Editor, el = $('editBar');
    const head = `<div class="ehead"><div class="etabs">
        <button class="${E.tab === 'room' ? 'on' : ''}" data-act="tab" data-v="room">🚪 部屋</button>
        <button class="${E.tab === 'furn' ? 'on' : ''}" data-act="tab" data-v="furn">🪑 家具</button>
        <button class="${E.tab === 'build' ? 'on' : ''}" data-act="tab" data-v="build">🏗️ 建物</button></div>
      <span class="grow"></span>${G.floors > 1 ? `<span class="efloor">${E.floor + 1}階</span>` : ''}<button class="btn small primary" data-act="close">✓ おわる</button></div>`;
    let body = '';
    const sr = E.sel && E.sel.room, sf = E.sel && E.sel.fu;
    if (sf) {
      const d = FURN[sf.type];
      body = `<div class="ehint"><img class="pi sm" src="${Icons.furn(sf.type)}" alt=""> <b>${d.name}</b> — ドラッグで動かせるよ。しまうと「もちもの」に入って、あとでただで置ける。</div>
        <div class="eitems"><button data-act="store">📦 しまう</button><button data-act="unsel">えらぶのをやめる</button></div>`;
    } else if (E.tab === 'room') {
      if (sr) {
        const used = Hotel.used(sr);
        body = `<div class="ehint">${HABITATS[sr.hab].icon} <input class="rn" data-chg="rename" maxlength="10" value="${esc(sr.name)}"> ${sr.w}×${sr.h}マス / ${used}/${Hotel.cap(sr)}ひき —
          ${this.touch ? '' : 'かべのまるをドラッグで大きさ、中をドラッグで場所を変えられる。'}広げると1マス ${yen(TILE_COST)}</div>
          <div class="eitems">
            <span class="grp">はば<button data-act="size" data-v="w:-1">−</button><button data-act="size" data-v="w:1">＋</button></span>
            <span class="grp">高さ<button data-act="size" data-v="h:-1">−</button><button data-act="size" data-v="h:1">＋</button></span>
            <span class="grp">動かす<button data-act="nudge" data-v="-1:0">←</button><button data-act="nudge" data-v="0:-1">↑</button><button data-act="nudge" data-v="0:1">↓</button><button data-act="nudge" data-v="1:0">→</button></span>
            <button data-act="door">🚪 ドアの場所</button>
            <button data-act="delRoom">🗑️ こわす</button>
            <button data-act="unsel">✕</button>
          </div>
          <div class="eitems">${HAB_ORDER.map((h) => `<button class="eitem${sr.hab === h ? ' on' : ''}" data-act="hab" data-v="${h}" ${habOpen(h) ? '' : 'disabled'}>
            <i>${HABITATS[h].icon}</i><span>${HABITATS[h].fname}</span><small>${sr.hab === h ? 'いまの種類' : habOpen(h) ? yen(HABITATS[h].cost) : `🔒★${HABITATS[h].star}`}</small></button>`).join('')}</div>`;
      } else {
        const t = E.tool && E.tool.kind === 'room' ? E.tool : null;
        const hint = !t ? 'つくりたい部屋の種類をえらんでね。今ある部屋をタップすると、大きさや種類を変えられるよ。'
          : E.pending ? `<b>${HABITATS[t.hab].room}</b> ${E.pending.w}×${E.pending.h}マス` : `<b>${HABITATS[t.hab].room}</b> — 床をドラッグして形を決めよう (タップすると 4×4)`;
        const pend = t && E.pending ? (() => {
          const cost = E.roomCost(E.pending, t.hab), why = E.testRoom(E.pending, t.hab);
          return `<button class="btn small primary" data-act="build" ${why || G.money < cost ? 'disabled' : ''}>ここにつくる ${yen(cost)}</button> <button class="btn small" data-act="cancel">やめる</button>`;
        })() : '';
        body = `<div class="ehint">${hint} ${pend}</div>
          <div class="eitems">${HAB_ORDER.map((h) => `<button class="eitem${t && t.hab === h ? ' on' : ''}" data-act="roomTool" data-v="${h}">
            <i>${HABITATS[h].icon}</i><span>${HABITATS[h].room}</span><small>${habOpen(h) ? `${yen(HABITATS[h].cost)}〜` : `🔒★${HABITATS[h].star}`}</small></button>`).join('')}</div>`;
      }
    } else if (E.tab === 'furn') {
      const t = E.tool && E.tool.kind === 'furn' ? E.tool : null;
      const list = Object.keys(FURN).filter((k) => FURN[k].hab === E.filter);
      body = `<div class="ehint">${t ? `<b>${FURN[t.type].name}</b> — 置きたい所を${this.touch ? '2回タップ' : 'クリック'}。` : '家具をえらんで置こう。置いた家具はタップでえらんで、ドラッグで動かせる。'}
        生まれた場所に合った家具があると、動物がよろこぶよ。</div>
        <div class="etabs scroll">${FURN_TABS.map((h) => `<button class="${E.filter === h ? 'on' : ''}" data-act="filter" data-v="${h}">${HABITATS[h] ? HABITATS[h].icon + ' ' + HABITATS[h].fname : FURN_TAB_NAME[h]}</button>`).join('')}</div>
        <div class="eitems">${list.map((k) => {
          const d = FURN[k], own = G.inv[k] || 0;
          return `<button class="eitem${t && t.type === k ? ' on' : ''}" data-act="furnTool" data-v="${k}"><img src="${Icons.furn(k)}" alt=""><span>${d.name}</span><small>${own ? `もってる×${own}` : yen(d.cost)}</small></button>`;
        }).join('')}</div>`;
      const inv = Object.keys(G.inv).filter((k) => G.inv[k] > 0);
      if (inv.length) body += `<div class="ehint">もちもの: ${inv.map((k) => `${FURN[k].name}×${G.inv[k]} <button class="mini-btn" data-act="sell" data-v="${k}">売る ${yen(Math.floor(FURN[k].cost / 2))}</button>`).join(' ')}</div>`;
    } else {
      const nf = G.floors < MAX_FLOORS ? FLOOR_COST[G.floors] : 0, nl = LANDS[G.lv + 1];
      body = `<div class="expand">
        <div>🏢 いまは <b>${G.floors}階建て</b>。${G.floors < MAX_FLOORS ? `${G.floors + 1}階をつくると、階段から行ける新しい階に部屋をつくれる。` : 'これ以上は高くできないよ。'}
          ${G.floors < MAX_FLOORS ? `<button class="btn small primary" data-act="addFloor" ${G.money < nf ? 'disabled' : ''}>${G.floors + 1}階をつくる ${yen(nf)}</button>` : ''}</div>
        <div>🌳 土地は <b>${Hotel.W}×${Hotel.H}マス</b>。${nl ? `広げると ${nl.w}×${nl.h}マスになる (全部の階が広がる)。 <button class="btn small primary" data-act="land" ${G.money < nl.cost ? 'disabled' : ''}>土地を広げる ${yen(nl.cost)}</button>` : 'これがいちばん広い土地だよ。'}</div>
      </div>`;
    }
    el.innerHTML = head + body;
  },

  /* ------------------------------ 1日のまとめ ------------------------------ */
  showSummary() {
    const d = G.today;
    const tomorrow = G.guests.filter((g) => g.outDay === G.day + 1).length;
    const next = G.bookings.filter((b) => b.day <= G.day + 1).length;
    const ds = stars() - clamp(Math.floor(d.repStart / 20), 0, 5);
    const body = `<div class="sum">
      <div class="sumbig"><span>きょうの売り上げ</span><b>${yen(d.income)}</b></div>
      <div class="sumrow"><span>チェックイン</span><b>${d.checkins}ひき</b></div>
      <div class="sumrow"><span>お見送り</span><b>${d.checkouts}ひき</b></div>
      <div class="sumrow"><span>えさの注文</span><b>${yen(d.cost)}</b></div>
      <div class="sumrow"><span>電話</span><b>${d.calls}本 ${d.missed ? `(出られなかった ${d.missed}本)` : ''}</b></div>
      <div class="sumrow"><span>評判</span><b>${this.starsHtml(stars())} ${ds > 0 ? '<span class="good">アップ!</span>' : ds < 0 ? '<span class="bad">ダウン…</span>' : ''}</b></div>
      ${d.reviews.length ? `<h3>お客さんの声</h3><div class="quotes">${d.reviews.map((q) => `<div class="quote"><img src="${Icons.pet(q.sp, q.look.c, q.stars >= 4 ? 'happy' : '')}" alt=""><div>${this.starsHtml(q.stars)} ${esc(q.line)}<small>${esc(q.owner)} (${esc(q.name)})</small></div></div>`).join('')}</div>` : ''}
      <h3>あした</h3>
      <div class="sumrow"><span>お迎えが来る</span><b>${tomorrow}ひき</b></div>
      <div class="sumrow"><span>あずけに来る</span><b>${next}ひき</b></div>
      <div class="sumrow"><span>あずかり中のペット</span><b>${G.guests.length}ひき</b></div>
      ${G.guests.length ? '<p class="mini">夜のあいだに、ペットのおなかがすくよ。朝になったらえさをあげよう。</p>' : ''}
    </div>`;
    this.open('summary', `🌙 ${G.day}日目おしまい`, body, '<span class="grow"></span><button class="btn primary" data-act="next">つぎの日へ ☀️</button>', {
      next: () => { this.panel.onClose = null; this.close(); Day.next(); },
    }, { onClose: () => { if (G.phase === 'night') setTimeout(() => this.showSummary(), 0); } });
  },

  /* ------------------------------ メニュー ------------------------------ */
  openMenu() {
    const render = () => {
      const body = `<div class="menu">
        <div class="rename"><input id="inRename" maxlength="12" value="${esc(G.hotel)}"><button class="btn small" data-act="rename">名前を変える</button></div>
        <button class="btn" data-act="sfx">効果音: ${Sound.sfxOn ? 'オン' : 'オフ'}</button>
        <button class="btn" data-act="music">音楽: ${Sound.musicOn ? 'オン' : 'オフ'}</button>
        <button class="btn" data-act="help">あそびかた</button>
        <button class="btn" data-act="title">タイトルにもどる (セーブします)</button>
      </div>`;
      this.open('menu', '⚙️ メニュー', body, '', {
        rename: () => { const v = ($('inRename').value || '').trim(); if (v) { G.hotel = v.slice(0, 12); this.refresh(); Toast.show('ホテルの名前を変えたよ', 'good'); } },
        sfx: () => { Sound.sfxOn = !Sound.sfxOn; Save.setPref({ sfx: Sound.sfxOn, music: Sound.musicOn }); render(); },
        music: () => { Sound.setMusic(!Sound.musicOn); Save.setPref({ sfx: Sound.sfxOn, music: Sound.musicOn }); render(); },
        help: () => this.openHelp(),
        title: () => { saveGame(); location.reload(); },
      }, { render });
    };
    render();
  },
  openHelp(first) {
    const body = `<div class="help">
      ${first ? `<p class="lead2">「${esc(G.hotel)}」へようこそ! 世界中の動物をあずかるペットホテルだよ。</p>` : ''}
      <h3>1. 電話に出る 📞</h3>
      <p>電話が鳴ったら、上のボタンかキーボードの T で出よう。動物の種類・何泊・料金を聞いて、引き受けるか決める。料金が高すぎるとことわられるよ。</p>
      <h3>2. 受付で案内する 🛎️</h3>
      <p>飼い主さんがペットをつれて受付に来る。カウンターの近くで話しかけて、どの部屋に入れるか選ぼう。</p>
      <h3>3. お世話をする 🤚🍖</h3>
      <p>ペットの近くで「なでる」「えさ」。動物によって食べる物がちがう。おなかがすくと 🍖、元気がないと 💧 のふきだしが出るよ。</p>
      <h3>4. 部屋をつくる 🛠️</h3>
      <p>熱帯雨林・サバンナ・さばく・こおりの国…動物は生まれた場所に合った部屋と家具が大好き。もようがえで部屋をつくって、かべをドラッグして大きさを変え、家具を置こう。2階・3階もつくれる。</p>
      <h3>5. お見送り 👋</h3>
      <p>あずかる日が終わると、飼い主さんがむかえに来る。ペットがごきげんだと評価が上がって、チップももらえる。評判の★が増えると、めずらしい動物からも電話が来るよ。</p>
      <h3>そうさ</h3>
      <p>${this.touch ? '行きたい所をタップすると歩く。近くでできることは下のボタンに出るよ。' : '矢印キー / WASD で歩く (クリックした所へも歩く)。E なでる・受付、F えさ、Q ようす、T 電話に出る、Esc 小窓をとじる。'}</p>
    </div>`;
    this.open('help', first ? '🐾 はじめに' : '❓ あそびかた', body, `<span class="grow"></span><button class="btn primary" data-act="ok">${first ? 'はじめる!' : 'とじる'}</button>`, { ok: () => this.close() });
  },
};
