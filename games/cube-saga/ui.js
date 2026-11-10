/* 画面まわり: HUD・もちもの・クラフト・お店・はなし */
'use strict';
(function () {
  const CS = window.CS;
  const { I, ITEMS, RECIPES } = CS;
  const $ = (id) => document.getElementById(id);

  // ================= もちもの =================
  const Inv = {
    stackOf(id) { return ITEMS[id].stack || 64; },
    add(p, id, n) {
      const st = Inv.stackOf(id);
      for (let pass = 0; pass < 2 && n > 0; pass++) {
        for (let i = 0; i < 36 && n > 0; i++) {
          const s = p.inv[i];
          if (pass === 0 && s && s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; }
          if (pass === 1 && !s) { const k = Math.min(n, st); p.inv[i] = { id, n: k }; n -= k; }
        }
      }
      return n;
    },
    count(p, id) { let c = 0; for (const s of p.inv) if (s && s.id === id) c += s.n; return c; },
    remove(p, id, n) {
      if (Inv.count(p, id) < n) return false;
      for (let i = 35; i >= 0 && n > 0; i--) {
        const s = p.inv[i];
        if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) p.inv[i] = null; }
      }
      return true;
    },
    held(p) { return p.inv[p.sel]; },
    useHeld(p) { const s = p.inv[p.sel]; if (!s) return; s.n--; if (s.n <= 0) p.inv[p.sel] = null; },
  };

  // ================= 小さな絵 (ハート・おなか) =================
  function pixSvg(rows, pal) {
    let r = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[ch]}"/>`; }));
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">${r}</svg>`)}")`;
  }
  const HEART = ['.kk...kk.', 'kAAk.kAAk', 'kAAAkAAAk', 'kAAAAAAAk', '.kAAAAAk.', '..kAAAk..', '...kAk...', '....k....'];
  const HEART_H = ['.kk...kk.', 'kAAk.kBBk', 'kAAAkBBBk', 'kAAAABBBk', '.kAAABBk.', '..kAABk..', '...kAk...', '....k....'];
  const MEAT = ['....kkk..', '...kAAAk.', '..kAAAAAk', '..kAAAAAk', '.kkAAAAk.', 'kWkkkkk..', 'kWk......', '.k.......'];
  const MEAT_H = ['....kkk..', '...kBBBk.', '..kABBBBk', '..kAABBBk', '.kkAABBk.', 'kWkkkkk..', 'kWk......', '.k.......'];
  const IC = {
    heart: pixSvg(HEART, { k: '#200', A: '#e83040' }),
    heartH: pixSvg(HEART_H, { k: '#200', A: '#e83040', B: '#3a1a1e' }),
    heartE: pixSvg(HEART, { k: '#200', A: '#3a1a1e' }),
    meat: pixSvg(MEAT, { k: '#210', A: '#c07030', W: '#eee' }),
    meatH: pixSvg(MEAT_H, { k: '#210', A: '#c07030', B: '#3a2618', W: '#eee' }),
    meatE: pixSvg(MEAT, { k: '#210', A: '#3a2618', W: '#777' }),
  };

  // ================= 画面の切りかえ =================
  const SCREENS = ['title', 'worlds', 'skin', 'help', 'pause', 'panel', 'dead', 'loading', 'noGL'];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
  function hideAll() { for (const s of SCREENS) $(s).classList.add('hidden'); }

  let toastT = [];
  function toast(msg, ms) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    toastT.push(setTimeout(() => el.remove(), ms || 3200));
  }
  let bannerT = 0;
  function banner(title, sub) {
    const b = $('banner');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(title));
    if (sub) { const s = document.createElement('small'); s.textContent = sub; b.appendChild(s); }
    b.classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => b.classList.remove('show'), 2600);
  }

  // ================= HUD =================
  function slotEl(cls) { const d = document.createElement('div'); d.className = 'slot ' + (cls || ''); d.innerHTML = '<span class="n"></span>'; return d; }
  function paintSlot(el, s, size) {
    CS.iconCss(el, s ? s.id : -1, size || 40);
    el.querySelector('.n').textContent = s && s.n > 1 ? s.n : '';
    el.title = s ? ITEMS[s.id].name : '';
  }
  const hot = [];
  function buildHud() {
    const hb = $('hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const d = slotEl(); const k = document.createElement('span'); k.className = 'k'; k.textContent = i + 1; d.appendChild(k);
      d.dataset.i = i; hb.appendChild(d); hot.push(d);
    }
    for (let i = 0; i < 10; i++) { const h = document.createElement('i'); h.className = 'ic'; $('hearts').appendChild(h); const f = document.createElement('i'); f.className = 'ic'; $('food').appendChild(f); }
  }
  let lastHud = '';
  function updateHud(G) {
    const p = G.player;
    const sig = JSON.stringify([p.inv.slice(0, 9), p.sel, Math.ceil(p.hp), Math.ceil(p.food), Math.floor(p.mp), p.maxMp, p.coins, G.creative]);
    if (sig === lastHud) return;
    lastHud = sig;
    const s = Math.min(44, hot[0].clientWidth || 44) - 4;
    for (let i = 0; i < 9; i++) { paintSlot(hot[i], p.inv[i], s); hot[i].classList.toggle('sel', i === p.sel); }
    const held = p.inv[p.sel];
    $('selName').textContent = held ? ITEMS[held.id].name : '';
    const hand = $('hand');
    if (held) { CS.iconCss(hand, held.id, hand.clientWidth || 160); hand.style.display = ''; } else hand.style.display = 'none';
    $('stats').style.visibility = G.creative ? 'hidden' : '';
    const hs = $('hearts').children, fs = $('food').children;
    for (let i = 0; i < 10; i++) {
      const hv = p.hp - i * 2, fv = p.food - i * 2;
      hs[i].style.backgroundImage = hv >= 2 ? IC.heart : hv >= 1 ? IC.heartH : IC.heartE;
      fs[9 - i].style.backgroundImage = fv >= 2 ? IC.meat : fv >= 1 ? IC.meatH : IC.meatE;
    }
    $('mpBar').style.width = (p.mp / p.maxMp * 100) + '%';
    $('mpText').textContent = 'MP ' + Math.floor(p.mp) + '/' + p.maxMp;
    $('coins').textContent = p.coins + ' コイン';
  }
  function swingHand() { const h = $('hand'); h.classList.remove('swing'); void h.offsetWidth; h.classList.add('swing'); }

  // ================= パネル (もちもの・お店・はなし) =================
  const panel = $('panel');
  let panelClose = null;
  function openPanel(html, onClose) {
    panel.innerHTML = `<div class="card">${html}</div>`;
    show('panel');
    panelClose = onClose || null;
  }
  function closePanel() {
    if ($('panel').classList.contains('hidden')) return false;
    $('panel').classList.add('hidden');
    const f = panelClose; panelClose = null;
    if (f) f();
    return true;
  }
  const isPanelOpen = () => !$('panel').classList.contains('hidden');
  const icon = (id, cls) => `<div class="${cls || 'ri'}" data-icon="${id}"></div>`;
  function paintIcons(root) { root.querySelectorAll('[data-icon]').forEach((el) => CS.iconCss(el, +el.dataset.icon, el.clientWidth || 32)); }

  // ---------- もちもの + クラフト (サバイバル) ----------
  const cursor = $('cursorItem');
  cursor.innerHTML = '<span class="n"></span>';
  window.addEventListener('pointermove', (e) => { cursor.style.left = (e.clientX - 20) + 'px'; cursor.style.top = (e.clientY - 20) + 'px'; });
  function paintCursor(G) {
    const c = G.cursor;
    cursor.style.display = c ? 'block' : 'none';
    if (c) { CS.iconCss(cursor, c.id, 40); cursor.querySelector('.n').textContent = c.n > 1 ? c.n : ''; }
  }
  function canCraft(p, r, st) {
    if (r.at && !st[r.at]) return false;
    return r.ins.every(([id, n]) => Inv.count(p, id) >= n);
  }
  function openInventory(G) {
    if (G.creative) return openCreative(G);
    const p = G.player;
    let filter = 'can';
    const st = G.nearStations();
    const html = `
