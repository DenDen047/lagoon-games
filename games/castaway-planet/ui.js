/* =========================================================================
   CASTAWAY PLANET ― 画面まわり
   HUD / 持ち物 / クラフト / ロボット工房 / 貯蔵箱 / 交易 / 宇宙船
   ========================================================================= */
'use strict';

const UI = {
  game: null,
  kind: null,
  ctx: null,      /* パネルごとの一時状態 */
  sel: -1,

  init(game) {
    this.game = game;
    this.el = {
      wrap: document.getElementById('panelWrap'),
      panel: document.getElementById('panel'),
      title: document.getElementById('panelTitle'),
      body: document.getElementById('panelBody'),
      foot: document.getElementById('panelFoot'),
      hotbar: document.getElementById('hotbar'),
      clock: document.getElementById('clock'),
      day: document.getElementById('day'),
      planet: document.getElementById('planetName'),
      hpFill: document.getElementById('hpFill'),
      stFill: document.getElementById('stFill'),
      robotBox: document.getElementById('robotBox'),
      battFill: document.getElementById('battFill'),
      waterFill: document.getElementById('waterFill'),
      armL: document.getElementById('armL'),
      armR: document.getElementById('armR'),
      prompt: document.getElementById('prompt'),
      promptText: document.getElementById('promptText'),
      quest: document.getElementById('questText'),
      seedBox: document.getElementById('seedBox'),
    };
    document.getElementById('panelClose').addEventListener('click', () => this.close());
    this.el.wrap.addEventListener('mousedown', (e) => { if (e.target === this.el.wrap) this.close(); });
  },

  /* ------------------------------ HUD ------------------------------ */
  hud() {
    const g = this.game, e = this.el;
    e.clock.textContent = g.clockText();
    e.day.textContent = `${g.day}日目`;
    e.planet.textContent = `${g.world.planet.name}`;
    e.hpFill.style.width = `${(g.player.hp / g.player.maxhp) * 100}%`;
    e.stFill.style.width = `${(g.player.st / g.player.maxst) * 100}%`;
    const r = g.riding;
    e.robotBox.style.display = r ? 'flex' : 'none';
    if (r) {
      e.battFill.style.width = `${(r.batt / r.maxbatt) * 100}%`;
      e.waterFill.style.width = `${(r.water / r.maxwater) * 100}%`;
      const nameOf = (id) => (id ? ARMS[id].name : '空');
      e.armL.textContent = `左 ${nameOf(r.arms.left)}`;
      e.armR.textContent = `右 ${nameOf(r.arms.right)}`;
      e.armL.classList.toggle('active', g.activeSide === 'left');
      e.armR.classList.toggle('active', g.activeSide === 'right');
      const seedNeeded = (r.arms.left && ARMS[r.arms.left].act === 'seed') || (r.arms.right && ARMS[r.arms.right].act === 'seed');
      const seed = g.selectedSeed();
      e.seedBox.style.display = seedNeeded ? 'block' : 'none';
      e.seedBox.textContent = seed ? `蒔く種: ${itemIcon(seed)} ${itemName(seed)}` : '蒔く種がない';
    }
    e.quest.textContent = g.questText();
    this.hotbar();
  },

  hotbar() {
    const g = this.game, box = this.el.hotbar;
    if (!this._hotCells) {
      box.innerHTML = '';
      this._hotCells = [];
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'slot';
        cell.innerHTML = `<span class="key">${i + 1}</span><span class="ic"></span><span class="n"></span>`;
        cell.addEventListener('mousedown', () => { g.hot = i; });
        box.appendChild(cell);
        this._hotCells.push(cell);
      }
    }
    for (let i = 0; i < 9; i++) {
      const s = g.inv[i], cell = this._hotCells[i];
      cell.classList.toggle('on', g.hot === i);
      cell.querySelector('.ic').textContent = s ? itemIcon(s.id) : '';
      cell.querySelector('.n').textContent = s && s.n > 1 ? s.n : '';
      cell.title = s ? itemName(s.id) : '';
    }
  },

  showPrompt(text) {
    const e = this.el;
    if (!text) { e.prompt.style.display = 'none'; return; }
    e.prompt.style.display = 'block';
    e.promptText.textContent = text;
  },

  /* ---------------------------- パネル基盤 ---------------------------- */
  open(kind, opt = {}) {
    this.kind = kind; this.ctx = opt; this.sel = -1;
    this.el.wrap.style.display = 'flex';
    this.game.uiOpen = true;
    this.refresh();
  },
  close() {
    this.kind = null; this.ctx = null;
    this.el.wrap.style.display = 'none';
    this.game.uiOpen = false;
    if (this._prevAnim) { cancelAnimationFrame(this._prevAnim); this._prevAnim = null; }
  },
  isOpen() { return !!this.kind; },

  refresh() {
    if (!this.kind) return;
    const map = {
      inv: () => this.renderInv(), craft: () => this.renderCraft(), robot: () => this.renderRobot(),
      chest: () => this.renderChest(), trade: () => this.renderTrade(), ship: () => this.renderShip(),
      sleep: () => this.renderSleep(), help: () => this.renderHelp(), charge: () => this.renderCharge(),
      water: () => this.renderWaterTank(),
    };
    (map[this.kind] || (() => {}))();
  },

  slotHTML(id, n, extra = '') {
    return `<div class="islot ${extra}" data-id="${id}"><span class="ic">${itemIcon(id)}</span>` +
      `<span class="nm">${itemName(id)}</span>${n ? `<span class="n">×${n}</span>` : ''}</div>`;
  },

  /* ------------------------------ 持ち物 ------------------------------ */
  renderInv() {
    const g = this.game;
    this.el.title.textContent = '持ち物';
    const cells = g.inv.map((s, i) => {
      if (!s) return `<div class="islot empty" data-i="${i}"></div>`;
      const sel = this.sel === i ? ' sel' : '';
      const hb = i < 9 ? '<span class="hb">' + (i + 1) + '</span>' : '';
      return `<div class="islot${sel}" data-i="${i}">${hb}<span class="ic">${itemIcon(s.id)}</span>` +
        `<span class="nm">${itemName(s.id)}</span><span class="n">×${s.n}</span></div>`;
    }).join('');
    const s = this.sel >= 0 ? g.inv[this.sel] : null;
    const def = s ? itemDef(s.id) : null;
    let actions = '<div class="hint">持ち物をクリックすると、下に操作が出ます。1〜9 のマスがすぐ手に持てる枠です。</div>';
    if (s) {
      const btns = [];
      if (this.sel >= 9) btns.push('<button class="btn" data-act="tohot">手元の枠へ移す</button>');
      if (def && def.kind === 'food') btns.push('<button class="btn primary" data-act="eat">食べる (+' + def.stamina + ')</button>');
      if (isStation(s.id)) btns.push('<button class="btn" data-act="tohot">手に持って設置する</button>');
      btns.push('<button class="btn ghost" data-act="drop">1つ捨てる</button>');
      const d = def && def.desc ? `<div class="hint">${def.desc}</div>` : '';
      actions = `<div class="selinfo"><b>${itemIcon(s.id)} ${itemName(s.id)}</b> ×${s.n}${d}</div><div class="row">${btns.join('')}</div>`;
    }
    this.el.body.innerHTML = `<div class="invgrid">${cells}</div>${actions}`;
    this.el.foot.innerHTML = '';
    this.el.body.querySelectorAll('.islot').forEach((n) => {
      n.addEventListener('mousedown', () => {
        const i = +n.dataset.i;
        if (!g.inv[i]) return;
        this.sel = this.sel === i ? -1 : i;
        this.renderInv();
      });
    });
    this.el.body.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        const act = b.dataset.act, i = this.sel;
        if (i < 0 || !g.inv[i]) return;
        if (act === 'tohot') { g.moveToHotbar(i); this.sel = -1; }
        else if (act === 'eat') g.eat(i);
        else if (act === 'drop') g.dropOne(i);
        this.renderInv();
      });
    });
  },

  /* ------------------------------ クラフト ------------------------------ */
  renderCraft() {
    const g = this.game;
    const near = g.nearStations();
    this.el.title.textContent = '作る';
    const groups = [
      { st: null, label: '手持ちで作れる' },
      { st: 'st_workbench', label: '作業台' },
      { st: 'st_smelter', label: '製錬炉' },
      { st: 'st_assembler', label: '組立台' },
      { st: 'st_robotbay', label: 'ロボット工房' },
    ];
    let html = '';
    for (const grp of groups) {
      const list = RECIPES.filter((r) => r.station === grp.st);
      if (!list.length) continue;
      const ok = grp.st === null || near.has(grp.st);
      html += `<div class="grp ${ok ? '' : 'off'}"><h3>${grp.label}${ok ? '' : ' <span class="tag">近くにない</span>'}</h3><div class="rlist">`;
      for (const r of list) {
        const [outId, outN] = r.out;
        const can = ok && g.canCraft(r);
        const cost = r.cost.map(([id, n]) => {
          const have = g.countItem(id);
          return `<span class="cost ${have >= n ? 'ok' : 'ng'}">${itemIcon(id)}${itemName(id)} ${have}/${n}</span>`;
        }).join('');
        const fuel = r.fuel ? `<span class="cost ${g.hasFuel() ? 'ok' : 'ng'}">🔥燃料 1</span>` : '';
        const def = itemDef(outId);
        const desc = def && def.desc ? `<div class="rdesc">${def.desc}</div>` : '';
        html += `<div class="recipe ${can ? '' : 'no'}" data-i="${RECIPES.indexOf(r)}">
          <div class="rhead"><span class="ic">${itemIcon(outId)}</span><b>${itemName(outId)}</b>${outN > 1 ? `<span class="n">×${outN}</span>` : ''}
          <button class="btn small ${can ? 'primary' : ''}" ${can ? '' : 'disabled'}>作る</button></div>
          <div class="costs">${cost}${fuel}</div>${desc}</div>`;
      }
      html += '</div></div>';
    }
    this.el.body.innerHTML = html;
    this.el.foot.innerHTML = '<div class="hint">製錬炉のレシピは燃石や木材などの燃料を1つ使います。</div>';
    this.el.body.querySelectorAll('.recipe button').forEach((b) => {
      b.addEventListener('click', () => {
        const i = +b.closest('.recipe').dataset.i;
        if (g.craft(RECIPES[i])) this.renderCraft();
      });
    });
  },

  /* --------------------------- ロボット工房 --------------------------- */
  renderRobot() {
    const g = this.game;
    this.el.title.textContent = 'ロボット工房';
    if (!g.robots.length) {
      const kit = g.countItem('robot_kit');
      this.el.body.innerHTML = `<div class="empty-note">
        <div class="big">🤖</div>
        <p>まだロボットがいない。<b>ロボット素体</b>をここで作ってから組み立てる。</p>
        <p class="hint">素体: 鉄インゴット12 / 機械部品8 / 回路基板4 / 動力セル2</p>
        <button class="btn primary" data-act="build" ${kit ? '' : 'disabled'}>${kit ? 'ロボットを組み立てる' : 'ロボット素体がない'}</button>
        <button class="btn" data-act="craft">工房のレシピを見る</button>
      </div>`;
      this.el.foot.innerHTML = '';
      this.bindRobotButtons();
      return;
    }
    const r = g.workRobot();
    const owned = g.ownedArms();
    const armRow = (side) => {
      const cur = r.arms[side];
      const chips = ['<div class="chip ' + (cur ? '' : 'on') + '" data-side="' + side + '" data-arm="">✋ 何も付けない</div>']
        .concat(owned.map((id) => `<div class="chip ${cur === id ? 'on' : ''}" data-side="${side}" data-arm="${id}">${ARMS[id].icon} ${ARMS[id].name}</div>`));
      const d = cur ? `<div class="hint">${ARMS[cur].desc} ／ 消費電力 ${ARMS[cur].batt}</div>` : '<div class="hint">アームを選ぶと、乗ったときに使えるようになります。</div>';
      return `<div class="armblock"><h4>${side === 'left' ? '左手' : '右手'}</h4><div class="chips">${chips.join('')}</div>${d}</div>`;
    };
    const presets = ROBOT_PRESETS.map((p, i) => `<div class="pre" data-pre="${i}" style="background:${p.body};border-color:${p.accent}"><i style="background:${p.accent}"></i><i style="background:${p.glow}"></i></div>`).join('');
    const roster = g.robots.map((rb) => `<div class="chip ${rb === r ? 'on' : ''}" data-robot="${rb.id}">🤖 ${rb.name}</div>`).join('');

    this.el.body.innerHTML = `
      <div class="robotwrap">
        <div class="preview">
          <canvas id="robotPreview" width="180" height="190"></canvas>
          <input id="robotName" class="nameinput" value="${r.name}" maxlength="10" />
          <div class="bars">
            <div class="bar"><span>🔋</span><div class="track"><div style="width:${(r.batt / r.maxbatt) * 100}%;background:#7fe8a0"></div></div></div>
            <div class="bar"><span>💧</span><div class="track"><div style="width:${(r.water / r.maxwater) * 100}%;background:#7ec8ff"></div></div></div>
          </div>
          <div class="row">
            <button class="btn small" data-act="charge">満充電</button>
            <button class="btn small" data-act="fill">水を入れる</button>
          </div>
          <div class="chips small">${roster}</div>
        </div>
        <div class="opts">
          ${armRow('left')}
          ${armRow('right')}
          <div class="armblock"><h4>色</h4>
            <div class="colors">
              <label>本体<input type="color" data-col="body" value="${this.hex(r.colors.body)}"></label>
              <label>差し色<input type="color" data-col="accent" value="${this.hex(r.colors.accent)}"></label>
              <label>腕<input type="color" data-col="arm" value="${this.hex(r.colors.arm)}"></label>
              <label>ランプ<input type="color" data-col="glow" value="${this.hex(r.colors.glow)}"></label>
            </div>
            <div class="presets">${presets}</div>
          </div>
        </div>
      </div>`;
    const kit = g.countItem('robot_kit');
    this.el.foot.innerHTML = `<button class="btn" data-act="build" ${kit ? '' : 'disabled'}>もう1体 組み立てる${kit ? '' : '（素体がない）'}</button>
      <button class="btn" data-act="craft">工房のレシピ</button>
      <div class="hint">アームは付け替えると、外したほうが持ち物に戻ります。</div>`;
    this.startPreview(r);
    this.bindRobotButtons();

    this.el.body.querySelectorAll('[data-arm]').forEach((c) => {
      c.addEventListener('click', () => { g.equipArm(r, c.dataset.side, c.dataset.arm || null); this.renderRobot(); });
    });
    this.el.body.querySelectorAll('[data-col]').forEach((inp) => {
      inp.addEventListener('input', () => { r.colors[inp.dataset.col] = inp.value; });
    });
    this.el.body.querySelectorAll('[data-pre]').forEach((p) => {
      p.addEventListener('click', () => {
        const pre = ROBOT_PRESETS[+p.dataset.pre];
        r.colors = { body: pre.body, accent: pre.accent, arm: pre.arm, glow: pre.glow };
        this.renderRobot();
      });
    });
    this.el.body.querySelectorAll('[data-robot]').forEach((c) => {
      c.addEventListener('click', () => { g.workRobotId = +c.dataset.robot; this.renderRobot(); });
    });
    const nameInput = document.getElementById('robotName');
    nameInput.addEventListener('input', () => { r.name = nameInput.value.trim() || r.name; });
  },

  bindRobotButtons() {
    const g = this.game;
    this.el.panel.querySelectorAll('[data-act]').forEach((b) => {
      if (b._bound) return;
      b._bound = true;
      b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a === 'build') { g.buildRobot(); this.renderRobot(); }
        else if (a === 'craft') this.open('craft');
        else if (a === 'charge') { const r = g.workRobot(); if (r) { r.charge(r.maxbatt); toast(`${r.name} を充電した`); this.renderRobot(); } }
        else if (a === 'fill') { const r = g.workRobot(); if (r) { r.fill(r.maxwater); toast(`${r.name} に水を入れた`); this.renderRobot(); } }
      });
    });
  },

  hex(c) { return c && c[0] === '#' ? c : '#cccccc'; },

  /* 工房のロボットをくるくる見せる */
  startPreview(r) {
    const cv = document.getElementById('robotPreview');
    if (!cv) return;
    const cx = cv.getContext('2d');
    const fake = { clock: 0, robots: [], riding: null, world: this.game.world };
    const savedCam = Render.cam;
    const step = () => {
      if (!document.body.contains(cv)) return;
      fake.clock += 0.016;
      cx.clearRect(0, 0, cv.width, cv.height);
      const grd = cx.createLinearGradient(0, 0, 0, cv.height);
      grd.addColorStop(0, '#243040'); grd.addColorStop(1, '#161d28');
      cx.fillStyle = grd; cx.fillRect(0, 0, cv.width, cv.height);
      cx.strokeStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < cv.height; i += 12) { cx.beginPath(); cx.moveTo(0, i); cx.lineTo(cv.width, i); cx.stroke(); }
      const ghost = Object.create(Robot.prototype);
      Object.assign(ghost, r, { x: 0, y: 0, ridden: false, preview: true, walk: fake.clock * 1.2, vx: 0, vy: 0 });
      ghost.arms = r.arms; ghost.colors = r.colors; ghost.swing = { left: 0, right: 0 };
      ghost.face = 1;
      Render.cam = { x: 0, y: 0, w: cv.width, h: cv.height };
      cx.save();
      cx.translate(cv.width / 2, cv.height * 0.68);
      cx.scale(1.9, 1.9);
      Render.drawRobot(fake, cx, ghost);
      cx.restore();
      Render.cam = savedCam;
      Render.lights.length = 0;
      this._prevAnim = requestAnimationFrame(step);
    };
    if (this._prevAnim) cancelAnimationFrame(this._prevAnim);
    step();
  },

  /* ------------------------------ 貯蔵箱 ------------------------------ */
  renderChest() {
    const g = this.game, st = this.ctx.station;
    this.el.title.textContent = '貯蔵箱';
    const chest = (st.items || []).map((s, i) => this.slotHTML(s.id, s.n, 'chest') .replace('data-id', `data-ci="${i}" data-id`)).join('') || '<div class="hint">空っぽ</div>';
    const inv = g.inv.map((s, i) => (s ? this.slotHTML(s.id, s.n, 'bag').replace('data-id', `data-ii="${i}" data-id`) : '')).join('');
    this.el.body.innerHTML = `<div class="twocol">
      <div><h3>箱の中</h3><div class="list">${chest}</div></div>
      <div><h3>持ち物</h3><div class="list">${inv}</div></div></div>`;
    this.el.foot.innerHTML = '<div class="hint">クリックで出し入れします。</div>';
    this.el.body.querySelectorAll('[data-ci]').forEach((n) => n.addEventListener('click', () => { g.chestTake(st, +n.dataset.ci); this.renderChest(); }));
    this.el.body.querySelectorAll('[data-ii]').forEach((n) => n.addEventListener('click', () => { g.chestPut(st, +n.dataset.ii); this.renderChest(); }));
  },

  /* ------------------------------ 交易 ------------------------------ */
  renderTrade() {
    const g = this.game, a = this.ctx.alien, d = ALIENS[a.sp];
    this.el.title.textContent = d.name;
    const t = d.trade;
    const have = g.countItem(t.want[0]);
    const ok = have >= t.want[1];
    this.el.body.innerHTML = `<p class="line">${d.line}</p>
      <div class="tradebox">
        <div class="side"><div class="ic">${itemIcon(t.want[0])}</div><div>${itemName(t.want[0])} ×${t.want[1]}</div><div class="hint">持っている: ${have}</div></div>
        <div class="arrow">→</div>
        <div class="side"><div class="ic">${itemIcon(t.give[0])}</div><div>${itemName(t.give[0])} ×${t.give[1]}</div></div>
      </div>
      <div class="hint">${t.text}</div>`;
    this.el.foot.innerHTML = `<button class="btn primary" data-t="1" ${ok ? '' : 'disabled'}>${ok ? '交換する' : '足りない'}</button>`;
    const b = this.el.foot.querySelector('[data-t]');
    if (b) b.addEventListener('click', () => { g.doTrade(a); this.close(); });
  },

  /* ------------------------------ 宇宙船 ------------------------------ */
  renderShip() {
    const g = this.game, P = g.world.planet;
    const partId = P.part;
    const has = g.countItem(partId) > 0;
    const last = g.world.pi === PLANETS.length - 1;
    this.el.title.textContent = '墜落した宇宙船';
    if (!g.world.shipRepaired) {
      this.el.body.innerHTML = `<p class="line">${P.intro}</p>
        <p>この星を出るには <b>${itemIcon(partId)} ${itemName(partId)}</b> が要る。組立台で作れる。</p>
        <div class="hint">${P.partHint}</div>`;
      this.el.foot.innerHTML = `<button class="btn primary" data-fix="1" ${has ? '' : 'disabled'}>${has ? '取り付ける' : 'まだ部品がない'}</button>`;
      const b = this.el.foot.querySelector('[data-fix]');
      if (b) b.addEventListener('click', () => { g.repairShip(); this.renderShip(); });
      return;
    }
    const next = last ? null : PLANETS[g.world.pi + 1];
    this.el.body.innerHTML = `<p class="line">エンジンに火が入った。いつでも飛べる。</p>
      ${next ? `<p>次の目的地: <b>${next.name}</b> ― ${next.tag}</p><div class="hint">${next.intro}</div>
      <div class="warn">飛ぶと、この星に建てたものと畑は置いていくことになります。持ち物とロボットは一緒に運べます。</div>`
        : '<p>ワープコアは積んだ。ここから故郷へ帰れる。</p>'}`;
    this.el.foot.innerHTML = next
      ? `<button class="btn primary" data-go="1">${next.name} へ飛ぶ</button><button class="btn ghost" data-close="1">まだ待つ</button>`
      : '<button class="btn primary" data-end="1">故郷へ帰る</button><button class="btn ghost" data-close="1">まだ待つ</button>';
    const go = this.el.foot.querySelector('[data-go]');
    if (go) go.addEventListener('click', () => { this.close(); g.warp(); });
    const end = this.el.foot.querySelector('[data-end]');
    if (end) end.addEventListener('click', () => { this.close(); g.ending(); });
    const cl = this.el.foot.querySelector('[data-close]');
    if (cl) cl.addEventListener('click', () => this.close());
  },

  /* ------------------------------ 睡眠 ------------------------------ */
  renderSleep() {
    this.el.title.textContent = '簡易ベッド';
    this.el.body.innerHTML = '<p class="line">朝まで眠りますか。体力が戻り、作物は夜のあいだも育ちます。</p>';
    this.el.foot.innerHTML = '<button class="btn primary" data-sleep="1">眠る</button><button class="btn ghost" data-close="1">やめる</button>';
    this.el.foot.querySelector('[data-sleep]').addEventListener('click', () => { this.close(); this.game.sleep(); });
    this.el.foot.querySelector('[data-close]').addEventListener('click', () => this.close());
  },

  renderCharge() {
    const g = this.game;
    this.el.title.textContent = 'ソーラー充電器';
    const day = !g.isNight();
    const near = g.robots.filter((r) => dist(r.x, r.y, this.ctx.x, this.ctx.y) < TILE * 3);
    this.el.body.innerHTML = `<p class="line">${day ? '陽が当たっている。近くのロボットを充電できる。' : '夜は発電しない。朝を待つことになる。'}</p>
      ${near.length ? near.map((r) => `<div class="row"><b>${r.name}</b> 🔋${Math.round(r.batt)}%</div>`).join('') : '<div class="hint">3マス以内にロボットがいない。</div>'}`;
    this.el.foot.innerHTML = `<button class="btn primary" data-ch="1" ${day && near.length ? '' : 'disabled'}>充電する</button>`;
    const b = this.el.foot.querySelector('[data-ch]');
    if (b) b.addEventListener('click', () => { near.forEach((r) => r.charge(r.maxbatt)); toast('ロボットを充電した'); this.renderCharge(); });
  },

  renderWaterTank() {
    const g = this.game, st = this.ctx.station;
    this.el.title.textContent = '貯水タンク';
    const r = g.riding || g.robots.find((rb) => dist(rb.x, rb.y, this.ctx.x, this.ctx.y) < TILE * 3);
    this.el.body.innerHTML = `<p class="line">タンクの水: ${Math.round(st.water)} / 40</p>
      <div class="hint">雨や湧き水で少しずつ溜まります。ロボットの散水アームはここから補給できます。</div>`;
    this.el.foot.innerHTML = `<button class="btn primary" data-fill="1" ${r && st.water > 0 ? '' : 'disabled'}>${r ? `${r.name} に汲む` : '近くにロボットがいない'}</button>
      <button class="btn" data-can="1" ${st.water > 0 && g.hasItem('tool_can', 1) ? '' : 'disabled'}>ジョウロに汲む</button>`;
    const b = this.el.foot.querySelector('[data-fill]');
    if (b) b.addEventListener('click', () => {
      const got = r.fill(st.water); st.water -= got; toast(`${r.name} に水を ${Math.round(got)} 入れた`); this.renderWaterTank();
    });
    const c = this.el.foot.querySelector('[data-can]');
    if (c) c.addEventListener('click', () => { const got = Math.min(st.water, 12 - g.canWater); g.canWater += got; st.water -= got; toast('ジョウロを満たした'); this.renderWaterTank(); });
  },

  /* ------------------------------ ヘルプ ------------------------------ */
  renderHelp() {
    this.el.title.textContent = '遊びかた';
    this.el.body.innerHTML = `
      <div class="help">
        <h3>歩く・手で作業する</h3>
        <ul>
          <li><b>WASD / 矢印</b> 移動、<b>左クリック</b> 手に持った道具を使う</li>
          <li><b>1〜9</b> 手に持つものを選ぶ、<b>Tab / I</b> 持ち物、<b>C</b> 作る、<b>E</b> 目の前を調べる</li>
          <li>素手では草しか採れません。ピッケルで鉱脈、斧で木、クワで畑、ジョウロで水やり。</li>
        </ul>
        <h3>ロボットに乗る</h3>
        <ul>
          <li>ロボットの近くで <b>E</b>。もう一度 <b>E</b> で降ります。</li>
          <li><b>左クリック</b> 右手のアーム、<b>右クリック</b> 左手のアーム。<b>Q</b> で使う手を切り替え。</li>
          <li>水やり・種まき・耕し・収穫・採掘は、乗っているあいだだけ 3×3 まとめてできます。</li>
          <li>バッテリーが切れると降ろされます。ロボット工房かソーラー充電器で充電を。</li>
          <li>アームと色はロボット工房で自由に変えられます。</li>
        </ul>
        <h3>暮らす</h3>
        <ul>
          <li>畑は「耕す → 種を蒔く → 水をやる」。乾くと育ちが止まります。</li>
          <li>友好的な宇宙人には <b>E</b> で話しかけて交換ができます。敵対的な相手は夜に増えます。</li>
          <li>各惑星で修理部品を作って宇宙船に取り付けると、次の星へ飛べます。</li>
        </ul>
      </div>`;
    this.el.foot.innerHTML = '<button class="btn ghost" data-close="1">閉じる</button>';
    this.el.foot.querySelector('[data-close]').addEventListener('click', () => this.close());
  },
};
