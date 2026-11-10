/* =========================================================================
   SLIME FUSION ― え
   スライム (からだ / もよう / パーツ / かざり) と はいけいを すべて プログラムで かく
   ========================================================================= */
'use strict';

/* からだの ふちの 点。th は まうえが 0 で 時計まわり。r=1 の 大きさで かえす */
function bodyPt(th, shape) {
  const s = Math.sin(th), c = Math.cos(th);
  if (shape === 'square') {
    const k = 0.5; // ちょうえんの かたさ
    const x = Math.sign(s) * Math.pow(Math.abs(s), k) * 1.0;
    const y = -Math.sign(c) * Math.pow(Math.abs(c), k) * (c > 0 ? 0.95 : 0.8);
    return [x, y];
  }
  if (shape === 'drop') {
    const up = c > 0 ? c : 0;
    return [s * 1.05 * (1 - 0.5 * up * up * up), -c * (c > 0 ? 1.18 : 0.78)];
  }
  if (shape === 'tall') return [s * 0.95, -c * (c > 0 ? 1.12 : 0.8)];
  return [s * 1.08, -c * (c > 0 ? 0.92 : 0.78)];
}
function bodyPath(ctx, r, shape, sq = 0) {
  ctx.beginPath();
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const [x, y] = bodyPt((i / N) * TAU, shape);
    const X = x * r * (1 + sq), Y = y * r * (1 - sq) + r * sq * 0.6;
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  }
  ctx.closePath();
}
const slimeR = (s, base) => base * (0.72 + s.size * 0.09) * (spOf(s).deco === 'mini' ? 0.7 : 1) * (spOf(s).deco === 'giant' ? 1.12 : 1);

/* からだの 色。col を わたすと その 1色で ぬる (たたかいで 色を かえた とき) */
function bodyFill(ctx, r, s, col) {
  const sp = spOf(s);
  let cols;
  if (col) cols = [col];
  else if (sp.deco === 'rainbow' || sp.deco === 'chaos') cols = ELEMS;
  else if (s.sp === 'plain') cols = ['plain'];
  else cols = sp.el.slice(0, 2);
  if (sp.deco === 'gold' && !col) return goldFill(ctx, r, '#ffd84a', '#b8860b');
  if (sp.deco === 'silver' && !col) return goldFill(ctx, r, '#eef2f6', '#8a96a4');
  if (cols.length === 1) {
    const C = COLORS[cols[0]];
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.25);
    g.addColorStop(0, shade(C.c, 0.45)); g.addColorStop(0.55, C.c); g.addColorStop(1, mix(C.c, C.d, 0.7));
    return g;
  }
  const g = ctx.createLinearGradient(-r, -r, r, r);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), COLORS[c].c));
  return g;
}
function goldFill(ctx, r, a, b) {
  const g = ctx.createLinearGradient(-r, -r, r * 0.6, r);
  g.addColorStop(0, shade(a, 0.5)); g.addColorStop(0.4, a); g.addColorStop(0.7, b); g.addColorStop(1, shade(a, 0.2));
  return g;
}
function mainHex(s, col) {
  const sp = spOf(s);
  if (col) return COLORS[col].c;
  if (sp.deco === 'gold') return '#e8b820';
  if (sp.deco === 'silver') return '#c4ccd6';
  return COLORS[s.sp === 'plain' ? 'plain' : sp.el[0]].c;
}

