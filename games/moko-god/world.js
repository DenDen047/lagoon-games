/* =========================================================================
   MOKO GOD ― 世界そのもの
   地形をつくる / 村と主の住みかを置く / 魔物をわかせる
   ========================================================================= */
'use strict';

const TILE = 32;
const WW = 340, WH = 340;

/* 中心からの遠さで土地が変わる。村を出るほど強い魔物が出る。 */
const RINGS = [
  { to: 0.20, kind: 'field' },
  { to: 0.40, kind: 'forest' },
  { to: 0.60, kind: 'waste' },
  { to: 0.80, kind: 'frost' },
  { to: 0.93, kind: 'castle' },
];

const World = {
  w: WW, h: WH,
  tiles: new Uint8Array(WW * WH),
  seed: 1,
  villages: [],
  lairs: [],
  castle: null,

  idx(tx, ty) { return ty * this.w + tx; },
  inside(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; },
  get(tx, ty) { return this.inside(tx, ty) ? this.tiles[ty * this.w + tx] : T.SEA; },
  set(tx, ty, v) { if (this.inside(tx, ty)) this.tiles[ty * this.w + tx] = v; },
  atPx(x, y) { return this.get(Math.floor(x / TILE), Math.floor(y / TILE)); },
  walkPx(x, y) { return TILE_DEF[this.atPx(x, y)].walk; },
  zonePx(x, y) { return TILE_DEF[this.atPx(x, y)].zone; },
  pxW() { return this.w * TILE; },
  pxH() { return this.h * TILE; },

  /* ============================ 地形生成 ============================ */
  generate(seed) {
    this.seed = seed >>> 0;
    const rng = new RNG(this.seed ^ 0x1f83d9ab);
    const nR = makeNoise(this.seed);            /* 帯のゆらぎ */
    const nD = makeNoise(this.seed ^ 0x9e3779b9); /* 土地のこまかい差 */
    const cx = this.w / 2, cy = this.h / 2;
    const maxR = Math.min(cx, cy);

    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const dx = tx - cx, dy = ty - cy;
        let d = Math.hypot(dx, dy) / maxR;
        /* 帯のさかいめをゆらす。まん丸に見えないように。 */
        d += (fbm(nR, tx * 0.018, ty * 0.018, 4) - 0.5) * 0.085;
        d += (fbm(nR, tx * 0.06, ty * 0.06, 2) - 0.5) * 0.03;

        let kind = 'sea';
        for (const r of RINGS) { if (d < r.to) { kind = r.kind; break; } }

        const v = fbm(nD, tx * 0.075 + 40, ty * 0.075 + 40, 4);
        let t;
        switch (kind) {
          case 'field':
            t = v > 0.62 ? T.FOREST : v > 0.54 ? T.FLOWER : v > 0.40 ? T.GRASS : v > 0.30 ? T.PLAIN : T.HILL;
            break;
          case 'forest':
            t = v > 0.60 ? T.MARSH : v > 0.34 ? T.FOREST : v > 0.26 ? T.GRASS : T.HILL;
            break;
          case 'waste':
            t = v > 0.66 ? T.ROCK : v > 0.30 ? T.DESERT : T.SAND;
            break;
          case 'frost':
            t = v > 0.62 ? T.ROCK : v > 0.34 ? T.SNOW : v > 0.24 ? T.HILL : T.ROCK;
            break;
          case 'castle':
            t = v > 0.72 ? T.ROCK : T.ASH;
            break;
          default:
            t = d > 0.92 ? T.SEA : T.SHALLOW;
        }
        this.tiles[this.idx(tx, ty)] = t;
      }
    }

    /* --- 湖をいくつか。まわりは浅瀬にする。 --- */
    for (let k = 0; k < 80; k++) {
      const a = rng.f(0, TAU), r = rng.f(0.18, 0.72) * maxR;
      const lx = Math.round(cx + Math.cos(a) * r), ly = Math.round(cy + Math.sin(a) * r);
      const rad = rng.i(3, 8);
      for (let y = ly - rad - 1; y <= ly + rad + 1; y++) {
        for (let x = lx - rad - 1; x <= lx + rad + 1; x++) {
          const dd = Math.hypot(x - lx, y - ly);
          if (dd > rad + 1) continue;
          if (this.get(x, y) === T.ASH) continue;
          this.set(x, y, dd > rad - 0.4 ? T.SHALLOW : T.SEA);
        }
      }
    }

    /* --- 村・主の住みか・城 --- */
    this.villages = [];
    this.lairs = [];
    const centerV = this.clearCircle(Math.round(cx), Math.round(cy), 6, T.GRASS);
    this.villages.push({ tx: centerV.tx, ty: centerV.ty, name: VILLAGE_NAMES[0], main: true });

    /* 主は、それぞれの帯の中に一つずつ */
    const lairAngles = { mori: rng.f(0, TAU), suna: 0, koori: 0 };
    lairAngles.suna = lairAngles.mori + rng.f(1.9, 2.6);
    lairAngles.koori = lairAngles.suna + rng.f(1.9, 2.6);
    const lairRing = { mori: 0.30, suna: 0.50, koori: 0.70 };
    for (const key of ['mori', 'suna', 'koori']) {
      const a = lairAngles[key], r = lairRing[key] * maxR;
      const p = this.clearCircle(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 5, null);
      this.lairs.push({ key, tx: p.tx, ty: p.ty });
    }

    /* 城は、いちばん外の灰の地。北の方角に立てる。 */
    const ca = -Math.PI / 2 + rng.f(-0.35, 0.35);
    const cr = 0.87 * maxR;
    const cp = this.clearCircle(Math.round(cx + Math.cos(ca) * cr), Math.round(cy + Math.sin(ca) * cr), 6, T.ASH);
    this.castle = { tx: cp.tx, ty: cp.ty };

    /* --- 村から外へ、道をのばす --- */
    const v0 = this.villages[0];
    for (const l of this.lairs) this.road(v0.tx, v0.ty, l.tx, l.ty);
    this.road(v0.tx, v0.ty, this.castle.tx, this.castle.ty);

    /* 外れの村を二つ。旅の途中で休めるように。 */
    const outNames = [VILLAGE_NAMES[1], VILLAGE_NAMES[2], VILLAGE_NAMES[3]];
    const outRing = [0.33, 0.53, 0.73];
    for (let i = 0; i < 3; i++) {
      const a = lairAngles.mori + 3.14 + i * 2.1 + rng.f(-0.4, 0.4);
      const r = outRing[i] * maxR;
      const p = this.clearCircle(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 5, null);
      this.villages.push({ tx: p.tx, ty: p.ty, name: outNames[i], main: false });
      this.road(v0.tx, v0.ty, p.tx, p.ty);
    }
  },

  /* 歩ける丸い広場をつくる。fill を渡すとその地面で塗る。 */
  clearCircle(tx, ty, r, fill) {
    tx = clamp(tx, r + 2, this.w - r - 3);
    ty = clamp(ty, r + 2, this.h - r - 3);
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (Math.hypot(x - tx, y - ty) > r) continue;
        const cur = this.get(x, y);
        if (fill) this.set(x, y, fill);
        else if (!TILE_DEF[cur].walk) this.set(x, y, cur === T.SEA || cur === T.SHALLOW ? T.SAND : T.PLAIN);
      }
    }
    return { tx, ty };
  },

  /* まっすぐな道。海の上は橋がわりに砂を敷く。 */
  road(x0, y0, x1, y1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(lerp(x0, x1, t)), y = Math.round(lerp(y0, y1, t));
      for (let k = -1; k <= 1; k++) {
        for (let j = -1; j <= 1; j++) {
          const cur = this.get(x + k, y + j);
          if (cur === T.ASH) continue;
          if (Math.abs(k) + Math.abs(j) > 1) { if (!TILE_DEF[cur].walk) this.set(x + k, y + j, T.SAND); continue; }
          this.set(x + k, y + j, T.ROAD);
        }
      }
    }
  },

  /* 歩ける場所を近くからさがす */
  findWalkableNear(tx, ty) {
    if (TILE_DEF[this.get(tx, ty)].walk) return { tx, ty };
    for (let r = 1; r < 50; r++) {
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * TAU;
        const x = Math.round(tx + Math.cos(ang) * r), y = Math.round(ty + Math.sin(ang) * r);
        if (TILE_DEF[this.get(x, y)].walk) return { tx: x, ty: y };
      }
    }
    return { tx, ty };
  },

  villageAt(x, y, r = 200) {
    for (const v of this.villages) {
      if (dist(v.tx * TILE + 16, v.ty * TILE + 16, x, y) < r) return v;
    }
    return null;
  },

  /* ========================= 魔物をわかせる =========================
     プレイヤーのまわりだけに湧かせ、遠ざかったら消す。               */
  spawnRing(G, px, py) {
    const cap = 18;
    if (G.mobs.length >= cap) return;
    /* 立っている土地と同じ土地の魔物だけ出す。
       帯のさかいめで、いきなり格上が湧かないようにするため。 */
    const here = this.zonePx(px, py);
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * TAU;
      const r = 420 + Math.random() * 280;
      const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
      if (x < 64 || y < 64 || x > this.pxW() - 64 || y > this.pxH() - 64) continue;
      if (!this.walkPx(x, y)) continue;
      if (this.villageAt(x, y, 340)) continue;
      const zone = this.zonePx(x, y);
      if (!zone) continue;
      if (here && zone !== here) continue;
      /* 主の住みかのすぐそばには雑魚を出さない */
      let nearLair = false;
      for (const l of this.lairs) if (dist(l.tx * TILE, l.ty * TILE, x, y) < 260) nearLair = true;
      if (nearLair) continue;

      const pool = Object.keys(MONSTERS).filter((k2) => MONSTERS[k2].zone === zone);
      if (!pool.length) continue;
      const sp = pool[Math.floor(Math.random() * pool.length)];
      G.mobs.push(makeMob(sp, x, y));
      return;
    }
  },

  cullFar(G, px, py) {
    for (let i = G.mobs.length - 1; i >= 0; i--) {
      const m = G.mobs[i];
      if (m.boss) continue;
      if (dist(m.x, m.y, px, py) > 1500) G.mobs.splice(i, 1);
    }
  },
};

