/* =========================================================================
   DEAD DRIVE ― ガレージ
   マス目に部品を置いて車を組む。前は画面の上。
   置いた部品は押して選ぶと強化でき、ドラッグすると別のマスへ動かせる。
   ========================================================================= */
'use strict';

/* マス目の上に「前」の見出しと、前へはみ出す衝角やノコのぶんの余白をとる */
const GTOP = 44;

const Garage = {
  sel: null,      // 置こうとしている部品
  rot: 0,         // 置くときの向き
  pick: null,     // 選んでいる置き済みの部品
  drag: null,     // ドラッグで動かしている置き済みの部品
  hover: null,
  cv: null, P: 40,
  painting: false,

  design() { return Run.state.design; },
  at(c, r) { return this.design().find((x) => x.c === c && x.r === r) || null; },

  render(root) {
    const s = Run.state;
    root.innerHTML = '';
    const wrap = h('div', 'garage');
    /* 部品の一覧 */
    const pal = h('div', 'palette');
    for (const cat of PART_CATS) {
      pal.appendChild(h('div', 'palHead', cat.name));
      for (const id of PART_ORDER) {
        const d = PARTS[id];
        if (d.cat !== cat.id) continue;
        const ok = Run.unlocked(id);
        const b = h('button', 'palItem' + (this.sel === id ? ' on' : '') + (ok ? '' : ' locked'));
        const ic = document.createElement('canvas'); ic.width = ic.height = 72; ic.className = 'palIcon';
        drawPartIcon(ic, id, 0);
        b.appendChild(ic);
        b.appendChild(h('span', 'palName', d.name));
        b.appendChild(h('span', 'palCost', ok ? `🔩${d.cost}` : '🔒設計図'));
        b.onclick = () => {
          Sfx.ui();
          if (!ok) { this.info(id); toast('警察署やホームセンター、木箱で設計図を探そう', ''); return; }
          this.sel = this.sel === id ? null : id; this.pick = null;
          this.render(root);
        };
        b.onmouseenter = () => this.info(id);
        pal.appendChild(b);
      }
    }
    /* マス目 */
    const mid = h('div', 'gMid');
    const tools = h('div', 'gTools');
    const rotBtn = h('button', 'btn small', '↻ 向きを変える <kbd>R</kbd>');
    rotBtn.onclick = () => this.rotate(root);
    const upBtn = h('button', 'btn small', '⬆ 強化');
    upBtn.onclick = () => { if (this.pick && this.upgrade(this.pick)) this.refresh(); };
    const delBtn = h('button', 'btn small ghost', '外す');
    delBtn.onclick = () => { if (this.pick) { this.remove(this.pick); this.render(root); } };
    tools.appendChild(rotBtn); tools.appendChild(upBtn); tools.appendChild(delBtn);
    this.upBtn = upBtn; this.delBtn = delBtn;
    const hint = h('div', 'gHint', this.sel ? `「${PARTS[this.sel].name}」を置く場所を押す。右クリックで外す。` : '部品を選んでから、マスを押して置く。置いた部品を押すと選べて、強化できる。ドラッグすると別のマスへ動かせる。');
    const [cols, rows] = Run.gridSize();
    const avail = Math.min(innerWidth < 760 ? innerWidth - 40 : 420, 560);
    this.P = Math.floor(clamp(Math.min(avail / cols, (innerHeight - 330) / rows), 26, 52));
    const cv = document.createElement('canvas');
    cv.width = cols * this.P * G.dpr; cv.height = (rows * this.P + GTOP) * G.dpr;
    cv.style.width = cols * this.P + 'px'; cv.style.height = rows * this.P + GTOP + 'px';
    cv.className = 'gGrid';
    this.cv = cv;
    mid.appendChild(hint); mid.appendChild(cv); mid.appendChild(tools);
    this.bindGrid(cv);

    /* 性能 */
    const side = h('div', 'gSide');
    side.appendChild(h('div', 'gStats', ''));
    side.appendChild(h('div', 'gInfo', ''));
    const rep = h('div', 'gRepair');
    side.appendChild(rep);
    wrap.appendChild(pal); wrap.appendChild(mid); wrap.appendChild(side);
    root.appendChild(wrap);
    this.root = root;
    this.refresh();
    if (this.pick) this.info(this.pick.t, this.pick); else if (this.sel) this.info(this.sel);
  },

  refresh() {
    this.draw();
    const s = Run.state;
    const p = this.pick;
    this.delBtn.disabled = !p || p.t === 'cabin';
    const lv = p ? p.lv || 1 : 1, maxed = lv >= PART_MAX_LV;
    this.upBtn.innerHTML = !p ? '⬆ 強化' : maxed ? '⬆ 強化 最大' : `⬆ 強化 Lv${lv + 1}（🔩${partUpCost(p.t, lv)}）`;
    this.upBtn.disabled = !p || maxed || s.scrap < partUpCost(p.t, lv);
    const cells = this.design().map((c) => ({ c: c.c, r: c.r, t: c.t, lv: c.lv, hp: Run.cellHp(c) }));
    const st = carStats(cells, s.perks, s.meta);
    const box = this.root.querySelector('.gStats');
    const bar = (label, val, max, txt) => `<div class="stat"><span>${label}</span><div class="sbar"><i style="width:${clamp(val / max, 0, 1) * 100}%"></i></div><b>${txt}</b></div>`;
    box.innerHTML =
      `<h4>性能</h4>` +
      bar('耐久', st.hp, Math.max(st.maxhp, 1200), `${Math.round(st.hp)} / ${st.maxhp}`) +
      bar('重さ', st.M, 60, st.M.toFixed(1)) +
      bar('最高速', st.top, 520, Math.round(st.top / 3.6) + ' km/h') +
      bar('加速', st.accel, 520, Math.round(st.accel / 3)) +
      bar('曲がり', st.turn, 3.3, (st.turn * 30).toFixed(0)) +
      bar('タイヤ', st.load, Math.max(st.M, 0.1), `${st.wheels}個・支え ${Math.round(st.load)}`) +
      bar('轢く力', st.ramPow, 3, st.ramPow.toFixed(1)) +
      bar('火力', st.dps, 400, st.dps + '') +
      `<div class="chips"><span>📦 積載 ${st.cargo}</span><span>💺 座席 ${st.seats}</span><span>🚀 ニトロ ${st.nitro.toFixed(1)}秒</span></div>` +
      (!st.wheels ? '<p class="warn">タイヤがない。これでは這うようにしか進まない。</p>'
        : st.support < 1 ? `<p class="warn">タイヤが重さ ${st.M.toFixed(1)} を支えきれず、遅くなっている。タイヤを足すか、強いタイヤにしよう。</p>` : '');
    const cost = Run.repairCost();
    const rep = this.root.querySelector('.gRepair');
    rep.innerHTML = '';
    if (cost > 0) {
      const b = h('button', 'btn primary', `🔧 まとめて修理（🔩${cost}）`);
      b.disabled = s.scrap < cost;
      b.onclick = () => { if (Run.repairAll()) { Sfx.good(); toast('車を修理した', 'good'); Run.save(); UI.refreshHead(); this.refresh(); } };
      rep.appendChild(b);
      if (Run.mechanics()) rep.appendChild(h('small', '', `整備士 ${Run.mechanics()}人で修理費が安い`));
    } else rep.appendChild(h('small', '', '傷はない'));
  },

  info(id, cell) {
    const box = this.root && this.root.querySelector('.gInfo');
    if (!box) return;
    const d = PARTS[id];
    const pw = cell ? partPowMul(cell.lv) : 1;   // 置いた部品は強化のぶんも入れて見せる
    const num = (v) => Math.round(v * pw * 10) / 10;
    let extra = '';
    if (d.weapon) {
      const w = WEAPONS[d.weapon];
      extra = `<div class="chips"><span>射程 ${w.range || '―'}</span><span>${w.arc > 3 ? '360°' : '射界 ' + Math.round(w.arc * 2 * 180 / Math.PI) + '°'}</span><span>威力 ${num(w.dmg)}${w.pellets ? '×' + w.pellets : ''}</span></div>`;
    }
    if (d.wheel) extra = `<div class="chips"><span>支える重さ ${num(d.wheel.load)}</span><span>速さ ×${d.wheel.speed}</span><span>曲がり ×${d.wheel.turn}</span></div>`;
    let hp = '';
    if (cell) {
      const lv = cell.lv || 1;
      const pow = d.weapon ? '威力' : d.contact ? '刺す力' : d.power ? '馬力' : d.wheel ? '支える重さ' : '';
      hp = `<div class="chips"><span>Lv ${lv} / ${PART_MAX_LV}</span><span>耐久 ${Math.round(Run.cellHp(cell))} / ${Run.cellMax(cell)}</span></div>` +
        `<p>${lv < PART_MAX_LV ? `強化すると 耐久 ×${partHpMul(lv + 1)}${pow ? `・${pow} ×${partPowMul(lv + 1)}` : ''}（はじめと比べて）` : 'これ以上は強化できない。'}</p>`;
    }
    box.innerHTML = `<h4>${d.name}${d.rot ? ' <small>向きあり</small>' : ''}</h4><p>${d.desc}</p>` +
      `<div class="chips"><span>🔩 ${d.cost}</span><span>耐久 ${d.hp}</span><span>重さ ${d.mass}</span></div>` + extra + hp;
  },

  /* 選んだ部品を1つ強化する。傷はそのままで、増えた耐久のぶんだけ HP も増える */
  upgrade(cell) {
    const s = Run.state, lv = cell.lv || 1;
    if (lv >= PART_MAX_LV || !s.design.includes(cell)) return false;
    const cost = partUpCost(cell.t, lv);
    if (s.scrap < cost) { toast('スクラップが足りない', 'bad'); return false; }
    const before = Run.cellMax(cell);
    s.scrap -= cost;
    cell.lv = lv + 1;
    if (cell.hp > 0) cell.hp += Run.cellMax(cell) - before;
    Sfx.good();
    Run.save(); UI.refreshHead();
    this.info(cell.t, cell);
    return true;
  },

  rotate(root) {
    if (this.pick && PARTS[this.pick.t].rot) { this.pick.rot = ((this.pick.rot || 0) + 1) % 4; Run.save(); }
    else this.rot = (this.rot + 1) % 4;
    Sfx.ui();
    this.draw();
  },

  canPlace(c, r, id) {
    if (!Run.unlocked(id)) return '設計図がない';
    const [cols, rows] = Run.gridSize();
    if (c < 0 || r < 0 || c >= cols || r >= rows) return '範囲の外';
    const cur = this.at(c, r);
    if (cur && cur.t === 'cabin') return '運転席は動かせない';
    if (cur && cur.t === id) return 'もう置いてある';
    const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dc, dr]) => this.at(c + dc, r + dr));
    if (!cur && !nb) return '車体につながっていない';
    const refund = cur ? this.refund(cur) : 0;
    if (Run.state.scrap + refund < PARTS[id].cost) return 'スクラップが足りない';
    return null;
  },

  refund(cell) {
    const cost = Run.cellInvest(cell);
    if (cell.fresh) return cost;
    return Math.floor(cost * 0.5 * clamp(Run.cellHp(cell) / Run.cellMax(cell), 0, 1));
  },

  place(c, r) {
    const id = this.sel;
    const why = this.canPlace(c, r, id);
    if (why) { if (why !== 'もう置いてある') toast(why, 'bad'); return false; }
    const s = Run.state;
    const cur = this.at(c, r);
    if (cur) { s.scrap += this.refund(cur); s.design.splice(s.design.indexOf(cur), 1); }
    s.scrap -= PARTS[id].cost;
    s.design.push({ c, r, t: id, rot: PARTS[id].rot ? this.rot : 0, fresh: true });
    Sfx.load();
    Run.save(); UI.refreshHead();
    return true;
  },

  remove(cell) {
    const s = Run.state;
    if (!s.design.includes(cell)) { this.pick = null; return false; }
    if (cell.t === 'cabin') { toast('運転席は外せない', 'bad'); return false; }
    const rest = s.design.filter((x) => x !== cell);
    if (!designConnected(rest)) { toast('ほかの部品がこの部品でつながっているので外せない', 'bad'); return false; }
    s.scrap += this.refund(cell);
    s.design = rest;
    if (this.pick === cell) this.pick = null;
    Sfx.ui();
    Run.save(); UI.refreshHead();
    return true;
  },

  /* 置いた部品を空いたマスへ動かせるか。だめなら理由を返す */
  moveWhy(cell, c, r) {
    const [cols, rows] = Run.gridSize();
    if (c < 0 || r < 0 || c >= cols || r >= rows) return '範囲の外';
    if (this.at(c, r)) return 'そこにはもう部品がある';
    const oc = cell.c, or = cell.r;
    cell.c = c; cell.r = r;
    const ok = designConnected(this.design());
    cell.c = oc; cell.r = or;
    return ok ? null : 'そこだと車体からはなれてしまう';
  },

  cellAt(ev) {
    const r = this.cv.getBoundingClientRect();
    return { c: Math.floor((ev.clientX - r.left) / this.P), r: Math.floor((ev.clientY - r.top - GTOP) / this.P) };
  },

  /* ドラッグを離したマスへ部品を動かす。マス目の外や同じマスで離したら何もしない */
  drop(ev) {
    this.painting = false;
    const cell = this.drag;
    this.drag = null;
    if (!cell || !this.cv || !this.cv.isConnected) return;
    const p = this.cellAt(ev);
    const [cols, rows] = Run.gridSize();
    if ((p.c === cell.c && p.r === cell.r) || p.c < 0 || p.r < 0 || p.c >= cols || p.r >= rows) { this.draw(); return; }
    const why = this.moveWhy(cell, p.c, p.r);
    if (why) toast(why, 'bad');
    else { cell.c = p.c; cell.r = p.r; Sfx.load(); Run.save(); }
    this.refresh();
  },

  bindGrid(cv) {
    const act = (ev, first) => {
      const p = this.cellAt(ev);
      const cur = this.at(p.c, p.r);
      if (this.sel) {
        if (!first && cur) return;
        if (this.place(p.c, p.r)) { this.refresh(); }
      } else if (first) {
        this.pick = cur || null;
        this.drag = cur || null;
        if (cur) this.info(cur.t, cur);
        this.refresh();
      }
    };
    cv.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      Sfx.unlock();
      if (ev.button === 2) {
        const p = this.cellAt(ev); const cur = this.at(p.c, p.r);
        if (cur && this.remove(cur)) this.refresh();
        return;
      }
      this.painting = true;
      act(ev, true);
    });
    cv.addEventListener('pointermove', (ev) => {
      const p = this.cellAt(ev);
      if (!this.hover || this.hover.c !== p.c || this.hover.r !== p.r) { this.hover = p; this.draw(); }
      if (this.painting && this.sel && ev.pointerType === 'mouse' && ev.buttons === 1) act(ev, false);
    });
    cv.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    if (!this.upBound) { this.upBound = true; addEventListener('pointerup', (ev) => this.drop(ev)); }
    cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
  },

  draw() {
    const cv = this.cv;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const P = this.P, [cols, rows] = Run.gridSize();
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    ctx.clearRect(0, 0, cols * P, rows * P + GTOP);
    ctx.fillStyle = '#ffd28a'; ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('▲ 前', cols * P / 2, 17);
    ctx.translate(0, GTOP);
    ctx.fillStyle = '#141820'; ctx.fillRect(0, 0, cols * P, rows * P);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * P + 0.5, 0); ctx.lineTo(c * P + 0.5, rows * P); ctx.stroke(); }
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * P + 0.5); ctx.lineTo(cols * P, r * P + 0.5); ctx.stroke(); }
    const d = this.design();
    drawDesign(ctx, d, P, { hp: true });
    /* 選んでいる部品の枠 */
    if (this.pick) {
      ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 2.5;
      ctx.strokeRect(this.pick.c * P + 1.5, this.pick.r * P + 1.5, P - 3, P - 3);
    }
    /* 置く前・動かす前の影。置けないマスは赤い枠 */
    const ghost = (t, rot, bad) => {
      const { c, r } = this.hover;
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.translate((c + 0.5) * P, (r + 0.5) * P); ctx.rotate(-Math.PI / 2); ctx.scale(P / CS, P / CS);
      drawPart(ctx, t, rot, CS, {});
      ctx.restore();
      ctx.strokeStyle = bad ? '#ff5f6d' : '#7ee39b'; ctx.lineWidth = 2;
      ctx.strokeRect(c * P + 1, r * P + 1, P - 2, P - 2);
    };
    if (this.sel && this.hover) {
      const bad = this.canPlace(this.hover.c, this.hover.r, this.sel);
      ghost(this.sel, PARTS[this.sel].rot ? this.rot : 0, bad && bad !== 'もう置いてある');
    } else if (this.drag && this.hover && (this.hover.c !== this.drag.c || this.hover.r !== this.drag.r)) {
      ghost(this.drag.t, this.drag.rot || 0, !!this.moveWhy(this.drag, this.hover.c, this.hover.r));
    }
  },
};