<div class="cHead"><b>もちもの と クラフト</b><span class="sp"></span><button class="btn" data-x="close">とじる (E)</button></div>
<div class="pGrid">
  <div>
    <div class="pTitle">もちもの <small>(クリックで もつ・おく / みぎクリックで はんぶん)</small></div>
    <div class="invGrid" id="invMain"></div>
    <div class="invGrid hot" id="invHot"></div>
  </div>
  <div>
    <div class="station">さぎょうだい: <b class="${st.table ? 'yes' : ''}">${st.table ? 'ちかくに ある' : 'ない'}</b>　かまど: <b class="${st.furnace ? 'yes' : ''}">${st.furnace ? 'ちかくに ある' : 'ない'}</b></div>
    <div class="tabs"><button class="tab on" data-f="can">つくれる もの</button><button class="tab" data-f="all">ぜんぶ</button></div>
    <div class="recList" id="recList"></div>
  </div>
</div>`;
    openPanel(html, () => {
      if (G.cursor) { const left = Inv.add(p, G.cursor.id, G.cursor.n); if (left) G.dropItem(G.cursor.id, left); G.cursor = null; paintCursor(G); }
      G.closeUi();
    });
    const main = $('invMain'), hb = $('invHot');
    const els = [];
    for (let i = 9; i < 36; i++) { const d = slotEl(); d.dataset.i = i; main.appendChild(d); els[i] = d; }
    for (let i = 0; i < 9; i++) { const d = slotEl(); d.dataset.i = i; hb.appendChild(d); els[i] = d; }
    function paint() {
      for (let i = 0; i < 36; i++) { paintSlot(els[i], p.inv[i], (els[i].clientWidth || 44) - 4); els[i].classList.toggle('sel', i === p.sel); }
      paintCursor(G);
      const list = $('recList');
      const rows = [];
      const seen = new Set();
      RECIPES.forEach((r, ri) => {
        const ok = canCraft(p, r, st);
        if (filter === 'can' && !ok) return;
        const key = r.out + ':' + r.ins.map((x) => x.join('x')).join(',');
        if (seen.has(key)) return; seen.add(key);
        const ins = r.ins.map(([id, n]) => `<span class="${Inv.count(p, id) >= n ? '' : 'lack'}">${icon(id, 'mini')}×${n}</span>`).join('');
        const at = r.at === 'table' ? '<span>[さぎょうだい]</span>' : r.at === 'furnace' ? '<span>[かまど]</span>' : '';
        rows.push(`<div class="rec ${ok ? '' : 'no'}">${icon(r.out)}<div class="rn">${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}<small>${ins}${at}</small></div><button class="btn small ok" data-r="${ri}" ${ok ? '' : 'disabled'}>つくる</button></div>`);
      });
      list.innerHTML = rows.join('') || '<div class="empty">いま つくれる ものは ないよ。きを きって いたざいを つくろう。</div>';
      paintIcons(list);
    }
    function clickSlot(i, right, shift) {
      const s = p.inv[i];
      if (shift && s) {
        const range = i < 9 ? [9, 36] : [0, 9];
        p.inv[i] = null;
        let n = s.n;
        const stk = Inv.stackOf(s.id);
        for (let k = range[0]; k < range[1] && n > 0; k++) { const t = p.inv[k]; if (t && t.id === s.id && t.n < stk) { const m = Math.min(n, stk - t.n); t.n += m; n -= m; } }
        for (let k = range[0]; k < range[1] && n > 0; k++) if (!p.inv[k]) { p.inv[k] = { id: s.id, n }; n = 0; }
        if (n > 0) p.inv[i] = { id: s.id, n };
        return;
      }
      const c = G.cursor;
      if (right) {
        if (!c && s) { const h = Math.ceil(s.n / 2); G.cursor = { id: s.id, n: h }; s.n -= h; if (!s.n) p.inv[i] = null; }
        else if (c && (!s || (s.id === c.id && s.n < Inv.stackOf(s.id)))) { if (!s) p.inv[i] = { id: c.id, n: 1 }; else s.n++; c.n--; if (!c.n) G.cursor = null; }
        return;
      }
      if (!c) { if (s) { G.cursor = s; p.inv[i] = null; } }
      else if (!s) { p.inv[i] = c; G.cursor = null; }
      else if (s.id === c.id) { const stk = Inv.stackOf(s.id); const m = Math.min(c.n, stk - s.n); s.n += m; c.n -= m; if (!c.n) G.cursor = null; }
      else { p.inv[i] = c; G.cursor = s; }
    }
    panel.onclick = (e) => {
      const t = e.target.closest('[data-i],[data-r],[data-f],[data-x]');
      if (!t) return;
      if (t.dataset.x === 'close') { closePanel(); return; }
      if (t.dataset.f) { filter = t.dataset.f; panel.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.f === filter)); }
      else if (t.dataset.i !== undefined) clickSlot(+t.dataset.i, false, e.shiftKey);
      else if (t.dataset.r !== undefined) {
        const r = RECIPES[+t.dataset.r];
        if (canCraft(p, r, st)) {
          r.ins.forEach(([id, n]) => Inv.remove(p, id, n));
          const left = Inv.add(p, r.out, r.n);
          if (left) G.dropItem(r.out, left);
          CS.sfx.pop();
          G.onCraft(r.out);
        }
      }
      paint();
    };
    panel.oncontextmenu = (e) => {
      e.preventDefault();
      const t = e.target.closest('[data-i]');
      if (t) { clickSlot(+t.dataset.i, true); paint(); }
    };
    paint();
  }

  // ---------- クリエイティブ ----------
  const CR_TABS = {
    blocks: { name: 'ブロック', ids: () => ITEMS.filter((d) => d && d.block !== undefined && d.id !== 0 && d.key !== 'pedestal').map((d) => d.id) },
    tools: { name: 'どうぐ・まほう', ids: () => ITEMS.filter((d) => d && (d.tool !== undefined || d.kind || d.wand || ['bow', 'arrow', 'net'].includes(d.key))).map((d) => d.id) },
    other: { name: 'そのほか', ids: () => ITEMS.filter((d) => d && d.id >= 256 && !(d.tool !== undefined || d.kind || d.wand || ['bow', 'arrow', 'net'].includes(d.key))).map((d) => d.id) },
  };
  function openCreative(G) {
    const p = G.player;
    let tab = 'blocks';
    openPanel(`
