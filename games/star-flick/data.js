/* =========================================================================
   STAR FLICK ― データ
   レア度 / 船体（形） / パーツ / ステージ / ぼうけん / ガチャ
   ========================================================================= */
'use strict';

const RARITY = {
  N:  { col: '#a9bccf', glow: '#dbe7f2', w: 60, dup: 20 },
  R:  { col: '#4fc3ff', glow: '#a8e6ff', w: 28, dup: 40 },
  SR: { col: '#c77dff', glow: '#e7c4ff', w: 10, dup: 120 },
  UR: { col: '#ffcf4a', glow: '#fff1ad', w: 2,  dup: 400 },
};

/* 船体（形）。
   r=大きさ  mass=重さ（重いほど押されにくい）  grip=止まりやすさ（小さいほどよくすべる）
   speed=はじく速さ  spin=回転のかかりやすさ  punch=ぶつけたとき相手を飛ばす力 */
const HULLS = {
  disc:     { name: 'ディスク',     rar: 'N',  r: 30, mass: 1.0,  grip: 1.0,  speed: 1.0,  spin: 1.0, punch: 0,    desc: 'まるい基本の形。クセがなくて使いやすい。' },
  arrow:    { name: 'アロー',       rar: 'R',  r: 27, mass: 0.85, grip: 0.82, speed: 1.12, spin: 0.9, punch: 0.05, desc: 'とがった形でよくすべる。遠くの相手にとどく。' },
  tank:     { name: 'タンク',       rar: 'R',  r: 36, mass: 1.6,  grip: 1.25, speed: 0.9,  spin: 0.8, punch: 0.1,  desc: '重くて止まりやすい。押されても落ちにくい。' },
  ring:     { name: 'リング',       rar: 'SR', r: 32, mass: 1.1,  grip: 0.95, speed: 1.0,  spin: 1.6, punch: 0.05, desc: '回転がよくかかる。大きくカーブして回りこめる。' },
  sting:    { name: 'スティング',   rar: 'SR', r: 25, mass: 0.75, grip: 0.85, speed: 1.2,  spin: 1.1, punch: 0.35, desc: '小さくて速い。針のようにするどい一撃。' },
  fortress: { name: 'フォートレス', rar: 'UR', r: 42, mass: 2.3,  grip: 1.4,  speed: 0.92, spin: 0.9, punch: 0.15, desc: '動く要塞。ほとんど押し出されない。' },
  nova:     { name: 'ノヴァ',       rar: 'UR', r: 31, mass: 1.35, grip: 0.95, speed: 1.18, spin: 1.3, punch: 0.3,  desc: '速さ・重さ・威力がそろった最強クラス。' },
  /* ここから下は敵だけが持っている形。倒してうばうと使えるようになる。 */
  claw:     { name: 'クロー',       rar: 'SR', enemy: true, r: 33, mass: 1.3,  grip: 1.05, speed: 1.05, spin: 1.0, punch: 0.25, desc: '2本のハサミで相手をはじき飛ばす。' },
  manta:    { name: 'マンタ',       rar: 'SR', enemy: true, r: 34, mass: 1.0,  grip: 0.7,  speed: 1.1,  spin: 1.25, punch: 0.1, desc: '広いつばさで宇宙をすべるように進む。' },
  hornet:   { name: 'ホーネット',   rar: 'SR', enemy: true, r: 27, mass: 0.9,  grip: 0.9,  speed: 1.25, spin: 1.1, punch: 0.4,  desc: 'ハチのような速さと鋭い針をもつ。' },
  phantom:  { name: 'ファントム',   rar: 'UR', enemy: true, r: 31, mass: 1.15, grip: 0.62, speed: 1.15, spin: 1.4, punch: 0.2,  desc: 'ほとんど止まらない、まぼろしの船。' },
  titan:    { name: 'タイタン',     rar: 'UR', enemy: true, r: 45, mass: 2.7,  grip: 1.35, speed: 0.95, spin: 0.8, punch: 0.3,  desc: '巨大な装甲のかたまり。とにかく重い。' },
  emperor:  { name: 'エンペラー',   rar: 'UR', enemy: true, r: 38, mass: 2.0,  grip: 1.0,  speed: 1.2,  spin: 1.4, punch: 0.45, desc: '宇宙をおさめる皇帝の船。すべてが最強。' },
};

