/* =========================================================================
   MOKO GOD ― 画面のUI
   HUD / 世界地図 / 奇跡えらび / 街のようす / 年代記 / 会話まど
   ========================================================================= */
'use strict';

const UI = {
  panelOpen: null,
  mapCv: null, mapCtx: null,
  talkQueue: [], talkOn: false, talkCb: null,

  init() {
    document.getElementById('panelClose').addEventListener('click', () => this.close());
    document.getElementById('panelWrap').addEventListener('click', (e) => {
      if (e.target.id === 'panelWrap') this.close();
    });
    document.getElementById('btnMap').addEventListener('click', () => this.openMap());
    document.getElementById('btnMiracle').addEventListener('click', () => this.openMiracles());
    document.getElementById('btnBook').addEventListener('click', () => this.openChronicle());
    document.getElementById('btnMenu').addEventListener('click', () => this.openMenu());
    document.getElementById('btnAct').addEventListener('click', () => Game.act());
    document.getElementById('talkWrap').addEventListener('click', () => this.talkNext());
    for (const b of document.querySelectorAll('.sbtn')) {
      b.addEventListener('click', () => Game.setSpeed(+b.dataset.speed));
    }
  },

  close() {
    document.getElementById('panelWrap').classList.add('hidden');
    this.panelOpen = null;
  },

  open(title, bodyHTML, footHTML = '') {
    document.getElementById('panelTitle').textContent = title;
    document.getElementById('panelBody').innerHTML = bodyHTML;
    document.getElementById('panelFoot').innerHTML = footHTML;
    document.getElementById('panelWrap').classList.remove('hidden');
  },

  /* =============================== HUD =============================== */
  refreshHUD(G) {
    document.getElementById('planetLabel').textContent = G.planet;
    const era = ERAS[G.towns.length ? Math.max(...G.towns.map((t) => t.era)) : 0];
    document.getElementById('eraLabel').textContent = era.name;
    document.getElementById('dayLabel').textContent = G.year + '年目';
    document.getElementById('clockLabel').textContent = (G.tod > 0.25 && G.tod < 0.78) ? '☀ ひる' : '🌙 よる';
    document.getElementById('faithNum').textContent = Math.floor(G.faith);
    document.getElementById('faithRate').textContent = '+' + G.faithRate.toFixed(1) + ' /年';
    for (const b of document.querySelectorAll('.sbtn')) {
      b.classList.toggle('on', +b.dataset.speed === G.speed);
    }
    document.getElementById('bossBar').classList.toggle('on', G.scene === 'castle' && G.demon.alive);
    if (G.scene === 'castle') {
      document.getElementById('bossFill').style.width = clamp(G.demon.hp / G.demon.maxHp * 100, 0, 100) + '%';
    }
    this.refreshMiracleBar(G);
  },

  refreshMiracleBar(G) {
    const bar = document.getElementById('miracleBar');
    if (G.scene === 'castle') { bar.style.display = 'none'; return; }
    bar.style.display = '';
    if (bar.childElementCount !== MIRACLES.length) {
      bar.innerHTML = MIRACLES.map((m) => `
        <div class="mslot" data-id="${m.id}" title="${m.name}｜${m.desc}">
          <span>${m.icon}</span><span class="cost">${m.cost}</span><span class="nm">${m.name}</span>
        </div>`).join('');
      for (const el of bar.querySelectorAll('.mslot')) {
        el.addEventListener('click', () => this.pickMiracle(el.dataset.id));
      }
    }
    for (const el of bar.querySelectorAll('.mslot')) {
      const m = MIRACLES.find((k) => k.id === el.dataset.id);
      const cost = Game.miracleCost(G, m);
      el.querySelector('.cost').textContent = cost;
      el.classList.toggle('on', G.ui.miracle === m.id);
      el.classList.toggle('poor', G.faith < cost);
    }
  },

  pickMiracle(id) {
    const G = Game.G;
    G.ui.miracle = id;
    const m = MIRACLES.find((k) => k.id === id);
    if (m.pick) this.openLifePicker();
    else toast(`${m.icon} ${m.name} をえらんだ`, 'holy');
    this.refreshMiracleBar(G);
  },

  setPrompt(text) {
    const p = document.getElementById('prompt');
    if (!text) { p.classList.remove('on'); return; }
    p.classList.add('on');
    document.getElementById('promptText').textContent = text;
  },

  setQuest(text) { document.getElementById('questText').textContent = text; },

  /* ============================ 世界地図 ============================ */
  openMap() {
    const G = Game.G;
    this.panelOpen = 'map';
    this.open(`${G.planet} の地上`, `
      <div id="mapHolder"><canvas id="mapCanvas" width="800" height="600"></canvas></div>
      <div class="mapLegend">
        <span>タップした場所に <b>奇跡</b> を起こせます</span>
        <span>まる = <b>街</b>（大きさは人の数、色は時代）</span>
        <span>小さな点 = <b>いきもの</b></span>
      </div>
      <div id="mapInfo" class="note" style="margin-top:8px"></div>
    `, `
      <button class="btn primary" id="mapCast">✨ ここに奇跡を起こす</button>
      <button class="btn" id="mapDescend">🚪 ここへ降りる</button>
      <button class="btn" id="mapTown" disabled>🏠 この街を見る</button>
      <button class="btn ghost" id="mapClose2">とじる</button>
    `);
    this.mapCv = document.getElementById('mapCanvas');
    this.mapCtx = this.mapCv.getContext('2d');

    const pick = (ev) => {
      const r = this.mapCv.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      G.ui.cur = {
        tx: clamp(Math.floor(x * World.w), 0, World.w - 1),
        ty: clamp(Math.floor(y * World.h), 0, World.h - 1),
      };
      this.updateMapInfo();
      ev.preventDefault();
    };
    this.mapCv.addEventListener('pointerdown', pick);
    this.mapCv.addEventListener('pointermove', (e) => { if (e.buttons) pick(e); });

    document.getElementById('mapCast').addEventListener('click', () => {
      if (!G.ui.cur) { toast('まず地図をタップして場所をえらぶ'); return; }
      Game.castMiracle(G.ui.cur.tx, G.ui.cur.ty);
      this.updateMapInfo();
    });
    document.getElementById('mapDescend').addEventListener('click', () => {
      if (!G.ui.cur) { toast('まず地図をタップして場所をえらぶ'); return; }
      const p = World.findWalkableNear(G.ui.cur.tx, G.ui.cur.ty);
      this.close();
      Game.descend(p.tx, p.ty);
    });
    document.getElementById('mapTown').addEventListener('click', () => {
      const t = this.townAtCursor();
      if (t) this.openTown(t);
    });
    document.getElementById('mapClose2').addEventListener('click', () => this.close());
    this.updateMapInfo();
  },

  townAtCursor() {
    const G = Game.G;
    if (!G.ui.cur) return null;
    return G.towns.find((t) => Math.hypot(t.tx - G.ui.cur.tx, t.ty - G.ui.cur.ty) < 5) || null;
  },

  updateMapInfo() {
    const G = Game.G, box = document.getElementById('mapInfo');
    if (!box) return;
    const btn = document.getElementById('mapTown');
    if (!G.ui.cur) { box.textContent = '地図をタップすると、その場所のことがわかります。'; return; }
    const { tx, ty } = G.ui.cur;
    const def = TILE_DEF[World.get(tx, ty)];
    const t = this.townAtCursor();
    const m = MIRACLES.find((k) => k.id === G.ui.miracle);
    const herds = World.herdsNear(G, tx, ty, 6);
    let s = `<b>${def.name}</b>（${tx}, ${ty}）`;
    if (t) s += `　― <b>${t.name}</b>：${ERAS[t.era].name}・${Math.round(t.pop)}人`;
    if (herds.length) s += `　― ${herds.map((h) => SPECIES[h.sp].name + '×' + h.n).join('、')}`;
    s += `<br>いま えらんでいる奇跡：${m.icon} <b>${m.name}</b>（✨${m.cost}）${m.id === 'life' ? '／' + SPECIES[G.ui.species].name : ''} ― ${m.desc}`;
    box.innerHTML = s;
    if (btn) btn.disabled = !t;
  },

  drawMap() {
    if (this.panelOpen !== 'map' || !this.mapCtx) return;
    R.drawWorldMap(this.mapCtx, 800, 600, Game.G, Game.G.ui);
  },

  /* ============================= 奇跡えらび ============================= */
  openMiracles() {
    const G = Game.G;
    this.panelOpen = 'miracle';
    const rows = MIRACLES.map((m) => `
      <div class="row mrow" data-id="${m.id}" style="cursor:pointer">
        <span class="ic">${m.icon}</span>
        <span class="grow"><span class="nm">${m.name}</span><br><span class="ds">${m.desc}</span></span>
        <span class="cost">✨ ${m.cost}</span>
      </div>`).join('');
    this.open('創世の祭壇 ― 奇跡をえらぶ', `
      <p class="note">えらんだ奇跡は、地上を歩いているときは <b>画面をタップした場所</b> に、
      雲の上からは <b>天窓の地図</b> をタップした場所に起こせます。いまの信仰は ✨${Math.floor(G.faith)}。</p>
      <div class="rows">${rows}</div>
    `, '<button class="btn ghost" id="mClose">とじる</button>');
    for (const el of document.querySelectorAll('.mrow')) {
      el.addEventListener('click', () => { this.pickMiracle(el.dataset.id); if (el.dataset.id !== 'life') this.close(); });
    }
    document.getElementById('mClose').addEventListener('click', () => this.close());
  },

  openLifePicker() {
    const G = Game.G;
    const list = Object.entries(SPECIES).filter(([, d]) => !d.evil);
    const rows = list.map(([k, d]) => `
      <div class="row srow" data-sp="${k}" style="cursor:pointer">
        <span class="ic">${d.icon}</span>
        <span class="grow"><span class="nm">${d.name}</span><br><span class="ds">${d.desc}<br>すみか：${d.biome.map((b) => TILE_DEF[b].name).join('・')}</span></span>
        <span class="cost">✨ ${d.cost}</span>
      </div>`).join('');
    this.open('いのちを生む ― どのいきもの？', `<div class="rows">${rows}</div>`,
      '<button class="btn ghost" id="sClose">とじる</button>');
    for (const el of document.querySelectorAll('.srow')) {
      el.addEventListener('click', () => {
        G.ui.species = el.dataset.sp;
        toast(`${SPECIES[G.ui.species].name} をえらんだ。地図か地上をタップ。`, 'holy');
        this.close();
      });
    }
    document.getElementById('sClose').addEventListener('click', () => this.close());
  },

  /* ============================== 街のようす ============================== */
  openTown(t) {
    const G = Game.G;
    this.panelOpen = 'town';
    const era = ERAS[t.era], nx = ERAS[t.era + 1];
    const need = nx
      ? `つぎの「${nx.name}」まで ― 人 ${Math.round(t.pop)}/${nx.pop}、知恵 ${Math.round(t.tech)}/${nx.tech}`
      : 'この街は、いちばん先の時代にいる。';
    const ev = t.event ? DISASTERS.find((d) => d.id === t.event) : null;
    this.open(`${t.name}`, `
      <div class="stats">
        <div class="stat"><div class="k">時代</div><div class="v">${era.name}</div></div>
        <div class="stat"><div class="k">人の数</div><div class="v">${Math.round(t.pop)}</div></div>
        <div class="stat"><div class="k">気もち</div><div class="v">${Math.round(t.happy)}</div>
          <div class="meter happy"><i style="width:${clamp(t.happy, 0, 100)}%"></i></div></div>
        <div class="stat"><div class="k">食べもの</div><div class="v">${t.food.toFixed(1)}</div>
          <div class="meter food"><i style="width:${clamp(t.food / Math.max(t.pop, 1) * 60, 0, 100)}%"></i></div></div>
        <div class="stat"><div class="k">知恵</div><div class="v">${Math.round(t.tech)}</div></div>
        <div class="stat"><div class="k">できた年</div><div class="v">${t.born}年</div></div>
      </div>
      <p class="note">${era.line}<br>${era.tip}<br>${need}</p>
      ${ev ? `<p class="note" style="color:#ffc0cc">${ev.icon} いま <b>${ev.name}</b> が起きている。${ev.text.replace('{town}', t.name)}</p>` : ''}
      ${t.shrine ? '<p class="note">この街には、あなたの社が建っている。信仰が集まりやすい。</p>' : ''}
    `, `
      <button class="btn primary" id="tBless">🕊 みちびきをさずける（✨25）</button>
      <button class="btn" id="tGo">🚪 この街へ降りる</button>
      <button class="btn ghost" id="tClose">とじる</button>
    `);
    document.getElementById('tBless').addEventListener('click', () => {
      if (G.faith < 25) { toast('信仰がたりない', 'bad'); return; }
      G.faith -= 25; t.blessed += 3; t.happy = clamp(t.happy + 12, 0, 100);
      Game.log(`${t.name} に みちびきをさずけた。`);
      toast(`${t.name} に みちびきをさずけた`, 'holy');
      this.openTown(t);
    });
    document.getElementById('tGo').addEventListener('click', () => {
      const p = World.findWalkableNear(t.tx, t.ty + 3);
      this.close(); Game.descend(p.tx, p.ty);
    });
    document.getElementById('tClose').addEventListener('click', () => this.close());
  },

  /* =============================== 年代記 =============================== */
  openChronicle() {
    const G = Game.G;
    this.panelOpen = 'chron';
    const rows = G.chronicle.slice().reverse().slice(0, 120).map((c) =>
      `<div class="cr"><span class="cy">${c.y}年</span><span>${c.t}</span></div>`).join('')
      || '<p class="note">まだ何も起きていない。</p>';
    const towns = G.towns.map((t) =>
      `<div class="row"><span class="ic">🏠</span><span class="grow"><span class="nm">${t.name}</span><br>
       <span class="ds">${ERAS[t.era].name}・${Math.round(t.pop)}人・気もち ${Math.round(t.happy)}</span></span></div>`).join('');
    this.open(`${G.planet} の年代記`, `
      <div class="stats">
        <div class="stat"><div class="k">いま</div><div class="v">${G.year}年目</div></div>
        <div class="stat"><div class="k">街</div><div class="v">${G.towns.length}</div></div>
        <div class="stat"><div class="k">モコの数</div><div class="v">${Math.round(G.towns.reduce((s, t) => s + t.pop, 0))}</div></div>
        <div class="stat"><div class="k">城の力</div><div class="v">${G.demon.alive ? Math.round(G.demon.power) : '封じた'}</div></div>
      </div>
      <div class="rows" style="margin-bottom:14px">${towns}</div>
      <div class="chron">${rows}</div>
    `, '<button class="btn ghost" id="cClose">とじる</button>');
    document.getElementById('cClose').addEventListener('click', () => this.close());
  },

  /* =============================== メニュー =============================== */
  openMenu() {
    const G = Game.G;
    this.panelOpen = 'menu';
    this.open('メニュー', `
      <div class="stats">
        <div class="stat"><div class="k">星の名まえ</div><div class="v">${G.planet}</div></div>
        <div class="stat"><div class="k">神さまの名まえ</div><div class="v">${G.godName}</div></div>
        <div class="stat"><div class="k">たった年月</div><div class="v">${G.year}年</div></div>
      </div>
      <div class="nameRow" style="margin-top:6px">
        <input id="renameInput" type="text" maxlength="14" value="${G.planet}" />
        <button class="btn sm" id="doRename">星の名前をかえる</button>
      </div>
      <p class="note">セーブは自動です（年がすすむたび、場所を移るたび）。データはこの端末のブラウザにだけ残ります。</p>
      <div class="kgrid" style="margin-top:12px">
        <div><b>WASD / 矢印</b><span>歩く</span></div>
        <div><b>E</b><span>調べる・話す</span></div>
        <div><b>M</b><span>地上を見る</span></div>
        <div><b>Q</b><span>奇跡をえらぶ</span></div>
        <div><b>左クリック</b><span>奇跡・光をなげる</span></div>
        <div><b>R</b><span>年代記</span></div>
      </div>
    `, `
      <button class="btn primary" id="mSave">いま記録する</button>
      <button class="btn" id="mTitle">タイトルへもどる</button>
      <button class="btn ghost" id="mClose3">とじる</button>
    `);
    document.getElementById('doRename').addEventListener('click', () => {
      const v = document.getElementById('renameInput').value.trim();
      if (!v) return;
      G.planet = v.slice(0, 14);
      Game.log(`この星は「${G.planet}」と呼ばれるようになった。`);
      toast(`星の名前を ${G.planet} にした`, 'holy');
      this.refreshHUD(G);
      this.openMenu();
    });
    document.getElementById('mSave').addEventListener('click', () => { Game.save(true); });
    document.getElementById('mTitle').addEventListener('click', () => { Game.save(true); this.close(); Game.toTitle(); });
    document.getElementById('mClose3').addEventListener('click', () => this.close());
  },

  /* =============================== 会話 =============================== */
  talk(name, lines, cb) {
    this.talkQueue = (Array.isArray(lines) ? lines : [lines]).map((l) =>
      typeof l === 'string' ? { who: name, text: l } : l);
    this.talkCb = cb || null;
    this.talkOn = true;
    document.getElementById('talkWrap').classList.remove('hidden');
    document.body.classList.add('talking');
    this.talkNext(true);
  },

  talkNext(first) {
    if (!this.talkOn) return;
    if (first !== true) this.talkQueue.shift();
    if (!this.talkQueue.length) {
      this.talkOn = false;
      document.getElementById('talkWrap').classList.add('hidden');
      document.body.classList.remove('talking');
      const cb = this.talkCb; this.talkCb = null;
      if (cb) cb();
      return;
    }
    const l = this.talkQueue[0];
    document.getElementById('talkName').textContent = l.who || '';
    document.getElementById('talkText').textContent = l.text;
  },
};
