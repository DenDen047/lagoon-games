/* MOD の しくみ: MOD の とうろく・ワールドごとの オン/オフ・ブロックの フック・MOD の がめん */
'use strict';
(function () {
  const CS = window.CS;
  const { BLOCKS, ITEMS, I, RECIPES, Reg, UI } = CS;
  const $ = UI.$;
  const B0 = 128, B1 = 255;      // MOD の ブロックの ばんごう
  const I0 = 1024, I1 = 4095;    // MOD の アイテムの ばんごう
  const DIRS = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]; // render.js の FACES と おなじ じゅん
  const USER_KEY = 'cubesaga.usermods';
  const LIST_KEY = 'cubesaga.worlds';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================= MOD の とうろく =================
  const registry = new Map(); // id -> { def, source: 'bundled' | 'user' }
  let loadingUser = null;
  CS.mod = function (def) {
    const ok = def && typeof def.id === 'string' && /^[a-z0-9_-]{1,32}$/i.test(def.id) && typeof def.setup === 'function';
    if (!ok) { console.warn('CS.mod: id (えいすうじ) と setup が ひつようです', def); if (loadingUser) loadingUser.err = 'CS.mod に id と setup が ありません'; return; }
    const source = loadingUser ? 'user' : 'bundled';
    const had = registry.get(def.id);
    if (had && had.source === 'bundled' && source === 'user') { if (loadingUser) loadingUser.err = `「${def.id}」は はじめから ある MOD と おなじ なまえです`; return; }
    registry.set(def.id, { def, source });
    if (loadingUser) loadingUser.ids.push(def.id);
  };
  // ゲームに ついてくる MOD (mods/list.js に かいたもの)
  const ready = Promise.all((CS.MOD_LIST || []).map((id) => new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'mods/' + id + '.js';
    s.onload = res;
    s.onerror = () => { console.warn('MOD が よみこめません: ' + id); res(); };
    document.head.appendChild(s);
  })));
  // じぶんで いれた MOD (localStorage に コードごと しまってある)
  const userMods = () => CS.store.get(USER_KEY, []);
  function runUser(code) {
    const ctx = { ids: [], err: null };
    loadingUser = ctx;
    try { (new Function('CS', code))(CS); } catch (e) { ctx.err = String((e && e.message) || e); }
    loadingUser = null;
    if (!ctx.err && !ctx.ids.length) ctx.err = 'CS.mod({ ... }) が よばれていません';
    return ctx;
  }
  const userErr = {};
  for (const um of userMods()) { const r = runUser(um.code); if (r.err) userErr[um.id] = r.err; }

  // ================= いま うごいている MOD =================
  const A = { mods: [], hooks: { tick: [], frame: [], draw: [], load: [] }, help: [], shops: [], tick: 0, acc: 0, data: null, errs: new Set() };
  const posOf = (w, i) => [i % w.W, Math.floor(i / (w.W * w.D)), Math.floor(i / w.W) % w.D]; // [x, y, z]

  // MOD の エラーで ゲームが とまらないように する
  function report(modId, e) {
    console.error('MOD「' + modId + '」の エラー', e);
    if (!A.errs.has(modId)) { A.errs.add(modId); UI.toast(`MOD「${modId}」で エラーが おきた (くわしくは コンソール)`, 4000); }
  }
  function call(def, name, ...args) {
    try { return def[name](...args); } catch (e) { report(def.mod || '?', e); return undefined; }
  }

  // すべての MOD の ものを とりのぞいて、もとの ゲームに もどす
  function reset() {
    for (let id = B0; id <= B1; id++) { if (!BLOCKS[id].ph) Reg.phBlock(id); if (!ITEMS[id] || !ITEMS[id].ph) Reg.phItem(id); }
    for (let id = I0; id < ITEMS.length; id++) if (ITEMS[id] && !ITEMS[id].ph) Reg.phItem(id);
    for (const k of Object.keys(I)) if (k.includes(':')) delete I[k];
    RECIPES.length = Reg.CORE_RECIPES;
    for (const [list, entry] of A.shops) { const k = list.indexOf(entry); if (k >= 0) list.splice(k, 1); }
    Reg.reset();
    A.mods = []; A.shops = []; A.help = []; A.errs = new Set();
    for (const k in A.hooks) A.hooks[k] = [];
    const h = $('modHelp'); if (h) h.innerHTML = '';
  }

  // ================= MOD に わたす 道具 (api) =================
  function makeApi(modId, data) {
    const ns = (k) => modId + ':' + k;
    const tiles = {};
    const api = {
      CS, DIRS, modId,
      get G() { return CS.G; },
      // 16×16 の テクスチャ。fn(x, y, rand) → [r, g, b, (a)] か null (すきま)
      tile(name, fn) {
        if (tiles[name] !== undefined) return tiles[name];
        const t = Reg.addTile(fn);
        if (t < 0) throw new Error('テクスチャの ばしょが たりない (あと ' + Reg.free().tiles + ' まい)');
        return (tiles[name] = t);
      },
      block(key, o) {
        const full = ns(key);
        let id = data.modIds[full];
        if (id === undefined) {
          const used = new Set(Object.values(data.modIds));
          for (let k = B0; k <= B1; k++) if (!used.has(k)) { id = k; break; }
          if (id === undefined) throw new Error('ブロックの ばんごうが たりない (128〜255 が いっぱい)');
          data.modIds[full] = id;
        }
        if (!BLOCKS[id].ph) throw new Error('ブロックの ばんごうが かさなった: ' + full);
        const made = new Map();
        const tt = (v) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'function') { if (!made.has(v)) made.set(v, api.tile(full + '#' + made.size, v)); return made.get(v); }
          return CS.TILE.modMissing;
        };
        const tex = o.tex;
        let tx;
        if (tex && typeof tex === 'object') {
          const side = tex.side !== undefined ? tex.side : tex.top;
          tx = { top: tt(tex.top !== undefined ? tex.top : side), bottom: tt(tex.bottom !== undefined ? tex.bottom : (tex.top !== undefined ? tex.top : side)), side: tt(side) };
        } else { const t = tt(tex); tx = { top: t, bottom: t, side: t }; }
        const def = Object.assign({ hard: 1, solid: true, render: 'cube' }, o, { id, key: full, tx, mod: modId });
        if (def.opaque === undefined) def.opaque = def.render === 'cube';
        if (typeof def.drop === 'string' && (I[ns(def.drop)] !== undefined || I[def.drop] === undefined)) def.drop = ns(def.drop);
        if (typeof def.flatIcon === 'function') def.flatIcon = tt(def.flatIcon);
        BLOCKS[id] = def;
        Reg.setTables(id);
        I[full] = id;
        const item = { id, key: full, name: def.name || key, block: id, stack: 64, mod: modId, hidden: !!o.hidden, sell: o.sell };
        ITEMS[id] = item;
        if (o.hidden) item.icon = Reg.PH_ICON;
        else if (Reg.addIcon(item) < 0) throw new Error('アイコンの ばしょが たりない');
        return id;
      },
      // o.icon: fn(x, y) → [r, g, b, (a)] か null。ほかは ITEMS と おなじ (name, stack, sell, food, tool, tier, dmg …)
      item(key, o) {
        const full = ns(key);
        let id = data.modItems[full];
        if (id === undefined) {
          const used = new Set(Object.values(data.modItems));
          for (let k = I0; k <= I1; k++) if (!used.has(k)) { id = k; break; }
          if (id === undefined) throw new Error('アイテムの ばんごうが たりない');
          data.modItems[full] = id;
        }
        const def = Object.assign({ stack: 64 }, o, { id, key: full, mod: modId, iconFn: o.icon });
        delete def.icon;
        ITEMS[id] = def;
        I[full] = id;
        if (Reg.addIcon(def) < 0) throw new Error('アイコンの ばしょが たりない');
        return id;
      },
      // MOD の なかの なまえ → ばんごう (じぶんの MOD → もとの ゲーム の じゅんに さがす)
      id(key) { if (typeof key === 'number') return key; const k = I[ns(key)]; return k !== undefined ? k : I[key]; },
      recipe(out, n, ins, at) {
        const need = (k) => { const v = api.id(k); if (v === undefined) throw new Error('レシピの ざいりょうが ない: ' + k); return v; };
        RECIPES.push({ out: need(out), n, ins: ins.map(([k, c]) => [need(k), c]), at: at || null, mod: modId });
      },
      // お店に ならべる (shop: 'shop' どうぐや / 'mage' まほうつかい)
      shop(shop, key, n, price) {
        const S = UI.SHOPS[shop];
        if (!S) throw new Error('お店が ない: ' + shop);
        const full = I[ns(key)] !== undefined ? ns(key) : key;
        const entry = [full, n, price];
        S.buy.push(entry); A.shops.push([S.buy, entry]);
      },
      onTick(fn) { A.hooks.tick.push(wrap(fn)); },   // 1びょうに 20かい: fn(world, tickNo)
      onFrame(fn) { A.hooks.frame.push(wrap(fn)); }, // まいフレーム: fn(world, dt)
      onDraw(fn) { A.hooks.draw.push(wrap(fn)); },   // まいフレーム かく: fn(ren, world, now)
      onLoad(fn) { A.hooks.load.push(wrap(fn)); },   // ワールドを よみこんだ とき: fn(world)
      help(html) { A.help.push({ name: registry.get(modId).def.name || modId, html }); },
      // ブロックの じょうたい (セーブされる。JSON に できる ものだけ いれる)
      state(w, x, y, z) { return w.st.get(w.idx(x, y, z)); },
      setState(w, x, y, z, s) { const i = w.idx(x, y, z); if (s == null) w.st.delete(i); else w.st.set(i, s); },
      // ticks あとに その ブロックの onTick を よぶ
      schedule(w, x, y, z, ticks) { const i = w.idx(x, y, z), due = A.tick + Math.max(1, ticks | 0), old = w.modSched.get(i); if (old === undefined || old > due) w.modSched.set(i, due); },
      redraw(w, x, y, z) { w.markDirty(x - 1, z - 1, x + 1, z + 1); },
      blocks(w) { return w.modIdx; },
      pos: posOf,
      now() { return A.tick + A.acc / 0.05; },
      tickNo() { return A.tick; },
      // プレイヤーが みている むき (DIRS の ばんごう)。vertical: 上下も えらぶ
      facing(p, vertical) {
        if (vertical && Math.abs(p.pitch) > 0.75) return p.pitch > 0 ? 4 : 5;
        const dx = Math.sin(p.yaw), dz = -Math.cos(p.yaw);
        return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 2 : 3) : (dz > 0 ? 0 : 1);
      },
      toast: (m, ms) => UI.toast(m, ms),
      sfx: (name) => { if (CS.sfx[name]) CS.sfx[name](); },
      drop: (id, n, x, y, z) => CS.G.dropItem(api.id(id), n, x, y, z),
      inv: CS.Inv,
    };
    function wrap(fn) { return (...a) => { try { return fn(...a); } catch (e) { report(modId, e); } }; }
    return api;
  }

  // ================= ワールドに はいる・でる =================
  async function activate(meta, data) {
    await ready;
    reset();
    data.modIds = data.modIds || {};
    data.modItems = data.modItems || {};
    A.data = data;
    const want = (meta.mods || []).slice();
    const missing = want.filter((id) => !registry.has(id));
    const failed = [];
    for (let tries = 0; tries <= want.length; tries++) {
      const list = want.filter((id) => registry.has(id) && !failed.includes(id));
      let bad = null;
      for (const id of list) {
        try { registry.get(id).def.setup(makeApi(id, data)); } catch (e) { bad = id; console.error('MOD「' + id + '」が よみこめません', e); failed.push(id); break; }
      }
      if (!bad) { A.mods = list; break; }
      reset(); // とちゅうまで よみこんだ ものを すてて、こわれた MOD ぬきで やりなおす
    }
    Reg.refreshIcons();
    if (CS.G && CS.G.ren) { CS.G.ren.refreshAtlas(); CS.G.ren.refreshIcons(); }
    if (CS.G && CS.G.refreshBcol) CS.G.refreshBcol();
    const h = $('modHelp');
    if (h) h.innerHTML = A.help.map((x) => `<h3>${esc(x.name)}</h3>${x.html}`).join('');
    A.tick = 0; A.acc = 0;
    const msg = [];
    if (missing.length) msg.push('みつからない MOD: ' + missing.join(', '));
    if (failed.length) msg.push('よみこめなかった MOD: ' + failed.join(', '));
    if (msg.length) setTimeout(() => UI.toast(msg.join(' / ') + ' (その ブロックは「？」に なるよ)', 6000), 1500);
  }
  function deactivate() {
    reset();
    Reg.refreshIcons();
    if (CS.G && CS.G.ren) { CS.G.ren.refreshAtlas(); CS.G.ren.refreshIcons(); }
  }
  // ワールドを つくったあと: じょうたいを もどし、MOD の ブロックに onAdd を よぶ
  function attach(w, data) {
    w.st = new Map(((data.mst && data.mst[w.dim]) || []).filter((e) => Array.isArray(e) && e.length === 2));
    w.modIdx = new Map();
    for (const [i, id] of w.diffs) if (id >= B0) w.modIdx.set(i, id);
    w.modSched = new Map();
    if (!A.mods.length) return;
    for (const [i, id] of [...w.modIdx]) { const d = BLOCKS[id]; if (d.onAdd && w.b[i] === id) call(d, 'onAdd', w, ...posOf(w, i), true); }
    for (const f of A.hooks.load) f(w);
  }
  function save(data, worlds) {
    data.mst = data.mst || {};
    for (const dim in worlds) data.mst[dim] = Array.from(worlds[dim].st);
  }
  // もちものに しらない ばんごうが あったら「？」に しておく (MOD を けしたあと など)
  function fixInv(inv) {
    for (const s of inv) if (s && !ITEMS[s.id]) Reg.phItem(s.id);
  }

  // ================= ブロックが かわった とき (world.js から) =================
  CS.onBlockSet = function (w, x, y, z, old, id) {
    if (!w.modSched) return;
    const i = w.idx(x, y, z);
    if (old >= B0) {
      const d = BLOCKS[old], st = w.st.get(i);
      w.modIdx.delete(i);
      // オフの MOD の ブロック (d.ph) の じょうたいは けさずに のこす
      if (!d.ph) { w.st.delete(i); w.modSched.delete(i); if (d.onRemove) call(d, 'onRemove', w, x, y, z, st); }
    }
    if (id >= B0) { w.modIdx.set(i, id); const d = BLOCKS[id]; if (d.onAdd) call(d, 'onAdd', w, x, y, z, false); }
    if (!A.mods.length) return;
    for (let f = 0; f < 6; f++) {
      const nx = x + DIRS[f][0], ny = y + DIRS[f][1], nz = z + DIRS[f][2];
      if (!w.inside(nx, ny, nz)) continue;
      const n = w.b[w.idx(nx, ny, nz)];
      if (n >= B0 && BLOCKS[n].onNeighbor) call(BLOCKS[n], 'onNeighbor', w, nx, ny, nz, x, y, z);
    }
  };

  // ================= まいフレーム =================
  function tick(dt) {
    if (!A.mods.length) return;
    const w = CS.G.world;
    if (!w || !w.modSched) return;
    A.acc += dt;
    let n = 0;
    while (A.acc >= 0.05 && n < 4) {
      A.acc -= 0.05; n++; A.tick++;
      const sc = w.modSched;
      if (sc.size) {
        for (const [i, due] of sc) {
          if (due > A.tick) continue;
          sc.delete(i);
          const id = w.b[i], d = BLOCKS[id];
          if (id >= B0 && d.onTick) call(d, 'onTick', w, ...posOf(w, i));
        }
      }
      for (const f of A.hooks.tick) f(w, A.tick);
    }
    if (A.acc > 0.2) A.acc = 0;
    for (const f of A.hooks.frame) f(w, dt);
  }
  function draw(ren, w, now) {
    if (!A.mods.length || !w || !w.modSched) return;
    for (const f of A.hooks.draw) f(ren, w, now);
  }
  // みぎクリック: もっている MOD の アイテム → ブロックの じゅんに きく
  function use(w, b, held, p) {
    const hd = held ? ITEMS[held.id] : null;
    if (hd && hd.onUseBlock && call(hd, 'onUseBlock', w, b.x, b.y, b.z, p, held)) return true;
    const d = BLOCKS[b.id];
    return !!(d.onUse && call(d, 'onUse', w, b.x, b.y, b.z, p, held));
  }

  // ================= MOD の がめん =================
  const LIST = () => CS.store.get(LIST_KEY, []);
  function modRows() {
    const rows = [];
    for (const [id, r] of registry) rows.push({ id, name: r.def.name || id, desc: r.def.desc || '', version: r.def.version || '', source: r.source });
    for (const um of userMods()) if (!registry.has(um.id)) rows.push({ id: um.id, name: um.name || um.id, desc: '', version: '', source: 'user', err: userErr[um.id] || 'よみこめません' });
    for (const r of rows) if (userErr[r.id]) r.err = userErr[r.id];
    return rows;
  }
  // world: ワールドごとの オン/オフ / null: MOD の いちらんと じぶんの MOD を いれる
  async function openScreen(world, back) {
    await ready;
    const el = $('mods');
    UI.show('mods');
    const rows = modRows();
    const on = new Set((world && world.mods) || []);
    const list = rows.map((r) => `
<div class="mRow">
  ${world ? `<label class="mChk"><input type="checkbox" data-mod="${esc(r.id)}" ${on.has(r.id) ? 'checked' : ''} ${r.err ? 'disabled' : ''}/></label>` : ''}
  <div class="mInfo"><b>${esc(r.name)}</b> <small class="tag ${r.source === 'user' ? 'cr' : ''}">${r.source === 'user' ? 'じぶんの MOD' : 'ついてくる MOD'}</small>${r.version ? `<small> ver ${esc(r.version)}</small>` : ''}
  <div class="mDesc">${esc(r.desc)}</div>${r.err ? `<div class="mErr">エラー: ${esc(r.err)}</div>` : ''}</div>
  ${!world && r.source === 'user' ? `<button class="btn small bad" data-rm="${esc(r.id)}">けす</button>` : ''}
</div>`).join('') || '<div class="empty">MOD が ないよ</div>';
    el.innerHTML = `<div class="card wide">
<div class="cHead"><b>${world ? '「' + esc(world.name) + '」の MOD' : 'MOD'}</b><span class="sp"></span><button class="btn" data-mx="back">もどる</button></div>
<p class="mNote">${world
    ? 'チェックした MOD が この ワールドで うごくよ。オフに すると、その MOD の ブロックは「？」に なって さわれなくなる (でも きえないよ)。もういちど オンに すると もとに もどるよ。'
    : 'MOD を つかうと、ゲームに あたらしい ブロックや しかけを ふやせるよ。MOD は ワールドごとに オン・オフ できる (ワールドを えらぶ がめんの「MOD」ボタン)。'}</p>
<div class="mList">${list}</div>
${world ? '' : `<div class="mUser">
  <b>じぶんで つくった MOD を いれる</b>
  <p class="warn">⚠ MOD は プログラムです。いれると この パソコンの ブラウザで うごきます。じぶんや せんせいが つくった、しんじられる ファイル だけ いれてね。へんな MOD は セーブデータを こわす かも しれません。</p>
  <label class="btn ok">.js ファイルを えらぶ<input type="file" id="mFile" accept=".js,text/javascript" hidden /></label>
  <a class="mHow" href="mods/README.md" target="_blank" rel="noopener">MOD の つくりかた</a>
  <div id="mMsg" class="mMsg"></div>
</div>`}
</div>`;
    el.querySelector('[data-mx=back]').onclick = () => back();
    el.querySelectorAll('[data-mod]').forEach((cb) => {
      cb.onchange = () => {
        const all = LIST(), m = all.find((x) => x.id === world.id);
        if (!m) return;
        const set = new Set(m.mods || []);
        if (cb.checked) set.add(cb.dataset.mod); else set.delete(cb.dataset.mod);
        m.mods = [...set]; world.mods = m.mods;
        CS.store.set(LIST_KEY, all);
        CS.sfx.click();
      };
    });
    el.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.rm;
        if (!confirm(`MOD「${id}」を けしても いい？ (ワールドの データは のこるよ)`)) return;
        CS.store.set(USER_KEY, userMods().filter((u) => u.id !== id));
        registry.delete(id);
        openScreen(world, back);
      };
    });
    const file = el.querySelector('#mFile');
    if (file) file.onchange = () => { const f = file.files[0]; if (f) addUserMod(f, (msg) => { openScreen(world, back).then(() => { const m = $('mMsg'); if (m) m.textContent = msg; }); }); };
  }
  function addUserMod(f, done) {
    if (f.size > 300000) { done('ファイルが おおきすぎるよ (300KB まで)'); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const code = String(rd.result);
      const r = runUser(code);
      if (r.err) { done('よみこめなかった: ' + r.err); return; }
      const id = r.ids[0], def = registry.get(id).def;
      const list = userMods().filter((u) => u.id !== id);
      list.push({ id, name: def.name || id, code, added: Date.now() });
      if (!CS.store.set(USER_KEY, list)) { done('ほぞんできなかった (ブラウザの ようりょうが いっぱい かも)'); return; }
      delete userErr[id];
      CS.sfx.coin();
      done(`「${def.name || id}」を いれたよ！ ワールドの「MOD」ボタンで オンに してね`);
    };
    rd.readAsText(f);
  }
  // あたらしい ワールドの フォーム
  async function fillNewWorld(box) {
    if (!box) return;
    await ready;
    const rows = modRows().filter((r) => !r.err);
    box.innerHTML = rows.length ? '<b>MOD (あとで かえられる)</b>' + rows.map((r) => `<label class="mPick"><input type="checkbox" value="${esc(r.id)}" /> ${esc(r.name)} <small>${esc(r.desc)}</small></label>`).join('') : '';
  }
  function newWorldMods(box) { return box ? [...box.querySelectorAll('input:checked')].map((c) => c.value) : []; }

  CS.Mods = { ready, registry, activate, deactivate, attach, save, fixInv, tick, draw, use, call, openScreen, fillNewWorld, newWorldMods, DIRS, active: () => A.mods.slice(), state: A };
})();