/* ---------------------- 魔物・主・魔王をつくる ---------------------- */
let MOB_ID = 1;

function makeMob(sp, x, y) {
  const d = MONSTERS[sp];
  return {
    id: MOB_ID++, sp, def: d, x, y, vx: 0, vy: 0, face: 1, wob: Math.random() * TAU,
    hp: d.hp, maxhp: d.hp, state: 'idle', t: Math.random() * 2, cool: Math.random() * d.cool,
    hurt: 0, slow: 0, kbx: 0, kby: 0, wx: x, wy: y, scale: 1, boss: false,
  };
}

function makeGuardian(key, x, y) {
  const d = GUARDIANS[key];
  return {
    id: MOB_ID++, sp: key, def: d, x, y, vx: 0, vy: 0, face: 1, wob: 0,
    hp: d.hp, maxhp: d.hp, state: 'idle', t: 0, cool: 1.4, hurt: 0, slow: 0,
    kbx: 0, kby: 0, wx: x, wy: y, scale: d.scale, boss: true, guardian: key, phase: 0,
  };
}

function makeDemon(x, y) {
  return {
    id: MOB_ID++, sp: 'demon', def: DEMON, x, y, vx: 0, vy: 0, face: 1, wob: 0,
    hp: DEMON.hp, maxhp: DEMON.hp, state: 'idle', t: 0, cool: 1.6, hurt: 0, slow: 0,
    kbx: 0, kby: 0, wx: x, wy: y, scale: 2.4, boss: true, demon: true, phase: 0, pat: 0,
  };
}