<div class="cHead"><b>クリエイティブ</b><span class="sp"></span><button class="btn" data-x="close">とじる (E)</button></div>
<div class="tabs" id="crTabs">${Object.entries(CR_TABS).map(([k, v]) => `<button class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${v.name}</button>`).join('')}</div>
<div class="pTitle">クリックすると えらんでいる わくに はいるよ</div>
<div class="crGrid" id="crGrid"></div>
<div class="invGrid hot" id="crHot"></div>
<button class="btn small bad" data-x="clear">えらんでいる わくを からにする</button>`, () => G.closeUi());
    function paint() {
      const grid = $('crGrid');
      grid.innerHTML = '';
      for (const id of CR_TABS[tab].ids()) { const d = slotEl(); d.dataset.c = id; grid.appendChild(d); paintSlot(d, { id, n: 1 }, 40); }
      const hb = $('crHot'); hb.innerHTML = '';
      for (let i = 0; i < 9; i++) { const d = slotEl(i === p.sel ? 'sel' : ''); d.dataset.h = i; hb.appendChild(d); paintSlot(d, p.inv[i], 40); }
    }
    panel.onclick = (e) => {
      const t = e.target.closest('[data-c],[data-h],[data-t],[data-x]');
      if (!t) return;
      if (t.dataset.x === 'close') return closePanel();
      if (t.dataset.x === 'clear') p.inv[p.sel] = null;
      if (t.dataset.t) { tab = t.dataset.t; panel.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === tab)); }
      if (t.dataset.c) { const id = +t.dataset.c; p.inv[p.sel] = { id, n: Inv.stackOf(id) }; if (p.sel < 8) p.sel++; CS.sfx.pop(); }
      if (t.dataset.h) p.sel = +t.dataset.h;
      paint();
    };
    panel.oncontextmenu = (e) => e.preventDefault();
    paint();
  }

  // ---------- はなし ----------
  // lines: 文字列の配列, buttons: [{label, fn, ok}]
  function talk(G, who, lines, buttons) {
    const btns = (buttons && buttons.length ? buttons : [{ label: 'わかった', ok: true }]);
    openPanel(`