/* パーツ。船1隻につき、4つの場所（コア・ジェット・ジャイロ・バリア）に1つずつ付けられる。 */
const SLOTS = [
  { id: 'core',    name: 'コア',     mark: 'コ', desc: 'はじく速さと、ぶつけたときの威力が上がる。' },
  { id: 'jet',     name: 'ジェット', mark: 'ジ', desc: '動いているあいだにボタンを押すと、ぐんと加速する。' },
  { id: 'gyro',    name: 'ジャイロ', mark: '回', desc: '強い回転をかけられる。回転するとカーブして、当たった相手を横にはじく。' },
  { id: 'barrier', name: 'バリア',   mark: 'バ', desc: 'こわれないカベを場に置ける。決まったターンがたつと消える。' },
];

const PARTS = {
  core_n:  { slot: 'core', rar: 'N',  name: 'ミニコア',         speed: 0.08, punch: 0.05 },
  core_r:  { slot: 'core', rar: 'R',  name: 'パワーコア',       speed: 0.15, punch: 0.12 },
  core_sr: { slot: 'core', rar: 'SR', name: 'ハイパーコア',     speed: 0.22, punch: 0.25 },
  core_ur: { slot: 'core', rar: 'UR', name: 'スーパーノヴァ',   speed: 0.30, punch: 0.45 },
  jet_n:   { slot: 'jet', rar: 'N',  name: '小型ジェット',      boost: 240, uses: 1, speed: 0 },
  jet_r:   { slot: 'jet', rar: 'R',  name: 'ツインジェット',    boost: 320, uses: 1, speed: 0.05 },
  jet_sr:  { slot: 'jet', rar: 'SR', name: 'ターボジェット',    boost: 380, uses: 2, speed: 0.08 },
  jet_ur:  { slot: 'jet', rar: 'UR', name: 'ワープジェット',    boost: 470, uses: 2, speed: 0.12 },
  gyro_n:  { slot: 'gyro', rar: 'N',  name: 'ジャイロ',           lv: 2, mul: 1.0, bite: 0.05 },
  gyro_r:  { slot: 'gyro', rar: 'R',  name: 'ハイパージャイロ',   lv: 3, mul: 1.0, bite: 0.1 },
  gyro_sr: { slot: 'gyro', rar: 'SR', name: 'トルネードジャイロ', lv: 3, mul: 1.3, bite: 0.18 },
  gyro_ur: { slot: 'gyro', rar: 'UR', name: 'ギャラクシージャイロ', lv: 3, mul: 1.6, bite: 0.28 },
  bar_n:   { slot: 'barrier', rar: 'N',  name: 'バリア発生器',   len: 150, uses: 1, turns: 2, bounce: 0.8 },
  bar_r:   { slot: 'barrier', rar: 'R',  name: 'ワイドバリア',   len: 210, uses: 1, turns: 3, bounce: 0.8 },
  bar_sr:  { slot: 'barrier', rar: 'SR', name: 'ダブルバリア',   len: 190, uses: 2, turns: 3, bounce: 0.9 },
  bar_ur:  { slot: 'barrier', rar: 'UR', name: 'オーロラバリア', len: 250, uses: 3, turns: 4, bounce: 1.25 },
};

/* 1つのパーツの効きめを、短い日本語で */
function partDesc(id) {
  const p = PARTS[id];
  if (!p) return '';
  if (p.slot === 'core') return `速さ +${Math.round(p.speed * 100)}%・威力 +${Math.round(p.punch * 100)}`;
  if (p.slot === 'jet') return `加速 ${p.boost}・${p.uses}回${p.speed ? `・速さ +${Math.round(p.speed * 100)}%` : ''}`;
  if (p.slot === 'gyro') return `回転レベル ${p.lv} まで・回転の強さ ×${p.mul}`;
  return `長さ ${p.len}・${p.uses}回・${p.turns}ターン${p.bounce > 1 ? '・はね返す' : ''}`;
}

