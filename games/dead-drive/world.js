/* =========================================================================
   DEAD DRIVE ― マップ
   街（出撃）と基地（襲撃）を作り、動かない物の当たり判定と描画を受けもつ。
   ========================================================================= */
'use strict';

/* 血やタイヤ痕は、必要になった場所だけ半分の解像度の小さなキャンバスに描きためる */
class DecalLayer {
  constructor() { this.chunks = new Map(); this.size = 256; }
  chunk(ix, iy, make) {
    const k = ix + ',' + iy;
    let c = this.chunks.get(k);
    if (!c && make) {
      c = document.createElement('canvas'); c.width = c.height = this.size / 2;
      c.ctx = c.getContext('2d'); c.ix = ix; c.iy = iy;
      this.chunks.set(k, c);
    }
    return c;
  }
  paint(x, y, r, fn) {
    const s = this.size;
    const x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const c = this.chunk(ix, iy, true);
      c.ctx.save(); c.ctx.scale(0.5, 0.5); c.ctx.translate(-ix * s, -iy * s);
      fn(c.ctx);
      c.ctx.restore();
    }
  }
  splat(x, y, r, col = '#3d4a1f') {
    this.paint(x, y, r * 2.2, (ctx) => {
      ctx.fillStyle = rgba(col, 0.75);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      for (let i = 0; i < 7; i++) {
        const a = rand(TAU), d = rand(r * 0.6, r * 1.9), rr = rand(r * 0.12, r * 0.4);
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, TAU); ctx.fill();
      }
    });
  }
  smear(x, y, dx, dy, w, col = '#3d4a1f') {
    this.paint(x, y, Math.hypot(dx, dy) + w, (ctx) => {
      ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
    });
  }
  skid(x, y, a) {
    this.paint(x, y, 4, (ctx) => { ctx.fillStyle = `rgba(10,10,10,${a})`; ctx.fillRect(x - 2.5, y - 2.5, 5, 5); });
  }
  scorch(x, y, r) {
    this.paint(x, y, r, (ctx) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(10,8,6,0.7)'); g.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    });
  }
  draw(ctx, v) {
    const s = this.size;
    const x0 = Math.floor(v.x0 / s), x1 = Math.floor(v.x1 / s);
    const y0 = Math.floor(v.y0 / s), y1 = Math.floor(v.y1 / s);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const c = this.chunk(ix, iy, false);
      if (c) ctx.drawImage(c, ix * s, iy * s, s, s);
    }
  }
}

let ASPHALT = null;
function asphaltPattern(ctx) {
  if (ASPHALT) return ASPHALT;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#2d3035'; x.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 700; i++) {
    x.fillStyle = `rgba(${chance(0.5) ? '255,255,255' : '0,0,0'},${rand(0.02, 0.07)})`;
    x.fillRect(rand(96), rand(96), rand(1, 2.5), rand(1, 2.5));
  }
  ASPHALT = ctx.createPattern(c, 'repeat');
  return ASPHALT;
}

class World {
  constructor(w, h, kind) {
    this.w = w; this.h = h; this.kind = kind;
    this.solids = [];
    this.ground = [];     // { x, y, w, h, col }
    this.marks = [];      // 道路の白線など { x1, y1, x2, y2, col, w, dash }
    this.decor = [];      // 当たり判定のない飾り
    this.zones = [];
    this.gsize = 128;
    this.grid = new Map();
    this.qid = 1;
    this.decal = new DecalLayer();
  }

  addSolid(s) {
    this.solids.push(s);
    const g = this.gsize;
    const x0 = s.r ? s.x - s.r : s.x, x1 = s.r ? s.x + s.r : s.x + s.w;
    const y0 = s.r ? s.y - s.r : s.y, y1 = s.r ? s.y + s.r : s.y + s.h;
    for (let ix = Math.floor(x0 / g); ix <= Math.floor(x1 / g); ix++) {
      for (let iy = Math.floor(y0 / g); iy <= Math.floor(y1 / g); iy++) {
        const k = ix * 100003 + iy;
        let b = this.grid.get(k);
        if (!b) { b = []; this.grid.set(k, b); }
        b.push(s);
      }
    }
    return s;
  }

  nearStatic(x, y, r, out = []) {
    out.length = 0;
    const g = this.gsize, q = ++this.qid;
    for (let ix = Math.floor((x - r) / g); ix <= Math.floor((x + r) / g); ix++) {
      for (let iy = Math.floor((y - r) / g); iy <= Math.floor((y + r) / g); iy++) {
        const b = this.grid.get(ix * 100003 + iy);
        if (!b) continue;
        for (const s of b) { if (s._q === q || s.off) continue; s._q = q; out.push(s); }
      }
    }
    return out;
  }