/* ------------------------------ パーツ ------------------------------ */
const PART_BACK = { horn: 1, spike: 1, wing: 1, tail: 1, ears: 1 };
function drawPart(ctx, p, r, shape, hex, col, sq = 0) {
  const [ux, uy] = bodyPt(p.a, shape);
  const x = ux * r * (1 + sq), y = uy * r * (1 - sq) + r * sq * 0.6;
  ctx.save();
  ctx.translate(x, y);
  const t = p.t;
  if (t === 'gem') {
    ctx.translate(-ux * r * 0.22, -uy * r * 0.22);
    const C = COLORS[col || 'light'];
    const k = r * 0.16;
    ctx.beginPath(); ctx.moveTo(0, -k * 1.2); ctx.lineTo(k, 0); ctx.lineTo(0, k * 1.2); ctx.lineTo(-k, 0); ctx.closePath();
    const g = ctx.createLinearGradient(-k, -k, k, k);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, C.c); g.addColorStop(1, C.d);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
    ctx.restore(); return;
  }
  ctx.rotate(p.a);
  const lw = Math.max(1, r * 0.035);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (t === 'horn') {
    const w = r * 0.15, hgt = r * 0.5;
    ctx.beginPath(); ctx.moveTo(-w, r * 0.08); ctx.quadraticCurveTo(-w * 0.6, -hgt * 0.6, w * 0.5, -hgt);
    ctx.quadraticCurveTo(w * 0.3, -hgt * 0.4, w, r * 0.08); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -hgt);
    g.addColorStop(0, '#e8d4a8'); g.addColorStop(1, '#fffaf0');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = lw; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.6, -hgt * 0.2); ctx.lineTo(w * 0.7, -hgt * 0.28);
    ctx.moveTo(-w * 0.3, -hgt * 0.48); ctx.lineTo(w * 0.5, -hgt * 0.55); ctx.strokeStyle = 'rgba(138,106,58,0.5)'; ctx.stroke();
  } else if (t === 'spike') {
    const w = r * 0.1, hgt = r * 0.26;
    ctx.beginPath(); ctx.moveTo(-w, r * 0.06); ctx.lineTo(0, -hgt); ctx.lineTo(w, r * 0.06); ctx.closePath();
    ctx.fillStyle = shade(hex, -0.35); ctx.fill(); ctx.strokeStyle = shade(hex, -0.6); ctx.lineWidth = lw; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.3, 0); ctx.lineTo(0, -hgt * 0.7); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  } else if (t === 'wing') {
    const side = Math.sin(p.a) >= 0 ? 1 : -1;
    ctx.rotate(-p.a);
    ctx.scale(side, 1);
    const bat = ['dark', 'fire'].includes(col);
    const L = r * 0.75;
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, r * 0.05);
    ctx.quadraticCurveTo(L * 0.4, -L * 0.9, L, -L * 0.75);
    if (bat) {
      ctx.lineTo(L * 0.85, -L * 0.3); ctx.lineTo(L * 0.62, -L * 0.42); ctx.lineTo(L * 0.5, -L * 0.05); ctx.lineTo(L * 0.3, -L * 0.18);
    } else {
      ctx.quadraticCurveTo(L * 0.95, -L * 0.45, L * 0.7, -L * 0.4); ctx.quadraticCurveTo(L * 0.75, -L * 0.15, L * 0.45, -L * 0.15);
      ctx.quadraticCurveTo(L * 0.45, L * 0.05, L * 0.2, 0);
    }
    ctx.closePath();
    ctx.fillStyle = bat ? '#3a2a4a' : '#ffffff'; ctx.fill();
    ctx.strokeStyle = bat ? '#1a0e24' : '#9ab4c8'; ctx.lineWidth = lw; ctx.stroke();
  } else if (t === 'tail') {
    ctx.beginPath(); ctx.moveTo(-r * 0.08, r * 0.05);
    ctx.bezierCurveTo(-r * 0.1, -r * 0.4, r * 0.4, -r * 0.3, r * 0.3, -r * 0.6);
    ctx.lineWidth = r * 0.12; ctx.strokeStyle = shade(hex, -0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.82); ctx.lineTo(r * 0.44, -r * 0.55); ctx.lineTo(r * 0.16, -r * 0.55); ctx.closePath();
    ctx.fillStyle = shade(hex, -0.4); ctx.fill();
  } else if (t === 'claw') {
    for (let i = -1; i <= 1; i++) {
      ctx.save(); ctx.translate(i * r * 0.08, -r * 0.02); ctx.rotate(i * 0.25);
      ctx.beginPath(); ctx.moveTo(-r * 0.035, 0); ctx.quadraticCurveTo(0, -r * 0.2, r * 0.06, -r * 0.22); ctx.quadraticCurveTo(r * 0.02, -r * 0.1, r * 0.035, 0); ctx.closePath();
      ctx.fillStyle = '#fbf6ea'; ctx.fill(); ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = lw * 0.7; ctx.stroke();
      ctx.restore();
    }
  } else if (t === 'ears') {
    const w = r * 0.2, hgt = r * 0.38;
    ctx.beginPath(); ctx.moveTo(-w, r * 0.1); ctx.quadraticCurveTo(-w * 0.4, -hgt, 0, -hgt); ctx.quadraticCurveTo(w * 0.4, -hgt, w, r * 0.1); ctx.closePath();
    ctx.fillStyle = shade(hex, -0.08); ctx.fill(); ctx.strokeStyle = shade(hex, -0.45); ctx.lineWidth = lw; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.5, r * 0.02); ctx.quadraticCurveTo(0, -hgt * 0.8, w * 0.5, r * 0.02); ctx.closePath();
    ctx.fillStyle = '#ffb4c8'; ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------ スライム ------------------------------ */
