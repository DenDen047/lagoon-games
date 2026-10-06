/* =========================================================================
   NEKO MART ― おえかき
   ラッピング / ポスター / 看板 をかく画面
   ========================================================================= */
'use strict';

const Paint = {
  el: null, cv: null, ctx: null, opts: null,
  tool: 'pen', size: 1, color: '#2b2230', stamp: '🐾',
  undo: [], used: new Set(), drawing: false, last: null,
  PALETTE: ['#2b2230', '#ffffff', '#ff5f6a', '#ff9b5a', '#ffd23f', '#8fd17a', '#2e9e5a', '#6cc3e8',
    '#3a6fd0', '#b59cf0', '#ff8fc8', '#a87850', '#f3dfb8', '#9aa3ad', '#ffc7d4', '#cdf0ff'],
  STAMPS: ['🐾', '❤️', '⭐', '🐟', '🌸', '✨', '🎀', '🍓', '🍀', 'hero'],
  SIZES: { pen: [2, 5, 10], eraser: [6, 12, 22], stamp: [18, 30, 46], text: [12, 20, 32] },

  build() {
    const el = document.createElement('div');
    el.id = 'paint';
    el.className = 'modal hide';
    el.innerHTML = `
      <div class="mcard pcard">
        <div class="mhead"><h2 id="pTitle"></h2></div>
        <div class="pbody">
          <div class="pmain"><canvas id="pCanvas"></canvas></div>
          <div class="pside">
            <canvas id="pPrev" width="128" height="128"></canvas>
            <p class="phint" id="pHint"></p>
          </div>
        </div>
        <div class="ptools" id="pTools">
          <button data-tool="pen" class="on">✏️ ペン</button>
          <button data-tool="eraser">🧽 けしゴム</button>
          <button data-tool="fill">🪣 ぬりつぶし</button>
          <button data-tool="stamp">🐾 スタンプ</button>
          <button data-tool="text">🔤 文字</button>
          <span class="sep"></span>
          <button data-size="0">小</button><button data-size="1" class="on">中</button><button data-size="2">大</button>
        </div>
        <div class="ppal" id="pPal"></div>
        <div class="pstamps hide" id="pStamps"></div>
        <div class="ptext hide" id="pTextRow"><input id="pText" maxlength="14" placeholder="文字を入れて、絵をタップ"></div>
        <div class="mfoot">
          <button class="btn ghost" id="pUndo">↩︎ もどす</button>
          <button class="btn ghost" id="pClear">ぜんぶけす</button>
          <span class="grow"></span>
          <button class="btn" id="pCancel">やめる</button>
          <button class="btn primary" id="pDone">できた!</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    this.cv = el.querySelector('#pCanvas');
    this.ctx = this.cv.getContext('2d', { willReadFrequently: true });
    this.prev = el.querySelector('#pPrev');
    const pal = el.querySelector('#pPal');
    pal.innerHTML = this.PALETTE.map((c) => `<button data-col="${c}" style="background:${c}"></button>`).join('') +
      '<label class="pcustom" title="ほかの色"><input type="color" id="pColor" value="#ff5f6a"></label>';
    const st = el.querySelector('#pStamps');
    st.innerHTML = this.STAMPS.map((s) => s === 'hero' ? '<button data-stamp="hero" class="herostamp"><canvas width="40" height="40"></canvas></button>' : `<button data-stamp="${s}">${s}</button>`).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      Sound.play('click');
      if (b.dataset.tool) this.setTool(b.dataset.tool);
      else if (b.dataset.size) { this.size = +b.dataset.size; this.mark('[data-size]', b); }
      else if (b.dataset.col) { this.color = b.dataset.col; this.mark('[data-col]', b); if (this.tool === 'eraser') this.setTool('pen'); }
      else if (b.dataset.stamp) { this.stamp = b.dataset.stamp; this.mark('[data-stamp]', b); }
      else if (b.id === 'pUndo') this.doUndo();
      else if (b.id === 'pClear') { this.push(); this.clear(); this.updatePrev(); }
      else if (b.id === 'pCancel') this.close();
      else if (b.id === 'pDone') this.done();
    });
    el.querySelector('#pColor').addEventListener('input', (e) => { this.color = e.target.value; this.mark('[data-col]', null); });
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => this.down(e));
    cv.addEventListener('pointermove', (e) => this.move(e));
    const up = () => { if (this.drawing) { this.drawing = false; this.updatePrev(); } };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('lostpointercapture', up);
  },
  mark(sel, b) {
    this.el.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b));
  },
  setTool(t) {
    this.tool = t;
    this.mark('[data-tool]', this.el.querySelector(`[data-tool="${t}"]`));
    this.el.querySelector('#pStamps').classList.toggle('hide', t !== 'stamp');
    this.el.querySelector('#pTextRow').classList.toggle('hide', t !== 'text');
  },

  /* opts: { w, h, data, bg, title, hint, text, preview(ctx, canvas), onDone({data, ink, colors}) } */
  open(opts) {
    if (!this.el) this.build();
    this.opts = opts;
    this.cv.width = opts.w; this.cv.height = opts.h;
    this.el.querySelector('#pTitle').textContent = opts.title;
    this.el.querySelector('#pHint').textContent = opts.hint || '';
    this.el.querySelector('#pText').value = opts.text || '';
    this.prev.classList.toggle('hide', !opts.preview);
    const maxW = Math.min(window.innerWidth - 48, opts.preview ? 380 : 460);
    const maxH = Math.min(window.innerHeight * 0.42, 380);
    const k = Math.min(maxW / opts.w, maxH / opts.h);
    this.cv.style.width = Math.round(opts.w * k) + 'px';
    this.cv.style.height = Math.round(opts.h * k) + 'px';
    this.undo = []; this.used = new Set();
    this.clear();
    if (opts.data) {
      const img = new Image();
      img.onload = () => { this.ctx.drawImage(img, 0, 0, opts.w, opts.h); this.updatePrev(); };
      img.src = opts.data;
    } else if (opts.init) { opts.init(this.ctx, opts.w, opts.h); }
    this.setTool('pen');
    const hc = this.el.querySelector('.herostamp canvas');
    if (hc && G) {
      const c = hc.getContext('2d');
      c.clearRect(0, 0, 40, 40);
      drawAnimal(c, 20, 37, { ...R.player.look, size: 0.82 }, { dir: 'd', t: 0 });
    }
    this.el.classList.remove('hide');
    this.updatePrev();
  },
  close() { this.el.classList.add('hide'); this.opts = null; },
  clear() {
    this.ctx.fillStyle = this.opts.bg || '#ffffff';
    this.ctx.fillRect(0, 0, this.cv.width, this.cv.height);
  },
  push() {
    this.undo.push(this.ctx.getImageData(0, 0, this.cv.width, this.cv.height));
    if (this.undo.length > 25) this.undo.shift();
  },
  doUndo() {
    const d = this.undo.pop();
    if (d) { this.ctx.putImageData(d, 0, 0); this.updatePrev(); }
  },
  pos(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * this.cv.width / r.width, y: (e.clientY - r.top) * this.cv.height / r.height };
  },
  down(e) {
    e.preventDefault();
    this.cv.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.push();
    const sz = this.SIZES[this.tool] ? this.SIZES[this.tool][this.size] : 0;
    if (this.tool === 'pen' || this.tool === 'eraser') {
      this.drawing = true;
      this.last = p;
      if (this.tool === 'pen') this.used.add(this.color);
      this.line(p, p, sz);
    } else if (this.tool === 'fill') {
      this.used.add(this.color);
      this.flood(Math.floor(p.x), Math.floor(p.y), this.color);
      this.updatePrev();
    } else if (this.tool === 'stamp') {
      this.putStamp(p, sz);
      this.updatePrev();
    } else if (this.tool === 'text') {
      const t = this.el.querySelector('#pText').value.trim();
      if (!t) { Toast.show('先に文字を入れてね'); this.undo.pop(); return; }
      this.used.add(this.color);
      const ctx = this.ctx;
      ctx.font = `900 ${sz}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = this.color;
      ctx.fillText(t, p.x, p.y);
      this.updatePrev();
    }
  },
  move(e) {
    if (!this.drawing) return;
    const p = this.pos(e);
    this.line(this.last, p, this.SIZES[this.tool][this.size]);
    this.last = p;
  },
  line(a, b, sz) {
    const ctx = this.ctx;
    ctx.strokeStyle = this.tool === 'eraser' ? (this.opts.bg || '#ffffff') : this.color;
    ctx.lineWidth = sz; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke();
  },
  putStamp(p, sz) {
    const ctx = this.ctx;
    if (this.stamp === 'hero') {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      drawAnimal(c.getContext('2d'), 48, 90, { ...R.player.look, size: 1.9 }, { dir: 'd', t: 0 });
      ctx.drawImage(c, p.x - sz * 0.75, p.y - sz * 0.75, sz * 1.5, sz * 1.5);
      this.used.add('hero');
      return;
    }
    ctx.font = `${sz}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.stamp, p.x, p.y);
    this.used.add(this.stamp);
  },
  /* ぬりつぶし。近い色ごとまとめて塗る */
  flood(x, y, hex) {
    const w = this.cv.width, h = this.cv.height;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const img = this.ctx.getImageData(0, 0, w, h), d = img.data;
    const n = parseInt(hex.slice(1), 16);
    const fr = (n >> 16) & 255, fg = (n >> 8) & 255, fb = n & 255;
    const i0 = (y * w + x) * 4;
    const sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2];
    if (Math.abs(sr - fr) + Math.abs(sg - fg) + Math.abs(sb - fb) < 8) return;
    const same = (i) => Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) < 96;
    const seen = new Uint8Array(w * h);
    const stack = [x, y];
    while (stack.length) {
      const cy = stack.pop(), cx = stack.pop();
      let lx = cx;
      while (lx >= 0 && !seen[cy * w + lx] && same((cy * w + lx) * 4)) lx--;
      lx++;
      let up = false, dn = false;
      for (let px = lx; px < w; px++) {
        const k = cy * w + px;
        if (seen[k] || !same(k * 4)) break;
        seen[k] = 1;
        d[k * 4] = fr; d[k * 4 + 1] = fg; d[k * 4 + 2] = fb; d[k * 4 + 3] = 255;
        if (cy > 0) { const u = k - w; const ok = !seen[u] && same(u * 4); if (ok && !up) { stack.push(px, cy - 1); } up = ok; }
        if (cy < h - 1) { const v = k + w; const ok = !seen[v] && same(v * 4); if (ok && !dn) { stack.push(px, cy + 1); } dn = ok; }
      }
    }
    this.ctx.putImageData(img, 0, 0);
  },
  /* 下地とちがう色のマスの割合 */
  ink() {
    const w = this.cv.width, h = this.cv.height;
    const d = this.ctx.getImageData(0, 0, w, h).data;
    const n = parseInt((this.opts.bg || '#ffffff').slice(1), 16);
    const br = (n >> 16) & 255, bg = (n >> 8) & 255, bb = n & 255;
    let c = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 60) c++;
    }
    return c / (w * h);
  },
  updatePrev() {
    if (!this.opts || !this.opts.preview) return;
    const c = this.prev.getContext('2d');
    c.clearRect(0, 0, 128, 128);
    c.save(); c.scale(2, 2);
    this.opts.preview(c, this.cv);
    c.restore();
  },
  done() {
    const o = this.opts;
    const res = { data: this.cv.toDataURL('image/png'), ink: this.ink(), colors: Math.max(this.used.size, o.prevColors || 0) };
    this.close();
    Sound.play('craft');
    o.onDone(res);
  },
};
