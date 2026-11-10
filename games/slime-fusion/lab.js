/* =========================================================================
   SLIME FUSION ― ごうせいだい
   2ひきを いれる → ごうせいムービー → (ルーレット) → うまれる → パーツを つける
   ========================================================================= */
'use strict';

const Movie = {
  st: null,

  start(A, B) {
    const plan = fusionPlan(A, B);
    this.st = { t: 0, phase: 'in', A, B, plan, wheel: null, res: null, msgs: [], born: 0 };
    G.mode = 'fusion';
    UI.hideAll();
    el('fusionUI').classList.remove('hidden');
    el('fzStop').classList.add('hidden');
    el('fzMsg').classList.add('hidden');
    el('fzSkip').classList.remove('hidden');
    Sfx.fuse();
  },

  skip() {
    const s = this.st;
    if (!s) return;
    if (s.phase === 'in' || s.phase === 'mix') { s.t = 3.6; s.phase = 'flash'; }
  },

  update(dt) {
    const s = this.st;
    if (!s) return;
    s.t += dt;
    if (s.phase === 'in' && s.t > 1.3) s.phase = 'mix';
    if (s.phase === 'mix') {
      if (Math.random() < dt * 14) Sfx.spin();
      if (s.t > 3.6) s.phase = 'flash';
    }
    if (s.phase === 'flash' && !s.flashed) {
      s.flashed = true; s.flashT = s.t; Sfx.flash();
      el('fzSkip').classList.add('hidden');
    }
    if (s.phase === 'flash' && s.t - s.flashT > 0.5) {
      if (s.plan.wheel) this.openWheel();
      else this.birth(null);
    }
    if (s.phase === 'wheel') this.updateWheel(dt);
    if (s.phase === 'born') s.born += dt;
  },

  /* ------------------------------ ルーレット ------------------------------ */
  openWheel() {
    const s = this.st;
    const segs = s.plan.wheel;
    const total = segs.reduce((a, b) => a + b.w, 0);
    let acc = 0;
    for (const g of segs) {
      g.a0 = (acc / total) * TAU; acc += g.w; g.a1 = (acc / total) * TAU;
      if (g.kind === 'grow') { g.label = 'おおきくなる'; g.icon = slimeCanvas(Object.assign({}, s.A, { size: 3, parts: [] }), 44, { fixed: true }); }
      else {
        const sp = SP[g.sp];
        const known = P.seen[g.sp] || g.kind === 'keep';
        if (!g.label) g.label = known ? sp.name.replace('スライム', '') || sp.name : '？？？';
        if (g.label === '') g.label = sp.name;
        g.col = COLORS[sp.el[0]].c;
        g.icon = slimeCanvas(sampleOf(g.sp), 44, { silhouette: !known, fixed: true });
      }
      if (!g.col) g.col = '#9fe0b8';
    }
    s.wheel = { segs, ang: rand(TAU), vel: 9 + rand(3), stopping: false, done: false, last: -1, hold: 0 };
    s.phase = 'wheel';
    el('fzStop').classList.remove('hidden');
    el('fzHint').textContent = s.plan.wheel.some((g) => g.kind === 'grow') ? 'ルーレットで しんかを きめよう！' : 'どっちに なるかな？';
    el('fzHint').classList.remove('hidden');
  },
  stopWheel() {
    const w = this.st && this.st.wheel;
    if (!w || w.stopping) return;
    w.stopping = true;
    Sfx.ui();
    el('fzStop').classList.add('hidden');
  },
  updateWheel(dt) {
    const w = this.st.wheel;
    if (w.done) {
      w.hold += dt;
      if (w.hold > 1.3) this.birth(w.hit);
      return;
    }
    if (w.stopping) w.vel *= Math.exp(-1.5 * dt);
    w.ang = (w.ang + w.vel * dt) % TAU;
    const seg = this.segAtPointer();
    if (seg !== w.last) { w.last = seg; Sfx.spin(); }
    if (w.stopping && w.vel < 0.12) {
      w.done = true;
      w.hit = w.segs[seg];
      Sfx.pickup();
      el('fzHint').textContent = w.hit.kind === 'grow' ? 'おおきくなる！' : w.hit.label === '？？？' ? 'しらない スライム！？' : w.hit.label + '！';
    }
  },
  segAtPointer() {
    const w = this.st.wheel;
    const a = ((-w.ang) % TAU + TAU) % TAU;
    return Math.max(0, w.segs.findIndex((g) => a >= g.a0 && a < g.a1));
  },

  /* ------------------------------ うまれる ------------------------------ */
  birth(hit) {
    const s = this.st;
    el('fzStop').classList.add('hidden');
    const r = performFusion(s.A, s.B, s.plan, hit);
    s.res = r;
    s.phase = 'born'; s.born = 0;
    /* 2ひきを けして 1ぴきに */
    const ia = P.party.indexOf(s.A.id), ib = P.party.indexOf(s.B.id);
    P.slimes = P.slimes.filter((x) => x !== s.A && x !== s.B);
    P.slimes.push(r.child);
    const party = P.party.slice();
    if (ia >= 0) party[ia] = r.child.id; else if (ib >= 0) party[ib] = r.child.id;
    P.party = party.filter((id, i) => id !== s.B.id && id !== s.A.id && party.indexOf(id) === i);
    if (!P.party.length) P.party = [r.child.id];
    saveGame();
    Sfx.invent();
    const c = r.child;
    const nm = spName(c);
    const msgs = [];
    if (s.plan.recipe) msgs.push({ big: 'ひみつのレシピ はっけん！', text: `${nm}が うまれた！` });
    else if (r.grow && c.sp === s.A.sp && c.sp === s.B.sp) msgs.push({ big: 'おおきくなった！', text: `${nm}が おおきさ ${c.size} に なった！` });
    else if (r.grow) msgs.push({ big: 'おおきくなった！', text: `${nm}に なって、おおきさ ${c.size} に なった！` });
    else msgs.push({ big: r.firstSeen ? 'あたらしい スライム！' : 'ごうせい せいこう！', text: `${nm}が うまれた！` });
    const cols = r.newColors.filter((x) => x !== 'plain');
    if (cols.length) msgs.push({ text: `${cols.map((x) => COLORS[x].name).join('・')} の 色を うけついだ！ バトルで 色を かえられるよ` });
    for (const t of r.inherited) {
      const has = c.parts.some((p) => p.t === t);
      msgs.push({ text: `${PARTS[t].name}の とくちょうが のこった！ ${has ? `${PARTS[t].name}が ついたまま。ばしょを うごかしたり ふやしたり できるよ` : `${PARTS[t].name}を つけられるよ`}`, part: t });
    }
    if (r.gained) msgs.push({ big: `${PARTS[r.gained].icon} ${PARTS[r.gained].name}を つけられるように なった！`, text: PARTS[r.gained].info, part: r.gained, place: true });
    if (r.newTrait) msgs.push({ text: `とくせい「${TRAITS[r.newTrait].name}」を うけついだ！ (${TRAITS[r.newTrait].info})` });
    s.msgs = msgs; s.msgIdx = -1;
    setTimeout(() => this.nextMsg(), 1500);
  },

  nextMsg() {
    const s = this.st;
    if (!s) return;
    s.msgIdx++;
    const box = el('fzMsg');
    el('fzHint').classList.add('hidden');
    if (s.msgIdx >= s.msgs.length) {
      box.classList.add('hidden');
      const placeType = s.res.gained || s.res.inherited[0];
      this.end(placeType);
      return;
    }
    const m = s.msgs[s.msgIdx];
    box.classList.remove('hidden');
    el('fzBig').textContent = m.big || '';
    el('fzBig').classList.toggle('hidden', !m.big);
    el('fzText').textContent = m.text;
    const btn = el('fzNext');
    btn.textContent = s.msgIdx === s.msgs.length - 1 ? (s.res.gained || s.res.inherited.length ? 'つける ばしょを きめる！' : 'OK') : 'つぎへ';
    Sfx.pickup();
  },

  end(placeType) {
    const child = this.st.res.child;
    this.st = null;
    el('fusionUI').classList.add('hidden');
    if (placeType) Editor.open(child, placeType, () => UI.afterFusion(child));
    else UI.afterFusion(child);
  },

  /* ------------------------------ え ------------------------------ */
  draw(ctx) {
    const s = this.st;
    const W = G.W, H = G.H;
    const t = s.t;
    /* ラボの へや */
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#3a2a6a'); g.addColorStop(1, '#0a0618');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140,120,255,0.12)'; ctx.lineWidth = 1;
    for (let x = (t * 20) % 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    const cx = W / 2, cy = H * 0.5;
    const R = Math.min(W, H) * 0.2;
    const shakeK = s.phase === 'mix' ? (t - 1.3) / 2.3 : 0;
    const sx = Math.sin(t * 60) * shakeK * 8, sy = Math.cos(t * 53) * shakeK * 5;

    if (s.phase === 'wheel') { this.drawMachine(ctx, cx, cy, R, t, 0, 0, true); this.drawWheel(ctx, cx, cy, Math.min(W, H) * 0.34); return; }
    if (s.phase === 'born') { this.drawBorn(ctx, cx, cy, R, t); return; }

    this.drawMachine(ctx, cx + sx, cy + sy, R, t, shakeK, s.phase === 'in' ? 0 : 1);
    if (s.phase === 'in') {
      const k = clamp(t / 1.2, 0, 1);
      for (const [sl, side] of [[s.A, -1], [s.B, 1]]) {
        const x = lerp(cx + side * W * 0.38, cx + side * R * 0.25, easeOut(k));
        const y = lerp(cy + R * 0.6, cy - R * 0.1, k) - Math.sin(k * Math.PI) * R * 1.4;
        ctx.save(); ctx.translate(x, y);
        drawSlime(ctx, sl, { r: R * 0.42 * (1 - k * 0.35), t, sq: Math.sin(t * 12) * 0.08, mood: 'happy', shadow: false });
        ctx.restore();
      }
    }
    if (s.phase === 'mix') {
      /* うずまき */
      const cols = [mainHex(s.A), mainHex(s.B)];
      for (let i = 0; i < 26; i++) {
        const a = t * (5 + shakeK * 10) + (i / 26) * TAU;
        const rr = R * (0.55 - shakeK * 0.3) * (0.6 + 0.4 * Math.sin(i * 1.7));
        ctx.fillStyle = cols[i % 2];
        ctx.beginPath(); ctx.arc(cx + sx + Math.cos(a) * rr, cy + sy - R * 0.1 + Math.sin(a) * rr * 0.6, R * 0.09, 0, TAU); ctx.fill();
      }
      /* かみなり */
      if (Math.random() < 0.35) {
        ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath();
        let x = cx + rand(-R, R), y = cy - R * 1.4;
        ctx.moveTo(x, y);
        for (let i = 0; i < 5; i++) { x += rand(-20, 20); y += R * 0.25; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(R * 0.2)}px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('ごうせいちゅう' + '.'.repeat(1 + Math.floor(t * 3) % 3), cx, cy + R * 1.55);
    }
    if (s.phase === 'flash') {
      const k = clamp((t - (s.flashT || t)) / 0.5, 0, 1);
      ctx.fillStyle = `rgba(255,255,255,${1 - k * 0.3})`; ctx.fillRect(0, 0, W, H);
    }
  },

  drawMachine(ctx, cx, cy, R, t, k, filled, dim) {
    ctx.save();
    if (dim) ctx.globalAlpha = 0.25;
    /* だい */
    ctx.fillStyle = '#5a5a7a';
    roundRect(ctx, cx - R * 1.2, cy + R * 0.55, R * 2.4, R * 0.5, 14); ctx.fill();
    ctx.fillStyle = '#7a7aa0'; roundRect(ctx, cx - R * 1.3, cy + R * 0.5, R * 2.6, R * 0.16, 8); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = Math.sin(t * 8 + i) > 0 ? '#7affb0' : '#2a6a4a';
      ctx.beginPath(); ctx.arc(cx - R * 0.8 + i * R * 0.4, cy + R * 0.82, R * 0.06, 0, TAU); ctx.fill();
    }
    /* ガラスの ドーム */
    const gl = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
    gl.addColorStop(0, 'rgba(160,220,255,0.15)'); gl.addColorStop(0.3, 'rgba(220,240,255,0.35)'); gl.addColorStop(1, 'rgba(160,220,255,0.1)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.moveTo(cx - R, cy + R * 0.5); ctx.lineTo(cx - R, cy - R * 0.4); ctx.arc(cx, cy - R * 0.4, R, Math.PI, 0); ctx.lineTo(cx + R, cy + R * 0.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,255,0.7)'; ctx.lineWidth = 3; ctx.stroke();
    if (filled) {
      ctx.fillStyle = `rgba(180,120,255,${0.25 + k * 0.4})`;
      ctx.beginPath(); ctx.moveTo(cx - R, cy + R * 0.5); ctx.lineTo(cx - R, cy - R * 0.1 + Math.sin(t * 4) * 5); ctx.quadraticCurveTo(cx, cy - R * 0.25, cx + R, cy - R * 0.1 + Math.cos(t * 4) * 5); ctx.lineTo(cx + R, cy + R * 0.5); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const bx = cx + Math.sin(i * 2.3) * R * 0.7, by = cy + R * 0.4 - ((t * 60 + i * 37) % (R * 0.6));
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(bx, by, 4, 0, TAU); ctx.fill();
      }
    }
    /* てっぺんの アンテナ */
    ctx.strokeStyle = '#9a9ac0'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, cy - R * 1.4); ctx.lineTo(cx, cy - R * 1.65); ctx.stroke();
    ctx.fillStyle = k > 0 ? (Math.sin(t * 20) > 0 ? '#ff5a5a' : '#ffd23a') : '#7affb0';
    ctx.beginPath(); ctx.arc(cx, cy - R * 1.7, 9, 0, TAU); ctx.fill();
    ctx.restore();
  },

  drawWheel(ctx, cx, cy, R) {
    const w = this.st.wheel;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#2a1a4a'; ctx.beginPath(); ctx.arc(0, 0, R + 14, 0, TAU); ctx.fill();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      ctx.fillStyle = (i + Math.floor(G.time * 6)) % 2 ? '#ffd23a' : '#fff6c0';
      ctx.beginPath(); ctx.arc(Math.cos(a) * (R + 7), Math.sin(a) * (R + 7), 4, 0, TAU); ctx.fill();
    }
    ctx.rotate(w.ang - Math.PI / 2);
    w.segs.forEach((g, i) => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, g.a0, g.a1); ctx.closePath();
      ctx.fillStyle = i % 2 ? g.col : shade(g.col, 0.25); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      const mid = (g.a0 + g.a1) / 2;
      const span = g.a1 - g.a0;
      ctx.save(); ctx.rotate(mid);
      if (span > 0.16 && g.icon) ctx.drawImage(g.icon, R * 0.72 - 22, -22, 44, 44);
      if (span > 0.2) {
        /* 左はんぶんでは 字が さかさまに ならないよう 裏がえす */
        const ga = ((mid + w.ang - Math.PI / 2) % TAU + TAU) % TAU;
        const flip = ga > Math.PI / 2 && ga < Math.PI * 1.5;
        if (flip) ctx.rotate(Math.PI);
        ctx.font = `900 ${span > 0.5 ? 15 : 12}px ${FONT}`; ctx.textAlign = flip ? 'left' : 'right'; ctx.textBaseline = 'middle';
        const lx = flip ? -R * 0.5 : R * 0.5;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(g.label, lx, 0);
        ctx.fillStyle = '#fff'; ctx.fillText(g.label, lx, 0);
      }
      ctx.restore();
    });
    ctx.restore();
    /* まんなかと はり */
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff3a5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy - R + 18); ctx.lineTo(cx - 16, cy - R - 20); ctx.lineTo(cx + 16, cy - R - 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (w.done) {
      const seg = w.hit;
      ctx.save(); ctx.translate(cx, cy);
      ctx.rotate(w.ang - Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, seg.a0, seg.a1); ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(G.time * 12) * 0.2})`; ctx.fill();
      ctx.restore();
    }
  },

  drawBorn(ctx, cx, cy, R, t) {
    const s = this.st;
    const k = clamp(s.born / 0.6, 0, 1);
    ctx.save(); ctx.translate(cx, cy);
    ctx.rotate(t * 0.4);
    for (let i = 0; i < 14; i++) {
      ctx.rotate(TAU / 14);
      ctx.fillStyle = i % 2 ? 'rgba(255,240,150,0.18)' : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-R * 0.4, -Math.max(G.W, G.H)); ctx.lineTo(R * 0.4, -Math.max(G.W, G.H)); ctx.fill();
    }
    ctx.restore();
    const c = s.res.child;
    const r = slimeR(c, Math.min(G.W * 0.3, G.H * 0.2));
    ctx.save();
    ctx.translate(cx, cy - Math.sin(k * Math.PI) * R * 0.5);
    const sc = k < 1 ? easeOut(k) * 1.15 : 1 + Math.sin(t * 3) * 0.02;
    ctx.scale(sc, sc);
    drawSlime(ctx, c, { r, t, mood: 'happy', sq: Math.sin(t * 5) * 0.03 });
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(Math.min(34, G.W / 14))}px ${FONT}`;
    ctx.lineWidth = 6; ctx.strokeStyle = '#2a1a4a';
    const label = spName(c);
    const y = Math.max(40, cy - r * 1.75 - 40);
    ctx.strokeText(label, cx, y); ctx.fillStyle = '#fff6c0'; ctx.fillText(label, cx, y);
    ctx.font = `800 15px ${FONT}`; ctx.fillStyle = '#d8d0ff';
    ctx.fillText(`おおきさ ${c.size}　Lv ${c.lv}`, cx, y + 26);
    if (s.born < 1.2) for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#fff'; star(ctx, cx + rand(-R * 1.5, R * 1.5), cy + rand(-R, R), rand(4, 10), 4);
    }
  },
};

