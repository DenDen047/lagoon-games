/* =========================================================================
   PARTY MAKER ― おえかき板
   線は座標の列として持っておき、消すときは全部引き直す。
   こうすると「ひとつ戻す」が軽く、あとで小さく描き直すのも同じ処理でできる。
   ========================================================================= */
'use strict';

const PAINT_W = 900;
const PAINT_H = 560;

const INK_COLORS = [
  '#1d2333', '#ff4d6d', '#ff9f1c', '#ffd23f', '#38b000',
  '#00b4d8', '#3a86ff', '#8338ec', '#c9184a', '#8d6e46',
];
const PEN_SIZES = [4, 10, 22];

class Paint {
  constructor() {
    this.strokes = [];
    this.current = null;
    this.color = INK_COLORS[0];
    this.size = PEN_SIZES[1];
    this.erasing = false;

    this.canvas = el('canvas', { class: 'paint-canvas', width: PAINT_W, height: PAINT_H });
    this.ctx = this.canvas.getContext('2d');
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.redraw();

    this.node = el('div', 'paint', [
      el('div', 'paint-sheet', this.canvas),
      this.buildTools(),
    ]);

    this.bindPointer();
  }

  /* ---------------- 道具 ---------------- */
  buildTools() {
    const swatches = INK_COLORS.map((c) => {
      const b = el('button', {
        class: 'swatch', type: 'button', style: { background: c }, title: c,
        onClick: () => { this.color = c; this.erasing = false; this.syncTools(); },
      });
      b.dataset.color = c;
      return b;
    });
    this.swatchEls = swatches;

    const sizes = PEN_SIZES.map((s, i) => {
      const b = el('button', {
        class: 'sizebtn', type: 'button', title: ['ほそい', 'ふつう', 'ふとい'][i],
        onClick: () => { this.size = s; this.syncTools(); },
      }, el('i', { style: { width: s + 'px', height: s + 'px' } }));
      b.dataset.size = s;
      return b;
    });
    this.sizeEls = sizes;

    this.eraserEl = el('button', {
      class: 'toolbtn', type: 'button',
      onClick: () => { this.erasing = !this.erasing; this.syncTools(); },
    }, '消しゴム');

    const tools = el('div', 'paint-tools', [
      el('div', 'tool-row', swatches),
      el('div', 'tool-row', [
        el('div', 'sizes', sizes),
        this.eraserEl,
        btn('ひとつ戻す', () => this.undo(), 'tiny'),
        btn('ぜんぶ消す', () => this.clear(), 'tiny danger'),
      ]),
    ]);
    this.syncTools();
    return tools;
  }

  syncTools() {
    this.swatchEls.forEach((b) => {
      b.classList.toggle('on', !this.erasing && b.dataset.color === this.color);
    });
    this.sizeEls.forEach((b) => b.classList.toggle('on', Number(b.dataset.size) === this.size));
    this.eraserEl.classList.toggle('on', this.erasing);
  }

  /* ---------------- 入力 ---------------- */
  bindPointer() {
    const cv = this.canvas;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (PAINT_W / r.width),
        y: (e.clientY - r.top) * (PAINT_H / r.height),
      };
    };

    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.current = {
        color: this.color, size: this.erasing ? this.size * 2.4 : this.size,
        erase: this.erasing, pts: [p, p],
      };
      this.strokes.push(this.current);
      this.redraw();
    });

    cv.addEventListener('pointermove', (e) => {
      if (!this.current) return;
      e.preventDefault();
      const p = pos(e);
      const pts = this.current.pts;
      const last = pts[pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
      pts.push(p);
      this.redraw();
    });

    const end = () => { this.current = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', end);
  }

  /* ---------------- 描画 ---------------- */
  redraw() {
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, PAINT_W, PAINT_H);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const s of this.strokes) {
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = s.erase ? '#ffffff' : s.color;
      c.lineWidth = s.size;
      c.beginPath();
      c.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i < s.pts.length; i++) c.lineTo(s.pts[i].x, s.pts[i].y);
      c.stroke();
    }
  }

  undo() { this.strokes.pop(); this.redraw(); }
  clear() { this.strokes = []; this.redraw(); }
  isBlank() { return this.strokes.length === 0; }
  toDataURL() { return this.canvas.toDataURL('image/png'); }
}

/* 描き上がった絵を貼るための img。読み込み前でも場所を取るようにしておく。 */
function drawingView(dataUrl, cls) {
  return el('div', 'shown-drawing ' + (cls || ''), el('img', { src: dataUrl, alt: '描かれた絵' }));
}
