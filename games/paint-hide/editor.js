/* =========================================================================
   PAINT & HIDE ― ぬりえの 画面
   ふで・ぬりつぶし・スポイトで 自分を ぬり、からだの 形を かえる。
   ゲーム中に ひらくと、うしろに 今 立っている 場所の けしきが 出るので、まねして ぬれる。
   ========================================================================= */
'use strict';

const PALETTE = ['#ffffff', '#d9dee6', '#8d939a', '#3a3f48', '#1a1d24', '#e8403f', '#f28a2e', '#f5c932', '#7ac943',
  '#34b86a', '#2ec5d3', '#3a7bf0', '#9b59d6', '#f27fb5', '#b5814f', '#8a5a34', '#ffe0c4', '#c9dbee'];
const BRUSH = [2.5, 5, 9];
const SHAPE_LABEL = { bw: 'からだの はば', bh: 'からだの たかさ', fr: 'かおの 大きさ' };

const Editor = {
  skin: null, done: null, where: null,
  tool: 'brush', size: 1, color: '#e8403f',
  undo: [], drawing: false, last: null, k: 4, ox: 0, oy: 0,

  isOpen() { return !!this.skin; },

  init() {
    const pal = el('edPal');
    pal.innerHTML = PALETTE.map((c) => `<button class="sw" data-col="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') +
      '<label class="sw pick" aria-label="じゆうな 色"><input type="color" id="edPick" value="#e8403f"></label>';
    pal.addEventListener('click', (ev) => { const b = ev.target.closest('[data-col]'); if (b) this.setColor(b.dataset.col); });
    el('edPick').addEventListener('input', (ev) => this.setColor(ev.target.value));
    el('edTools').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tool]'); if (!b) return;
      Sfx.ui();
      if (b.dataset.tool === 'undo') this.doUndo();
      else if (b.dataset.tool === 'reset') this.reset();
      else { this.tool = b.dataset.tool; this.reflect(); }
    });
    el('edSizes').addEventListener('click', (ev) => { const b = ev.target.closest('[data-size]'); if (b) { this.size = +b.dataset.size; this.tool = 'brush'; this.reflect(); Sfx.ui(); } });
    el('edShape').innerHTML = Object.keys(SHAPE).map((k) => `<label class="slider"><span>${SHAPE_LABEL[k]}</span><input type="range" data-k="${k}" min="${SHAPE[k][0]}" max="${SHAPE[k][1]}" step="0.5"></label>`).join('');
    el('edShape').addEventListener('pointerdown', () => this.pushUndo());
    el('edShape').addEventListener('keydown', (ev) => { if (!ev.repeat) this.pushUndo(); });
    el('edShape').addEventListener('input', (ev) => {
      const k = ev.target.dataset.k; if (!k) return;
      this.skin.shape[k] = +ev.target.value; this.skin.ver++; this.render();
    });
    el('edDone').addEventListener('click', () => { Sfx.ui(); this.close(); });
    const cv = el('edCv');
    cv.addEventListener('pointerdown', (ev) => {
      if (!this.skin) return;
      ev.preventDefault();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* なくてもよい */ }
      const [x, y] = this.local(ev);
      if (this.tool === 'dropper') { this.pick(ev); return; }
      this.pushUndo();
      if (this.tool === 'fill') {
        const part = this.skin.partAt(x, y);
        if (part) { this.skin.fillPart(part, this.color); Sfx.paint(); this.render(); }
        return;
      }
      this.drawing = true; this.last = [x, y];
      this.skin.stroke(x, y, x, y, BRUSH[this.size], this.color);
      Sfx.paint();
      this.render();
    });
    cv.addEventListener('pointermove', (ev) => {
      if (!this.drawing) return;
      const [x, y] = this.local(ev);
      this.skin.stroke(this.last[0], this.last[1], x, y, BRUSH[this.size], this.color);
      this.last = [x, y];
      Sfx.paint();
      this.render();
    });
    const up = () => { this.drawing = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  },

  /* skin を その場で ぬる。where は ゲーム中の 立ち位置 (けしきを うしろに 出す) */
  open(skin, where, done) {
    this.skin = skin; this.where = where; this.done = done; this.undo = [];
    el('editor').classList.remove('hidden');
    el('edTitle').textContent = where ? 'まわりに にせて ぬろう' : 'じぶんを ぬろう';
    this.makeBack();
    this.fit();
    this.reflect();
    Input.clear();
    Sfx.ui();
  },
  close() {
    if (!this.skin) return;
    const done = this.done;
    this.skin = null; this.done = null;
    el('editor').classList.add('hidden');
    if (done) done();
  },

  /* うしろの けしき。ゲーム中なら 立っている 場所、タイトルなら ホールの じゅうたんの 上 */
  makeBack() {
    if (!Art.map) Art.buildMap(1);
    const w = this.where || { x: 26.5 * TILE, y: 23.5 * TILE };
    const c = this.back || (this.back = makeCanvas(BOX.w * 4, BOX.h * 4));
    const g = c.getContext('2d'), s = Art.mapScale;
    g.drawImage(Art.map, (w.x + BOX.x) * s, (w.y + BOX.y) * s, BOX.w * s, BOX.h * s, 0, 0, c.width, c.height);
  },

  fit() {
    const cv = el('edCv');
    const wide = G.W > G.H * 1.1;
    const hMax = wide ? G.H - 110 : G.H * 0.5;
    const wMax = wide ? G.W * 0.38 : G.W * 0.9;
    const k = Math.max(2, Math.min(hMax / BOX.h, wMax / BOX.w));
    this.k = k;
    cv.style.width = Math.round(BOX.w * k) + 'px'; cv.style.height = Math.round(BOX.h * k) + 'px';
    cv.width = Math.round(BOX.w * k * G.dpr); cv.height = Math.round(BOX.h * k * G.dpr);
    if (this.skin) this.render();
  },

  local(ev) {
    const r = el('edCv').getBoundingClientRect();
    return [(ev.clientX - r.left) / r.width * BOX.w + BOX.x, (ev.clientY - r.top) / r.height * BOX.h + BOX.y];
  },

  render() {
    const cv = el('edCv'), g = cv.getContext('2d'), k = this.k * G.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.back, 0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, -BOX.x * k, -BOX.y * k);
    drawChar(g, this.skin, 0, 0, {});
    /* ぬれる はんいが わかるよう、うすく ふちどり */
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.4; g.setLineDash([1.5, 1.5]);
    const P = partsOf(this.skin.shape);
    for (const p of Object.values(P)) { partPath(g, p); g.stroke(); }
    g.setLineDash([]);
  },

  pick(ev) {
    const cv = el('edCv'), r = cv.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / r.width * cv.width), y = Math.floor((ev.clientY - r.top) / r.height * cv.height);
    const d = cv.getContext('2d').getImageData(clamp(x, 0, cv.width - 1), clamp(y, 0, cv.height - 1), 1, 1).data;
    this.setColor('#' + hex2(d[0]) + hex2(d[1]) + hex2(d[2]));
    this.tool = 'brush';
    this.reflect();
    Sfx.tap();
  },

  setColor(c) {
    this.color = c;
    el('edPick').value = c;
    if (this.tool === 'dropper') this.tool = 'brush';
    this.reflect();
  },

  pushUndo() {
    if (!this.skin) return;
    this.undo.push(this.skin.clone());
    if (this.undo.length > 25) this.undo.shift();
  },
  doUndo() {
    const prev = this.undo.pop();
    if (!prev) return;
    this.skin.copyFrom(prev);
    this.reflect();
  },
  reset() {
    this.pushUndo();
    this.skin.copyFrom(makeSkin('#3a7bf0', '#ffe0c4'));
    this.reflect();
  },

  reflect() {
    document.querySelectorAll('#edTools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === this.tool));
    document.querySelectorAll('#edSizes [data-size]').forEach((b) => b.classList.toggle('on', +b.dataset.size === this.size && this.tool === 'brush'));
    document.querySelectorAll('#edPal [data-col]').forEach((b) => b.classList.toggle('on', b.dataset.col === this.color));
    el('edNow').style.background = this.color;
    if (this.skin) document.querySelectorAll('#edShape input').forEach((i) => { i.value = this.skin.shape[i.dataset.k]; });
    if (this.skin) this.render();
  },
};
