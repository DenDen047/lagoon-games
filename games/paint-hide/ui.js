/* =========================================================================
   PAINT & HIDE ― 画面まわり (タイトル・役わり発表・HUD・おしらせ・地図・おわり)
   ボタンは アイコンに みじかい ことばを そえる。大事な できごとは 文字で 知らせる。
   ========================================================================= */
'use strict';

const UI = {
  settings: { role: 'random', oni: 1, sound: true },
  peopleKey: '',

  init() {
    const s = Save.read();
    if (s) {
      Object.assign(this.settings, s.settings || {});
      if (s.skin) Skin.fromData(s.skin, (sk) => { Game.mySkin = sk; this.drawMe(); });
    }
    if (!Game.mySkin) Game.mySkin = makeSkin('#3a7bf0', '#ffe0c4');
    Sfx.on = this.settings.sound;
    document.querySelectorAll('[data-ic]').forEach((b) => { b.insertAdjacentHTML('afterbegin', iconSVG(b.dataset.ic)); });
    el('rolePick').innerHTML = [['random', 'question', 'おまかせ'], ['hider', 'person', 'かくれる'], ['oni', 'gun', 'オニ']]
      .map(([k, ic, t]) => `<button class="seg" data-role="${k}">${iconSVG(ic)}<small>${t}</small></button>`).join('');
    el('oniPick').innerHTML = [1, 2].map((n) => `<button class="seg" data-oni="${n}"><span class="onis">${iconSVG('oni').repeat(n)}</span><small>オニ ${n}人</small></button>`).join('');
    el('rolePick').addEventListener('click', (ev) => { const b = ev.target.closest('[data-role]'); if (b) { this.settings.role = b.dataset.role; this.saveAll(); Sfx.ui(); } });
    el('oniPick').addEventListener('click', (ev) => { const b = ev.target.closest('[data-oni]'); if (b) { this.settings.oni = +b.dataset.oni; this.saveAll(); Sfx.ui(); } });
    el('helpBody').innerHTML = this.helpHTML();

    el('btnPlay').addEventListener('click', () => { Sfx.unlock(); Sfx.ui(); this.startGame(); });
    el('btnPaint').addEventListener('click', () => { Sfx.unlock(); Editor.open(Game.mySkin, null, () => { this.saveAll(); this.drawMe(); }); });
    el('btnHelp').addEventListener('click', () => { Sfx.unlock(); Sfx.ui(); el('help').classList.remove('hidden'); });
    el('helpClose').addEventListener('click', () => { Sfx.ui(); el('help').classList.add('hidden'); });
    el('help').addEventListener('click', (ev) => { if (ev.target.id === 'help') el('help').classList.add('hidden'); });
    for (const id of ['btnSound', 'pSound']) el(id).addEventListener('click', () => { Sfx.unlock(); this.settings.sound = !this.settings.sound; Sfx.on = this.settings.sound; this.saveAll(); Sfx.ui(); });

    el('btnPause').addEventListener('click', () => this.pause());
    el('pResume').addEventListener('click', () => this.resume());
    el('pHome').addEventListener('click', () => this.title());
    el('btnMap').addEventListener('click', () => this.toggleMap());
    el('mapWin').addEventListener('click', () => this.closeMap());
    el('oAgain').addEventListener('click', () => { Sfx.ui(); this.startGame(); });
    /* みんなで あそぶ */
    el('btnOnline').addEventListener('click', () => { Sfx.unlock(); Sfx.ui(); this.openOnline(); });
    el('olClose').addEventListener('click', () => { Sfx.ui(); Net.leave(); el('online').classList.add('hidden'); });
    el('olHost').addEventListener('click', () => { Sfx.ui(); Net.hostRoom(); });
    el('olJoin').addEventListener('click', () => { Sfx.ui(); Net.joinRoom(el('olCode').value); });
    el('olCode').addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') Net.joinRoom(el('olCode').value); });
    el('olCode').addEventListener('input', () => { el('olCode').value = el('olCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
    el('olGo').addEventListener('click', () => { if (Net.host) { Sfx.ui(); this.startGame(); } });
    el('oHome').addEventListener('click', () => { Sfx.ui(); this.title(); });
    Input.bindButton(el('actHide'), 'hide');
    Input.bindButton(el('actPaint'), 'paint');
    Input.bindButton(el('actShoot'), 'shoot');

    addEventListener('keydown', (ev) => {
      if (ev.repeat || Editor.isOpen()) return;
      if (G.mode === 'title' && ev.key === 'Enter' && !Net.on && el('help').classList.contains('hidden') && el('online').classList.contains('hidden')) { ev.preventDefault(); Sfx.unlock(); this.startGame(); }
      else if (G.mode === 'play' && Game.paused && (ev.key === 'Escape' || ev.key === 'p' || ev.key === 'P')) this.resume();
      else if (G.mode === 'play' && !el('mapWin').classList.contains('hidden') && (ev.key === 'Escape' || ev.key === 'm' || ev.key === 'M')) { ev.preventDefault(); this.closeMap(); Input.clear(); }
    });
    Editor.init();
    this.reflectSettings();
    this.drawMe();
  },

  saveAll() {
    Save.write({ settings: this.settings, skin: Game.mySkin ? Game.mySkin.toData() : null });
    this.reflectSettings();
  },
  reflectSettings() {
    document.querySelectorAll('#rolePick .seg').forEach((b) => b.classList.toggle('on', b.dataset.role === this.settings.role));
    document.querySelectorAll('#oniPick .seg').forEach((b) => b.classList.toggle('on', +b.dataset.oni === this.settings.oni));
    for (const id of ['btnSound', 'pSound']) el(id).innerHTML = iconSVG(this.settings.sound ? 'soundOn' : 'soundOff');
  },

  /* キャラクターを 小さな canvas に 描く */
  charCanvas(cv, skin, o = {}) {
    const W = cv.clientWidth || 40, H = cv.clientHeight || 58;
    cv.width = Math.round(W * G.dpr); cv.height = Math.round(H * G.dpr);
    const g = cv.getContext('2d'), k = Math.min(W / BOX.w, H / BOX.h) * G.dpr;
    g.setTransform(k, 0, 0, k, cv.width / 2, cv.height / 2 - (BOX.y + BOX.h / 2) * k);
    drawChar(g, skin, 0, 0, { gun: o.gun ? -0.3 : null });
  },
  drawMe() { if (Game.mySkin) this.charCanvas(el('meCv'), Game.mySkin); },

  show(id) {
    for (const k of ['titleScreen', 'hud', 'reveal', 'over', 'pause', 'help', 'mapWin', 'blind', 'online']) el(k).classList.toggle('hidden', k !== id);
  },

  title() {
    G.mode = 'title';
    Game.paused = false;
    Editor.close();
    Net.leave();
    this.show('titleScreen');
    this.drawMe();
  },

  startGame() {
    if (Net.host) Net.startGame();
    else Game.start({ role: this.settings.role, oni: this.settings.oni, auto: G.auto });
    this.peopleKey = '';
    this.reveal();
  },

  /* 役わり発表 */
  reveal() {
    G.mode = 'reveal';
    this.peopleKey = '';
    const p = Game.player;
    this.show('reveal');
    const oni = p.role === 'oni';
    const n = Game.agents.filter((a) => a.role === 'oni').length;
    el('rvTitle').textContent = oni ? 'あなたは オニ' : 'あなたは かくれる人';
    el('rvSub').textContent = oni
      ? (n > 1 ? 'もう1人の オニと いっしょに、' : '') + '30 かぞえたら さがしに 行こう。銃で 撃てば つかまえられる'
      : '30びょうの あいだに かくれよう。ぬって まわりに とけこんだり、はこや ロッカーに 入ったり できる';
    el('reveal').className = oni ? 'oniSide' : 'hiderSide';
    this.charCanvas(el('rvCv'), p.skin, { gun: oni });
    Sfx.reveal(oni);
    clearTimeout(this.revealTimer);
    this.revealTimer = setTimeout(() => this.beginPlay(), G.auto ? 50 : 3400);
    el('reveal').onclick = Net.on ? null : () => { clearTimeout(this.revealTimer); this.beginPlay(); };
  },

  beginPlay() {
    if (G.mode !== 'reveal') return;
    G.mode = 'play';
    this.show('hud');
    const p = Game.player;
    document.body.classList.toggle('isOni', p.role === 'oni');
    if (p.role === 'oni') el('blind').classList.remove('hidden');
    else this.banner('かくれる時間！', '30びょうで かくれよう', '');
    const touch = document.body.classList.contains('touch');
    el('hint').textContent = p.role === 'oni'
      ? (touch ? 'ひだりで いどう・みぎを タップすると そこへ うつ' : 'WASD で いどう・マウスで ねらって クリックで うつ')
      : (touch ? 'ひだりで いどう・ボタンで かくれる / ぬる' : 'WASD で いどう・E で かくれる・Q で ぬる');
    el('hint').classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => el('hint').classList.add('hidden'), 9000);
    Input.clear();
  },

  /* 画面の まんなか上に 出る おしらせ */
  banner(title, sub = '', kind = '') {
    const b = el('banner');
    b.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    b.className = kind;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), 2600);
  },

  openPaint() {
    const p = Game.player;
    Editor.open(p.skin, { x: p.x, y: p.y }, () => {
      p.painting = 0.6; Input.clear();
      if (Net.client) Net.send({ t: 'skin', data: p.skin.toData() });
      else if (Net.host) Net.emit({ t: 'skin', id: p.id, data: p.skin.toData() });
    });
  },

  pause() {
    if (G.mode !== 'play' || Game.winner) return;
    /* みんなで あそんでいる ときは 止めない */
    Game.paused = !Net.on;
    Editor.close();
    el('pause').classList.remove('hidden');
    Sfx.ui();
  },
  resume() {
    Game.paused = false;
    el('pause').classList.add('hidden');
    Input.clear();
    Sfx.ui();
  },

  /* ------------------------------ 地図 ------------------------------ */
  toggleMap() {
    if (!el('mapWin').classList.contains('hidden')) { this.closeMap(); return; }
    el('mapWin').classList.remove('hidden');
    Sfx.ui();
    this.drawMap();
  },
  closeMap() { el('mapWin').classList.add('hidden'); },
  drawMap() {
    const cv = el('mapCv');
    const k = Math.min(G.W * 0.94 / (MW * TILE), G.H * 0.84 / (MH * TILE));
    const w = MW * TILE * k, hh = MH * TILE * k;
    cv.style.width = w + 'px'; cv.style.height = hh + 'px';
    cv.width = Math.floor(w * G.dpr); cv.height = Math.floor(hh * G.dpr);
    const g = cv.getContext('2d');
    g.setTransform(k * G.dpr, 0, 0, k * G.dpr, 0, 0);
    g.fillStyle = '#0d1a2e'; g.fillRect(0, 0, MW * TILE, MH * TILE);
    g.fillStyle = '#3a5272';
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (isFloor(tx, ty)) g.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
    for (const r of ROOMS) {
      g.fillStyle = '#4d6a90'; g.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE);
      drawIcon(g, r.icon, r.cx, r.cy, TILE * 2.6, 'rgba(255,255,255,0.45)', 2);
    }
    for (const s of SPOTS) { g.fillStyle = '#c99a62'; g.fillRect(s.x * TILE + 6, s.y * TILE + 6, s.w * TILE - 12, s.h * TILE - 12); }
    const p = Game.player;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 28, 0, TAU); g.fill();
    g.fillStyle = p.role === 'oni' ? '#e8403f' : '#3a7bf0'; g.beginPath(); g.arc(p.x, p.y, 20, 0, TAU); g.fill();
  },

  /* ------------------------------ HUD ------------------------------ */
  tick() {
    if (G.mode !== 'play' || !Game.player) return;
    const p = Game.player;
    const sec = Math.max(0, Math.ceil(Game.t));
    el('phLabel').textContent = Game.phase === 'hide' ? 'かくれる時間' : Game.phase === 'hunt' ? 'さがす時間' : 'おしまい';
    el('phTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    el('phase').classList.toggle('hurry', Game.phase === 'hunt' && sec <= 10);
    el('blindNum').textContent = sec;
    el('edTime').textContent = Editor.where ? `${el('phLabel').textContent} ${el('phTime').textContent}` : '';
    if (p.role === 'oni' && Game.phase !== 'hide') el('blind').classList.add('hidden');
    /* のこりの かくれる人 */
    const hs = Game.agents.filter((a) => a.role === 'hider');
    const key = hs.map((a) => (a.alive ? 1 : 0) + ':' + a.skin.ver).join(',');
    if (key !== this.peopleKey) {
      this.peopleKey = key;
      const box = el('people');
      if (box.children.length !== hs.length) box.innerHTML = hs.map((a) => `<span class="pp${a === p ? ' me' : ''}"><canvas></canvas><i></i></span>`).join('');
      hs.forEach((a, i) => {
        const sp = box.children[i];
        sp.classList.toggle('out', !a.alive);
        this.charCanvas(sp.querySelector('canvas'), a.skin, { gray: !a.alive });
      });
      el('leftN').textContent = `のこり ${Game.left()}人`;
    }
    /* 行動ボタン */
    const hider = p.role === 'hider';
    el('actHide').classList.toggle('hidden', !hider || !p.alive);
    el('actShoot').classList.toggle('hidden', hider || !p.alive);
    el('actPaint').classList.toggle('hidden', !p.alive);
    if (hider) {
      const can = p.inSpot || Game.freeSpotNear();
      el('actHide').classList.toggle('off', !can);
      const lab = p.inSpot ? 'でる' : 'かくれる';
      if (el('actHide').dataset.lab !== lab) { el('actHide').dataset.lab = lab; el('actHide').querySelector('.slot').innerHTML = iconSVG(p.inSpot ? 'exit' : 'box'); el('actHide').querySelector('small').textContent = lab; }
    } else {
      el('actShoot').classList.toggle('off', Game.phase !== 'hunt' || p.ammo < 1);
      el('ammo').innerHTML = '<i class="on"></i>'.repeat(p.ammo) + '<i></i>'.repeat(AMMO_MAX - p.ammo);
    }
    el('actPaint').classList.toggle('off', !!p.inSpot);
    el('ammo').classList.toggle('hidden', hider || !p.alive);
    if (!el('mapWin').classList.contains('hidden') && Math.floor(G.time * 4) !== this.mapT) { this.mapT = Math.floor(G.time * 4); this.drawMap(); }
    if (Input.consume('map')) this.toggleMap();
    if (Input.consume('pause')) this.pause();
  },

  /* ------------------------------ みんなで あそぶ ------------------------------ */
  openOnline() {
    Net.leave();
    el('online').classList.remove('hidden');
    el('olStart').classList.remove('hidden');
    el('olRoom').classList.add('hidden');
    this.netMsg('');
  },
  netMsg(text, bad) {
    const m = el('olMsg');
    m.textContent = text;
    m.classList.toggle('bad', !!bad);
  },
  /* へやの ようす。ホストは 自分で、入った人は ホストから もらって 描く */
  onlineRoom(skins, code) {
    el('online').classList.remove('hidden');
    el('olStart').classList.add('hidden');
    el('olRoom').classList.remove('hidden');
    el('olCodeShow').textContent = code || Net.code;
    el('olGo').classList.toggle('hidden', !Net.host);
    const list = skins || [Game.mySkin.toData()];
    const box = el('olPeople');
    box.innerHTML = list.map(() => '<span class="olP"><canvas></canvas></span>').join('');
    const gen = this.lobbyGen = (this.lobbyGen || 0) + 1;
    list.forEach((d, i) => { if (d) Skin.fromData(d, (sk) => { const c = box.children[i]; if (gen === this.lobbyGen && c) this.charCanvas(c.querySelector('canvas'), sk); }); });
    const max = Net.host ? Net.maxPlayers() : '';
    el('olInfo').textContent = Net.host
      ? `${list.length}人 あつまった (さいだい ${max}人)。あいている ところは コンピューターが 入るよ`
      : 'ホストが はじめるのを まっています';
    this.netMsg('');
  },
  netLost() {
    if (G.mode === 'play' || G.mode === 'reveal' || G.mode === 'over') this.title();
    this.openOnline();
    this.netMsg('ホストとの つながりが 切れました', true);
  },

  /* あそびかた */
  helpHTML() {
    const I = (n, c = '') => `<span class="hi ${c}">${iconSVG(n)}</span>`;
    return `
      <h2>あそびかた</h2>
      <section class="hSec hider">
        <h3>${I('person')}かくれる人</h3>
        <p>はじめの 30びょうで かくれよう。</p>
        <p>${I('brush')}<b>ぬる</b> … じぶんの からだを ぬって、まわりの 色に とけこむ。からだの 形も かえられる。</p>
        <p>${I('box')}<b>かくれる</b> … はこ・ロッカー・しげみ・ベッドに 入れる。1か所に 1人だけ。</p>
        <p>うごくと 足あとが のこるので、見つかりやすく なるよ。</p>
      </section>
      <section class="hSec oni">
        <h3>${I('gun')}オニ</h3>
        <p>30 かぞえたら さがしに 行こう。あやしい ところを 銃で 撃つと つかまえられる。</p>
        <p>たまは 6はつ。時間が たつと もどる。はこや ロッカーも 撃って たしかめられる。</p>
      </section>
      <section class="hSec win">
        <h3>${I('trophy', 'gold')}かち まけ</h3>
        <p>時間まで 1人でも かくれていたら <b>かくれる人の かち</b>。ぜんいん つかまえたら <b>オニの かち</b>。</p>
      </section>
      <section class="hSec keys">
        <h3>そうさ</h3>
        <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> いどう　<kbd>E</kbd> かくれる・でる　<kbd>Q</kbd> ぬる</p>
        <p>オニ: マウスで ねらって クリックで うつ (<kbd>スペース</kbd> でも うてる)　<kbd>M</kbd> 地図　<kbd>Esc</kbd> ひとやすみ</p>
      </section>
      <section class="hSec touchOnly">
        <h3>スマホ</h3>
        <p>画面の ひだりを なぞって いどう。オニは みぎがわを タップすると そこへ 撃つ。</p>
      </section>`;
  },

  over(w) {
    if (G.mode === 'over') return;
    G.mode = 'over';
    Editor.close();
    el('hud').classList.add('hidden');
    el('blind').classList.add('hidden');
    const p = Game.player;
    const left = Game.left();
    const win = (w.team === 'oni') === (p.role === 'oni');
    el('oTitle').textContent = w.team === 'oni' ? 'オニの かち！' : 'かくれる人の かち！';
    el('oSub').textContent = w.team === 'oni' ? 'ぜんいん つかまった' : `${left}人が さいごまで かくれきった`;
    let mine;
    if (p.role === 'oni') mine = `あなたは ${Game.agents.filter((a) => a.role === 'hider' && !a.alive).length}人 つかまえた`;
    else mine = p.alive ? 'あなたは さいごまで かくれきった！' : `あなたは さがす時間の ${p.caughtT}びょう目に みつかった`;
    el('oMine').textContent = mine;
    const list = el('oList');
    list.innerHTML = Game.agents.map((a) => `<span class="oP${a === p ? ' me' : ''}${a.role === 'oni' ? ' oni' : a.alive ? ' safe' : ' out'}"><canvas></canvas><b>${Game.nameOf(a)}</b><small>${a.role === 'oni' ? 'オニ' : a.alive ? 'のこった' : `${a.caughtT}びょう`}</small></span>`).join('');
    el('over').className = (w.team === 'oni' ? 'oniWin' : 'hiderWin') + (win ? ' youWin' : ' youLose');
    el('oAgain').classList.toggle('hidden', Net.client);
    el('oWait').classList.toggle('hidden', !Net.client);
    Game.agents.forEach((a, i) => this.charCanvas(list.children[i].querySelector('canvas'), a.skin, { gun: a.role === 'oni', gray: a.role === 'hider' && !a.alive }));
    win ? Sfx.win() : Sfx.lose();
  },
};