  /* 円が動かない物にめりこんでいたら押し出す。最後にぶつかった物を返す */
  pushCircle(o, r) {
    const cands = this.nearStatic(o.x, o.y, r + 4, this._tmp || (this._tmp = []));
    let hit = null;
    for (const s of cands) {
      if (s.r) {
        const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy), m = r + s.r;
        if (d < m && d > 0.001) { o.x = s.x + dx / d * m; o.y = s.y + dy / d * m; hit = s; }
      } else {
        const qx = clamp(o.x, s.x, s.x + s.w), qy = clamp(o.y, s.y, s.y + s.h);
        const dx = o.x - qx, dy = o.y - qy, d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 0.001) { o.x = qx + dx / d * r; o.y = qy + dy / d * r; } else {
            const l = o.x - s.x, rr = s.x + s.w - o.x, t = o.y - s.y, b = s.y + s.h - o.y, m = Math.min(l, rr, t, b);
            if (m === l) o.x = s.x - r; else if (m === rr) o.x = s.x + s.w + r; else if (m === t) o.y = s.y - r; else o.y = s.y + s.h + r;
          }
          hit = s;
        }
      }
    }
    o.x = clamp(o.x, r, this.w - r); o.y = clamp(o.y, r, this.h - r);
    return hit;
  }

  free(x, y, r) {
    if (x < r || y < r || x > this.w - r || y > this.h - r) return false;
    for (const s of this.nearStatic(x, y, r + 2, this._tmp2 || (this._tmp2 = []))) {
      if (s.r) { if (dist(x, y, s.x, s.y) < r + s.r) return false; }
      else if (x > s.x - r && x < s.x + s.w + r && y > s.y - r && y < s.y + s.h + r) return false;
    }
    return true;
  }

  /* 弾をさえぎる物（建物・防壁）に点が入っているか。
     基地の防壁は低い土のう壁なので、味方の弾（friendly）は越えられる */
  shotBlock(x, y, friendly) {
    for (const s of this.nearStatic(x, y, 2, this._tmp3 || (this._tmp3 = []))) {
      if (!s.blocks || (friendly && (s.kind === 'wall' || s.kind === 'gate'))) continue;
      if (s.r) { if (dist(x, y, s.x, s.y) < s.r) return s; }
      else if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
  }

  /* ------------------------------ 描画 ------------------------------ */
  drawGround(ctx, v) {
    ctx.fillStyle = this.kind === 'base' ? '#3b3a2c' : asphaltPattern(ctx);
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    for (const g of this.ground) {
      if (g.x > v.x1 || g.y > v.y1 || g.x + g.w < v.x0 || g.y + g.h < v.y0) continue;
      ctx.fillStyle = g.pat ? asphaltPattern(ctx) : g.col;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      if (g.edge) { ctx.strokeStyle = g.edge; ctx.lineWidth = 2; ctx.strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2); }
    }
    for (const m of this.marks) {
      if (Math.max(m.x1, m.x2) < v.x0 || Math.min(m.x1, m.x2) > v.x1 || Math.max(m.y1, m.y2) < v.y0 || Math.min(m.y1, m.y2) > v.y1) continue;
      ctx.strokeStyle = m.col; ctx.lineWidth = m.w;
      ctx.setLineDash(m.dash || []);
      ctx.beginPath(); ctx.moveTo(m.x1, m.y1); ctx.lineTo(m.x2, m.y2); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const d of this.decor) {
      if (d.layer === 'top') continue;
      if (d.x > v.x1 + 60 || d.y > v.y1 + 60 || d.x < v.x0 - 60 || d.y < v.y0 - 60) continue;
      drawDecor(ctx, d);
    }
    this.decal.draw(ctx, v);
  }

  drawZones(ctx) {
    for (const z of this.zones) {
      if (z.hidden) continue;
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 4);
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.fillStyle = rgba(z.col, 0.1 + pulse * 0.06);
      ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(z.col, 0.8); ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]); ctx.lineDashOffset = -G.time * 30;
      ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (z.progress !== undefined && z.progress > 0) {
        ctx.strokeStyle = z.col; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(0, 0, z.r - 8, -Math.PI / 2, -Math.PI / 2 + TAU * z.progress); ctx.stroke();
      }
      ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(z.label, 0, -z.r - 10); ctx.fillStyle = '#fff'; ctx.fillText(z.label, 0, -z.r - 10);
      ctx.restore();
    }
  }

  drawTop(ctx, v) {
    for (const s of this.solids) {
      if (s.off && s.kind !== 'wall' && s.kind !== 'gate') continue;
      const ext = (s.lift || 0) + 40;
      const bx = s.r ? s.x - s.r : s.x, by = s.r ? s.y - s.r : s.y, bw = s.r ? s.r * 2 : s.w, bh = s.r ? s.r * 2 : s.h;
      if (bx > v.x1 + 40 || by > v.y1 + ext || bx + bw < v.x0 - 40 || by + bh < v.y0 - 40) continue;
      drawSolid(ctx, s);
    }
    for (const d of this.decor) {
      if (d.layer !== 'top') continue;
      if (d.x > v.x1 + 80 || d.y > v.y1 + 80 || d.x < v.x0 - 80 || d.y < v.y0 - 80) continue;
      drawDecor(ctx, d);
    }
  }

  /* 右上に出す小さな地図。作ったときに一度だけ描いておく */
  buildMinimap(size = 170) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const k = size / Math.max(this.w, this.h);
    x.fillStyle = this.kind === 'base' ? '#2f2e22' : '#202328'; x.fillRect(0, 0, size, size);
    for (const g of this.ground) { x.fillStyle = g.mini || g.col || '#34373c'; x.fillRect(g.x * k, g.y * k, Math.max(1, g.w * k), Math.max(1, g.h * k)); }
    for (const s of this.solids) {
      if (s.kind === 'bound') continue;
      x.fillStyle = s.kind === 'tree' ? '#2e5230' : s.kind === 'wreck' ? '#5a4a3a' : s.kind === 'wall' || s.kind === 'gate' ? '#a0927a' : '#6b6f78';
      if (s.r) { x.beginPath(); x.arc(s.x * k, s.y * k, Math.max(1, s.r * k), 0, TAU); x.fill(); }
      else x.fillRect(s.x * k, s.y * k, Math.max(1, s.w * k), Math.max(1, s.h * k));
    }
    this.mini = c; this.miniK = k;
  }
}

