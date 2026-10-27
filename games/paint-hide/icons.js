/* =========================================================================
   PAINT & HIDE ― アイコン
   1つの形を DOM (SVG) と canvas の両方で使う。
   形は 24x24 の座標で書き、部品ごとに s=線 / f=ぬり / e=ぬり(穴あき) / f.3=うすいぬり を持つ。
   ========================================================================= */
'use strict';

const f2 = (n) => +n.toFixed(2);

function snowflakeD() {
  let d = '';
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 - Math.PI / 2;
    d += `M12 12L${f2(12 + 9.5 * Math.cos(a))} ${f2(12 + 9.5 * Math.sin(a))}`;
    const bx = 12 + 6 * Math.cos(a), by = 12 + 6 * Math.sin(a);
    for (const s of [-1, 1]) {
      const aa = a + s * 0.75;
      d += `M${f2(bx)} ${f2(by)}L${f2(bx + 3.2 * Math.cos(aa))} ${f2(by + 3.2 * Math.sin(aa))}`;
    }
  }
  return d;
}
function cogD() {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const c = i * TAU / 8;
    const pts = [[7.4, c - 0.36], [10, c - 0.2], [10, c + 0.2], [7.4, c + 0.36]];
    pts.forEach(([r, a], j) => { d += `${i === 0 && j === 0 ? 'M' : 'L'}${f2(12 + r * Math.cos(a))} ${f2(12 + r * Math.sin(a))}`; });
  }
  return d + 'z';
}
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const ICONS = {
  play: [['f', 'M8 4.5L19.5 12L8 19.5z']],
  replay: [['s', 'M20 12A8 8 0 1 1 17.66 6.34'], ['s', 'M17.66 1.8V6.34H13.1']],
  home: [['s', 'M3 11.5L12 4l9 7.5'], ['s', 'M5.5 10v10h13V10'], ['s', 'M10 20v-5h4v5']],
  pause: [['f', 'M6 4h4v16H6z'], ['f', 'M14 4h4v16h-4z']],
  soundOn: [['f', 'M3 9h4l5-4.5v15L7 15H3z'], ['s', 'M15.5 9a4 4 0 0 1 0 6'], ['s', 'M18.5 6a8.5 8.5 0 0 1 0 12']],
  soundOff: [['f', 'M3 9h4l5-4.5v15L7 15H3z'], ['s', 'M16 9l6 6M22 9l-6 6']],
  help: [['s', 'M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5'], ['f', circ(12, 18.6, 1.4)]],
  map: [['s', 'M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3z'], ['s', 'M9 3.5v14M15 6.5v14']],
  close: [['s', 'M5.5 5.5l13 13M18.5 5.5l-13 13']],
  check: [['s', 'M4.5 12.5l4.8 4.8L19.5 7']],
  trophy: [['s', 'M7 3.5h10v6a5 5 0 0 1-10 0z'], ['s', 'M7 5.5H4.5a3 3 0 0 0 3 4.5'], ['s', 'M17 5.5h2.5a3 3 0 0 1-3 4.5'], ['s', 'M12 14.5v4M8 20.5h8']],
  oni: [
    ['s', circ(12, 15, 7)], ['f', 'M6.5 10.5L5 2.8l5.2 5z'], ['f', 'M17.5 10.5L19 2.8l-5.2 5z'],
    ['s', 'M8.5 13.2l2.5 1.2M15.5 13.2l-2.5 1.2'], ['s', 'M9.2 18h5.6'], ['f', 'M10 18l.8 1.6.8-1.6zM12.4 18l.8 1.6.8-1.6z'],
  ],
  question: [['s', 'M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5'], ['f', circ(12, 18.6, 1.4)]],
  /* まるで できた 人 (かお・からだ・て) */
  person: [['f', circ(12, 6.5, 4.2)], ['f', 'M7.5 16.5a4.5 5.5 0 1 0 9 0a4.5 5.5 0 1 0 -9 0z'], ['f', circ(5.6, 16, 1.6) + circ(18.4, 16, 1.6)]],
  people: [['f', circ(8.5, 6, 3.2) + circ(16.5, 7, 2.8)], ['f', 'M4.5 15.5a4 4.8 0 1 0 8 0a4 4.8 0 1 0 -8 0zM13 16.5a3.5 4.2 0 1 0 7 0a3.5 4.2 0 1 0 -7 0z']],
  gun: [['f', 'M2.5 8h15V6.5h3V12h-9l-1.6 6.5H6.2l1.4-6.5H2.5z']],
  brush: [['f', 'M18.6 2.4l3 3-8.8 8.8-3-3z'], ['f', 'M8.6 13c-2.6 0-4.6 1.9-4.6 4.3 0 1.6-.8 2.6-2 3.3 4.2.9 8.6-.4 9.6-4.6z']],
  bucket: [['s', 'M4 9h12l-1.6 11.5H5.6z'], ['s', 'M6.5 9a3.5 3.5 0 0 1 7 0'], ['f', 'M19 10.5c1.3 1.9 2.2 3.2 2.2 4.3a2.2 2.2 0 0 1-4.4 0c0-1.1.9-2.4 2.2-4.3z']],
  dropper: [['f', 'M15.6 2.6a2.2 2.2 0 0 1 3.1 0l2.7 2.7a2.2 2.2 0 0 1 0 3.1l-2 2-5.8-5.8z'], ['s', 'M14.5 7.5L5.5 16.5 4.5 19.5 7.5 18.5 16.5 9.5']],
  undo: [['s', 'M9 14L4 9l5-5'], ['s', 'M4 9h10a6 6 0 0 1 0 12h-3']],
  trash: [['s', 'M4.5 7h15M9.5 7V4h5v3M7 7l1 13.5h8L17 7']],
  box: [['f.3', 'M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z'], ['s', 'M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z'], ['s', 'M3.5 7.5L12 12l8.5-4.5M12 12v9']],
  exit: [['s', 'M13.5 4H5.5v16h8'], ['s', 'M10.5 12h10M16.5 8l4 4-4 4']],
  clock: [['s', circ(12, 12, 9)], ['s', 'M12 7v5.5l3.5 2']],
  eye: [['s', 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z'], ['f', circ(12, 12, 3)]],
  /* へや */
  flame: [['f', 'M12 2.5c1 4 6.5 6 6.5 11.5a6.5 6.5 0 0 1-13 0c0-3.2 2-4.5 3-6.5.3 2 1.2 3 2.2 3 0-3.2-.6-5.3 1.3-8z']],
  fish: [['e', 'M2.5 12c3-4.5 8.5-6 13.5-2.2L21.5 6v12l-5.5-3.8C11 18 5.5 16.5 2.5 12z' + circ(7.6, 11.6, 1.1)]],
  dish: [['s', 'M4.5 9.5a9 9 0 0 0 10 10z'], ['s', 'M9.5 14.5l6-6'], ['f', circ(16.8, 7.2, 1.8)], ['s', 'M17 2.5a4.5 4.5 0 0 1 4.5 4.5'], ['s', 'M7 17l-2 4.5h6']],
  bolt: [['f', 'M13.5 2L4.5 13.5h6.5L9.5 22l9-11.5h-6.5z']],
  snow: [['s', snowflakeD()]],
  telescope: [['s', 'M3.5 13.5l13-5.5 2 4.6-13 5.5z'], ['s', 'M16.5 8l1.6-.7 2 4.6-1.6.7'], ['s', 'M10.5 15.5L8 21.5M12 15l2.5 6.5']],
  flask: [['s', 'M9 3h6M10 3v6.5L4.8 18.3A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.5V3'], ['f', 'M7.3 15h9.4l2.5 3.3A1.8 1.8 0 0 1 17.6 21H6.4a1.8 1.8 0 0 1-1.6-2.7z']],
  cog: [['s', cogD()], ['s', circ(12, 12, 3)]],
  moon: [['f', 'M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z']],
};

/* DOM 用。色は currentColor にしておき、CSS で決める */
function iconSVG(name, cls = '') {
  const parts = ICONS[name] || ICONS.question;
  let s = `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">`;
  for (const [m, d] of parts) {
    if (m === 's') s += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if (m === 'e') s += `<path d="${d}" fill="currentColor" fill-rule="evenodd"/>`;
    else if (m === 'f.3') s += `<path d="${d}" fill="currentColor" fill-opacity="0.28"/>`;
    else s += `<path d="${d}" fill="currentColor"/>`;
  }
  return s + '</svg>';
}

/* canvas 用。(x, y) を中心に size の大きさで描く */
const P2D = {};
function drawIcon(ctx, name, x, y, size, color, lw = 2.2) {
  const parts = ICONS[name] || ICONS.question;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [m, d] of parts) {
    const p = P2D[d] || (P2D[d] = new Path2D(d));
    if (m === 's') ctx.stroke(p);
    else if (m === 'e') ctx.fill(p, 'evenodd');
    else if (m === 'f.3') { ctx.globalAlpha *= 0.28; ctx.fill(p); ctx.globalAlpha /= 0.28; }
    else ctx.fill(p);
  }
  ctx.restore();
}