/* =========================================================================
   パーツの つけかえ
   ========================================================================= */
const Editor = {
  s: null, type: null, done: null, drag: null, canvas: null,

  open(s, type, done) {
    this.s = s; this.done = done; this.drag = null;
    this.type = type && s.unlocked.includes(type) ? type : s.unlocked[0] || null;
    G.mode = 'editor';
    UI.hideAll();
    el('editor').classList.remove('hidden');
    this.canvas = el('edCanvas');
    this.renderPalette();
  },
  close() {
    el('editor').classList.add('hidden');
    saveGame();
    const d = this.done; this.done = null; this.s = null;
    if (d) d();
  },
  renderPalette() {
    const s = this.s;
    const box = el('edPalette');
    box.innerHTML = '';
    if (!s.unlocked.length) box.innerHTML = '<p class="dim">まだ つけられる パーツが ないよ。ごうせいすると ふえる！</p>';
    for (const t of PART_IDS) {
      if (!s.unlocked.includes(t)) continue;
      const b = h('button', 'pchip' + (this.type === t ? ' on' : ''), `<span class="pic">${PARTS[t].icon}</span>${PARTS[t].name}<small>${partCount(s, t)}/${PARTS[t].cap(s.size)}</small>`);
      b.onclick = () => { this.type = t; Sfx.ui(); this.renderPalette(); };
      box.appendChild(b);
    }
    el('edInfo').textContent = this.type ? `${PARTS[this.type].name}: ${PARTS[this.type].info}` : '';
    el('edName').textContent = `${spName(s)}　おおきさ ${s.size}`;
  },
  geom() {
    const c = this.canvas;
    const W = c.clientWidth, H = c.clientHeight;
    const R = Math.min(W, H) * 0.28;
    return { W, H, cx: W / 2, cy: H * 0.55, R };
  },
  /* キャンバスの 中の 点 → からだの 角度 */
  angleAt(x, y) {
    const { cx, cy } = this.geom();
    return Math.atan2(x - cx, -(y - cy));
  },
  nearPart(x, y) {
    const { cx, cy, R } = this.geom();
    const shape = spOf(this.s).shape;
    let best = -1, bd = 1e9;
    this.s.parts.forEach((p, i) => {
      const [ux, uy] = bodyPt(p.a, shape);
      const d = Math.hypot(cx + ux * R - x, cy + uy * R - y);
      if (d < bd) { bd = d; best = i; }
    });
    return bd < R * 0.28 ? best : -1;
  },
  down(x, y) {
    const i = this.nearPart(x, y);
    if (i >= 0) { this.drag = { i, moved: false, x, y }; return; }
    const { cx, cy, R } = this.geom();
    if (Math.hypot(x - cx, y - cy) > R * 1.9) return;
    const t = this.type;
    if (!t) return;
    if (partCount(this.s, t) >= PARTS[t].cap(this.s.size)) { toast(`${PARTS[t].name}は もう つけられないよ (大きく なると ふえる ものも あるよ)`); Sfx.bad(); return; }
    this.s.parts.push({ t, a: this.angleAt(x, y) });
    this.drag = { i: this.s.parts.length - 1, moved: true, x, y, fresh: true };
    Sfx.place();
    this.renderPalette();
  },
  move(x, y) {
    if (!this.drag) return;
    if (Math.hypot(x - this.drag.x, y - this.drag.y) > 6) this.drag.moved = true;
    if (this.drag.moved) this.s.parts[this.drag.i].a = this.angleAt(x, y);
  },
  up() {
    if (!this.drag) return;
    if (!this.drag.moved && !this.drag.fresh) { this.s.parts.splice(this.drag.i, 1); Sfx.split(); this.renderPalette(); }
    this.drag = null;
  },
  clear() { this.s.parts = []; this.renderPalette(); },

  draw() {
    if (!this.s) return;
    const c = this.canvas;
    const dpr = G.dpr;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { cx, cy, R } = this.geom();
    const g = x.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#2e4a6a'); g.addColorStop(1, '#101828');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* つけられる ふちを うすく */
    x.save(); x.translate(cx, cy);
    x.setLineDash([6, 8]); x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 2;
    bodyPath(x, R * 1.08, spOf(this.s).shape); x.stroke(); x.setLineDash([]);
    drawSlime(x, this.s, { r: R, t: G.time, mood: 'happy', look: 0 });
    x.restore();
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = `700 12px ${FONT}`; x.textAlign = 'center';
    x.fillText('ふちを タップで つける ／ ドラッグで うごかす ／ タップで はずす', W / 2, H - 12);
  },
};