/* ------------------------------ 動かない物の絵 ------------------------------ */
function drawSolid(ctx, s) {
  switch (s.kind) {
    case 'bld': return drawBuilding(ctx, s);
    case 'tree': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(s.x + 6, s.y + 8, s.canopy, 0, TAU); ctx.fill();
      ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.canopy, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(s.col, 0.12);
      ctx.beginPath(); ctx.arc(s.x - s.canopy * 0.3, s.y - s.canopy * 0.3, s.canopy * 0.55, 0, TAU); ctx.fill();
      return;
    }
    case 'wreck': return drawWreck(ctx, s);
    case 'barrier': {
      ctx.fillStyle = '#8f8a80'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#b8b2a6'; ctx.fillRect(s.x, s.y, s.w, 3);
      ctx.fillStyle = '#d64a3a';
      const n = Math.max(1, Math.floor(Math.max(s.w, s.h) / 22));
      for (let i = 0; i < n; i++) {
        if (s.w > s.h) ctx.fillRect(s.x + (i + 0.3) * s.w / n, s.y + 4, s.w / n * 0.35, s.h - 8);
        else ctx.fillRect(s.x + 4, s.y + (i + 0.3) * s.h / n, s.w - 8, s.h / n * 0.35);
      }
      return;
    }
    case 'pump': {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#d64a3a'; ctx.fillRect(s.x + 3, s.y + 3, s.w - 6, 8);
      ctx.fillStyle = '#333'; ctx.fillRect(s.x + 5, s.y + s.h - 10, s.w - 10, 5);
      return;
    }
    case 'pallet': {
      ctx.fillStyle = '#8a6a42'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#a8845a';
      for (let i = 0; i < 3; i++) ctx.fillRect(s.x + 2, s.y + 3 + i * (s.h - 6) / 3, s.w - 4, (s.h - 6) / 3 - 3);
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(s.x + 5, s.y + 5, s.w * 0.4, s.h * 0.4);
      return;
    }
    case 'wall': case 'gate': return drawWall(ctx, s);
    case 'tower': return; // 砲台は combat.js が描く
    case 'hq': return drawBuilding(ctx, s);
    case 'bound': return;
  }
}