const COLORS = ['#4fd1ff', '#57e39b', '#ffd84a', '#ff9a3d', '#ff5a7a', '#b07bff', '#eef2f8', '#3d6bff', '#2fe0c8', '#ff7ad9'];

/* 船の能力を、船体とパーツから計算する */
function shipStats(ship) {
  const hl = HULLS[ship.hull] || HULLS.disc;
  const pp = ship.parts || {};
  const core = PARTS[pp.core], jet = PARTS[pp.jet], gyro = PARTS[pp.gyro], bar = PARTS[pp.barrier];
  return {
    r: hl.r, mass: hl.mass, grip: hl.grip,
    vmax: 700 * hl.speed * (1 + (core ? core.speed : 0) + (jet ? jet.speed : 0)),
    punch: hl.punch + (core ? core.punch : 0),
    spinLv: gyro ? gyro.lv : 1,
    spinPer: 8 * hl.spin * (gyro ? gyro.mul : 1),
    bite: 0.22 + (gyro ? gyro.bite : 0),
    jetBoost: jet ? jet.boost : 0,
    jetUses: jet ? jet.uses : 0,
    bar: bar ? { len: bar.len, uses: bar.uses, turns: bar.turns, bounce: bar.bounce } : null,
  };
}

/* ------------------------------ ステージ ------------------------------ */
/* 床は「輪っか（多角形）」の集まり。even-odd で中を判定するので、内側の輪っかは穴になる。 */
function polyRect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
function polyRound(x0, y0, x1, y1, r, seg = 8) {
  const pts = [];
  const cs = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}
/* 左右対称にゆがんだ楕円。sin の奇数次と cos の偶数次だけ使うと x → -x で同じ形になる。 */
function polyBlob(rx, ry, n, wob) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + wob * (0.5 * Math.sin(3 * a) + 0.4 * Math.cos(4 * a) + 0.3 * Math.sin(5 * a) + 0.25 * Math.cos(8 * a));
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  return pts;
}
function crateWalls(x, y, w, hgt) {
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - hgt / 2, y1 = y + hgt / 2;
  return [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].map(([a, b, c, d]) => ({ x1: a, y1: b, x2: c, y2: d, crate: true }));
}
const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

