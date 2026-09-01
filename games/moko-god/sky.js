/* =========================================================================
   MOKO GOD ― 雲の上
   神さまが歩く雲の島と、そこに建っているものたち
   ========================================================================= */
'use strict';

/* 雲のかたまりをつくる。同じ種なら毎回おなじかたち。 */
function cloudBlob(cx, cy, R, n, seed, dark = false) {
  const rng = new RNG(seed);
  const out = [{ x: cx, y: cy, r: R, dark }];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.f(-0.35, 0.35);
    const d = R * rng.f(0.55, 1.0);
    out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.72, r: R * rng.f(0.42, 0.72), dark });
  }
  return out;
}

/* 島と島をつなぐ、細い雲の橋 */
function cloudBridge(ax, ay, bx, by, r = 46, dark = false) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.max(2, Math.round(d / (r * 0.75)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ x: lerp(ax, bx, t), y: lerp(ay, by, t), r: r * (0.85 + Math.sin(t * Math.PI) * 0.25), dark, bridge: true });
  }
  return out;
}

const SKY = {
  W: 3000, H: 2000,
  spawn: { x: 700, y: 1020 },
  circles: [],
  spots: [],

  build() {
    const C = [];
    /* はじまりの雲（お社がある） */
    C.push(...cloudBlob(700, 1020, 210, 8, 11));
    /* 見はらしの雲（天窓） */
    C.push(...cloudBlob(1420, 780, 195, 8, 22));
    /* 祭壇の雲 */
    C.push(...cloudBlob(1380, 1440, 190, 8, 33));
    /* 降りの雲 */
    C.push(...cloudBlob(2110, 1120, 200, 8, 44));
    /* 星読みの雲 */
    C.push(...cloudBlob(860, 470, 165, 7, 55));

    C.push(...cloudBridge(700, 1020, 1420, 780, 52));
    C.push(...cloudBridge(700, 1020, 1380, 1440, 52));
    C.push(...cloudBridge(1420, 780, 2110, 1120, 50));
    C.push(...cloudBridge(1380, 1440, 2110, 1120, 50));
    C.push(...cloudBridge(700, 1020, 860, 470, 48));

    /* 黒い城の雲。橋がかかるまで渡れない。 */
    C.push(...cloudBlob(2520, 420, 210, 9, 66, true));
    C.push(...cloudBridge(2110, 1120, 2520, 420, 44, true));

    this.circles = C;

    this.spots = [
      { id: 'shrine',  name: 'はじまりの社', icon: '⛩', x: 700, y: 990, r: 58,
        hint: 'ここで手を合わせる（記録をつける）' },
      { id: 'window',  name: '天窓',        icon: '👁', x: 1420, y: 770, r: 62,
        hint: '地上を見る' },
      { id: 'altar',   name: '創世の祭壇',  icon: '✨', x: 1380, y: 1430, r: 62,
        hint: '奇跡をえらぶ' },
      { id: 'gate',    name: '降りの門',    icon: '🚪', x: 2110, y: 1110, r: 64,
        hint: '地上へ降りる' },
      { id: 'tower',   name: '星読みの塔',  icon: '🔭', x: 860, y: 450, r: 56,
        hint: '年代記を読む' },
      { id: 'castle',  name: 'モコの城',    icon: '🏰', x: 2520, y: 400, r: 92,
        hint: '城の門をたたく', dark: true },
    ];
  },

  /* その場所に雲があるか。黒い雲は橋がかかってからだけ通れる。 */
  onCloud(x, y, G) {
    const dark = G && G.demon && G.demon.bridge;
    for (const c of this.circles) {
      if (c.dark && !dark) continue;
      const dx = x - c.x, dy = (y - c.y) / 0.82;
      if (dx * dx + dy * dy < c.r * c.r) return true;
    }
    return false;
  },

  spotAt(x, y) {
    for (const s of this.spots) {
      if (dist(x, y, s.x, s.y) < s.r + 22) return s;
    }
    return null;
  },
};

/* ------------------------------ 城のなか ------------------------------ */
const CASTLE = {
  R: 430,               /* 円い広間 */
  cx: 0, cy: 0,
  spawn: { x: 0, y: 330 },
  inside(x, y) { return Math.hypot(x, y) < this.R - 18; },
};