/* o: { r, col (たたかい中の色), t, sq (つぶれ), look (-1〜1), mood, flash, shadow } */
function drawSlime(ctx, s, o) {
  const sp = spOf(s);
  const r = o.r;
  const t = o.t || 0;
  const sq = o.sq || 0;
  const shape = sp.shape;
  const col = o.col && o.col !== 'plain' ? o.col : o.col === 'plain' ? 'plain' : null;
  const hex = mainHex(s, col);
  const partCol = col || baseColor(s);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.8, r * 1.0, r * 0.22, 0, 0, TAU); ctx.fill();
  }
  /* オーラ (5だんかい いじょう) */
  if (sp.tier >= 5 || sp.deco === 'chaos') {
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.7);
    g.addColorStop(0, rgba(hex, 0.45)); g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.7 * (1 + Math.sin(t * 3) * 0.05), 0, TAU); ctx.fill();
  }
  if (sp.deco === 'twin' || sp.deco === 'triple') {
    /* うしろに もう1ぴき (2ひき) */
    const n = sp.deco === 'twin' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.translate((i ? -1 : 1) * r * 0.75, r * 0.15); ctx.scale(0.62, 0.62);
      ctx.fillStyle = bodyFill(ctx, r, s, col); bodyPath(ctx, r, 'round', sq); ctx.fill();
      ctx.strokeStyle = rgba('#000000', 0.25); ctx.lineWidth = r * 0.05; ctx.stroke();
      drawEyes(ctx, r, o.look || 0, o.mood, false, t + i);
      ctx.restore();
    }
  }
  for (const p of s.parts) if (PART_BACK[p.t]) drawPart(ctx, p, r, shape, hex, partCol, sq);
  if (sp.deco === 'devil' || sp.deco === 'dragon') drawDecoBack(ctx, sp.deco, r);
  /* からだ */
  ctx.fillStyle = bodyFill(ctx, r, s, col);
  if (sp.deco === 'ghost') ctx.globalAlpha *= 0.82;
  bodyPath(ctx, r, shape, sq); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.strokeStyle = rgba(shade(hex, -0.6), 0.7); ctx.stroke();
  ctx.save(); bodyPath(ctx, r, shape, sq); ctx.clip();
  drawPattern(ctx, s, r, col, t);
  /* つや */
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.42, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.6, r * 0.05, 0, TAU); ctx.fill();
  ctx.restore();
  if (sp.deco === 'ghost') ctx.globalAlpha /= 0.82;
  for (const p of s.parts) if (!PART_BACK[p.t]) drawPart(ctx, p, r, shape, hex, partCol, sq);
  const evil = ['devil', 'chaos', 'dragon'].includes(sp.deco) || (sp.line === 'dark' && sp.tier >= 4);
  drawEyes(ctx, r, o.look || 0, o.mood, evil, t, sp.deco === 'robo');
  if (sp.deco) drawDeco(ctx, sp.deco, r, t, hex);
  else if (sp.tier >= 5) drawDeco(ctx, 'crownSmall', r, t, hex);
  if (o.flash) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${o.flash})`; bodyPath(ctx, r, shape, sq); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function drawEyes(ctx, r, look, mood, evil, t, robo) {
  const ex = r * 0.3, ey = -r * 0.08, lx = look * r * 0.08;
  const blink = (Math.sin(t * 1.3) > 0.985);
  ctx.save();
  for (const sx of [-1, 1]) {
    const x = sx * ex + lx;
    if (mood === 'hurt') {
      ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - sx * r * 0.1, ey - r * 0.08); ctx.lineTo(x + sx * r * 0.06, ey); ctx.lineTo(x - sx * r * 0.1, ey + r * 0.08); ctx.stroke();
    } else if (mood === 'happy' || blink) {
      ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, ey + r * 0.04, r * 0.09, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (robo) {
      ctx.fillStyle = '#6af0ff'; ctx.fillRect(x - r * 0.1, ey - r * 0.06, r * 0.2, r * 0.12);
    } else {
      ctx.fillStyle = evil ? '#ff3a3a' : '#1a1a2a';
      ctx.beginPath(); ctx.ellipse(x, ey, r * 0.09, r * 0.13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - r * 0.03, ey - r * 0.05, r * 0.035, 0, TAU); ctx.fill();
    }
  }
  /* くち */
  ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = r * 0.04; ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'hurt') { ctx.moveTo(lx - r * 0.08, r * 0.2); ctx.quadraticCurveTo(lx, r * 0.12, lx + r * 0.08, r * 0.2); }
  else ctx.arc(lx, r * 0.1, r * 0.08, 0.2, Math.PI - 0.2);
  ctx.stroke();
  /* ほっぺ */
  ctx.fillStyle = 'rgba(255,110,140,0.35)';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.52 + lx, r * 0.1, r * 0.1, r * 0.06, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* しゅるいごとの もよう (からだの 中に クリップして かく) */
function drawPattern(ctx, s, r, col, t) {
  const sp = spOf(s);
  const e = col || (sp.line || (sp.hyb ? sp.el[0] : null));
  const k = sp.tier;
  ctx.save();
  if (sp.hyb && !col) {
    /* 2色の なみ もよう */
    ctx.fillStyle = rgba(COLORS[sp.el[1]].c, 0.55);
    ctx.beginPath(); ctx.moveTo(-r * 1.2, r * 0.25);
    for (let x = -1.2; x <= 1.21; x += 0.1) ctx.lineTo(x * r, r * 0.25 + Math.sin(x * 6 + t * 2) * r * 0.06);
    ctx.lineTo(r * 1.2, r * 1.2); ctx.lineTo(-r * 1.2, r * 1.2); ctx.fill();
  }
  if (e === 'earth' && k >= 1) {
    ctx.fillStyle = 'rgba(80,50,20,0.3)';
    [[0.4, 0.3, 0.12], [-0.5, 0.35, 0.09], [0.15, 0.5, 0.07], [0.55, -0.25, 0.08]].forEach(([x, y, rr]) => { ctx.beginPath(); ctx.arc(x * r, y * r, rr * r, 0, TAU); ctx.fill(); });
  } else if (e === 'thunder' && k >= 2) {
    ctx.strokeStyle = 'rgba(160,100,0,0.45)'; ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.moveTo(-r, r * 0.4); ctx.lineTo(-r * 0.4, r * 0.25); ctx.lineTo(0, r * 0.45); ctx.lineTo(r * 0.4, r * 0.25); ctx.lineTo(r, r * 0.4); ctx.stroke();
  } else if (e === 'ice' && k >= 2) {
    ctx.strokeStyle = 'rgba(120,180,220,0.6)'; ctx.lineWidth = r * 0.03;
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; ctx.beginPath(); ctx.moveTo(r * 0.45 + Math.cos(a) * r * 0.14, r * 0.38 + Math.sin(a) * r * 0.14); ctx.lineTo(r * 0.45 - Math.cos(a) * r * 0.14, r * 0.38 - Math.sin(a) * r * 0.14); ctx.stroke(); }
  } else if (e === 'dark' && k >= 1) {
    ctx.fillStyle = 'rgba(220,200,255,0.5)';
    [[0.5, 0.4], [-0.55, 0.3], [0.2, 0.55]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * r, y * r, r * 0.035, 0, TAU); ctx.fill(); });
  } else if (e === 'light' && k >= 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    [[0.5, 0.35], [-0.5, 0.4]].forEach(([x, y]) => star(ctx, x * r, y * r, r * 0.08, 4));
  } else if (e === 'water' && k >= 2) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.arc(r * 0.3, r * 0.45, r * 0.25, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  }
  if (k >= 4 && !sp.special) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = r * 0.08;
    bodyPath(ctx, r * 0.92, sp.shape); ctx.stroke();
  }
  ctx.restore();
  /* からだの 上に のる もよう (クリップの 外は かけないので 上の ほうだけ) */
  if (!sp.special && !col) {
    if (sp.line === 'fire' && k >= 2) {
      ctx.fillStyle = 'rgba(255,230,120,0.75)';
      ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.6); ctx.quadraticCurveTo(0, -r * (0.95 + Math.sin(t * 8) * 0.05), r * 0.15, -r * 0.6); ctx.fill();
    } else if (sp.line === 'grass' && k >= 2) {
      ctx.fillStyle = '#7ae05a';
      ctx.beginPath(); ctx.ellipse(r * 0.12, -r * 0.82, r * 0.12, r * 0.06, -0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-r * 0.12, -r * 0.82, r * 0.12, r * 0.06, 0.5, 0, TAU); ctx.fill();
    }
  }
}
function star(ctx, x, y, r, n = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

function drawDecoBack(ctx, d, r) {
  if (d === 'devil') {
    ctx.fillStyle = '#2a1a3a';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.7, -r * 0.2); ctx.lineTo(sx * r * 1.5, -r * 0.7); ctx.lineTo(sx * r * 1.25, -r * 0.1); ctx.lineTo(sx * r * 1.4, r * 0.1); ctx.closePath(); ctx.fill(); }
  } else if (d === 'dragon') {
    ctx.fillStyle = '#b8321e';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.6, -r * 0.3); ctx.quadraticCurveTo(sx * r * 1.4, -r * 1.3, sx * r * 1.7, -r * 0.6); ctx.lineTo(sx * r * 1.2, -r * 0.4); ctx.lineTo(sx * r * 1.3, -r * 0.05); ctx.closePath(); ctx.fill(); }
  }
}

function drawDeco(ctx, d, r, t, hex) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1, r * 0.04);
  if (d === 'crown' || d === 'crownSmall') {
    const k = d === 'crown' ? 1 : 0.6;
    ctx.translate(0, -r * 0.88);
    ctx.scale(k, k);
    ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#a86a00'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(-r * 0.45, -r * 0.4); ctx.lineTo(-r * 0.2, -r * 0.18); ctx.lineTo(0, -r * 0.5); ctx.lineTo(r * 0.2, -r * 0.18); ctx.lineTo(r * 0.45, -r * 0.4); ctx.lineTo(r * 0.4, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff3a6a'; ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.07, 0, TAU); ctx.fill();
  } else if (d === 'tiara') {
    ctx.translate(0, -r * 0.82);
    ctx.fillStyle = '#ffe9a0'; ctx.strokeStyle = '#c49a2a'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.quadraticCurveTo(0, -r * 0.4, r * 0.3, 0); ctx.quadraticCurveTo(0, -r * 0.15, -r * 0.3, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6ab8'; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.06, 0, TAU); ctx.fill();
  } else if (d === 'halo') {
    ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = r * 0.07; ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = r * 0.3;
    ctx.beginPath(); ctx.ellipse(0, -r * 1.12 + Math.sin(t * 3) * r * 0.04, r * 0.4, r * 0.1, 0, 0, TAU); ctx.stroke();
  } else if (d === 'wizard') {
    ctx.translate(0, -r * 0.7);
    ctx.fillStyle = '#4a2a8a'; ctx.strokeStyle = '#1a0a3a'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.quadraticCurveTo(-r * 0.1, -r * 0.2, r * 0.2, -r * 0.95); ctx.quadraticCurveTo(r * 0.1, -r * 0.3, r * 0.6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23a'; star(ctx, 0, -r * 0.3, r * 0.1);
  } else if (d === 'ninja') {
    ctx.fillStyle = '#2a2a3a'; ctx.fillRect(-r * 1.05, -r * 0.3, r * 2.1, r * 0.16);
    ctx.fillStyle = '#c0c8d0'; ctx.fillRect(-r * 0.12, -r * 0.3, r * 0.24, r * 0.16);
    ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.moveTo(r * 1.0, -r * 0.22); ctx.quadraticCurveTo(r * 1.3, -r * 0.3 + Math.sin(t * 6) * r * 0.1, r * 1.5, -r * 0.1); ctx.stroke();
  } else if (d === 'helm' || d === 'samurai') {
    ctx.translate(0, -r * 0.55);
    ctx.fillStyle = d === 'helm' ? '#c8d0dc' : '#3a2a2a'; ctx.strokeStyle = d === 'helm' ? '#5a6474' : '#120a0a'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (d === 'samurai') {
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(-r * 0.5, -r * 0.9); ctx.lineTo(-r * 0.1, -r * 0.35); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(r * 0.5, -r * 0.9); ctx.lineTo(r * 0.1, -r * 0.35); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.08, r * 0.25, 0, 0, TAU); ctx.fill();
    }
  } else if (d === 'robo') {
    ctx.strokeStyle = '#555'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.lineTo(0, -r * 1.2); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff4a4a' : '#ffaaaa'; ctx.beginPath(); ctx.arc(0, -r * 1.25, r * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; [[-0.6, 0.4], [0.6, 0.4], [-0.6, -0.4], [0.6, -0.4]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * r, y * r, r * 0.04, 0, TAU); ctx.fill(); });
  } else if (d === 'space') {
    ctx.strokeStyle = 'rgba(255,220,140,0.85)'; ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 1.45, r * 0.3, -0.2, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; [[0.3, -0.5], [-0.4, 0.45], [0.55, 0.3]].forEach(([x, y]) => star(ctx, x * r, y * r, r * 0.05, 4));
  } else if (d === 'stars') {
    ctx.fillStyle = '#fff6a0';
    for (let i = 0; i < 3; i++) { const a = t * 1.5 + (i * TAU) / 3; star(ctx, Math.cos(a) * r * 1.3, -r * 0.4 + Math.sin(a) * r * 0.3, r * 0.12); }
  } else if (d === 'clock') {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#555'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(0, r * 0.42, r * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, r * 0.42); ctx.lineTo(Math.sin(t) * r * 0.15, r * 0.42 - Math.cos(t) * r * 0.15); ctx.moveTo(0, r * 0.42); ctx.lineTo(r * 0.08, r * 0.42); ctx.stroke();
  } else if (d === 'cat' || d === 'dog' || d === 'bear' || d === 'rabbit') {
    const ear = { cat: '#f0a860', dog: '#a8784a', bear: '#7a5030', rabbit: '#f4f4f4' }[d];
    ctx.fillStyle = ear; ctx.strokeStyle = shade(ear, -0.5); ctx.lineWidth = lw;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      if (d === 'cat') { ctx.moveTo(sx * r * 0.65, -r * 0.5); ctx.lineTo(sx * r * 0.55, -r * 1.1); ctx.lineTo(sx * r * 0.2, -r * 0.8); }
      else if (d === 'rabbit') ctx.ellipse(sx * r * 0.3, -r * 1.15, r * 0.14, r * 0.45, sx * 0.15, 0, TAU);
      else if (d === 'bear') ctx.arc(sx * r * 0.6, -r * 0.72, r * 0.2, 0, TAU);
      else ctx.ellipse(sx * r * 0.85, -r * 0.3, r * 0.18, r * 0.38, sx * -0.4, 0, TAU);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (d === 'cat') { ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = lw * 0.6; for (const sx of [-1, 1]) for (const dy of [-0.03, 0.05]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.45, r * (0.12 + dy)); ctx.lineTo(sx * r * 0.85, r * (0.08 + dy * 2)); ctx.stroke(); } }
    ctx.fillStyle = '#2a1a1a'; ctx.beginPath(); ctx.ellipse(0, r * 0.04, r * 0.06, r * 0.04, 0, 0, TAU); ctx.fill();
  } else if (d === 'ghost') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.75); ctx.lineTo(r * 0.25, -r * 0.75); ctx.lineTo(0, -r * 1.0); ctx.closePath(); ctx.fill();
  } else if (d === 'chaos') {
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = lw;
    ctx.fillStyle = '#1a0a24';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(-r * 0.3, -r * 1.25); ctx.lineTo(-r * 0.1, -r * 0.85); ctx.lineTo(0, -r * 1.35); ctx.lineTo(r * 0.1, -r * 0.85); ctx.lineTo(r * 0.3, -r * 1.25); ctx.lineTo(r * 0.5, -r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (d === 'rainbow') {
    ctx.fillStyle = '#fff'; [[0.6, -0.6], [-0.7, -0.5]].forEach(([x, y]) => star(ctx, x * r, y * r, r * 0.1 * (1 + Math.sin(t * 5) * 0.3), 4));
  } else if (d === 'gold' || d === 'silver') {
    ctx.fillStyle = '#fff'; const k = (Math.sin(t * 4) + 1) / 2;
    star(ctx, r * 0.55, -r * 0.5, r * 0.12 * k, 4); star(ctx, -r * 0.6, r * 0.3, r * 0.08 * (1 - k), 4);
  }
  ctx.restore();
}

/* DOM に はる 小さな え */
function slimeCanvas(s, px, o = {}) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(px * dpr);
  c.style.width = c.style.height = px + 'px';
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  x.translate(px / 2, px * 0.56);
  if (o.silhouette) {
    x.filter = 'brightness(0)'; x.globalAlpha = 0.5;
  }
  drawSlime(x, s, { r: px * 0.26 * (o.fixed ? 1 : (0.72 + 0.09 * Math.min(s.size, 3)) / 0.81), t: o.t || 0.3, mood: o.mood, shadow: !o.silhouette, col: o.col });
  return c;
}
/* ずかんの 見本 */
function sampleOf(spId) {
  const sp = SP[spId];
  const types = [];
  if (sp.line) types.push(...LINE[sp.line].grants.slice(0, Math.max(0, sp.tier - 1)));
  const parts = autoParts(types.filter((t, i) => types.indexOf(t) === i));
  return { sp: spId, size: 2, lv: 1, colors: sp.el.filter((e) => e !== 'plain'), parts, unlocked: [], traits: [sp.trait] };
}

/* ------------------------------ はいけい ------------------------------ */
function drawSky(ctx, W, H, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
/* ぼくじょう */
function drawRanch(ctx, W, H, t) {
  drawSky(ctx, W, H, '#8fd8ff', '#d8f6ff');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 0.31 + t * 0.01) % 1.2 - 0.1) * W, y = H * (0.08 + i * 0.05);
    ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.arc(x + 28, y + 6, 20, 0, TAU); ctx.arc(x - 26, y + 8, 18, 0, TAU); ctx.fill();
  }
  const hz = H * 0.42;
  ctx.fillStyle = '#7cc86a';
  ctx.beginPath(); ctx.moveTo(0, hz);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hz - Math.sin(x / 140) * 22 - 14);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  const g = ctx.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, '#6cc04e'); g.addColorStop(1, '#4a9a3a');
  ctx.fillStyle = g; ctx.fillRect(0, hz + 10, W, H);
  /* さく */
  ctx.strokeStyle = '#c89a5a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, hz + 22); ctx.lineTo(W, hz + 22); ctx.moveTo(0, hz + 38); ctx.lineTo(W, hz + 38); ctx.stroke();
  ctx.fillStyle = '#a8783a';
  for (let x = 10; x < W; x += 70) ctx.fillRect(x, hz + 12, 7, 36);
  /* くさ */
  const R = seeded(7);
  ctx.fillStyle = 'rgba(40,110,30,0.5)';
  for (let i = 0; i < 70; i++) {
    const x = R() * W, y = hz + 50 + R() * (H - hz - 50);
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 9); ctx.lineTo(x + 4, y); ctx.fill();
  }
}
/* たたかいの ばしょ */
function drawArena(ctx, W, H, bg, t) {
  drawSky(ctx, W, H, bg[0], shade(bg[0], 0.2));
  const hz = H * 0.48;
  ctx.fillStyle = shade(bg[1], 0.15);
  ctx.beginPath(); ctx.moveTo(0, hz);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, hz - 40 - Math.abs(Math.sin(x / 90)) * 50);
  ctx.lineTo(W, hz); ctx.fill();
  const g = ctx.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, bg[1]); g.addColorStop(1, shade(bg[1], -0.35));
  ctx.fillStyle = g; ctx.fillRect(0, hz, W, H - hz);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(W * (i / 5), hz + 40 + i % 2 * 30, 120, 14, 0, 0, TAU); ctx.fill(); }
}