const STAGES = {
  deck: {
    name: 'ステーション甲板', place: '宇宙ステーションの外', theme: 'station',
    desc: 'まわりはぜんぶ宇宙。はしから落ちたらアウト。',
    rings: [polyRound(-440, -280, 440, 280, 70)],
    spawn: [[-285, -150], [-305, 0], [-285, 150]],
  },
  asteroid: {
    name: '小惑星リング', place: '小惑星の上', theme: 'asteroid',
    desc: 'でこぼこの小惑星。岩にぶつけてはね返そう。',
    rings: [polyBlob(440, 305, 72, 0.07)],
    rocks: [{ x: 0, y: 0, r: 46 }, { x: 0, y: -205, r: 30 }, { x: 0, y: 205, r: 30 }],
    spawn: [[-275, -115], [-300, 35], [-250, 160]],
  },
  moon: {
    name: 'クレーターの月', place: '月の表面', theme: 'moon',
    desc: '砂のクレーターに入ると止まりやすい。黒い穴に落ちてもアウト。',
    rings: [polyBlob(450, 310, 72, 0.04)],
    zones: [
      { x: 0, y: 0, r: 95, f: 2.6, kind: 'sand' },
      { x: -205, y: 150, r: 62, f: 2.6, kind: 'sand' }, { x: 205, y: 150, r: 62, f: 2.6, kind: 'sand' },
      { x: -200, y: -165, r: 48, f: 2.6, kind: 'sand' }, { x: 200, y: -165, r: 48, f: 2.6, kind: 'sand' },
    ],
    holes: [{ x: 0, y: -215, r: 34 }, { x: 0, y: 215, r: 34 }],
    spawn: [[-300, -95], [-320, 55], [-275, 180]],
  },
  city: {
    name: 'ネオン宇宙都市', place: '宇宙都市の屋上', theme: 'city',
    desc: '2つの屋上を細い橋がつなぐ。ネオンのバンパーは当たると強くはね返す。',
    rings: [
      [[-460, -260], [-60, -260], [-60, -225], [60, -225], [60, -260], [460, -260], [460, 260], [60, 260], [60, 225], [-60, 225], [-60, 260], [-460, 260]],
      polyRect(-60, -95, 60, 95),
    ],
    rocks: [{ x: -250, y: 0, r: 24, kind: 'bumper' }, { x: 250, y: 0, r: 24, kind: 'bumper' }],
    spawn: [[-340, -150], [-365, 10], [-340, 160]],
  },
  hangar: {
    name: '母艦の格納庫', place: '巨大な母艦の中', theme: 'hangar',
    desc: '床がツルツルですべる。カベの切れ目（ハッチ）から外に出たらアウト。',
    rings: [polyRect(-450, -290, 450, 290)],
    grip: 0.72,
    /* カベでふさがれた辺からは落ちないので、落ちる場所（ハッチ）を別に持つ */
    exits: [
      { x1: -120, y1: -290, x2: 120, y2: -290 }, { x1: -120, y1: 290, x2: 120, y2: 290 },
      { x1: -450, y1: -90, x2: -450, y2: 90 }, { x1: 450, y1: -90, x2: 450, y2: 90 },
    ],
    walls: [
      { x1: -450, y1: -290, x2: -120, y2: -290 }, { x1: 120, y1: -290, x2: 450, y2: -290 },
      { x1: -450, y1: 290, x2: -120, y2: 290 }, { x1: 120, y1: 290, x2: 450, y2: 290 },
      { x1: -450, y1: -290, x2: -450, y2: -90 }, { x1: -450, y1: 90, x2: -450, y2: 290 },
      { x1: 450, y1: -290, x2: 450, y2: -90 }, { x1: 450, y1: 90, x2: 450, y2: 290 },
      ...crateWalls(-150, -145, 70, 70), ...crateWalls(150, 145, 70, 70),
      ...crateWalls(-150, 145, 70, 70), ...crateWalls(150, -145, 70, 70),
    ],
    spawn: [[-320, -175], [-330, 0], [-320, 175]],
  },
  blackhole: {
    name: 'ブラックホール', place: 'ブラックホールのそば', theme: 'blackhole',
    desc: 'まん中の穴に近づくと吸いこまれる。外のはしから落ちてもアウト。',
    rings: [polyBlob(430, 430, 80, 0)],
    holes: [{ x: 0, y: 0, r: 58, bh: true }],
    gravity: { x: 0, y: 0, k: 2.4e6 },
    rocks: [{ x: 0, y: -265, r: 26 }, { x: 0, y: 265, r: 26 }],
    spawn: [[-280, -125], [-300, 45], [-235, 215]],
  },
};
const STAGE_ORDER = ['deck', 'asteroid', 'moon', 'city', 'hangar', 'blackhole'];

/* ステージの外枠（カメラ合わせ用）と、敵の出発位置（味方を左右反転）を前もって計算しておく */
for (const id of STAGE_ORDER) {
  const st = STAGES[id];
  st.id = id;
  st.rocks = st.rocks || []; st.zones = st.zones || []; st.holes = st.holes || []; st.walls = st.walls || [];
  st.grip = st.grip || 1;
  st.spawnE = mirror(st.spawn);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of st.rings) for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  st.box = { x0, y0, x1, y1 };
}

