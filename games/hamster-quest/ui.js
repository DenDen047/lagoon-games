/* =========================================================================
   ハムスターの冒険 ― 画面の部品
   HUD / カバン (もちもの・つくる・そうび・まほう) / 店 / 地図 / メニュー / 会話
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  panel: null, tab: null, talkQ: null, sel: null, shopId: null, mapWarp: false,

  init() {
    $('panelClose').addEventListener('click', () => { Sfx.click(); this.closePanel(); });
    $('panelWrap').addEventListener('click', (e) => { if (e.target === $('panelWrap')) this.closePanel(); });
    $('panelTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      Sfx.click(); this.tab = b.dataset.tab; this.sel = null; this.render();
    });
    $('panelBody').addEventListener('click', (e) => this.onBody(e));
    $('talkWrap').addEventListener('click', (e) => { if (!e.target.closest('button')) this.advance(); });
    $('talkChoices').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ch]');
      if (!b) return;
      e.stopPropagation();
      const ch = this.talkQ && this.talkQ.choices && this.talkQ.choices[+b.dataset.ch];
      this.hideTalk();
      Sfx.click();
      if (ch && ch[1]) ch[1]();
    });

    const tap = (id, fn) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Snd.unlock(); fn(); });
    };
    tap('btnBag', () => this.openBag());
    tap('btnMap', () => this.openMap());
    tap('btnMenu', () => this.openMenu());
    tap('btnAtk', () => Input.virt('atk'));
    tap('btnMag', () => Input.virt('mag'));
    tap('btnRoll', () => Input.virt('roll'));
    tap('btnAct', () => { if (Game.G && Game.G.near) Game.act(); });
    tap('btnEat', () => Game.quickEat());
    tap('spellBox', () => Game.cycleSpell(1));
  },

  isBusy() { return !!this.panel || !!this.talkQ; },
  closeAll() { this.closePanel(); this.hideTalk(); },
  back() {
    const q = this.talkQ;
    if (q && q.choices && q.i >= q.lines.length - 1) {
      /* えらぶ画面で Esc は「やめる」 (いちばん最後の選択肢) */
      const ch = q.choices[q.choices.length - 1];
      this.hideTalk();
      if (ch[1]) ch[1]();
    } else if (q) this.advance();
    else if (this.panel) this.closePanel();
  },

  /* ------------------------------- HUD ------------------------------- */
  refreshHUD() {
    const G = Game.G;
    if (!G) return;
    Game.refreshObjective();
    const mh = Game.maxHp(), mm = Game.maxMp(), ne = needExp(G.lv);
    $('lvNum').textContent = G.lv;
    $('hpFill').style.width = (100 * clamp(G.hp / mh, 0, 1)) + '%';
    $('mpFill').style.width = (100 * clamp(G.mp / mm, 0, 1)) + '%';
    $('expFill').style.width = (100 * clamp(G.exp / ne, 0, 1)) + '%';
    $('hpNum').textContent = `${Math.max(0, Math.ceil(G.hp))} / ${mh}`;
    $('mpNum').textContent = `${G.mp} / ${mm}`;
    $('coinNum').textContent = G.coins;
    $('zoneLabel').textContent = G.tower ? `${TOWERS[G.tower.id].name} ${G.tower.floor}F` : (REGIONS[G.region] ? REGIONS[G.region].name : '');
    $('questText').textContent = G.objective;
    const s = SPELLS[G.spell];
    $('spellIcon').textContent = s.icon;
    $('spellName').textContent = s.name;
    $('spellCost').textContent = `MP ${s.mp}`;
    $('spellBox').classList.toggle('off', !G.eq.staff || G.mp < s.mp);
    const near = G.near;
    $('btnAct').textContent = near ? near.label : '…';
    $('btnAct').classList.toggle('dim', !near);
    let food = 0; for (const it of G.inv) if (ITEMS[it.id].kind === 'food' && ITEMS[it.id].heal) food += it.n;
    $('foodNum').textContent = food;
    $('bagNum').textContent = `${G.inv.length}/${Game.slots()}`;
    $('btnBag').classList.toggle('full', G.inv.length >= Game.slots());
    if (G.boss) $('bossFill').style.width = (100 * clamp(G.boss.hp / G.boss.max, 0, 1)) + '%';
  },
  bossBar(b) {
    $('bossBar').classList.toggle('on', !!b);
    if (b) { $('bossName').textContent = b.name; $('bossFill').style.width = '100%'; }
  },
  banner(text) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  },

  /* ------------------------------- 会話 ------------------------------- */
  talk(name, lines, done) {
    this.talkQ = { name, lines: lines.slice(), i: 0, done };
    this.showTalk();
  },
  ask(name, text, choices) {
    this.talkQ = { name, lines: [text], i: 0, choices };
    this.showTalk();
  },
  showTalk() {
    const q = this.talkQ;
    $('talkWrap').classList.remove('hidden');
    $('talkName').textContent = q.name || '';
    $('talkName').style.display = q.name ? '' : 'none';
    $('talkText').textContent = q.lines[q.i];
    const last = q.i >= q.lines.length - 1;
    if (q.choices && last) {
      $('talkChoices').innerHTML = q.choices.map((c, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-ch="${i}">${esc(c[0])}</button>`).join('');
      $('talkHint').style.display = 'none';
    } else {
      $('talkChoices').innerHTML = '';
      $('talkHint').style.display = '';
      $('talkHint').textContent = last ? 'とじる ▶' : 'つづき ▶';
    }
  },
  advance() {
    const q = this.talkQ;
    if (!q) return;
    if (q.choices && q.i >= q.lines.length - 1) return;
    Sfx.click();
    q.i++;
    if (q.i >= q.lines.length) { this.hideTalk(); if (q.done) q.done(); return; }
    this.showTalk();
  },
  hideTalk() { this.talkQ = null; $('talkWrap').classList.add('hidden'); },
  updateTalkKeys() {
    if (!this.talkQ) return;
    if (Input.hit(' ') || Input.hit('Enter') || Input.hit('e') || Input.hit('j')) {
      const q = this.talkQ;
      if (q.choices && q.i >= q.lines.length - 1) { const ch = q.choices[0]; this.hideTalk(); if (ch[1]) ch[1](); }
      else this.advance();
    }
  },

  /* ------------------------------ パネル ------------------------------ */
  open(kind, title, tabs, tab) {
    this.panel = kind; this.tab = tab; this.sel = null;
    $('panelWrap').classList.remove('hidden');
    $('panelTitle').textContent = title;
    $('panelTabs').innerHTML = tabs.map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('');
    $('panelTabs').style.display = tabs.length ? '' : 'none';
    this.render();
  },
  closePanel() {
    if (!this.panel) return;
    this.panel = null;
    $('panelWrap').classList.add('hidden');
    if (Game.G) Game.save();
  },
  render() {
    for (const b of $('panelTabs').children) b.classList.toggle('on', b.dataset.tab === this.tab);
    const body = $('panelBody');
    if (this.panel === 'bag') body.innerHTML = this.bagHtml();
    else if (this.panel === 'shop') body.innerHTML = this.shopHtml();
    else if (this.panel === 'map') { body.innerHTML = this.mapHtml(); this.drawMap(); }
    else if (this.panel === 'menu') body.innerHTML = this.menuHtml();
    else if (this.panel === 'board') body.innerHTML = this.boardHtml();
    if (this.panel === 'bag' && this.tab === 'gear') this.drawPreview();
  },

  /* ------------------------------ カバン ------------------------------ */
  openBag(tab) {
    if (this.isBusy()) return;
    Sfx.click();
    this.open('bag', '🎒 カバン', [['inv', 'もちもの'], ['craft', 'つくる'], ['gear', 'そうび'], ['magic', 'まほう']], tab || 'inv');
  },
  bagHtml() {
    const G = Game.G;
    if (this.tab === 'inv') {
      const slots = Game.slots();
      let h = `<div class="bagHead"><span>${GEAR[Game.bagId()].icon} ${GEAR[Game.bagId()].name}（${G.inv.length}/${slots} わく・1わく${STACK}こまで）</span><span class="coin">🪙 ${G.coins}</span></div><div class="grid">`;
      for (let i = 0; i < slots; i++) {
        const s = G.inv[i];
        h += s ? `<button class="slot ${this.sel === i ? 'sel' : ''}" data-slot="${i}"><i>${ITEMS[s.id].icon}</i><b>${s.n}</b></button>` : '<div class="slot empty"></div>';
      }
      h += '</div>';
      const s = this.sel !== null ? G.inv[this.sel] : null;
      if (s) {
        const it = ITEMS[s.id];
        h += `<div class="detail"><div class="dname">${it.icon} ${esc(it.name)} ×${s.n}</div><p>${esc(it.desc)}</p><div class="row">`;
        if (it.kind === 'food') h += `<button class="btn primary" data-eat="${s.id}">たべる</button>`;
        h += `<button class="btn ghost" data-toss="${this.sel}">1こ すてる</button><button class="btn ghost" data-tossall="${this.sel}">ぜんぶ すてる</button></div></div>`;
      } else {
        h += `<p class="hint">アイテムをえらぶと、たべたり すてたり できます。${GEAR[Game.bagId()].slots < 32 ? '大きいカバンは「つくる」でつくれます。' : ''}</p>`;
      }
      return h;
    }
    if (this.tab === 'craft') {
      let h = '<p class="hint">集めた材料で つくろう。いつでも どこでも つくれます。</p><div class="list">';
      const rows = RECIPES.map((r) => {
        const gear = GEAR[r.out], item = ITEMS[r.out];
        const owned = gear && G.owned.has(r.out);
        const ok = Game.hasAll(r.need);
        return { r, gear, item, owned, ok };
      });
      rows.sort((a, b) => (a.owned - b.owned) || (b.ok - a.ok));
      for (const { r, gear, item, owned, ok } of rows) {
        const icon = gear ? gear.icon : item.icon, name = gear ? gear.name : item.name + (r.n > 1 ? ` ×${r.n}` : '');
        const need = Object.entries(r.need).map(([k, v]) => {
          const have = Game.count(k);
          return `<span class="${have >= v ? 'ok' : 'ng'}">${ITEMS[k].icon}${esc(ITEMS[k].name)} ${Math.min(have, v)}/${v}</span>`;
        }).join('');
        h += `<div class="card ${owned ? 'done' : ok ? 'ready' : ''}"><div class="cicon">${icon}</div><div class="cmain"><div class="cname">${esc(name)} <small>${this.statText(r.out)}</small></div><div class="need">${need}</div></div>` +
          (owned ? '<span class="tag">もってる</span>' : `<button class="btn ${ok ? 'primary' : 'ghost'}" data-craft="${RECIPES.indexOf(r)}" ${ok ? '' : 'disabled'}>つくる</button>`) + '</div>';
      }
      return h + '</div>';
    }
    if (this.tab === 'gear') {
      const st = `<div class="stats"><div><b>${Game.atk()}</b><span>こうげき</span></div><div><b>${Game.def()}</b><span>まもり</span></div><div><b>${Game.mag()}</b><span>まりょく</span></div><div><b>${Game.maxHp()}</b><span>HP</span></div><div><b>${Game.maxMp()}</b><span>MP</span></div></div>`;
      let h = `<div class="gearTop"><canvas id="preview" width="200" height="200"></canvas>${st}</div>`;
      for (const slot of ['weapon', 'staff', 'body', 'hat', 'bag', 'tool']) {
        const ids = [...G.owned].filter((id) => GEAR[id].slot === slot);
        if (!ids.length && slot !== 'staff') continue;
        h += `<h3>${SLOT_NAMES[slot]}</h3><div class="chips">`;
        if (!ids.length) h += '<span class="hint">まだない（魔法屋で買えるよ）</span>';
        for (const id of ids) {
          const g = GEAR[id];
          const on = G.eq[slot] === id || (slot === 'bag' && Game.bagId() === id) || slot === 'tool';
          const auto = slot === 'bag' || slot === 'tool';
          h += `<button class="chip ${on ? 'on' : ''}" ${auto ? 'disabled' : `data-eq="${id}"`}>${g.icon} ${esc(g.name)} <small>${this.statText(id)}</small></button>`;
        }
        h += '</div>';
      }
      return h + '<p class="hint">カバンとつるはしは、いちばんいいものを自動でつかいます。</p>';
    }
    if (this.tab === 'magic') {
      let h = `<p class="hint">杖をそうびすると 魔法がつかえます（${Input.isTouch ? '✨ ボタン' : 'K キー / 右クリック、Q で切りかえ'}）。いまの まりょく ${Game.mag()}。</p><div class="list">`;
      SPELL_ORDER.forEach((k, i) => {
        const s = SPELLS[k], ok = Game.learned(k);
        h += `<div class="card ${G.spell === k ? 'ready' : ''} ${ok ? '' : 'locked'}"><div class="cicon">${ok ? s.icon : '❔'}</div><div class="cmain"><div class="cname">${ok ? esc(s.name) : '？？？'} <small>MP ${s.mp}${Input.isTouch ? '' : ` ・ ${i + 1}キー`}</small></div><div class="need">${ok ? esc(s.desc) : esc(s.book ? BOOKS[s.book].name + 'で おぼえる' : '')}</div></div>` +
          (ok ? `<button class="btn ${G.spell === k ? 'primary' : 'ghost'}" data-spell="${k}">${G.spell === k ? 'えらんでいる' : 'えらぶ'}</button>` : '') + '</div>';
      });
      h += '</div><h3>魔法の本</h3><div class="chips">';
      for (const b in BOOKS) h += `<span class="chip ${G.books[b] ? 'on' : 'off'}">${G.books[b] ? BOOKS[b].icon + ' ' + BOOKS[b].name : '❔ ？？？'}</span>`;
      return h + '</div>';
    }
    return '';
  },
  statText(id) {
    const g = GEAR[id];
    if (!g) { const it = ITEMS[id]; return it && it.heal ? `HP+${it.heal}` : it && it.mp ? `MP+${it.mp}` : ''; }
    const p = [];
    if (g.atk) p.push(`こうげき${g.atk}`);
    if (g.mag) p.push(`まりょく+${g.mag}`);
    if (g.def) p.push(`まもり+${g.def}`);
    if (g.mp) p.push(`MP+${g.mp}`);
    if (g.warm) p.push('あったか');
    if (g.slots) p.push(`${g.slots}わく`);
    if (g.mine) p.push(g.mine >= 2 ? '水晶もほれる' : '岩と鉄をほれる');
    return p.join(' ');
  },
  drawPreview() {
    const c = $('preview');
    if (!c) return;
    const g = c.getContext('2d'), G = Game.G;
    g.clearRect(0, 0, 200, 200);
    g.fillStyle = '#fff6e0'; g.beginPath(); g.arc(100, 100, 92, 0, TAU); g.fill();
    drawHamster(g, 100, 170, {
      face: 'down', t: R.t, moving: false, body: G.eq.body, hat: G.eq.hat, bag: Game.bagId(), weapon: G.eq.weapon, staff: G.eq.staff,
      swing: -1, roll: -1, cheek: Game.bagFill(), scale: 3.4, aim: 0,
    });
  },

  /* ------------------------------ 店 ------------------------------ */
  openShop(id) {
    if (this.panel) return;
    this.shopId = id;
    Sfx.door();
    this.open('shop', SHOPS[id].name, [['buy', 'かう'], ['sell', 'うる']], 'buy');
  },
  shopHtml() {
    const G = Game.G, sh = SHOPS[this.shopId];
    let h = `<div class="owner"><span class="who">${esc(sh.owner)}</span>「${esc(sh.hello)}」<span class="coin">🪙 ${G.coins}</span></div>`;
    if (this.tab === 'buy') {
      h += '<div class="list">';
      sh.stock.forEach(([kind, id, price, req], i) => {
        if (req && !G.books[req]) return;
        let icon, name, stat, owned = false;
        if (kind === 'item') { icon = ITEMS[id].icon; name = ITEMS[id].name; stat = this.statText(id); }
        else if (kind === 'gear') { icon = GEAR[id].icon; name = GEAR[id].name; stat = this.statText(id); owned = G.owned.has(id); }
        else { icon = BOOKS[id].icon; name = BOOKS[id].name; stat = BOOKS[id].desc; owned = G.books[id]; }
        const can = !owned && G.coins >= price;
        h += `<div class="card ${owned ? 'done' : ''}"><div class="cicon">${icon}</div><div class="cmain"><div class="cname">${esc(name)} <small>${esc(stat)}</small></div><div class="price">🪙 ${price}</div></div>` +
          (owned ? '<span class="tag">もってる</span>' : `<button class="btn ${can ? 'primary' : 'ghost'}" data-buy="${i}" ${can ? '' : 'disabled'}>かう</button>`) + '</div>';
      });
      return h + '</div>';
    }
    const sums = {};
    for (const s of G.inv) sums[s.id] = (sums[s.id] || 0) + s.n;
    const ids = Object.keys(sums);
    h += '<div class="list">';
    if (!ids.length) h += '<p class="hint">売れる物を もっていない。森で集めてこよう！</p>';
    for (const id of ids) {
      const it = ITEMS[id];
      h += `<div class="card"><div class="cicon">${it.icon}</div><div class="cmain"><div class="cname">${esc(it.name)} <small>×${sums[id]}</small></div><div class="price">1こ 🪙 ${it.sell}</div></div>` +
        `<button class="btn" data-sell="${id}">1こ</button><button class="btn primary" data-sellall="${id}">ぜんぶ 🪙${it.sell * sums[id]}</button></div>`;
    }
    const gear = [...G.owned].filter((id) => GEAR[id].sell && !Object.values(G.eq).includes(id) && !['bag', 'tool'].includes(GEAR[id].slot) && id !== 'crown');
    if (gear.length) {
      h += '<h3>つかっていない そうび</h3>';
      for (const id of gear) {
        const g = GEAR[id];
        h += `<div class="card"><div class="cicon">${g.icon}</div><div class="cmain"><div class="cname">${esc(g.name)} <small>${this.statText(id)}</small></div><div class="price">🪙 ${g.sell}</div></div><button class="btn" data-sellgear="${id}">売る</button></div>`;
      }
    }
    return h + '</div>';
  },

  /* ------------------------------ 地図 ------------------------------ */
  openMap(warp) {
    if (this.isBusy()) return;
    Sfx.click();
    this.mapWarp = !!warp;
    this.open('map', '🗺 地図', [], null);
  },
  mapHtml() {
    const G = Game.G;
    if (G.map.kind !== 'over') return `<p class="hint">塔の中では 地図が見られない。いまは ${TOWERS[G.tower.id].name} の ${G.tower.floor}かい（ぜんぶで ${TOWERS[G.tower.id].floors}かい）。</p>`;
    const ws = World.warps.filter((w) => G.flags.warps[w.id]);
    let h = '<div class="mapBox"><canvas id="mapCv"></canvas></div><p class="hint">✦ = 道しるべ（さわるとワープ先になる）・★ = つぎの目的地</p>';
    h += '<h3>ワープ</h3><div class="chips">';
    for (const w of ws) h += `<button class="chip" data-warp="${w.id}">✦ ${esc(w.name)}</button>`;
    return h + '</div>';
  },
  drawMap() {
    const cv = $('mapCv');
    if (!cv) return;
    const G = Game.G, m = World.over;
    const box = cv.parentElement.getBoundingClientRect();
    const sc = Math.max(1, Math.min((box.width - 8) / m.w, window.innerHeight * 0.48 / m.h, 3.2));
    cv.width = Math.round(m.w * sc); cv.height = Math.round(m.h * sc);
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(R.worldMap(m), 0, 0, cv.width, cv.height);
    /* まだ行っていない所は霧でかくす。小さな絵を引きのばして ふちをぼかす */
    const fog = document.createElement('canvas');
    fog.width = CW; fog.height = CH;
    const fg = fog.getContext('2d'), img = fg.createImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) { img.data[i * 4] = 30; img.data[i * 4 + 1] = 24; img.data[i * 4 + 2] = 40; img.data[i * 4 + 3] = G.reveal[i] ? 0 : 240; }
    fg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(fog, 0, 0, cv.width, cv.height);
    const lab = (x, y, s, size = 12) => { g.font = `${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x * sc, y * sc); };
    for (const s of m.structs) {
      if (!G.reveal[Math.floor(s.y / CELL) * CW + Math.floor(s.x / CELL)]) continue;
      if (s.kind === 'tower') lab(s.x + 2, s.y, Game.towerCleared(s.tower) ? '🏁' : '🗼', 16);
      if (s.kind === 'home') lab(s.x + 2, s.y + 1, '🏠', 14);
      if (s.kind === 'warp') { g.fillStyle = G.flags.warps[s.id] ? '#7af0ff' : '#888'; lab(s.x + 0.5, s.y + 0.5, '✦', 12); }
      if (s.kind === 'hut' || s.kind === 'tent') lab(s.x + 1.5, s.y + 1, '⛺', 13);
    }
    g.fillStyle = '#fff'; g.font = 'bold 11px "Hiragino Maru Gothic ProN", sans-serif';
    const name = (x, y, s) => { if (!G.reveal[Math.floor(y / CELL) * CW + Math.floor(x / CELL)]) return; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 3; g.strokeText(s, x * sc, y * sc); g.fillText(s, x * sc, y * sc); };
    name(28, 60, 'ひまわりの森'); name(72, 70, 'ほおぶくろタウン'); name(72, 22, 'かがみ湖'); name(112, 64, 'ゴツゴツ山'); name(141, 90, 'きりの谷'); name(176, 80, '月の野原');
    if (G.target && G.target.map === 'over') { g.fillStyle = '#ffd84a'; lab(G.target.x / TILE, G.target.y / TILE, '★', 16); }
    const px = G.p.x / TILE * sc, py = G.p.y / TILE * sc;
    g.fillStyle = '#ff5a5a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill(); g.stroke();
  },

  /* ------------------------------ メニュー ------------------------------ */
  openMenu() {
    if (this.isBusy()) return;
    Sfx.click();
    this.open('menu', '☰ メニュー', [], null);
  },
  menuHtml() {
    const G = Game.G;
    const keys = Input.isTouch
      ? '<p class="hint">左半分をなぞって歩く。⚔ でたたく・攻撃、✨ で魔法、💨 でころがる、まん中のボタンで話す・しらべる、🌻 で食べる。</p>'
      : '<div class="kgrid"><div><b>WASD / 矢印</b><span>歩く</span></div><div><b>スペース / J / 左クリック</b><span>たたく・攻撃</span></div><div><b>K / 右クリック</b><span>魔法</span></div><div><b>Q / 1〜5</b><span>魔法をえらぶ</span></div><div><b>Shift / L</b><span>ころがる</span></div><div><b>E</b><span>話す・しらべる</span></div><div><b>F</b><span>食べる</span></div><div><b>I / B</b><span>カバン</span></div><div><b>M</b><span>地図</span></div></div>';
    return `<div class="menuBtns"><button class="btn primary" data-menu="close">ゲームにもどる</button>` +
      `<button class="btn" data-menu="sound">音：${Options.sound ? 'オン' : 'オフ'}</button>` +
      `<button class="btn ghost" data-menu="title">セーブしてタイトルへ</button></div>` +
      `<h3>あそびかた</h3>${keys}<p class="hint">プレイ時間 ${Math.floor(G.time / 60)}分 ・ たおした魔物 ${G.kills} ・ セーブは自動で、この端末のブラウザにだけ残ります。</p>`;
  },

  openBoard() {
    if (this.isBusy()) return;
    Sfx.click();
    this.open('board', '📋 けいじばん', [], null);
  },
  boardHtml() {
    const G = Game.G;
    let h = '<p class="hint">町の人の 頼みごと。もちものを集めて、その人に話しかけよう。</p><div class="list">';
    for (const k in REQUESTS) {
      const r = REQUESTS[k], done = G.flags.reqs[k];
      const need = Object.entries(r.need).map(([id, v]) => `<span class="${Game.count(id) >= v ? 'ok' : 'ng'}">${ITEMS[id].icon}${esc(ITEMS[id].name)} ${Math.min(Game.count(id), v)}/${v}</span>`).join('');
      h += `<div class="card ${done ? 'done' : ''}"><div class="cicon">${done ? '✅' : '📌'}</div><div class="cmain"><div class="cname">${esc(r.who)}</div><div class="need">${done ? 'おわった！' : need}</div></div></div>`;
    }
    return h + '</div>';
  },

  /* ------------------------------ クリック ------------------------------ */
  onBody(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const G = Game.G, d = b.dataset;
    if (d.slot !== undefined) { this.sel = this.sel === +d.slot ? null : +d.slot; Sfx.click(); }
    else if (d.eat) { Game.eat(d.eat); if (this.sel !== null && !G.inv[this.sel]) this.sel = null; }
    else if (d.toss !== undefined || d.tossall !== undefined) {
      const s = G.inv[+(d.toss ?? d.tossall)];
      if (s) {
        const n = d.toss !== undefined ? 1 : s.n;
        Game.remove(s.id, n);
        Game.drop(G.p.x, G.p.y + 6, s.id, n, { delay: 2.5 });
        Sfx.click();
        if (!G.inv[this.sel]) this.sel = null;
      }
    }
    else if (d.craft !== undefined) Game.craft(RECIPES[+d.craft]);
    else if (d.eq) Game.equip(d.eq);
    else if (d.spell) Game.selectSpell(d.spell);
    else if (d.buy !== undefined) this.buy(+d.buy);
    else if (d.sell || d.sellall) {
      const id = d.sell || d.sellall, n = d.sell ? 1 : Game.count(id);
      Game.remove(id, n);
      G.coins += ITEMS[id].sell * n; G.earned += ITEMS[id].sell * n;
      Sfx.coin();
    }
    else if (d.sellgear) {
      G.owned.delete(d.sellgear); G.coins += GEAR[d.sellgear].sell; Sfx.coin();
    }
    else if (d.warp) { Game.warpTo(d.warp); return; }
    else if (d.menu) {
      if (d.menu === 'close') { this.closePanel(); return; }
      if (d.menu === 'sound') { Snd.unlock(); Snd.setOn(!Options.sound); }
      if (d.menu === 'title') { this.closePanel(); Game.toTitle(); return; }
    }
    this.render();
    this.refreshHUD();
  },
  buy(i) {
    const G = Game.G, [kind, id, price] = SHOPS[this.shopId].stock[i];
    if (G.coins < price) { Sfx.error(); return; }
    if (kind === 'item') {
      if (Game.add(id, 1) < 1) { toast('カバンがいっぱい！', 'bad'); Sfx.error(); return; }
      toast(`${ITEMS[id].name} を買った`);
    } else if (kind === 'gear') {
      if (G.owned.has(id)) return;
      Game.gainGear(id);
      toast(`${GEAR[id].name} を買った！`, 'good');
    } else {
      if (G.books[id]) return;
      G.coins -= price;
      Sfx.buy();
      this.closePanel();
      Game.gainBook(id);
      return;
    }
    G.coins -= price;
    Sfx.buy();
    Game.refreshObjective();
  },
};