<div class="talk"><div style="flex:1"><div class="who">${who}</div>${lines.map((l) => `<p>${l}</p>`).join('')}</div></div>
<div class="col" style="margin-top:10px">${btns.map((b, i) => `<button class="btn ${b.ok ? 'ok' : ''}" data-b="${i}">${b.label}</button>`).join('')}</div>`, () => G.closeUi());
    panel.onclick = (e) => {
      const t = e.target.closest('[data-b]');
      if (!t) return;
      const b = btns[+t.dataset.b];
      CS.sfx.click();
      if (b.fn) b.fn(); else closePanel();
    };
    panel.oncontextmenu = (e) => e.preventDefault();
  }

  // ---------- お店 ----------
  const SHOPS = {
    shop: {
      name: 'どうぐや', hello: 'いらっしゃい！ ぼうけんの どうぐは ここで そろうよ。こうせきや にくも かいとるよ。',
      buy: [['bread', 1, 5], ['apple', 2, 4], ['cookedMeat', 2, 12], ['torch', 8, 10], ['stone_pick', 1, 15], ['stone_sword', 1, 15], ['iron_pick', 1, 60], ['iron_sword', 1, 60], ['iron_axe', 1, 50], ['iron_shovel', 1, 30], ['bow', 1, 40], ['arrow', 16, 15], ['net', 1, 30], ['log', 16, 12], ['cobble', 32, 10], ['glass', 8, 12], ['table', 1, 5], ['furnace', 1, 10]],
      sells: true,
    },
    mage: {
      name: 'まほうつかい', hello: 'ふぉっふぉっ。まほうのつえが ほしいかね？ ちかの ふかくで ひかる「まほうのこうせき」を ほれば、じぶんでも つくれるぞい。',
      buy: [['crystal', 1, 40], ['lamp', 4, 30], ['wand_fire', 1, 120], ['wand_ice', 1, 120], ['wand_heal', 1, 150], ['wand_blast', 1, 200], ['wand_warp', 1, 250], ['wand_thunder', 1, 300]],
      sells: false,
    },
  };
  function openShop(G, kind) {
    const p = G.player, S = SHOPS[kind];
    let tab = 'buy';
    openPanel(`