function drawBuilding(ctx, s) {
  const lift = s.lift;
  const x = s.x, y = s.y - lift, w = s.w, h = s.h;
  /* 南の壁面 */
  ctx.fillStyle = shade(s.col, -0.45);
  ctx.fillRect(x, s.y + s.h - lift, w, lift);
  if (s.windows) {
    ctx.fillStyle = 'rgba(255,230,160,0.13)';
    const n = Math.floor(w / 22);
    for (let i = 0; i < n; i++) for (let j = 0; j < Math.floor(lift / 14); j++) ctx.fillRect(x + 6 + i * 22, s.y + s.h - lift + 4 + j * 14, 10, 7);
  }
  /* 屋上 */
  ctx.fillStyle = s.col; ctx.fillRect(x, y, w, h);
  if (s.house) {
    ctx.fillStyle = shade(s.col, -0.15);
    if (w > h) ctx.fillRect(x, y + h / 2, w, h / 2); else ctx.fillRect(x + w / 2, y, w / 2, h);
    ctx.strokeStyle = shade(s.col, 0.2); ctx.lineWidth = 2;
    ctx.beginPath();
    if (w > h) { ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); } else { ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h - 4); }
    ctx.stroke();
  } else {
    ctx.strokeStyle = shade(s.col, 0.18); ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    for (const u of s.units || []) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + u[0] + 3, y + u[1] + 3, u[2], u[3]);
      ctx.fillStyle = shade(s.col, 0.1 + (u[4] || 0)); ctx.fillRect(x + u[0], y + u[1], u[2], u[3]);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x + u[0] + 0.5, y + u[1] + 0.5, u[2] - 1, u[3] - 1);
    }
  }
  if (s.sign) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (s.sign === 'cross') {
      ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d6333a'; ctx.fillRect(-9, -28, 18, 56); ctx.fillRect(-28, -9, 56, 18);
    } else {
      ctx.font = `900 ${s.signSize || 30}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(s.sign, 3, 3);
      ctx.fillStyle = s.signCol || '#ffd35a'; ctx.fillText(s.sign, 0, 0);
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }
  if (s.hp !== undefined && s.maxhp && s.hp < s.maxhp) {
    const k = clamp(s.hp / s.maxhp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + w / 2 - 50, y - 16, 100, 8);
    ctx.fillStyle = k > 0.5 ? '#7ee39b' : k > 0.25 ? '#ffd35a' : '#ff5f6d'; ctx.fillRect(x + w / 2 - 49, y - 15, 98 * k, 6);
  }
}

function drawWreck(ctx, s) {
  ctx.save();
  ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
  if (s.w > s.h) ctx.rotate(Math.PI / 2);
  const w = Math.min(s.w, s.h), h = Math.max(s.w, s.h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
  ctx.fillStyle = s.col; roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = shade(s.col, -0.35);
  roundRect(ctx, -w / 2 + 4, -h * 0.22, w - 8, h * 0.44, 4); ctx.fill();
  ctx.fillStyle = 'rgba(120,150,170,0.5)';
  ctx.fillRect(-w / 2 + 5, -h * 0.2, w - 10, h * 0.1);
  if (s.burnt) { ctx.fillStyle = 'rgba(20,15,10,0.55)'; roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill(); }
  ctx.restore();
}

function drawWall(ctx, s) {
  if (s.off) {
    if (s.kind === 'gate' && s.hp > 0) {
      /* 開いている門 */
      ctx.fillStyle = '#6a5a44';
      ctx.fillRect(s.x - 6, s.y - 4, 10, s.h + 8); ctx.fillRect(s.x + s.w - 4, s.y - 4, 10, s.h + 8);
      return;
    }
    ctx.fillStyle = '#5a5246';
    for (let i = 0; i < 5; i++) ctx.fillRect(s.x + (i / 5) * s.w + rand(-1, 1), s.y + (i % 2) * 5, s.w / 6, s.h * 0.6);
    return;
  }
  const k = clamp(s.hp / s.maxhp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(s.x + 3, s.y + 5, s.w, s.h);
  ctx.fillStyle = s.kind === 'gate' ? '#7a6242' : mix('#6b5d4a', '#a89878', k);
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  if (s.w > s.h) { for (let i = 10; i < s.w; i += 18) { ctx.beginPath(); ctx.moveTo(s.x + i, s.y); ctx.lineTo(s.x + i, s.y + s.h); ctx.stroke(); } }
  else { for (let i = 10; i < s.h; i += 18) { ctx.beginPath(); ctx.moveTo(s.x, s.y + i); ctx.lineTo(s.x + s.w, s.y + i); ctx.stroke(); } }
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  if (s.w > s.h) ctx.fillRect(s.x, s.y, s.w, 3); else ctx.fillRect(s.x, s.y, 3, s.h);
  if (s.kind === 'gate') {
    ctx.strokeStyle = '#c9a060'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.w, s.y + s.h); ctx.moveTo(s.x + s.w, s.y); ctx.lineTo(s.x, s.y + s.h); ctx.stroke();
  }
  if (k < 0.99) {
    ctx.fillStyle = k > 0.5 ? '#ffd35a' : '#ff5f6d';
    if (s.w > s.h) ctx.fillRect(s.x, s.y - 6, s.w * k, 3); else ctx.fillRect(s.x - 6, s.y, 3, s.h * k);
  }
}

function drawDecor(ctx, d) {
  switch (d.kind) {
    case 'crosswalk': {
      ctx.fillStyle = 'rgba(230,230,230,0.55)';
      for (let i = 0; i < 6; i++) {
        if (d.vert) ctx.fillRect(d.x + i * 22, d.y, 12, d.len);
        else ctx.fillRect(d.x, d.y + i * 22, d.len, 12);
      }
      return;
    }
    case 'bush': {
      ctx.fillStyle = '#2f5a30'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3d6e3c'; ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.6, 0, TAU); ctx.fill();
      return;
    }
    case 'plot': {
      ctx.fillStyle = '#4a3a26'; ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#5c9a42';
      for (let i = 8; i < d.w - 4; i += 14) for (let j = 8; j < d.h - 4; j += 14) { ctx.beginPath(); ctx.arc(d.x + i, d.y + j, 4, 0, TAU); ctx.fill(); }
      return;
    }
    case 'canopy': {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(d.x + 8, d.y + 10, d.w, d.h);
      ctx.fillStyle = 'rgba(236,236,236,0.93)'; ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#d64a3a'; ctx.fillRect(d.x, d.y, d.w, 10);
      ctx.font = `900 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#d64a3a';
      ctx.fillText('GAS', d.x + d.w / 2, d.y + d.h / 2 + 10);
      return;
    }
    case 'lines': {
      ctx.strokeStyle = 'rgba(230,230,230,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i <= d.n; i++) { ctx.beginPath(); ctx.moveTo(d.x + i * d.gap, d.y); ctx.lineTo(d.x + i * d.gap, d.y + d.len); ctx.stroke(); }
      return;
    }
    case 'fence': {
      ctx.strokeStyle = 'rgba(180,180,170,0.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      ctx.setLineDash([2, 5]); ctx.strokeRect(d.x + 3, d.y + 3, d.w - 6, d.h - 6); ctx.setLineDash([]);
      return;
    }
    case 'sandbags': {
      ctx.fillStyle = '#a08a5c';
      for (let i = 0; i < d.n; i++) { ctx.beginPath(); ctx.ellipse(d.x + i * 16 * Math.cos(d.a), d.y + i * 16 * Math.sin(d.a), 9, 6, d.a, 0, TAU); ctx.fill(); }
      return;
    }
    case 'helipad': {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(d.x, d.y, 46, 0, TAU); ctx.stroke();
      ctx.font = `900 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('H', d.x, d.y + 2); ctx.textBaseline = 'alphabetic';
      return;
    }
    case 'slot': {
      ctx.strokeStyle = 'rgba(255,210,120,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(d.x, d.y, 22, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
  }
}

/* =========================================================================
   街をつくる
   5×5 の街区を道路で区切り、目的の建物を奥のほうの街区に置く。
   ========================================================================= */
const BLOCK = 520, ROAD = 150, NB = 5;
const MAPW = NB * BLOCK + (NB + 1) * ROAD;

function blockRect(i, j) { return { x: ROAD + i * (BLOCK + ROAD), y: ROAD + j * (BLOCK + ROAD), w: BLOCK, h: BLOCK }; }

function genCity(o) {
  const rng = new RNG(o.seed);
  const W = new World(MAPW, MAPW, 'city');
  const area = o.area;
  const ents = { pickups: [], crates: [], people: [], zombies: [] };
  W.ents = ents;

  /* 外周は通れない */
  const T = 400;
  W.addSolid({ x: -T, y: -T, w: MAPW + T * 2, h: T, kind: 'bound' });
  W.addSolid({ x: -T, y: MAPW, w: MAPW + T * 2, h: T, kind: 'bound' });
  W.addSolid({ x: -T, y: 0, w: T, h: MAPW, kind: 'bound' });
  W.addSolid({ x: MAPW, y: 0, w: T, h: MAPW, kind: 'bound' });

  /* 道路の線 */
  for (let i = 0; i <= NB; i++) {
    const c = i * (BLOCK + ROAD) + ROAD / 2;
    W.marks.push({ x1: c, y1: 0, x2: c, y2: MAPW, col: 'rgba(240,200,80,0.45)', w: 3, dash: [34, 26] });
    W.marks.push({ x1: 0, y1: c, x2: MAPW, y2: c, col: 'rgba(240,200,80,0.45)', w: 3, dash: [34, 26] });
  }
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
    const x = i * (BLOCK + ROAD), y = j * (BLOCK + ROAD);
    if (j > 0) W.decor.push({ kind: 'crosswalk', x: x + 8, y: y - 24, vert: true, len: 20 });
    if (i > 0) W.decor.push({ kind: 'crosswalk', x: x - 24, y: y + 8, vert: false, len: 20 });
  }

  const start = { x: 2 * (BLOCK + ROAD) + ROAD / 2, y: MAPW - ROAD / 2 - 10, a: -Math.PI / 2 };
  W.start = start;
  const exit = { x: start.x, y: start.y - 20, r: 95, col: '#7ee39b', label: '撤収（止まる）', kind: 'exit' };
  W.zones.push(exit); W.exit = exit;

  /* 目的の街区は上の2列から */
  const objI = rng.i(0, NB - 1), objJ = rng.i(0, 1);
  const dt = o.dest.type;

  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    const b = blockRect(i, j);
    W.ground.push({ x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20, col: '#55565a', mini: '#3a3c40' });
    if (i === objI && j === objJ && dt !== 'patrol') { genObjective(W, rng, b, o, ents); continue; }
    const roll = rng.f();
    if (roll < area.park) genPark(W, rng, b, ents);
    else if (roll < area.park + 0.14) genParking(W, rng, b, ents);
    else genBuildings(W, rng, b, area, ents);
  }

  /* 道路の障害物：放置車両とバリケード */
  const roadPts = [];
  for (let n = 0; n < 60; n++) {
    const vert = rng.chance(0.5);
    const li = rng.i(0, NB), along = rng.f(ROAD, MAPW - ROAD);
    const c = li * (BLOCK + ROAD) + ROAD / 2 + rng.f(-40, 40);
    const x = vert ? c : along, y = vert ? along : c;
    if (dist(x, y, start.x, start.y) < 450) continue;
    roadPts.push({ x, y, vert });
  }
  for (const p of roadPts.slice(0, 16 + o.day)) {
    const col = rng.pick(['#8a3b34', '#3b5a8a', '#c9c2b0', '#4a6b44', '#7a6a3a', '#5a5a60']);
    const w = p.vert ? 36 : 72, h = p.vert ? 72 : 36;
    if (!W.free(p.x, p.y, 40)) continue;
    W.addSolid({ x: p.x - w / 2, y: p.y - h / 2, w, h, kind: 'wreck', col, burnt: rng.chance(0.3) });
  }
  for (let n = 0; n < 3; n++) {
    const vert = rng.chance(0.5);
    const li = rng.i(1, NB - 1), seg = rng.i(0, NB - 1);
    const c = li * (BLOCK + ROAD);
    const along = ROAD + seg * (BLOCK + ROAD) + BLOCK / 2;
    const gapLeft = rng.chance(0.5);
    if (vert) {
      const bx = gapLeft ? c + 55 : c; const bw = ROAD - 55;
      if (dist(bx, along, start.x, start.y) > 500) W.addSolid({ x: bx, y: along, w: bw, h: 20, kind: 'barrier' });
    } else {
      const by = gapLeft ? c + 55 : c; const bh = ROAD - 55;
      if (dist(along, by, start.x, start.y) > 500) W.addSolid({ x: along, y: by, w: 20, h: bh, kind: 'barrier' });
    }
  }

  /* 散らばった拾いもの */
  const rich = o.mods.includes('rich') ? 1.6 : 1;
  const nScrap = Math.round((dt === 'patrol' ? 55 : 34) * rich);
  for (let n = 0; n < nScrap; n++) {
    const p = randomFree(W, rng, 10);
    if (p && dist(p.x, p.y, start.x, start.y) > 250) ents.pickups.push({ x: p.x, y: p.y, kind: 'scrap', amt: rng.i(2, 5) });
  }
  for (let n = 0; n < Math.round(6 * rich); n++) {
    const p = randomFree(W, rng, 10);
    if (p) ents.pickups.push({ x: p.x, y: p.y, kind: 'food', amt: 1 });
  }
  for (let n = 0; n < Math.round(rng.i(6, 11) * rich); n++) {
    const p = randomFree(W, rng, 18);
    if (p && dist(p.x, p.y, start.x, start.y) > 300) ents.crates.push({ x: p.x, y: p.y, hp: 1, loot: 'random' });
  }
  /* 道ばたで手を振る人 */
  const nWave = rng.i(0, 2);
  for (let n = 0; n < nWave; n++) {
    const p = randomFree(W, rng, 14);
    if (p && dist(p.x, p.y, start.x, start.y) > 700) ents.people.push(makePerson(p.x, p.y, rng, true));
  }

  /* はじめからいるゾンビ */
  const horde = o.mods.includes('horde') ? 1.5 : 1;
  const nZ = Math.round((55 + o.day * 12 + o.dest.danger * 10) * horde * (o.easy ? 0.75 : 1));
  const mix = zombieMix(o.day, { dogs: o.mods.includes('dogs') });
  const goal = W.goalPos || { x: MAPW / 2, y: MAPW / 3 };
  for (let n = 0; n < nZ; n++) {
    let p = null;
    for (let t = 0; t < 8 && !p; t++) {
      /* 目的地のまわりに多め */
      const near = rng.chance(0.35);
      const x = near ? goal.x + rng.f(-420, 420) : rng.f(60, MAPW - 60);
      const y = near ? goal.y + rng.f(-420, 420) : rng.f(60, MAPW - 60);
      if (W.free(x, y, 12) && dist(x, y, start.x, start.y) > 520) p = { x, y };
    }
    if (p) ents.zombies.push({ x: p.x, y: p.y, type: rng.weighted(mix).id });
  }
  if (o.mods.includes('boss')) ents.zombies.push({ x: goal.x + 120, y: goal.y + 160, type: 'brute' });

  W.buildMinimap();
  return W;
}

function randomFree(W, rng, r) {
  for (let t = 0; t < 20; t++) {
    const x = rng.f(40, W.w - 40), y = rng.f(40, W.h - 40);
    if (W.free(x, y, r)) return { x, y };
  }
  return null;
}

function makePerson(x, y, rng, waving) {
  return {
    x, y, vx: 0, vy: 0, hp: 30, waving, state: 'wait', t: rng.f(3),
    shirt: rng.pick(['#e2584b', '#4fb0d8', '#e0a43a', '#7ee39b', '#b07ad6', '#f0f0f0']),
    hair: rng.pick(['#2a1c14', '#5a3a22', '#111', '#9a7a4a', '#c9c9c9']),
    trait: null,
  };
}

function genBuildings(W, rng, b, area, ents) {
  /* 街区を1〜4区画に割る */
  const lots = [];
  const split = rng.i(0, 3);
  if (split === 0) lots.push(b);
  else if (split === 1) { const k = rng.f(0.35, 0.65); lots.push({ x: b.x, y: b.y, w: b.w * k, h: b.h }, { x: b.x + b.w * k, y: b.y, w: b.w * (1 - k), h: b.h }); }
  else if (split === 2) { const k = rng.f(0.35, 0.65); lots.push({ x: b.x, y: b.y, w: b.w, h: b.h * k }, { x: b.x, y: b.y + b.h * k, w: b.w, h: b.h * (1 - k) }); }
  else { const kx = rng.f(0.4, 0.6), ky = rng.f(0.4, 0.6);
    lots.push({ x: b.x, y: b.y, w: b.w * kx, h: b.h * ky }, { x: b.x + b.w * kx, y: b.y, w: b.w * (1 - kx), h: b.h * ky },
      { x: b.x, y: b.y + b.h * ky, w: b.w * kx, h: b.h * (1 - ky) }, { x: b.x + b.w * kx, y: b.y + b.h * ky, w: b.w * (1 - kx), h: b.h * (1 - ky) }); }
  for (const l of lots) {
    if (rng.chance(0.15)) {
      /* 空き地 */
      W.ground.push({ x: l.x + 8, y: l.y + 8, w: l.w - 16, h: l.h - 16, col: '#3d4a33', mini: '#35402d' });
      for (let k = 0; k < 3; k++) W.decor.push({ kind: 'bush', x: l.x + rng.f(30, l.w - 30), y: l.y + rng.f(30, l.h - 30), r: rng.f(10, 18) });
      continue;
    }
    const m = rng.f(22, 48);
    const house = l.w * l.h < 60000 && rng.chance(0.4);
    const bw = l.w - m * 2, bh = l.h - m * 2;
    if (bw < 60 || bh < 60) continue;
    const s = { x: l.x + m, y: l.y + m, w: bw, h: bh, kind: 'bld', blocks: true, col: rng.pick(area.roof),
      lift: house ? rng.f(14, 20) : rng.f(22, 46), house, windows: !house };
    if (!house) {
      s.units = [];
      for (let k = 0; k < rng.i(1, 4); k++) {
        const uw = rng.f(16, 34), uh = rng.f(14, 28);
        s.units.push([rng.f(10, bw - uw - 10), rng.f(10, bh - uh - 10), uw, uh, rng.f(-0.1, 0.15)]);
      }
    }
    W.addSolid(s);
    W.ground.push({ x: l.x + 6, y: l.y + 6, w: l.w - 12, h: l.h - 12, col: '#47484c', mini: '#3a3c40' });
  }
}

function genPark(W, rng, b, ents) {
  W.ground.push({ x: b.x + 10, y: b.y + 10, w: b.w - 20, h: b.h - 20, col: '#34512f', mini: '#2e4a2c' });
  const n = rng.i(9, 16);
  for (let k = 0; k < n; k++) {
    const x = b.x + rng.f(50, b.w - 50), y = b.y + rng.f(50, b.h - 50);
    if (!W.free(x, y, 40)) continue;
    const canopy = rng.f(24, 36);
    W.addSolid({ x, y, r: 9, kind: 'tree', canopy, col: rng.pick(['#2f5a30', '#3a6b34', '#2a4f2e', '#46703a']) });
  }
  for (let k = 0; k < 6; k++) W.decor.push({ kind: 'bush', x: b.x + rng.f(20, b.w - 20), y: b.y + rng.f(20, b.h - 20), r: rng.f(8, 14) });
}

function genParking(W, rng, b, ents) {
  W.ground.push({ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16, pat: true, mini: '#303338' });
  for (let row = 0; row < 3; row++) {
    const y = b.y + 50 + row * 150;
    W.decor.push({ kind: 'lines', x: b.x + 40, y, n: 10, gap: 44, len: 80 });
    for (let k = 0; k < 10; k++) {
      if (!rng.chance(0.35)) continue;
      W.addSolid({ x: b.x + 44 + k * 44, y: y + 6, w: 36, h: 70, kind: 'wreck', col: rng.pick(['#8a3b34', '#3b5a8a', '#c9c2b0', '#4a6b44', '#5a5a60']), burnt: rng.chance(0.25) });
    }
  }
}

/* 目的の街区 */
function genObjective(W, rng, b, o, ents) {
  const dt = o.dest.type;
  const cx = b.x + b.w / 2;
  const amt = o.dest.stock;
  W.goalPos = { x: cx, y: b.y + b.h / 2 };
  const lot = () => W.ground.push({ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16, pat: true, mini: '#303338' });
  const col = DEST_TYPES[dt].col;

  if (dt === 'market' || dt === 'hardware') {
    lot();
    const bh = b.h * 0.46;
    W.addSolid({ x: b.x + 30, y: b.y + 30, w: b.w - 60, h: bh, kind: 'bld', blocks: true, col: dt === 'market' ? '#8a6f5a' : '#6b6255', lift: 34, windows: true,
      sign: dt === 'market' ? 'SUPER' : 'HOME', signSize: 46, signCol: dt === 'market' ? '#ffd35a' : '#ff9a4d',
      units: [[20, 20, 40, 26, 0.1], [b.w - 140, 24, 36, 22, 0.1]] });
    W.decor.push({ kind: 'lines', x: b.x + 40, y: b.y + bh + 170, n: 10, gap: 44, len: 70 });
    for (let k = 0; k < 10; k++) if (rng.chance(0.3)) W.addSolid({ x: b.x + 44 + k * 44, y: b.y + bh + 176, w: 36, h: 60, kind: 'wreck', col: rng.pick(['#8a3b34', '#3b5a8a', '#c9c2b0']), burnt: rng.chance(0.3) });
    if (dt === 'hardware') for (let k = 0; k < 4; k++) W.addSolid({ x: b.x + 40 + k * 110, y: b.y + b.h - 70, w: 44, h: 40, kind: 'pallet' });
    const z = { x: cx, y: b.y + 30 + bh + 80, r: 72, col, label: dt === 'market' ? '搬入口（止まって積む）' : '資材置き場（止まって積む）', kind: 'load',
      res: DEST_TYPES[dt].res, stock: amt, progress: 0 };
    W.zones.push(z); W.goal = z;
  } else if (dt === 'gas') {
    lot();
    W.addSolid({ x: b.x + 60, y: b.y + 40, w: b.w - 120, h: 120, kind: 'bld', blocks: true, col: '#7a7e86', lift: 22, windows: true, sign: 'MART', signSize: 28, signCol: '#e8e8e8' });
    for (let k = 0; k < 3; k++) W.addSolid({ x: b.x + 130 + k * 110, y: b.y + 300, w: 24, h: 34, kind: 'pump' });
    W.decor.push({ kind: 'canopy', x: b.x + 90, y: b.y + 250, w: b.w - 180, h: 140, layer: 'top' });
    const z = { x: cx, y: b.y + 380, r: 78, col, label: '給油（止まって積む）', kind: 'load', res: 'fuel', stock: amt, progress: 0 };
    W.zones.push(z); W.goal = z;
  } else if (dt === 'rescue' || dt === 'hospital') {
    lot();
    const hosp = dt === 'hospital';
    W.addSolid({ x: b.x + 70, y: b.y + 40, w: b.w - 140, h: b.h * 0.5, kind: 'bld', blocks: true, col: hosp ? '#b9bcc2' : '#7a6f66', lift: 40, windows: true,
      sign: hosp ? 'cross' : 'SOS', signSize: 54, signCol: '#ff5f6d' });
    const fy = b.y + 40 + b.h * 0.5;
    W.decor.push({ kind: 'sandbags', x: b.x + 120, y: fy + 30, a: 0, n: 6 });
    W.decor.push({ kind: 'sandbags', x: b.x + b.w - 210, y: fy + 30, a: 0, n: 6 });
    const z = { x: cx, y: fy + 80, r: 80, col, label: '救出（止まって乗せる）', kind: 'rescue', progress: 0 };
    W.zones.push(z); W.goal = z;
    for (let k = 0; k < amt; k++) {
      const p = makePerson(cx + rng.f(-40, 40), fy + 20 + rng.f(0, 20), rng, true);
      p.goal = true;
      if (hosp && k === 0) p.trait = 'doctor';
      ents.people.push(p);
    }
    if (hosp) for (let k = 0; k < 3; k++) ents.pickups.push({ x: cx + rng.f(-160, 160), y: fy + rng.f(120, 200), kind: 'kit', amt: 1 });
  } else if (dt === 'junk') {
    W.ground.push({ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16, col: '#4a4236', mini: '#3e382e' });
    W.decor.push({ kind: 'fence', x: b.x + 14, y: b.y + 14, w: b.w - 28, h: b.h - 28 });
    for (let k = 0; k < 14; k++) {
      const x = b.x + rng.f(50, b.w - 90), y = b.y + rng.f(50, b.h - 90);
      if (W.free(x + 20, y + 35, 45)) W.addSolid({ x, y, w: rng.chance(0.5) ? 36 : 72, h: rng.chance(0.5) ? 72 : 36, kind: 'wreck', col: rng.pick(['#6a4a3a', '#5a5a60', '#7a6a3a', '#4a5a6a']), burnt: rng.chance(0.5) });
    }
    const piles = [];
    for (let k = 0; k < 9; k++) {
      let p = null;
      for (let t = 0; t < 20 && !p; t++) { const x = b.x + rng.f(40, b.w - 40), y = b.y + rng.f(40, b.h - 40); if (W.free(x, y, 30)) p = { x, y }; }
      if (p) { const pile = { x: p.x, y: p.y, kind: 'pile', amt: Math.round(amt / 6) }; piles.push(pile); ents.pickups.push(pile); }
    }
    const z = { x: cx, y: b.y + b.h / 2, r: b.w * 0.5, col, label: 'スクラップの山を轢く', kind: 'collect', need: Math.min(6, piles.length), got: 0, hidden: true };
    W.zones.push(z); W.goal = z;
  } else if (dt === 'police') {
    lot();
    W.addSolid({ x: b.x + 40, y: b.y + 40, w: b.w - 80, h: b.h * 0.42, kind: 'bld', blocks: true, col: '#5d6b82', lift: 34, windows: true, sign: 'POLICE', signSize: 40, signCol: '#dfe8ff' });
    const yy = b.y + 40 + b.h * 0.42 + 40;
    W.decor.push({ kind: 'fence', x: b.x + 40, y: yy, w: b.w - 80, h: b.h - (yy - b.y) - 30 });
    W.addSolid({ x: b.x + b.w - 130, y: yy + 20, w: 72, h: 36, kind: 'wreck', col: '#2a3a5a' });
    const n = 5;
    const crates = [];
    for (let k = 0; k < n; k++) {
      const c = { x: b.x + 110 + k * 75, y: yy + 90 + (k % 2) * 60, hp: 1, loot: k === 0 ? 'bp' : 'scrap', big: true, goal: true };
      crates.push(c); ents.crates.push(c);
    }
    rng.shuffle(crates);
    const z = { x: cx, y: yy + 110, r: 190, col, label: '木箱を壊す', kind: 'crates', need: n, got: 0, hidden: true };
    W.zones.push(z); W.goal = z;
  }
}

/* =========================================================================
   基地をつくる
   まんなかに本部、四角い防壁、下の辺に門。砲台の枠は壁の内側に8つ。
   ========================================================================= */
const BASE_W = 2400;
const BASE_BOX = { x: 850, y: 880, w: 700, h: 620 };
const TOWER_SLOTS = [
  { x: 1200, y: 918 }, { x: 1110, y: 1462 }, { x: 888, y: 1190 }, { x: 1512, y: 1190 },
  { x: 890, y: 920 }, { x: 1510, y: 920 }, { x: 890, y: 1460 }, { x: 1510, y: 1460 },
];

function genBase(o) {
  const rng = new RNG(o.seed);
  const W = new World(BASE_W, BASE_W, 'base');
  const T = 400;
  W.addSolid({ x: -T, y: -T, w: BASE_W + T * 2, h: T, kind: 'bound' });
  W.addSolid({ x: -T, y: BASE_W, w: BASE_W + T * 2, h: T, kind: 'bound' });
  W.addSolid({ x: -T, y: 0, w: T, h: BASE_W, kind: 'bound' });
  W.addSolid({ x: BASE_W, y: 0, w: T, h: BASE_W, kind: 'bound' });

  const B = BASE_BOX;
  W.ground.push({ x: B.x - 40, y: B.y - 40, w: B.w + 80, h: B.h + 80, col: '#4a4837', mini: '#4a4837' });
  W.ground.push({ x: B.x + 10, y: B.y + 10, w: B.w - 20, h: B.h - 20, col: '#5a5646', mini: '#5a5646' });
  /* 門から南へのびる道 */
  W.ground.push({ x: 1200 - 70, y: B.y + B.h, w: 140, h: BASE_W - B.y - B.h, pat: true, mini: '#303338' });

  const wallHp = WALL_HP[o.wall] * (o.easy ? 1.5 : 1);
  const th = 16, seg = 70;
  W.walls = [];
  const addWall = (x, y, w, h, kind = 'wall') => {
    const s = W.addSolid({ x, y, w, h, kind, blocks: true, hp: wallHp, maxhp: wallHp });
    W.walls.push(s); return s;
  };
  for (let x = B.x; x < B.x + B.w; x += seg) addWall(x, B.y, Math.min(seg, B.x + B.w - x), th);
  for (let y = B.y + th; y < B.y + B.h - th; y += seg) {
    addWall(B.x, y, th, Math.min(seg, B.y + B.h - th - y));
    addWall(B.x + B.w - th, y, th, Math.min(seg, B.y + B.h - th - y));
  }
  const gateW = 120, gx = 1200 - gateW / 2;
  for (let x = B.x; x < gx; x += seg) addWall(x, B.y + B.h - th, Math.min(seg, gx - x), th);
  for (let x = gx + gateW; x < B.x + B.w; x += seg) addWall(x, B.y + B.h - th, Math.min(seg, B.x + B.w - x), th);
  W.gate = addWall(gx, B.y + B.h - th, gateW, th, 'gate');
  W.gate.hp = W.gate.maxhp = wallHp * 1.6;

  const hqHp = (1200 + (o.wall - 1) * 250 + o.dogs * 150) * (o.easy ? 1.5 : 1);
  W.hq = W.addSolid({ x: 1120, y: 1120, w: 160, h: 110, kind: 'hq', blocks: true, col: '#6f6a5a', lift: 30, windows: true, sign: 'HQ', signSize: 34, signCol: '#ffd28a', hp: hqHp, maxhp: hqHp });
  W.addSolid({ x: 1330, y: 1300, w: 140, h: 90, kind: 'bld', blocks: true, col: '#5d6b73', lift: 22, windows: true, sign: 'GARAGE', signSize: 20, signCol: '#dfe8ff' });
  if (o.workshop > 0) W.addSolid({ x: 920, y: 1010, w: 110, h: 80, kind: 'bld', blocks: true, col: '#6b5d4a', lift: 20, units: [[10, 10, 26, 20, 0.1]] });
  for (let k = 0; k < o.farm; k++) W.decor.push({ kind: 'plot', x: 920 + k * 70, y: 1300, w: 60, h: 120 });
  W.decor.push({ kind: 'helipad', x: 1320, y: 1010 });
  if (o.radio > 0) W.addSolid({ x: 1440, y: 990, r: 14, kind: 'tree', canopy: 16, col: '#8a8f96' });
  W.slots = TOWER_SLOTS.map((p, i) => ({ x: p.x, y: p.y, i }));
  for (let i = 0; i < TURRET_SLOTS[o.wall]; i++) W.decor.push({ kind: 'slot', x: TOWER_SLOTS[i].x, y: TOWER_SLOTS[i].y });

  /* まわりの町はずれ */
  for (let k = 0; k < 26; k++) {
    const x = rng.f(100, BASE_W - 100), y = rng.f(100, BASE_W - 100);
    if (x > B.x - 260 && x < B.x + B.w + 260 && y > B.y - 260 && y < B.y + B.h + 260) continue;
    if (Math.abs(x - 1200) < 120 && y > B.y) continue;
    if (!W.free(x, y, 60)) continue;
    const r = rng.f(0, 1);
    if (r < 0.45) W.addSolid({ x, y, r: 9, kind: 'tree', canopy: rng.f(24, 34), col: rng.pick(['#2a4a2a', '#34512f', '#2e4630']) });
    else if (r < 0.75) W.addSolid({ x, y, w: rng.chance(0.5) ? 36 : 72, h: rng.chance(0.5) ? 72 : 36, kind: 'wreck', col: rng.pick(['#6a4a3a', '#5a5a60', '#4a5a6a']), burnt: true });
    else W.addSolid({ x, y, w: rng.f(90, 160), h: rng.f(80, 140), kind: 'bld', blocks: true, col: rng.pick(['#5a5550', '#4f5358', '#5e554c']), lift: rng.f(18, 30), windows: true });
  }
  W.start = { x: 1200, y: 1330, a: -Math.PI / 2 };
  W.buildMinimap();
  return W;
}