/* ------------------------------ ぼうけん ------------------------------ */
/* ai は強さ（1〜4）。1つのステージに3戦あり、3戦目がボス。 */
const E = (name, hull, col, parts = {}) => ({ name, hull, col, parts });
const CAMPAIGN = [
  { stage: 'deck', battles: [
    { name: 'パトロール隊', ai: 1, coins: 150, fleet: [E('パトロール1号', 'disc', '#ff6a5a')] },
    { name: '見張りの2機', ai: 1, coins: 180, fleet: [E('ミハリA', 'disc', '#ff8a4a'), E('ミハリB', 'arrow', '#ff6a5a')] },
    { name: 'BOSS 甲板長ガルド', boss: true, ai: 2, coins: 320, fleet: [E('ガルド号', 'claw', '#ff4a4a', { core: 'core_n' }), E('子分号', 'disc', '#ff9a6a', { gyro: 'gyro_n' })] },
  ] },
  { stage: 'asteroid', battles: [
    { name: '岩場の番人', ai: 2, coins: 200, fleet: [E('ロックA', 'tank', '#d07a4a'), E('ロックB', 'disc', '#e08a5a', { core: 'core_n' })] },
    { name: '流れ星トリオ', ai: 2, coins: 230, fleet: [E('ナガレ1', 'arrow', '#ffb04a', { jet: 'jet_n' }), E('ナガレ2', 'arrow', '#ff8a4a'), E('ナガレ3', 'disc', '#ffa05a')] },
    { name: 'BOSS 宇宙エイのマンタレイ', boss: true, ai: 2, coins: 380, fleet: [E('マンタレイ', 'manta', '#ff5ab0', { gyro: 'gyro_r', jet: 'jet_n' }), E('護衛タンク', 'tank', '#c04a6a', { core: 'core_n' })] },
  ] },
  { stage: 'moon', battles: [
    { name: '月面パトロール', ai: 2, coins: 240, fleet: [E('ルナR', 'ring', '#e0e0ff', { gyro: 'gyro_n' }), E('ルナT', 'tank', '#b0b0d0')] },
    { name: 'クレーター団', ai: 2, coins: 270, fleet: [E('ハリ', 'sting', '#ff6a8a', { core: 'core_r' }), E('ヤジリ', 'arrow', '#ff8aa0', { jet: 'jet_r' }), E('カベ屋', 'disc', '#ffa0b0', { barrier: 'bar_n' })] },
    { name: 'BOSS ルナ・ホーネット', boss: true, ai: 3, coins: 450, fleet: [E('ルナ・ホーネット', 'hornet', '#ffd23a', { core: 'core_r', jet: 'jet_n' }), E('月の輪', 'ring', '#d0d0f0', { gyro: 'gyro_r' }), E('月の盾', 'tank', '#a0a0c0', { barrier: 'bar_r' })] },
  ] },
  { stage: 'city', battles: [
    { name: 'ネオン走り屋', ai: 3, coins: 300, fleet: [E('ネオンA', 'sting', '#ff3ad9'), E('ネオンB', 'sting', '#3affe0'), E('ネオンC', 'ring', '#ff3a8a', { gyro: 'gyro_n' })] },
    { name: '都市防衛隊', ai: 3, coins: 330, fleet: [E('防衛タンク', 'tank', '#5a8aff', { barrier: 'bar_r', core: 'core_r' }), E('防衛リング', 'ring', '#8a5aff', { gyro: 'gyro_sr' }), E('防衛アロー', 'arrow', '#3ad0ff', { jet: 'jet_sr' })] },
    { name: 'BOSS ネオン・ファントム', boss: true, ai: 3, coins: 520, fleet: [E('ネオン・ファントム', 'phantom', '#9a5aff', { jet: 'jet_sr', gyro: 'gyro_r' }), E('ノヴァ・ガード', 'nova', '#ff5ae0', { core: 'core_n' }), E('ハリ2号', 'sting', '#ff3a9a', { core: 'core_r' })] },
  ] },
  { stage: 'hangar', battles: [
    { name: '格納庫の警備', ai: 3, coins: 360, fleet: [E('警備要塞', 'fortress', '#8a9aaa'), E('警備バチ', 'sting', '#ffaa3a', { jet: 'jet_r' })] },
    { name: '精鋭部隊', ai: 3, coins: 400, fleet: [E('精鋭ノヴァ', 'nova', '#ff7a3a', { core: 'core_sr' }), E('精鋭リング', 'ring', '#ffaa5a', { gyro: 'gyro_sr' }), E('精鋭タンク', 'tank', '#cc6a3a', { barrier: 'bar_sr' })] },
    { name: 'BOSS 鋼鉄のタイタン', boss: true, ai: 4, coins: 620, fleet: [E('タイタン', 'titan', '#7a8a9a', { core: 'core_sr', barrier: 'bar_r' }), E('要塞2号', 'fortress', '#9aaaba'), E('クロー2号', 'claw', '#ff5a3a', { jet: 'jet_r' })] },
  ] },
  { stage: 'blackhole', battles: [
    { name: '事象の地平線', ai: 4, coins: 450, fleet: [E('ノヴァX', 'nova', '#ff4a6a', { jet: 'jet_r' }), E('マンタX', 'manta', '#c04aff', { gyro: 'gyro_sr' }), E('ファントムX', 'phantom', '#7a4aff')] },
    { name: '皇帝の親衛隊', ai: 4, coins: 500, fleet: [E('親衛タイタン', 'titan', '#5a5a7a', { barrier: 'bar_sr' }), E('親衛スティング', 'sting', '#ff3a5a', { core: 'core_ur' }), E('親衛リング', 'ring', '#ff9a3a', { gyro: 'gyro_ur' })] },
    { name: 'FINAL 皇帝艦エンペラー', boss: true, ai: 4, coins: 1200, fleet: [E('エンペラー', 'emperor', '#ffcf4a', { core: 'core_ur', jet: 'jet_ur', gyro: 'gyro_ur', barrier: 'bar_ur' }), E('皇帝のタイタン', 'titan', '#8a6a3a', { core: 'core_sr' }), E('皇帝のファントム', 'phantom', '#c08aff', { jet: 'jet_sr' })] },
  ] },
];
CAMPAIGN.forEach((c, i) => c.battles.forEach((b, j) => { b.id = `${i + 1}-${j + 1}`; b.stage = c.stage; }));

