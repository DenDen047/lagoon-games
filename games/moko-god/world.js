/* =========================================================================
   MOKO GOD ― 星そのもの
   地形をつくる / 街をひらく / 一年ごとの移りかわりを計算する
   ========================================================================= */
'use strict';

const TILE = 32;          /* 1マスの大きさ（地上の座標） */
const WW = 200, WH = 150; /* 世界のマス数 */

const World = {
  w: WW, h: WH,
  tiles: new Uint8Array(WW * WH),
  seed: 1,

  idx(tx, ty) { return ty * this.w + tx; },
  inside(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; },
  get(tx, ty) { return this.inside(tx, ty) ? this.tiles[ty * this.w + tx] : T.SEA; },
  set(tx, ty, v) { if (this.inside(tx, ty)) this.tiles[ty * this.w + tx] = v; },
  atPx(x, y) { return this.get(Math.floor(x / TILE), Math.floor(y / TILE)); },
  walkableAtPx(x, y) { return TILE_DEF[this.atPx(x, y)].walk; },
  pxW() { return this.w * TILE; },
  pxH() { return this.h * TILE; },

  /* ----------------------------- 地形生成 ----------------------------- */
  generate(seed) {
    this.seed = seed >>> 0;
    const nElev = makeNoise(this.seed);
    const nMoist = makeNoise(this.seed ^ 0x9e3779b9);
    const nTemp = makeNoise(this.seed ^ 0x45d9f3b);
    const cx = this.w / 2, cy = this.h / 2;

    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        /* まん中ほど高く、へりは海になるようにする */
        const dx = (tx - cx) / (this.w * 0.5), dy = (ty - cy) / (this.h * 0.5);
        const fall = clamp(1 - Math.hypot(dx * 1.05, dy * 1.15), 0, 1);
        let e = fbm(nElev, tx * 0.035, ty * 0.035, 5) * 0.78 + fall * 0.48;
        e += (fbm(nElev, tx * 0.11, ty * 0.11, 3) - 0.5) * 0.12;

        const m = fbm(nMoist, tx * 0.045 + 100, ty * 0.045 + 100, 4);
        /* 気温は緯度（南北）できまる。まん中があたたかい。 */
        const lat = Math.abs(ty - cy) / cy;
        const temp = clamp(1 - lat * 1.25 + (fbm(nTemp, tx * 0.05, ty * 0.05, 3) - 0.5) * 0.5, 0, 1);

        let t;
        if (e < 0.40) t = T.SEA;
        else if (e < 0.455) t = T.SHALLOW;
        else if (e < 0.485) t = T.SAND;
        else if (e > 0.86) t = temp < 0.42 ? T.SNOW : T.ROCK;
        else if (e > 0.76) t = temp < 0.24 ? T.SNOW : T.HILL;
        else if (temp < 0.2) t = T.SNOW;
        else if (m < 0.32 && temp > 0.62) t = T.DESERT;
        else if (m > 0.70) t = (e < 0.53 ? T.MARSH : T.FOREST);
        else if (m > 0.56) t = T.FOREST;
        else if (m > 0.46) t = T.GRASS;
        else if (m > 0.40 && temp > 0.5) t = T.FLOWER;
        else t = T.PLAIN;
        this.tiles[this.idx(tx, ty)] = t;
      }
    }
  },

  /* セーブから戻すとき、奇跡でいじった場所だけ上書きする */
  applyEdits(edits) {
    if (!edits) return;
    for (const [i, v] of edits) this.tiles[i] = v;
  },

  /* 奇跡での書きかえ。edits に残しておくとセーブが軽い。 */
  edit(G, tx, ty, v) {
    if (!this.inside(tx, ty)) return false;
    const i = this.idx(tx, ty);
    if (this.tiles[i] === v) return false;
    this.tiles[i] = v;
    G.edits.push([i, v]);
    if (G.edits.length > 20000) G.edits.splice(0, 5000);
    return true;
  },

  /* --------------------------- 場所をさがす --------------------------- */
  /* 街をひらけるか。陸で、ほかの街から離れていること。 */
  canFoundAt(G, tx, ty) {
    const t = this.get(tx, ty);
    if (!TILE_DEF[t].build) return { ok: false, why: 'ここには街をひらけない' };
    for (const tw of G.towns) {
      if (Math.hypot(tw.tx - tx, tw.ty - ty) < 14) return { ok: false, why: 'ほかの街に近すぎる' };
    }
    /* まわりに十分な陸があること */
    let land = 0;
    for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) {
      if (TILE_DEF[this.get(x, y)].walk) land++;
    }
    if (land < 28) return { ok: false, why: 'ここは陸がせますぎる' };
    return { ok: true };
  },

  /* 最初の街にふさわしい場所（実り豊かで、海が近い） */
  findCradle(rng) {
    let best = null, bestScore = -1;
    for (let k = 0; k < 4000; k++) {
      const tx = rng.i(12, this.w - 13), ty = rng.i(12, this.h - 13);
      const t = this.get(tx, ty);
      if (!TILE_DEF[t].build || t === T.SNOW || t === T.DESERT) continue;
      let score = 0, sea = 0;
      for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) {
        const tt = this.get(x, y);
        score += TILE_DEF[tt].fer;
        if (isWater(tt)) sea++;
      }
      if (sea > 0 && sea < 26) score += 8;
      if (score > bestScore) { bestScore = score; best = { tx, ty }; }
    }
    return best || { tx: this.w >> 1, ty: this.h >> 1 };
  },

  /* まわりの実りやすさの合計 */
  fertilityAround(tx, ty, r = 5) {
    let sum = 0;
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (Math.hypot(x - tx, y - ty) > r) continue;
      sum += TILE_DEF[this.get(x, y)].fer;
    }
    return sum;
  },

  /* 歩ける場所をその近くからさがす（降臨するときに使う） */
  findWalkableNear(tx, ty) {
    if (TILE_DEF[this.get(tx, ty)].walk) return { tx, ty };
    for (let r = 1; r < 40; r++) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * TAU;
        const x = Math.round(tx + Math.cos(ang) * r), y = Math.round(ty + Math.sin(ang) * r);
        if (TILE_DEF[this.get(x, y)].walk) return { tx: x, ty: y };
      }
    }
    return { tx, ty };
  },

  /* ------------------------------ 街 ------------------------------ */
  makeTown(G, tx, ty, name) {
    const t = {
      id: G.nextTownId++,
      name: name || this.pickTownName(G),
      tx, ty,
      pop: 6, food: 12, tech: 0, happy: 62, era: 0,
      born: G.year, blessed: 0, rain: 0, sun: 0, shrine: 0,
      event: null, eventLeft: 0, burnt: 0,
      houses: [],
    };
    this.rebuildHouses(t);
    G.towns.push(t);
    return t;
  },

  pickTownName(G) {
    const used = new Set(G.towns.map((t) => t.name));
    for (const n of TOWN_NAMES) if (!used.has(n)) return n;
    return 'もこ里' + (G.towns.length + 1);
  },

  /* 家のならびは街ごとに決まっていて、時代と人の数でふえる */
  rebuildHouses(t) {
    const rng = new RNG(t.id * 7919 + 13);
    const n = clamp(3 + Math.floor(t.pop / 7), 3, 26);
    t.houses = [];
    for (let i = 0; i < n; i++) {
      const a = rng.f(0, TAU), r = 18 + Math.sqrt(rng.f()) * (46 + n * 2.4);
      t.houses.push({
        dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8,
        rot: rng.f(-0.12, 0.12), size: rng.f(0.85, 1.2), kind: rng.i(0, 2),
      });
    }
    t.houses.sort((a, b) => a.dy - b.dy);
  },

  /* --------------------------- いきものの群れ --------------------------- */
  spawnHerd(G, tx, ty, sp, n = 4) {
    const h = { id: G.nextHerdId++, sp, tx, ty, n, wob: Math.random() * TAU };
    G.herds.push(h);
    return h;
  },

  herdsNear(G, tx, ty, r = 12) {
    return G.herds.filter((h) => Math.hypot(h.tx - tx, h.ty - ty) <= r);
  },

  /* ============================ 一年の流れ ============================ */
  yearTick(G, log) {
    const rng = new RNG((G.seed ^ (G.year * 2654435761)) >>> 0);
    let faithGain = 0;

    /* --- 群れがすこし動き、ふえたりへったりする --- */
    for (let i = G.herds.length - 1; i >= 0; i--) {
      const h = G.herds[i];
      const def = SPECIES[h.sp];
      const nx = clamp(h.tx + rng.i(-2, 2), 1, this.w - 2);
      const ny = clamp(h.ty + rng.i(-2, 2), 1, this.h - 2);
      const okNow = def.biome.includes(this.get(h.tx, h.ty));
      const okNext = def.biome.includes(this.get(nx, ny));
      if (okNext) { h.tx = nx; h.ty = ny; }
      if (okNow || okNext) { if (rng.chance(0.35) && h.n < 40) h.n++; }
      else if (rng.chance(0.45)) h.n--;
      if (h.n <= 0) G.herds.splice(i, 1);
    }

    /* --- 街ごとの一年 --- */
    for (const t of G.towns) {
      const eraDef = ERAS[t.era];

      /* 食べもの: まわりの土地 + いきもの + 雨 */
      const fer = this.fertilityAround(t.tx, t.ty, 5 + Math.floor(t.era * 0.6));
      let food = fer * (0.30 + t.era * 0.08);
      for (const h of this.herdsNear(G, t.tx, t.ty, 10)) {
        const d = SPECIES[h.sp];
        food += (d.food || 0) * Math.min(h.n, 12) * 0.22;
        if (d.danger) t.happy -= d.danger * Math.min(h.n, 10) * 0.35;
        if (d.tech) t.tech += d.tech * Math.min(h.n, 12) * 0.1;
      }
      if (t.rain > 0) { food *= 1.35; t.rain--; }
      if (t.burnt > 0) { food *= 0.7; t.burnt--; }
      food *= 1 - clamp(G.demon.power * 0.0018, 0, 0.35);

      /* 人の数は「食べられる数」に近づいていく */
      const cap = food / 0.85;
      t.pop += (cap - t.pop) * 0.16 * (0.55 + t.happy / 160);
      t.pop = clamp(t.pop, 0, 4000);
      t.food = food;

      /* 気もち */
      let target = 52 + clamp((cap - t.pop) * 1.6, -22, 22) + t.era * 2.2;
      if (t.sun > 0) { target += 16; t.sun--; }
      if (t.shrine) target += 6;
      target -= clamp(G.demon.power * 0.06, 0, 26);
      t.happy += (target - t.happy) * 0.3;

      /* 知恵 */
      const tg = t.pop * 0.07 * (0.4 + t.happy / 140) * (1 + t.era * 0.22);
      t.tech += tg + t.blessed * 2.2;
      t.blessed = Math.max(0, t.blessed - 1);
      t.happy = clamp(t.happy, 4, 100);

      /* 時代がすすむ */
      const nx = ERAS[t.era + 1];
      if (nx && t.pop >= nx.pop && t.tech >= nx.tech) {
        t.era++;
        if (t.era >= 3) t.shrine = 1;
        this.rebuildHouses(t);
        log(`${t.name} が「${ERAS[t.era].name}」にはいった。${ERAS[t.era].line}`, 'era');
        toast(`${t.name} ― ${ERAS[t.era].name}`, 'holy');
      } else if (Math.floor(t.pop / 7) !== Math.floor((t.pop - 1) / 7)) {
        this.rebuildHouses(t);
      }

      /* 信仰 */
      faithGain += 0.5 + t.pop * 0.11 * (t.happy / 100) * (1 + (t.shrine ? 0.5 : 0)) * (1 + t.era * 0.1);

      /* わざわい */
      const risk = 0.035 + G.demon.power * 0.0016 + (t.happy < 35 ? 0.03 : 0);
      if (t.eventLeft > 0) t.eventLeft--;
      else if (rng.chance(risk) && G.year > 6) {
        const d = rng.pick(DISASTERS);
        t.event = d.id; t.eventLeft = 2 + rng.i(0, 3);
        if (d.pop) t.pop *= 1 + d.pop;
        if (d.food) t.food *= 1 + d.food;
        if (d.happy) t.happy = clamp(t.happy + d.happy, 4, 100);
        if (d.tech) t.tech = Math.max(0, t.tech + d.tech);
        log(d.text.replace('{town}', t.name), 'bad');
        toast(`${d.icon} ${d.text.replace('{town}', t.name)}`, 'bad');
      } else if (t.eventLeft === 0) t.event = null;

      /* 街がおおきくなると、となりに分かれ村ができる */
      if (t.era >= 2 && t.pop > 40 && G.towns.length < 9 && rng.chance(0.07)) {
        for (let k = 0; k < 30; k++) {
          const a = rng.f(0, TAU), r = rng.f(16, 26);
          const nxT = Math.round(t.tx + Math.cos(a) * r), nyT = Math.round(t.ty + Math.sin(a) * r);
          if (this.canFoundAt(G, nxT, nyT).ok) {
            const child = this.makeTown(G, nxT, nyT);
            child.era = Math.max(0, t.era - 1);
            child.tech = ERAS[child.era].tech;
            this.rebuildHouses(child);
            log(`${t.name} から人がわかれて、${child.name} ができた。`, 'town');
            toast(`あたらしい街 ― ${child.name}`, 'good');
            break;
          }
        }
      }
    }

    /* --- 城の力 --- */
    const D = G.demon;
    if (D.alive) {
      D.power = Math.min(220, D.power + 0.4 + G.towns.length * 0.08);
      if (D.power > 40 && !D.bridge) {
        D.bridge = true;
        log('雲のはしに、黒い橋がかかった。城へ行けるようになった。', 'demon');
        toast('黒い橋がかかった ― モコの城へ行ける', 'bad');
      }
      /* 影のいきものを流す */
      if (D.power > 60 && G.herds.filter((h) => h.sp === 'kagemushi').length < 4 && rng.chance(0.25)) {
        const tw = rng.pick(G.towns);
        if (tw) {
          const tx = clamp(tw.tx + rng.i(-9, 9), 1, this.w - 2);
          const ty = clamp(tw.ty + rng.i(-9, 9), 1, this.h - 2);
          if (TILE_DEF[this.get(tx, ty)].walk) {
            this.spawnHerd(G, tx, ty, 'kagemushi', 3);
            log('城から影がこぼれ、地上に「かげむし」がわいた。', 'demon');
          }
        }
      }
    } else {
      D.sealed++;
      if (D.sealed > 26) { D.alive = true; D.power = 24; D.hp = D.maxHp; D.sealed = 0;
        log(`${DEMON.name} が、また城で目をさました。`, 'demon');
        toast('黒い城に、また灯りがついた', 'bad'); }
    }

    G.faith += faithGain;
    G.faithRate = faithGain;
    G.year++;

    /* 星の時代にとどいたら、おわりの合図 */
    if (!G.flags.ending && G.towns.some((t) => t.era >= 5)) {
      G.flags.ending = true;
      log('モコたちは、星へ出ていく舟をつくりはじめた。', 'era');
    }
  },
};