<div class="cHead"><b>${S.name}</b><span class="sp"></span><span id="shCoins"></span><button class="btn" data-x="close">とじる</button></div>
<p style="margin:0 0 10px">${S.hello}</p>
<div class="tabs"><button class="tab on" data-t="buy">かう</button>${S.sells ? '<button class="tab" data-t="sell">うる</button>' : ''}</div>
<div class="shopList" id="shList"></div>`, () => G.closeUi());
    function paint() {
      $('shCoins').textContent = p.coins + ' コイン';
      const list = $('shList');
      if (tab === 'buy') {
        list.innerHTML = S.buy.map(([k, n, price], i) => `<div class="shopRow">${icon(I[k])}<div class="nm">${ITEMS[I[k]].name}${n > 1 ? ' ×' + n : ''}</div><span class="pr">${price} コイン</span><button class="btn small ok" data-buy="${i}" ${p.coins >= price ? '' : 'disabled'}>かう</button></div>`).join('');
      } else {
        const ids = [...new Set(p.inv.filter((s) => s && ITEMS[s.id].sell > 0).map((s) => s.id))];
        list.innerHTML = ids.map((id) => `<div class="shopRow">${icon(id)}<div class="nm">${ITEMS[id].name} <small>(${Inv.count(p, id)}こ)</small></div><span class="pr">1こ ${ITEMS[id].sell} コイン</span><button class="btn small" data-sell="${id}" data-all="0">1こ うる</button><button class="btn small ok" data-sell="${id}" data-all="1">ぜんぶ</button></div>`).join('') || '<div class="empty">うれる ものを もっていないよ。こうせきや にく、てんくうりゅうの ウロコを もってきてね。</div>';
      }
      paintIcons(list);
    }
    panel.onclick = (e) => {
      const t = e.target.closest('[data-buy],[data-sell],[data-t],[data-x]');
      if (!t) return;
      if (t.dataset.x === 'close') return closePanel();
      if (t.dataset.t) { tab = t.dataset.t; panel.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === tab)); }
      if (t.dataset.buy !== undefined) {
        const [k, n, price] = S.buy[+t.dataset.buy];
        if (p.coins >= price) { p.coins -= price; const left = Inv.add(p, I[k], n); if (left) G.dropItem(I[k], left); CS.sfx.coin(); }
      }
      if (t.dataset.sell !== undefined) {
        const id = +t.dataset.sell, n = t.dataset.all === '1' ? Inv.count(p, id) : 1;
        if (Inv.remove(p, id, n)) { p.coins += ITEMS[id].sell * n; CS.sfx.coin(); }
      }
      paint();
    };
    panel.oncontextmenu = (e) => e.preventDefault();
    paint();
  }

  // ---------- 博物館 ----------
  function openMuseum(G) {
    const p = G.player, ex = p.exhibits;
    let tab = 'sell';
    openPanel(`
