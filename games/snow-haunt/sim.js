/* =========================================================================
   SNOW HAUNT ― しくみ
   やしきの マス / みちさがし / 夜の しかけと オバケと おきゃくさん / おかね と ひょうばん
   ========================================================================= */
'use strict';

const REP_DELTA = [0, -1.5, -0.8, 0.3, 0.8, 1.4];   // おきゃくさんの まんぞく (★1〜5) ごとの ひょうばんの 上がり下がり
const REACT = ['ひゃっ!', 'きゃー!', 'うわっ!', 'ひえ〜', 'こわい!', 'ぶるぶる', 'でたー!'];
const FACES = ['', 'つまらない…', 'こわすぎ!', 'まあまあ', 'こわかった!', 'さいこう!'];

const idx = (x, y) => y * MAP_W + x;
const ghostPower = (gh) => GHOSTS[gh.type].power * (1 + 0.12 * (gh.lv - 1));
const ghostStamina = (gh) => GHOSTS[gh.type].stamina + (gh.lv - 1);
const expNeed = (lv) => 6 + lv * 4;

function newState() {
  const grid = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) grid.push(x < EXPAND[0].cols ? CELL.WALL : CELL.LOCK);
  const s = {
    v: 1, day: 1, coins: 300, rep: 10, price: 30, expand: 0, grid, mission: 0, event: null, nextId: 1,
    park: 'ゆきやま ゴーストランド', costume: 'sheet', wardrobe: ['none', 'sheet'], deco: [], rails: [],
    props: [], ghosts: [],
    stats: { nights: 0, guests: 0, great: 0, fled: 0, bestCombo: 0, bestNight: 0, bestIncome: 0 },
  };
  const path = [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [3, 7], [2, 7], [1, 7], [0, 7]];
  for (const [x, y] of path) grid[idx(x, y)] = CELL.FLOOR;
  s.props.push({ type: 'candle', x: 3, y: 3 }, { type: 'icicle', x: 5, y: 2 }, { type: 'snowman', x: 3, y: 6 });
  s.ghosts.push(Sim.makeGhost(s, 'yuki', 5, 5, 'ユキ'));
  s.deco.push({ type: 'lantern', x: -3, y: 11 }, { type: 'flower', x: 0, y: 12 }, { type: 'balloon', x: 1, y: 10 });
  return s;
}