/* 部品がすべて、運転席から上下左右のとなりづたいにつながっているか */
function designConnected(cells) {
  const cab = cells.find((x) => x.t === 'cabin');
  const seen = new Set([cab]); const q = [cab];
  while (q.length) {
    const a = q.pop();
    for (const b of cells) if (!seen.has(b) && Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1) { seen.add(b); q.push(b); }
  }
  return seen.size === cells.length;
}

/* 設計図のマスを、前を上にして描く（ガレージとアイコン用） */
function drawDesign(ctx, design, P, opt = {}) {
  const has = (c, r) => design.some((x) => x.c === c && x.r === r && Run.cellHp(x) > 0);
  for (const cell of design) {
    const hp = Run.cellHp(cell), max = Run.cellMax(cell);
    ctx.save();
    ctx.translate((cell.c + 0.5) * P, (cell.r + 0.5) * P);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(P / CS, P / CS);
    let open = 0;
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr], i) => { if (!has(cell.c + dc, cell.r + dr)) open |= 1 << i; });
    if (hp <= 0) ctx.globalAlpha = 0.35;
    drawPart(ctx, cell.t, cell.rot || 0, CS, { open, hpRatio: opt.hp ? hp / max : 1, time: G.time, lv: cell.lv });
    ctx.restore();
    if (hp <= 0) {
      ctx.strokeStyle = '#ff5f6d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cell.c * P + 6, cell.r * P + 6); ctx.lineTo((cell.c + 1) * P - 6, (cell.r + 1) * P - 6);
      ctx.moveTo((cell.c + 1) * P - 6, cell.r * P + 6); ctx.lineTo(cell.c * P + 6, (cell.r + 1) * P - 6); ctx.stroke();
    } else if (opt.hp && hp < max) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cell.c * P + 3, (cell.r + 1) * P - 6, P - 6, 3);
      ctx.fillStyle = hp / max > 0.5 ? '#7ee39b' : '#ff9a4d'; ctx.fillRect(cell.c * P + 3, (cell.r + 1) * P - 6, (P - 6) * hp / max, 3);
    }
  }
}

function drawPartIcon(cv, id, rot) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.rotate(-Math.PI / 2);
  const k = cv.width / CS * 0.62;
  ctx.scale(k, k);
  drawPart(ctx, id, rot, CS, { open: 15, time: 0 });
  ctx.restore();
}

/* 車全体を小さなキャンバスに描く（出撃画面の見本） */
function drawDesignThumb(cv, design) {
  const ctx = cv.getContext('2d');
  let minR = 99, maxR = -99, minC = 99, maxC = -99;
  for (const c of design) { minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r); minC = Math.min(minC, c.c); maxC = Math.max(maxC, c.c); }
  const w = maxC - minC + 2.4, hh = maxR - minR + 1.4;
  const P = Math.min(cv.width / w, cv.height / hh);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(cv.width / 2 - (minC + maxC + 1) / 2 * P, cv.height / 2 - (minR + maxR + 1) / 2 * P);
  drawDesign(ctx, design, P, { hp: true });
  ctx.restore();
}