<div class="cHead"><b>はくぶつかん</b><span class="sp"></span><span id="muCoins"></span><button class="btn" data-x="close">とじる</button></div>
<p style="margin:0 0 10px">こだいの せかいの かせきや、つかまえた いきものを かいとるよ。はじめて もってきた ものは <b>2ばいの ねだん</b> で かって、はくぶつかんに かざるからね！</p>
<div class="tabs"><button class="tab on" data-t="sell">うる</button><button class="tab" data-t="book">ずかん</button></div>
<div class="shopList" id="muList"></div>`, () => G.closeUi());
    function sellable() {
      return [...new Set(p.inv.filter((s) => s && (ITEMS[s.id].fossil || ITEMS[s.id].cage)).map((s) => s.id))];
    }
    function isNew(id) { const d = ITEMS[id]; return d.cage ? !ex.species[d.cage] : !ex.fossils[d.fossil]; }
    function paint() {
      $('muCoins').textContent = p.coins + ' コイン';
      const list = $('muList');
      if (tab === 'sell') {
        list.innerHTML = sellable().map((id) => {
          const d = ITEMS[id], price = d.price * (isNew(id) ? 2 : 1);
          return `<div class="shopRow">${icon(id)}<div class="nm">${d.name} <small>(${Inv.count(p, id)}こ)</small>${isNew(id) ? ' <b style="color:#7aff9a">はじめて！</b>' : ''}</div><span class="pr">${price} コイン</span><button class="btn small ok" data-sell="${id}">うる</button></div>`;
        }).join('') || '<div class="empty">かせきも いきものも もっていないよ。おうこくの こだいのゲートから こだいの せかいへ いってみよう。</div>';
      } else {
        const got = (k, f) => (f ? ex.fossils[k] : ex.species[k]);
        list.innerHTML = '<div class="book">' + CS.SPECIES.map((s) => `<div class="${got(s.key) ? 'got' : ''}">${icon(s.item)}${got(s.key) ? s.name : '？？？'}<br><small>${s.price} コイン</small></div>`).join('') +
          CS.FOSSILS.map((f) => `<div class="${got(f.key, 1) ? 'got' : ''}">${icon(f.item)}${got(f.key, 1) ? f.name : '？？？'}<br><small>${f.price} コイン</small></div>`).join('') + '</div>' +
          `<p class="pTitle">かざった かず: ${Object.keys(ex.species).length + Object.keys(ex.fossils).length} / ${CS.SPECIES.length + CS.FOSSILS.length}</p>`;
      }
      paintIcons(list);
    }
    panel.onclick = (e) => {
      const t = e.target.closest('[data-sell],[data-t],[data-x]');
      if (!t) return;
      if (t.dataset.x === 'close') return closePanel();
      if (t.dataset.t) { tab = t.dataset.t; panel.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === tab)); }
      if (t.dataset.sell !== undefined) {
        const id = +t.dataset.sell, d = ITEMS[id], first = isNew(id);
        if (Inv.remove(p, id, 1)) {
          p.coins += d.price * (first ? 2 : 1);
          if (first) {
            if (d.cage) ex.species[d.cage] = 1; else ex.fossils[d.fossil] = 1;
            CS.sfx.fanfare();
            toast(`${d.name.replace('のおり', '')} を はくぶつかんに かざったよ！`);
            G.refreshExhibits();
          } else CS.sfx.coin();
        }
      }
      paint();
    };
    panel.oncontextmenu = (e) => e.preventDefault();
    paint();
  }

  // ================= ワールド一覧 =================
  function renderWorlds(list, onPlay, onDelete) {
    const box = $('wList');
    if (!list.length) { box.innerHTML = '<div class="empty">まだ ワールドが ないよ。したで つくろう！</div>'; return; }
    box.innerHTML = '';
    for (const m of list) {
      const d = document.createElement('div');
      d.className = 'wItem';
      const date = new Date(m.played || m.created);
      d.innerHTML = `<div class="wInfo"><b></b><small><span class="tag ${m.mode === 'creative' ? 'cr' : ''}">${m.mode === 'creative' ? 'クリエイティブ' : 'サバイバル'}</span>${date.getMonth() + 1}/${date.getDate()} にあそんだ</small></div><button class="btn small bad" data-del>けす</button><button class="btn ok" data-play>あそぶ</button>`;
      d.querySelector('b').textContent = m.name;
      d.querySelector('[data-play]').onclick = () => onPlay(m);
      d.querySelector('[data-del]').onclick = () => { if (confirm(`「${m.name}」を けしても いい？ もとに もどせないよ。`)) onDelete(m); };
      box.appendChild(d);
    }
  }

  CS.UI = { $, show, hideAll, toast, banner, buildHud, updateHud, swingHand, openInventory, talk, openShop, openMuseum, closePanel, isPanelOpen, renderWorlds, paintCursor, resetHud() { lastHud = ''; } };
  CS.Inv = Inv;
})();