const Sim = {
  s: null,       // セーブされる 状態
  n: null,       // 夜のあいだだけの 状態
  path: null,    // いりぐちから でぐちまでの マスの ならび (つながっていないと null)
  demo: false,
  p: null,       // オーナー (あなた)
  input: { dx: 0, dy: 0, act: false },

  /* ------------------------------ マス ------------------------------ */
  cell(x, y) { return x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? -1 : this.s.grid[idx(x, y)]; },
  isDoor(x, y) { return x === 0 && (y === ENTRANCE.y || y === EXIT.y); },
  propAt(x, y) { return this.s.props.find((p) => p.x === x && p.y === y); },
  ghostAt(x, y) { return this.s.ghosts.find((g) => g.x === x && g.y === y); },
  free(x, y) { return this.cell(x, y) === CELL.WALL && !this.propAt(x, y) && !this.ghostAt(x, y); },
  /* ひろばの マス (外の みち 2れつは のぞく) */
  isPark(x, y) { return y >= PARK_Y0 && y <= PARK_Y1 && x >= PARK_X0 && x < MAP_W && x !== -2 && x !== -1; },
  decoAt(x, y) { return this.s.deco.find((d) => d.x === x && d.y === y); },
  railAt(x, y) { return this.s.rails.some((r) => r.x === x && r.y === y); },
  parkFree(x, y) { return this.isPark(x, y) && !this.decoAt(x, y) && !this.railAt(x, y); },
  placeDeco(type, x, y) {
    if (!this.parkFree(x, y)) return false;
    if (DECOS[type].one && this.s.deco.some((d) => d.type === type)) { toast(`${DECOS[type].name}は ひとつだけ おけるよ`, 'bad'); return false; }
    if (!this.pay(DECOS[type].cost)) return false;
    this.s.deco.push({ type, x, y }); this.findTrack(); return true;
  },
  placeRail(x, y) {
    if (!this.parkFree(x, y)) return false;
    if (!this.pay(RAIL_COST)) return false;
    this.s.rails.push({ x, y }); this.findTrack(); return true;
  },
  /* のりばから レールを たどって、ぐるっと 1しゅう もどってきたら コースターの コースに なる */
  findTrack() {
    const s = this.s, st = s.deco.find((d) => d.type === 'station');
    this.track = null;
    if (!st) return null;
    const isRail = (x, y) => (x === st.x && y === st.y) || this.railAt(x, y);
    const loop = [{ x: st.x, y: st.y }], seen = new Set([st.x + ',' + st.y]);
    let cur = loop[0];
    for (let guard = 0; guard < 200; guard++) {
      let next = null, closed = false;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!isRail(nx, ny)) continue;
        if (nx === st.x && ny === st.y && loop.length >= 4) closed = true;
        if (!seen.has(nx + ',' + ny)) { next = { x: nx, y: ny }; break; }
      }
      if (!next) { if (closed && loop.length >= 6) this.track = loop; break; }
      seen.add(next.x + ',' + next.y); loop.push(next); cur = next;
    }
    return this.track;
  },

  makeGhost(s, type, x = -1, y = -1, name) {
    const used = new Set(s.ghosts.map((g) => g.name));
    const left = GHOST_NAMES.filter((n) => !used.has(n));
    return { id: s.nextId++, type, name: name || (left.length ? pick(left) : 'オバケ' + s.nextId), x, y, lv: 1, exp: 0 };
  },

  /* はばゆうせんで いちばん ちかい みちを さがす */
  findPath() {
    const s = this.s, W = MAP_W, H = MAP_H;
    const prev = new Int16Array(W * H).fill(-1);
    const start = idx(ENTRANCE.x, ENTRANCE.y), goal = idx(EXIT.x, EXIT.y);
    const q = [start]; prev[start] = start;
    while (q.length) {
      const c = q.shift();
      if (c === goal) break;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = idx(nx, ny);
        if (prev[ni] !== -1 || s.grid[ni] !== CELL.FLOOR) continue;
        prev[ni] = c; q.push(ni);
      }
    }
    if (prev[goal] === -1) { this.path = null; return null; }
    const out = [];
    for (let c = goal; ; c = prev[c]) { out.push({ x: c % W, y: (c / W) | 0 }); if (c === start) break; }
    this.path = out.reverse();
    return this.path;
  },

  /* ------------------------------ ひるの けんちく ------------------------------ */
  pay(cost) {
    if (this.s.coins < cost) { toast('コインが たりないよ', 'bad'); Sound.no(); return false; }
    this.s.coins -= cost; return true;
  },
  placeFloor(x, y) {
    if (this.cell(x, y) !== CELL.WALL || this.propAt(x, y) || this.ghostAt(x, y)) return false;
    if (!this.pay(5)) return false;
    this.s.grid[idx(x, y)] = CELL.FLOOR; this.findPath(); return true;
  },
  placeProp(type, x, y) {
    if (!this.free(x, y)) return false;
    if (!this.pay(PROPS[type].cost)) return false;
    this.s.props.push({ type, x, y }); return true;
  },
  moveGhost(gh, x, y) {
    if (!this.free(x, y)) return false;
    gh.x = x; gh.y = y; gh.desk = false; return true;
  },
  deskGhost() { return this.s.ghosts.find((g) => g.desk); },
  /* カウンターの うけつけ係に する。まえの 係は まちあいに もどる */
  setDesk(gh) {
    for (const g of this.s.ghosts) g.desk = false;
    gh.desk = true; gh.x = gh.y = -1;
  },
  /* けす: しかけは はんがくで うる / オバケは まちあいに もどす / ろうかは かべに もどす */
  erase(x, y) {
    const s = this.s, p = this.propAt(x, y), dc = this.decoAt(x, y);
    if (dc) { s.deco.splice(s.deco.indexOf(dc), 1); const back = Math.floor(DECOS[dc.type].cost / 2); s.coins += back; this.findTrack(); return 'prop:' + back; }
    const ri = s.rails.findIndex((r) => r.x === x && r.y === y);
    if (ri >= 0) { s.rails.splice(ri, 1); this.findTrack(); return 'rail'; }
    if (p) { s.props.splice(s.props.indexOf(p), 1); const back = Math.floor(PROPS[p.type].cost / 2); s.coins += back; return 'prop:' + back; }
    const gh = this.ghostAt(x, y);
    if (gh) { gh.x = gh.y = -1; return 'ghost'; }
    if (this.cell(x, y) === CELL.FLOOR && !this.isDoor(x, y)) { s.grid[idx(x, y)] = CELL.WALL; this.findPath(); return 'floor'; }
    return '';
  },
  expandHouse() {
    const s = this.s, nx = EXPAND[s.expand + 1];
    if (!nx) return false;
    if (stars(s) < nx.star) { toast(`★${nx.star}に なると ひろげられるよ`, 'bad'); Sound.no(); return false; }
    if (!this.pay(nx.cost)) return false;
    for (let y = 0; y < MAP_H; y++) for (let x = EXPAND[s.expand].cols; x < nx.cols; x++) s.grid[idx(x, y)] = CELL.WALL;
    s.expand++; return true;
  },
  /* ------------------------------ オーナー ------------------------------ */
  resetPlayer(inside) {
    const c = inside && this.path ? this.path[1] : null;
    this.p = { x: c ? c.x + 0.5 : OUT.staff, y: c ? c.y + 0.5 : OUT.deskY, face: 1, cd: 0, pose: 0, walk: 0, moving: false, bub: null };
    this.input.dx = this.input.dy = 0; this.input.act = false;
  },
  /* あるける ところ: やしきの ろうか と 外の ゆきみち (カウンターの 中は だめ) */
  walkable(x, y) {
    if (y > GATE_Y || y < -0.45 || x < OUT.left || x >= MAP_W) return false;
    if (x > BOOTH.x0 && x < BOOTH.x1 && y > BOOTH.y0 && y < BOOTH.y1) return false;
    if (y >= MAP_H + 0.08 || x < 0) return !this.decoAt(Math.floor(x), Math.floor(y));
    return this.cell(Math.floor(x), Math.floor(y)) === CELL.FLOOR;
  },
  canStand(x, y) {
    const r = 0.22;
    return this.walkable(x - r, y - r) && this.walkable(x + r, y - r) && this.walkable(x - r, y + r) && this.walkable(x + r, y + r);
  },
  atDesk() { return dist(this.p.x, this.p.y, OUT.staff, OUT.deskY) < 0.8; },
  canServe() { const q = this.n && this.n.queue[0]; return !!(q && q.ready && this.atDesk()); },
  updatePlayer(dt) {
    const p = this.p, i = this.input;
    let dx = i.dx, dy = i.dy;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    p.moving = l > 0.15;
    if (p.moving) {
      const sp = 3 * dt;
      if (this.canStand(p.x + dx * sp, p.y)) p.x += dx * sp;
      if (this.canStand(p.x, p.y + dy * sp)) p.y += dy * sp;
      if (Math.abs(dx) > 0.1) p.face = dx > 0 ? 1 : -1;
      p.walk += dt;
    }
    p.cd = Math.max(0, p.cd - dt);
    p.pose = Math.max(0, p.pose - dt * 2.2);
    if (p.bub && (p.bub.t -= dt) <= 0) p.bub = null;
    if (i.act) { i.act = false; this.playerAction(); }
  },
  /* ボタン: カウンターに おきゃくさんが いれば うけつけ、いなければ ばあ! */
  playerAction() {
    const n = this.n, p = this.p;
    if (this.canServe()) { this.serve(n.queue[0]); this.bubble(p, 'いらっしゃいませ!', 0.8); return; }
    if (p.cd > 0) return;
    const c = COSTUMES[this.s.costume];
    p.cd = 1; p.pose = 1;
    this.bubble(p, 'ばあ!', 0.7); Sound.boo();
    for (const gu of n.guests) {
      if (gu.st !== 'walk' || dist(p.x, p.y, gu.x, gu.y) > 1.6 || n.t - gu.pHit < 2.5) continue;
      gu.pHit = n.t; n.pScares++;
      this.scare(gu, c.power, c.kind, 0.4);
    }
  },

  /* カウンターで おかねを もらって、やしきの 中へ */
  serve(gu) {
    const n = this.n, s = this.s;
    n.queue.splice(n.queue.indexOf(gu), 1);
    gu.st = 'walk'; gu.d = 0; gu.idle = false; gu.ready = false;
    if (!this.demo) { n.tickets += n.price; s.coins += n.price; }
    this.float(OUT.lane, OUT.deskY - 0.9, '+' + n.price, '#ffd23a');
    Sound.coin();
    if (gu.reporter) this.bubble(gu, 'テレビの しゅざいに きました!', 2.2);
    else if (chance(0.5)) this.bubble(gu, `${KINDS[gu.weak].name}は にがて…`, 2);
  },

  /* 今夜 来そうな 人数 */
  guestEstimate() {
    const s = this.s, ev = s.event ? EVENTS[s.event] : null;
    const pf = clamp(1.5 - 0.6 * s.price / fairPrice(s), 0.35, 1.4);
    return clamp(Math.round((3 + stars(s) * 4 + s.expand * 2) * pf * cuteMul(s) * (ev && ev.guestMul || 1)), 2, 45);
  },

  /* もくひょうを たっせいしていたら ごほうびを わたして つぎへ */
  checkMission() {
    const s = this.s;
    while (s.mission < MISSIONS.length && MISSIONS[s.mission].check(s)) {
      const m = MISSIONS[s.mission];
      s.coins += m.reward; s.mission++;
      toast(`もくひょう たっせい! 「${m.text}」 <b>+${m.reward}${COIN}</b>`, 'good');
      Sound.great();
    }
  },

  /* ------------------------------ 夜 ------------------------------ */
  startNight() {
    const s = this.s, ev = s.event ? EVENTS[s.event] : null;
    const total = this.demo ? 999 : this.guestEstimate();
    const times = [];
    for (let i = 0; i < total && !this.demo; i++) times.push(rfloat(1.5, NIGHT_LEN * SPAWN_END));
    times.sort((a, b) => a - b);
    // 道のりを 線で つなぐ。外の ゆきみちから 入って、外へ 出る。
    const pts = [{ x: OUT.lane, y: OUT.deskY }, { x: OUT.lane, y: ENTRANCE.y + 0.5 }];
    for (const c of this.path) pts.push({ x: c.x + 0.5, y: c.y + 0.5 });
    pts.push({ x: OUT.exit, y: EXIT.y + 0.5 }, { x: OUT.exit, y: GATE_Y + 0.4 });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
    this.n = {
      t: 0, ev, fair: fairPrice(s), expect: expectThrill(s), price: s.price, times, total: this.demo ? 0 : total, reporterAt: ev && ev.reporter ? rint(0, total - 1) : -1,
      pts, cum, len: cum[cum.length - 1], guests: [], queue: [], spawned: 0, served: 0, left: 0, tickets: 0, tips: 0, bonus: 0, shop: 0, deskT: 1, pScares: 0, patience: patienceOf(s),
      ratings: [0, 0, 0, 0, 0, 0], rides: 0, coaster: null, bestCombo: 0, repBefore: s.rep, starsBefore: stars(s), lvUps: [], fx: [], parts: [], nextDemo: 0.5,
    };
    this.findTrack();
    if (this.track) {
      const L = this.track.length;
      const pops = s.deco.filter((d) => DECOS[d.type].scare).map((d) => {
        let best = -1, bd = 1.6;
        this.track.forEach((c, i) => { const dd = dist(c.x, c.y, d.x, d.y); if (dd < bd) { bd = dd; best = i; } });
        return { d, i: best };
      }).filter((p) => p.i >= 0);
      this.n.coaster = { pos: 0, load: 0, pending: 0, L, pops, lastI: 0 };
    }
    for (const gh of s.ghosts) {
      Object.assign(gh, { _stam: ghostStamina(gh), _cd: rfloat(0, 1.5), _st: 'idle', _t: 0, _ox: 0, _oy: 0, _hx: 0, _hy: 0, _tg: null });
    }
    for (const p of s.props) Object.assign(p, { _cd: rfloat(0, 1), _anim: 0 });
    // ろうそくの あかりと おうさまオバケの ちからを 先に 数えておく
    const candles = s.props.filter((p) => p.type === 'candle');
    const kings = s.ghosts.filter((g) => GHOSTS[g.type].boost && g.x >= 0);
    const lit = (o) => 1 + 0.2 * Math.min(2, candles.filter((c) => c !== o && dist(c.x, c.y, o.x, o.y) <= 1.6).length);
    for (const p of s.props) p._boost = lit(p);
    for (const gh of s.ghosts) {
      gh._boost = lit(gh);
      if (kings.some((k) => k !== gh && dist(k.x, k.y, gh.x, gh.y) <= GHOSTS[k.type].range)) gh._boost *= 1.3;
    }
  },

  makeGuest(reporter) {
    const n = this.n, ev = n.ev;
    const w = {}; for (const k in GUESTS) w[k] = GUESTS[k].w;
    const sp = pickW(w);
    let mood = pickW(MOODS.map((m) => m.w));
    if (ev && ev.brave) mood = 2;
    let brave = MOODS[mood].brave * rfloat(0.9, 1.12);
    if (ev && ev.brave) brave *= 1.25;
    const kid = !reporter && chance(ev && ev.kids || 0.15);
    if (kid) brave *= 0.75;
    const resist = GUESTS[sp].resist;
    const weak = pick(Object.keys(KINDS).filter((k) => k !== resist));
    return {
      id: n.spawned, sp, mood, brave, kid, reporter, weak, d: 0, x: OUT.lane, y: GATE_Y + 0.4, fear: 0, thrill: 0, combo: 0, lastHit: -9, pHit: -9,
      st: 'come', pat: n.patience * (kid ? 0.8 : 1), ready: false, idle: false, stun: 0, iced: false, slow: 1, hop: 0, face: -1, bub: null,
      lane: rfloat(-0.13, 0.13), aura: false, hue: rnd(), seen: new Set(),
    };
  },

  bubble(o, text, t = 1.1) { o.bub = { text, t, life: t }; },
  float(x, y, text, color, size = 1) { this.n.fx.push({ x, y, text, color, size, t: 0, life: 1.2 }); },
  puff(x, y, color, k = 8) {
    for (let i = 0; i < k; i++) this.n.parts.push({ x, y, vx: rfloat(-1.4, 1.4), vy: rfloat(-1.8, 0.2), life: rfloat(0.5, 1), t: 0, color, r: rfloat(0.04, 0.09) });
  },

  /* こわさの かけざん: にがて / つよい / できごと */
  kindMul(gu, kind) {
    let m = 1;
    if (gu.weak === kind) m *= 1.6;
    if (GUESTS[gu.sp].resist === kind) m *= 0.4;
    const ev = this.n.ev;
    if (ev && ev.kindMul && ev.kindMul[kind]) m *= ev.kindMul[kind];
    return m;
  },

  scare(gu, power, kind, stun = 0.35) {
    const n = this.n;
    if (gu.st !== 'walk') return;
    gu.combo = n.t - gu.lastHit < 1.6 ? gu.combo + 1 : 1;
    gu.lastHit = n.t;
    const amt = power * this.kindMul(gu, kind) * (1 + 0.15 * Math.min(4, gu.combo - 1)) / gu.brave;
    gu.fear += amt; gu.thrill += amt; gu.hop = 1; gu.stun = Math.max(gu.stun, stun);
    n.bestCombo = Math.max(n.bestCombo, gu.combo);
    this.float(gu.x, gu.y - 0.9, '+' + Math.round(amt), KINDS[kind].color);
    if (gu.combo >= 2) this.float(gu.x + 0.35, gu.y - 1.25, `コンボ ×${gu.combo}`, '#ffe24a', 0.85);
    if (kind === 'hiehie') Sound.chill(); else if (kind === 'zokuzoku') Sound.pop();
    if (gu.fear >= 100) return this.flee(gu);
    this.bubble(gu, gu.weak === kind && chance(0.6) ? 'にがて〜!' : pick(REACT));
  },
  flee(gu) {
    gu.fear = 100; gu.st = 'flee'; gu.stun = 0.25; gu.iced = false;
    this.bubble(gu, 'ぎゃー!! にげろー!', 1.6);
    Sound.scream();
  },

  finish(gu) {
    const s = this.s, n = this.n;
    gu.st = 'out';
    if (this.demo) return;
    let r;
    if (gu.fear >= 100) r = 2;
    else {
      r = rateThrill(gu.thrill, n.expect);
      if (n.price > n.fair * 1.25) r = Math.max(1, r - 1);
    }
    n.ratings[r]++; n.served++;
    const tip = r === 5 ? Math.round(n.price * 0.5) : r === 4 ? Math.round(n.price * 0.2) : 0;
    n.tips += tip; s.coins += tip;
    let d = REP_DELTA[r];
    if (d > 0) d *= 1 - s.rep / 130;
    if (gu.reporter) d *= 6;
    s.rep = clamp(s.rep + d, 0, 100);
    s.stats.guests++;
    if (r === 5) s.stats.great++;
    if (gu.fear >= 100) s.stats.fled++;
    const ex = n.pts[n.pts.length - 2];
    this.float(ex.x - 0.3, ex.y - 0.8, FACES[r] + (tip ? ` +${tip}` : ''), r >= 4 ? '#ffe680' : r === 3 ? '#e8f0ff' : '#ff9a9a', 0.9);
    if (r === 5) Sound.coin();
    // かえりに ひろばの おみせで かいもの
    if (r !== 2) for (const dc of s.deco) {
      const d = DECOS[dc.type];
      if (d.shop && chance(0.5)) { n.shop += d.shop; s.coins += d.shop; this.float(dc.x + 0.5, dc.y - 0.3, '+' + d.shop, '#ffd23a', 0.8); }
      if (d.photo && chance(0.4)) { s.rep = clamp(s.rep + 0.15, 0, 100); this.float(dc.x + 0.5, dc.y - 0.3, 'パシャ!', '#ffffff', 0.8); }
      if (d.stay && r >= d.stay.minR && chance(d.stay.chance)) {
        n.shop += d.stay.fee; s.coins += d.stay.fee; s.rep = clamp(s.rep + 0.1, 0, 100);
        this.float(dc.x + 0.5, dc.y - 0.6, (dc.type === 'hotel' ? 'おとまり ' : 'たいけん ') + '+' + d.stay.fee, '#ffd23a', 0.8);
      }
    }
    const co = n.coaster;
    if (co && r !== 2 && chance(0.6)) {
      const st = s.deco.find((d) => d.type === 'station'), fee = DECOS.station.ride;
      co.pending++; n.rides++; n.shop += fee; s.coins += fee;
      this.float(st.x + 0.5, st.y - 0.4, 'コースター +' + fee, '#ffd23a', 0.8);
    }
    if (gu.reporter) {
      if (r === 5) { n.bonus += 300; s.coins += 300; toast(`テレビで しょうかいされた! <b>+300${COIN}</b> ひょうばん アップ!`, 'good'); Sound.great(); }
      else toast('テレビの レポーターは あまり まんぞくしなかった…', 'bad');
    }
  },

  /* 夜を すすめる。おわったら true */
  update(dt) {
    const s = this.s, n = this.n;
    n.t += dt;
    // おきゃくさんが 来る
    if (this.demo) {
      n.nextDemo -= dt;
      if (n.nextDemo <= 0 && n.queue.length < 4) { n.nextDemo = rfloat(1.8, 3.4); const gu = this.makeGuest(false); n.guests.push(gu); n.queue.push(gu); n.spawned++; }
    } else {
      while (n.spawned < n.times.length && n.times[n.spawned] <= n.t) {
        const gu = this.makeGuest(n.spawned === n.reporterAt);
        n.guests.push(gu); n.queue.push(gu); n.spawned++;
      }
    }
    this.updateQueue(dt);
    if (this.p) {
      if (this.demo) this.demoPlayer();
      this.updatePlayer(dt);
    }
    const walking = n.guests.filter((g) => g.st === 'walk');

    // しかけ
    for (const gu of n.guests) { gu.slow = 1; gu.aura = false; }
    for (const p of s.props) {
      const d = PROPS[p.type];
      p._anim = Math.max(0, p._anim - dt * 1.2);
      const cx = p.x + 0.5, cy = p.y + 0.5;
      if (d.aura) {
        for (const gu of walking) {
          if (gu.st !== 'walk' || dist(cx, cy, gu.x, gu.y) > d.range) continue;
          const v = d.aura * p._boost * this.kindMul(gu, d.kind) / gu.brave * dt;
          gu.fear += v; gu.thrill += v; gu.aura = true;
          if (d.slow) gu.slow = Math.min(gu.slow, d.slow);
          if (gu.fear >= 100) this.flee(gu);
        }
        continue;
      }
      p._cd -= dt;
      if (p._cd > 0) continue;
      const near = walking.filter((gu) => gu.st === 'walk' && dist(cx, cy, gu.x, gu.y) <= d.range);
      if (!near.length) continue;
      near.sort((a, b) => dist(cx, cy, a.x, a.y) - dist(cx, cy, b.x, b.y));
      for (const gu of d.multi ? near : [near[0]]) this.scare(gu, d.power * p._boost, d.kind);
      p._cd = d.cd; p._anim = 1;
      if (d.kind === 'bikkuri') Sound.boo();
      if (p.type === 'icicle') this.puff(near[0].x, near[0].y - 0.5, '#e8f6ff', 6);
    }

    // オバケ
    const evMul = n.ev && n.ev.ghostMul || 1;
    for (const gh of s.ghosts) {
      if (gh.x < 0) continue;
      const d = GHOSTS[gh.type], hx = gh.x + 0.5, hy = gh.y + 0.5;
      gh._cd -= dt;
      if (gh._st === 'idle') {
        if (gh._stam <= 0) { gh._st = 'sleep'; continue; }
        if (gh._cd > 0) continue;
        let best = null, bd = d.range;
        for (const gu of walking) { const dd = dist(hx, hy, gu.x, gu.y); if (gu.st === 'walk' && !gu.seen.has(gh.id) && dd <= bd) { best = gu; bd = dd; } }
        if (best) { gh._st = 'go'; gh._t = 0; gh._tg = best; best.stun = Math.max(best.stun, 0.3); }
      } else if (gh._st === 'go') {
        gh._t += dt / 0.22;
        const tg = gh._tg, dx = tg.x - hx, dy = tg.y - hy, l = Math.hypot(dx, dy) || 1;
        const k = easeOut(Math.min(1, gh._t));
        gh._ox = (dx - dx / l * 0.38) * k; gh._oy = (dy - dy / l * 0.38) * k;
        if (gh._t >= 1) {
          const pw = ghostPower(gh) * gh._boost * evMul * (d.hidden ? 1.25 : 1);
          const targets = d.multi ? walking.filter((gu) => gu.st === 'walk' && !gu.seen.has(gh.id) && dist(hx, hy, gu.x, gu.y) <= d.range) : [tg];
          for (const gu of targets) {
            gu.seen.add(gh.id);
            this.scare(gu, pw, d.kind, d.freeze || 0.5);
            if (d.freeze && gu.st === 'walk') gu.iced = true;
          }
          if (d.multi) this.puff(hx + gh._ox, hy + gh._oy, '#ffffff', 14);
          this.bubble(gh, d.scale > 1.2 ? 'ばあああ!!' : 'ばあ!', 0.7);
          if (d.kind !== 'hiehie') Sound.boo();
          gh._st = d.chase ? 'chase' : 'hold'; gh._t = 0; gh._hx = gh._ox; gh._hy = gh._oy;
          if (!this.demo) gh._stam--;
          if (!this.demo && gh.lv < 10 && ++gh.exp >= expNeed(gh.lv)) {
            gh.exp = 0; gh.lv++; n.lvUps.push(gh.name);
            this.float(hx, hy - 1.2, `レベルアップ! Lv${gh.lv}`, '#9affc0', 0.9);
          }
        }
      } else if (gh._st === 'chase') {
        // ロボットは しばらく おいかける。おいかけられている あいだ どきどきが ふえる
        gh._t += dt;
        const tg = gh._tg;
        if (tg && tg.st === 'walk' && gh._t < d.chase) {
          const tx = tg.x - hx, ty = tg.y - hy, ddx = tx - gh._ox, ddy = ty - gh._oy, l = Math.hypot(ddx, ddy) || 1;
          if (l > 0.45) { const m = Math.min(l - 0.45, 2.2 * dt); gh._ox += ddx / l * m; gh._oy += ddy / l * m; }
          const v = d.aura * gh._boost * this.kindMul(tg, d.kind) / tg.brave * dt;
          tg.fear += v; tg.thrill += v; tg.lastHit = n.t; tg.chased = 0.3;
          if (tg.fear >= 100) this.flee(tg);
        } else { gh._st = 'back'; gh._t = 0; gh._hx = gh._ox; gh._hy = gh._oy; }
      } else if (gh._st === 'hold') {
        gh._t += dt;
        if (gh._t >= 0.5) { gh._st = 'back'; gh._t = 0; }
      } else if (gh._st === 'back') {
        gh._t += dt / 0.4;
        const k = Math.min(1, gh._t);
        gh._ox = gh._hx * (1 - k); gh._oy = gh._hy * (1 - k);
        if (k >= 1) { gh._st = 'idle'; gh._cd = d.cd; gh._tg = null; }
      }
      if (gh.bub && (gh.bub.t -= dt) <= 0) gh.bub = null;
    }

    // おきゃくさんが あるく。前の人を おいこさない (にげる人は べつ)。
    const order = n.guests.filter((g) => g.st === 'walk' || g.st === 'flee').sort((a, b) => b.d - a.d);
    let front = Infinity;
    for (const gu of order) {
      gu.hop = Math.max(0, gu.hop - dt * 3);
      if (gu.bub && (gu.bub.t -= dt) <= 0) gu.bub = null;
      if (gu.st === 'walk') {
        if (n.t - gu.lastHit > 1.2) gu.fear = Math.max(0, gu.fear - 10 * dt);
        if (gu.stun > 0) { gu.stun -= dt; if (gu.stun <= 0) gu.iced = false; front = gu.d; continue; }
        if (gu.chased > 0) gu.chased -= dt;
        const sp = 1.15 * (gu.kid ? 1.1 : 1) * gu.slow * (gu.chased > 0 ? 1.7 : 1);
        gu.d = Math.max(gu.d, Math.min(gu.d + sp * dt, front - 0.55));
        front = gu.d;
      } else if (gu.st === 'flee') {
        if (gu.stun > 0) gu.stun -= dt; else gu.d += 3.2 * dt;
      }
      this.placeOnPath(gu);
      if (gu.d >= n.len) this.finish(gu);
    }
    n.guests = n.guests.filter((g) => g.st !== 'out');

    if (n.coaster) this.updateCoaster(dt);
    for (const dc of s.deco) if (dc._anim) dc._anim = Math.max(0, dc._anim - dt * 1.5);

    // 文字と つぶ
    for (const f of n.fx) { f.t += dt; f.y -= dt * 0.7; }
    n.fx = n.fx.filter((f) => f.t < f.life);
    for (const p of n.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 2.4 * dt; }
    n.parts = n.parts.filter((p) => p.t < p.life);

    if (this.demo) return false;
    return n.t >= NIGHT_LEN && n.spawned >= n.times.length && n.guests.length === 0;
  },

  /* コースターは ずっと まわる。のりばで おきゃくさんを のせ、こわい かざりの そばで おどかす */
  updateCoaster(dt) {
    const n = this.n, s = this.s, co = n.coaster;
    const before = co.pos;
    co.pos = (co.pos + dt * (co.load ? 3.2 : 2)) % co.L;
    const wrapped = co.pos < before;
    if (wrapped) { co.load = Math.min(4, co.pending); co.pending -= co.load; }
    if (!co.load) return;
    for (const p of co.pops) {
      const passed = wrapped ? (p.i > before || p.i <= co.pos) : (p.i > before && p.i <= co.pos);
      if (!passed) continue;
      p.d._anim = 1;
      const bonus = DECOS[p.d.type].scare * co.load;
      n.shop += bonus; if (!this.demo) s.coins += bonus;
      this.float(p.d.x + 0.5, p.d.y - 0.5, `きゃー! +${bonus}`, '#ff9ab8', 0.8);
      Sound.pop();
    }
  },

  /* カウンターの れつ。まちくたびれると かえってしまう */
  updateQueue(dt) {
    const n = this.n, s = this.s;
    n.queue.forEach((gu, k) => {
      const ty = OUT.deskY + 0.55 * k, dy = ty - gu.y, step = (Math.abs(dy) > 1 ? 2.6 : 1.4) * dt;
      if (Math.abs(dy) <= step) { gu.y = ty; gu.idle = true; gu.ready = k === 0; }
      else { gu.y += Math.sign(dy) * step; gu.idle = false; gu.ready = false; }
      gu.x = OUT.lane; gu.face = -1;
      gu.pat -= dt;
      if (gu.pat < 8 && !gu.bub && chance(dt * 0.4)) this.bubble(gu, pick(['まだかな…', 'はやく〜', 'さむいよ〜']), 1.4);
      if (gu.pat <= 0) { gu.st = 'leave'; gu.idle = false; this.bubble(gu, 'もう かえる!', 1.6); }
    });
    n.queue = n.queue.filter((g) => g.st === 'come');
    for (const gu of n.guests) {
      if (gu.st === 'come' || gu.st === 'leave') { gu.hop = Math.max(0, gu.hop - dt * 3); if (gu.bub && (gu.bub.t -= dt) <= 0) gu.bub = null; }
      if (gu.st !== 'leave') continue;
      gu.x = OUT.lane - 0.4; gu.y += 1.8 * dt;
      if (gu.y > GATE_Y + 0.4) {
        gu.st = 'out';
        if (!this.demo) {
          n.left++;
          s.rep = clamp(s.rep - 0.6 * (gu.reporter ? 6 : 1), 0, 100);
          if (gu.reporter) toast('テレビの レポーターが まちくたびれて かえってしまった…', 'bad');
        }
      }
    }
    // うけつけ係の オバケは すこしずつ ひとりずつ うけつける
    n.deskT -= dt;
    if (n.queue[0] && n.queue[0].ready && n.deskT <= 0 && this.deskGhost()) { n.deskT = 2.6; this.serve(n.queue[0]); }
  },

  /* タイトルの お手本: オーナーが ちかくに きた おきゃくさんを おどかす */
  demoPlayer() {
    const n = this.n, p = this.p;
    if (p.cd <= 0 && n.guests.some((gu) => gu.st === 'walk' && dist(p.x, p.y, gu.x, gu.y) < 1.3 && n.t - gu.pHit > 2.5)) this.input.act = true;
  },

  placeOnPath(gu) {
    const n = this.n, d = clamp(gu.d, 0, n.len);
    let i = 1;
    while (i < n.cum.length - 1 && n.cum[i] < d) i++;
    const a = n.pts[i - 1], b = n.pts[i], seg = n.cum[i] - n.cum[i - 1] || 1, k = (d - n.cum[i - 1]) / seg;
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    gu.x = lerp(a.x, b.x, k) - dy / l * gu.lane;
    gu.y = lerp(a.y, b.y, k) + dx / l * gu.lane;
    if (Math.abs(dx) > 0.01) gu.face = dx > 0 ? 1 : -1;
  },

  /* 夜の しめくくり。おきゅうりょうを はらい、きろくを のこす */
  endNight() {
    const s = this.s, n = this.n;
    const wages = s.ghosts.reduce((a, g) => a + GHOSTS[g.type].wage, 0);
    s.coins -= wages;
    const income = n.tickets + n.tips + n.bonus + n.shop;
    s.stats.nights++;
    s.stats.bestCombo = Math.max(s.stats.bestCombo, n.bestCombo);
    s.stats.bestNight = Math.max(s.stats.bestNight, n.served);
    s.stats.bestIncome = Math.max(s.stats.bestIncome, income);
    const slept = s.ghosts.filter((g) => g._st === 'sleep').length;
    for (const gh of s.ghosts) { gh._st = 'idle'; gh._ox = gh._oy = 0; gh.bub = null; }
    return {
      served: n.served, left: n.left, pScares: n.pScares, rides: n.rides, ratings: n.ratings, tickets: n.tickets, tips: n.tips, bonus: n.bonus, shop: n.shop, wages, net: income - wages,
      repBefore: n.repBefore, repAfter: s.rep, starsBefore: n.starsBefore, starsAfter: stars(s), lvUps: n.lvUps, bestCombo: n.bestCombo, slept,
    };
  },

  nextDay() {
    const s = this.s;
    s.day++;
    s.event = chance(0.45) ? pick(Object.keys(EVENTS)) : null;
    this.n = null;
  },
};

function easeOut(p) { return 1 - (1 - p) * (1 - p); }
/* 重みつき抽選。w は {key: 重み} か 重みの配列 */
function pickW(w) {
  const keys = Object.keys(w);
  let sum = 0; for (const k of keys) sum += w[k];
  let r = rnd() * sum;
  for (const k of keys) { r -= w[k]; if (r <= 0) return Array.isArray(w) ? +k : k; }
  return Array.isArray(w) ? 0 : keys[0];
}