/* AI の強さ。samples=試す打ち方の数, noise=狙いのぶれ（ラジアン）, barrier=バリアを使う気の強さ */
const AI_LEVEL = {
  1: { samples: 14, noise: 0.16, barrier: 0.3 },
  2: { samples: 36, noise: 0.09, barrier: 0.6 },
  3: { samples: 80, noise: 0.045, barrier: 0.85 },
  4: { samples: 140, noise: 0.02, barrier: 1 },
};

/* ------------------------------ ガチャ ------------------------------ */
const GACHA = { one: 100, ten: 900 };
/* 出るもの = ディスク以外の船体と、すべてのパーツ。レア度ごとに等しい確率で選ぶ。 */
const GACHA_POOL = { N: [], R: [], SR: [], UR: [] };
for (const [id, hl] of Object.entries(HULLS)) if (!hl.enemy && id !== 'disc') GACHA_POOL[hl.rar].push({ kind: 'hull', id });
for (const [id, p] of Object.entries(PARTS)) GACHA_POOL[p.rar].push({ kind: 'part', id });

/* はじめて遊ぶときの持ちもの */
function newProfile() {
  return {
    v: 1,
    coins: 1000,
    hulls: ['disc'],
    parts: {},
    ships: [
      { id: 's1', name: 'ミルキー号', hull: 'disc', col: '#4fd1ff', parts: {} },
      { id: 's2', name: 'コメット号', hull: 'disc', col: '#57e39b', parts: {} },
      { id: 's3', name: 'ポラリス号', hull: 'disc', col: '#ffd84a', parts: {} },
    ],
    fleet: ['s1', 's2', 's3'],
    cleared: {},
    nextId: 4,
    seen: {},
    stats: { wins: 0, kos: 0, pulls: 0, captures: 0 },
  };
}