/* =========================================================================
   ごうせいだいの 画面 (2ひき えらぶ)
   ========================================================================= */
const Lab = {
  sel: [null, null],
  slot: 0,

  open() {
    this.sel = this.sel.filter((id) => id && slimeById(id));
    while (this.sel.length < 2) this.sel.push(null);
    UI.screen('ごうせいだい', (body) => this.render(body));
  },
  render(body) {
    body.innerHTML = '';
    const top = h('div', 'labTop');
    for (let i = 0; i < 2; i++) {
      const id = this.sel[i];
      const s = id && slimeById(id);
      const slot = h('button', 'labSlot' + (this.slot === i ? ' on' : ''));
      if (s) { slot.appendChild(slimeCanvas(s, 96)); slot.appendChild(h('div', 'nm', `${spName(s)}<br><small>Lv${s.lv} おおきさ${s.size}</small>`)); }
      else slot.appendChild(h('div', 'nm empty', `${i + 1}ぴきめを<br>えらんでね`));
      slot.onclick = () => { this.slot = i; if (s) this.sel[i] = null; Sfx.ui(); this.render(body); };
      top.appendChild(slot);
      if (i === 0) top.appendChild(h('div', 'plus', '＋'));
    }
    body.appendChild(top);
    const A = this.sel[0] && slimeById(this.sel[0]), B = this.sel[1] && slimeById(this.sel[1]);
    const prev = h('div', 'labPrev');
    if (A && B) {
      const plan = fusionPlan(A, B);
      let t;
      if (plan.wheel) t = plan.wheel.some((w) => w.kind === 'grow') ? '🎡 ルーレットで しんか！ (大きくなる か、色の スライムに なる か…)' : '🎡 ルーレットで どちらに なるか きまる！ (おおきさ ＋1)';
      else if (plan.recipe) t = P.seen[plan.sp] ? `✨ ひみつのレシピ: ${SP[plan.sp].name}` : '✨ なにかが おこりそう…！？';
      else t = (P.seen[plan.sp] ? `→ ${SP[plan.sp].name}` : '→ ？？？ (まだ 見たことが ない スライム)') + (plan.grow ? ' (おおきさ ＋1)' : '');
      prev.innerHTML = `<b>${t}</b><br><small>パーツ・色・とくせいの 一部は うけつがれるよ。2ひきは 1ぴきに なるよ</small>`;
    } else prev.innerHTML = '<small>スライムを 2ひき えらんで ごうせいだいに いれよう。トゲの ついた スライムと くっつけると トゲの とくちょうが のこるよ</small>';
    body.appendChild(prev);
    const go = h('button', 'btn primary big labGo', 'ごうせい！');
    go.disabled = !(A && B);
    go.onclick = () => {
      if (P.slimes.length <= 1) return;
      Sfx.ui();
      this.sel = [null, null]; this.slot = 0;
      Movie.start(A, B);
    };
    body.appendChild(go);
    body.appendChild(h('h3', 'sec', 'スライムを えらぶ'));
    const grid = h('div', 'sgrid');
    for (const s of P.slimes) {
      const used = this.sel.includes(s.id);
      const card = UI.slimeCard(s, { used });
      card.onclick = () => {
        if (used) return;
        this.sel[this.slot] = s.id;
        this.slot = this.sel[0] && !this.sel[1] ? 1 : this.sel[1] && !this.sel[0] ? 0 : this.slot;
        Sfx.ui(); this.render(body);
      };
      grid.appendChild(card);
    }
    body.appendChild(grid);
    if (P.slimes.length < 2) body.appendChild(h('p', 'dim', 'スライムが 1ぴきしか いないよ。ショップで ただのスライムを かうか、とうばつで なかまを ふやそう'));
  },
};
