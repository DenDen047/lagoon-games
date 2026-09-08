/* =========================================================================
   PHANTOM DUEL ― データ
   能力タイプ、能力表、すがたの部品、挑戦者、闘技場
   ========================================================================= */
'use strict';

const ARENA = { w: 1240, h: 780 };
const MAX_LEVEL = 10;
const BASE_POINTS = 8;          /* 作るときに配れる点 */
const GHOST_SCALE = 0.62;       /* 幻影の描画倍率。1体ぶんの大きさはこれで決まる */
const HIT_R = 17;               /* 幻影の当たり判定の半径 */

/* ===================== 能力表 ===================== */
const STAT_KEYS = ['power', 'speed', 'range', 'stamina', 'precision'];
const STATS = {
  power:     { ja: '破壊力',       desc: '一撃で削れる体力' },
  speed:     { ja: 'スピード',     desc: '動く速さと攻撃の間隔' },
  range:     { ja: '射程距離',     desc: '攻撃が届く距離、弾の飛ぶ距離' },
  stamina:   { ja: '持続力',       desc: '体力の多さ' },
  precision: { ja: '精密動作性',   desc: '当たりの広さ、弾の速さ、能力ゲージの溜まり' },
};
const RANK_LETTER = ['-', 'E', 'D', 'C', 'B', 'A'];

function pointsFor(level) { return BASE_POINTS + (level - 1); }
function spentPoints(stats) { return STAT_KEYS.reduce((s, k) => s + (stats[k] - 1), 0); }
function freePoints(c) { return pointsFor(c.level) - spentPoints(c.stats); }
function expNeed(level) { return level >= MAX_LEVEL ? Infinity : 35 + (level - 1) * 22; }

/** 能力表とレベルから、実際の戦闘で使う数値を出す */
function derive(c) {
  const t = TYPES[c.type], s = c.stats, lv = c.level;
  const grow = 1 + 0.025 * (lv - 1);
  return {
    pow:       (0.72 + 0.16 * s.power) * grow,
    dmg:       (0.72 + 0.16 * s.power) * t.dmgMul * grow,
    moveSpd:   (152 + 17 * s.speed + 1.5 * lv) * (t.spdMul || 1),
    reach:     (22 + 4.5 * s.range + 1.5 * s.precision) * (t.reachMul || 1),
    shotRange: 300 + 95 * s.range,
    maxHp:     Math.round((92 + 24 * s.stamina + 6 * lv) * (t.hpMul || 1)),
    bullet:    330 + 55 * s.precision,
    rate:      1 + 0.07 * s.speed,
    gaugeRate: 4 + 0.9 * s.precision,
  };
}

/* ===================== 能力タイプ ===================== */
const TYPES = {
  moot: {
    ja: 'パンチ型', lead: '2発殴ったら少し溜める',
    desc: '思いきり殴る。2発つづけて出したあと少しだけ溜めの時間が入る。一撃が重いぶん、近づかないと当たらない。',
    dmgMul: 0.85, hpMul: 1.05, reachMul: 1.0,
    ability: { name: '大地たたき', cost: 60, desc: '地面を殴り、まわりに衝撃波を出す' },
    awaken:  { name: '爆砕', desc: '殴った相手がそのあと爆発する' },
  },
  rush: {
    ja: '連打型', lead: '押しっぱなしで殴りつづける',
    desc: '軽い拳を絶え間なく浴びせる。1発は小さいが手数で押し切る。',
    dmgMul: 0.28, spdMul: 1.05,
    ability: { name: '渾身', cost: 55, desc: '少し溜めてから踏み込み、重い一撃を入れる' },
    awaken:  { name: '衝波', desc: '連打が8発たまるたびに衝撃波が出る' },
  },
  shot: {
    ja: '射撃型', lead: '離れたところから撃ち抜く',
    desc: '弾を撃つ。遠くまで届くので距離を保って戦える。',
    dmgMul: 0.50, reachMul: 1.0,
    ability: { name: '貫通弾', cost: 50, desc: '柱も相手もつらぬく大きな弾を撃つ' },
    awaken:  { name: '三条', desc: 'ふだんの弾が3方向に増える' },
  },
  auto: {
    ja: '自動型', lead: '幻影が自分で狙って戦う',
    desc: 'ボタンを押さなくても近くの相手を自分で攻撃する。ボタンは突進の合図になる。',
    dmgMul: 0.70,
    ability: { name: '追尾の礫', cost: 55, desc: '追いかける礫を3つ放つ' },
    awaken:  { name: '追撃', desc: '自動で出す攻撃が追いかける弾になる' },
  },
  bind: {
    ja: '束縛型', lead: '長い腕で薙ぎ払う',
    desc: '間合いの外から薙ぎ払う。能力を当てると相手をその場に縛りつけられる。',
    dmgMul: 0.60, reachMul: 1.45,
    ability: { name: '縛鎖', cost: 50, desc: '鎖を飛ばし、当たった相手を2.2秒動けなくする' },
    awaken:  { name: '喰鎖', desc: '縛っているあいだ相手の体力が削れつづける' },
  },
  mend: {
    ja: '再生型', lead: '守りながら立て直す',
    desc: '攻撃は並だが、能力で体力を戻して耐えられる。粘って勝つ型。',
    dmgMul: 0.62, hpMul: 1.12,
    ability: { name: '加護', cost: 45, desc: '4秒間ダメージを半分にして、体力を少し戻す' },
    awaken:  { name: '不屈', desc: '倒れる一撃を1回だけ耐える' },
  },
  world: {
    ja: '時間型', lead: '時間を止める',
    desc: '速くて重い連打で削りながらゲージを溜め、ここぞで時間を止める。止まっているあいだ動けるのは自分だけ。',
    dmgMul: 0.40, spdMul: 1.08,
    ability: { name: 'ザ・ワールド', cost: 85, desc: '2.6秒のあいだ相手と弾の動きが止まり、その間の一撃は1.4倍' },
    awaken:  { name: '止まった世界', desc: '止められる時間が4秒に延びる' },
  },
  flame: {
    ja: '火炎型', lead: '前方を焼きはらう',
    desc: '短い炎を吹きつづける。1発は軽いが、当たった相手はしばらく燃える。',
    dmgMul: 0.30, reachMul: 1.2,
    ability: { name: '火柱', cost: 55, desc: '足もとに炎の柱を立てる。4秒のあいだ入った相手を焼く' },
    awaken:  { name: '延焼', desc: '炎を当てた相手が3秒燃えつづける' },
  },
  blade: {
    ja: '斬撃型', lead: '一歩外から斬る',
    desc: '間合いの外から大きく斬る。手数は少ないが一撃が通る。',
    dmgMul: 0.95, reachMul: 1.3,
    ability: { name: '居合', cost: 55, desc: 'まっすぐ踏み込み、通り道の相手を斬る' },
    awaken:  { name: '飛燕', desc: '斬るたびに斬撃が飛んでいく' },
  },
  omni: {
    ja: '万能型', lead: '挑戦者だけが使う型',
    desc: '自分で戦いながら、いくつもの能力を順ぐりに使う。',
    dmgMul: 0.62, hpMul: 1.10, spdMul: 0.95, foeOnly: true,
    ability: { name: '万象', cost: 50, desc: '貫通弾・縛鎖・追尾の礫・時間停止を順番に使う' },
    awaken:  { name: '万全', desc: 'すべての能力が強くなる' },
  },
};

/* ===================== すがたの部品 ===================== */
const PARTS = {
  head:     { ja: 'かぶりもの', list: [
    { id: 'none', ja: 'なし' }, { id: 'helm',  ja: '兜' }, { id: 'horn', ja: '角' },
    { id: 'visor', ja: 'バイザー' }, { id: 'skull', ja: 'めん' }, { id: 'crown', ja: '冠' },
    { id: 'hood', ja: 'フード' }] },
  eyes:     { ja: 'め', list: [
    { id: 'slit', ja: '細目' }, { id: 'round', ja: '丸目' }, { id: 'triple', ja: '三つ目' },
    { id: 'cross', ja: '十字' }, { id: 'void', ja: '虚ろ' }] },
  shoulder: { ja: 'かた', list: [
    { id: 'pad', ja: '厚肩' }, { id: 'spike', ja: '棘' }, { id: 'ring', ja: '輪' },
    { id: 'wing', ja: '翼' }, { id: 'bare', ja: 'なし' }] },
  arm:      { ja: 'まえ足', list: [
    { id: 'fist', ja: '篭手' }, { id: 'claw', ja: '爪' }, { id: 'slim', ja: '細腕' },
    { id: 'cannon', ja: '砲' }, { id: 'blade', ja: '刃' }] },
  body:     { ja: 'せなか', list: [
    { id: 'armor', ja: '装甲' }, { id: 'ribs', ja: 'あばら' }, { id: 'coat', ja: 'コート' },
    { id: 'core', ja: '核' }] },
  lower:    { ja: 'しっぽ', list: [
    { id: 'legs', ja: 'みじかい尾' }, { id: 'tail', ja: 'ながい尾' },
    { id: 'mist', ja: '霧の尾' }, { id: 'wheel', ja: '輪の尾' }] },
  mark:     { ja: 'もよう', list: [
    { id: 'none', ja: 'なし' }, { id: 'stripe', ja: '縞' }, { id: 'dots', ja: '点' },
    { id: 'cross', ja: '十字' }, { id: 'circuit', ja: '回路' }] },
};
const PART_KEYS = Object.keys(PARTS);

const PALETTE = {
  main: ['#e8e3d6', '#5a6bd8', '#d8574a', '#3fae7d', '#c9a227', '#8a56c9', '#2f3a52', '#e08bb4'],
  sub:  ['#2c3a72', '#7a2b2b', '#1f4d3d', '#4a3a6b', '#c3b48a', '#22252f', '#b0552a', '#3a6d8c'],
  glow: ['#8fd0ff', '#ffdc5e', '#ff6f91', '#7dffc4', '#c79bff', '#ff9d4d', '#ffffff', '#6effe9'],
};

/* ===================== 用意されている相棒 ===================== */
/* すがたと型は決まっていて、色と能力表はあとから変えられる。 */
function presetChar(k) {
  return {
    id: k.id + '-' + Date.now(),
    kit: k.id,
    preset: k.draw || null,     /* 専用の絵を持つ子だけ入る */
    name: k.name,
    cry: k.cry,
    type: k.type,
    level: 1,
    exp: 0,
    stats: Object.assign({}, k.stats),
    colors: Object.assign({}, k.colors),
    parts: Object.assign({}, k.parts),
    owner: 'ニャ太郎',
  };
}

const PRESETS = [
  {
    id: 'starplatinya', name: 'スタープラチニャ', type: 'rush', cry: 'ニャラニャラ',
    note: 'ニャ太郎の幻影。速い拳で押し切る',
    stats: { power: 4, speed: 4, range: 2, stamina: 2, precision: 1 },
    colors: { main: '#8a56c9', sub: '#c9a227', glow: '#ffdc5e' },
    parts: { head: 'crown', eyes: 'slit', shoulder: 'pad', arm: 'fist', body: 'armor', lower: 'tail', mark: 'stripe' },
  },
  {
    id: 'moot', draw: 'moot', name: 'ムートくん', type: 'moot', cry: 'ドゴォ',
    note: '2発殴って少し溜める、重い拳の相棒',
    stats: { power: 5, speed: 2, range: 2, stamina: 3, precision: 1 },
    colors: { main: '#f7f1e0', sub: '#2c3a72', glow: '#8fd0ff' },
    parts: { head: 'helm', eyes: 'round', shoulder: 'pad', arm: 'fist', body: 'armor', lower: 'tail', mark: 'none' },
  },
  {
    id: 'cat', draw: 'cat', name: 'ニャワールド', type: 'world', cry: 'ニャニャニャニャ',
    note: '猫のかたちをした幻影。時間を止める',
    stats: { power: 2, speed: 4, range: 2, stamina: 2, precision: 3 },
    colors: { main: '#d9b64a', sub: '#2e4a3c', glow: '#ffe98f' },
    parts: { head: 'helm', eyes: 'slit', shoulder: 'pad', arm: 'fist', body: 'armor', lower: 'tail', mark: 'none' },
  },
  {
    id: 'javelin', name: 'ジャベリン', type: 'blade', cry: 'シャッ',
    note: '間合いの外から斬る細身の機体',
    stats: { power: 4, speed: 3, range: 3, stamina: 2, precision: 1 },
    colors: { main: '#b9bec9', sub: '#3a6d8c', glow: '#8fd0ff' },
    parts: { head: 'helm', eyes: 'slit', shoulder: 'pad', arm: 'blade', body: 'armor', lower: 'legs', mark: 'cross' },
  },
  {
    id: 'blitz', name: 'ブリッツ', type: 'rush', cry: 'ドドドド',
    note: '手数で押し切る軽量機',
    stats: { power: 2, speed: 4, range: 2, stamina: 3, precision: 2 },
    colors: { main: '#c9a227', sub: '#22252f', glow: '#ffdc5e' },
    parts: { head: 'horn', eyes: 'slit', shoulder: 'bare', arm: 'fist', body: 'armor', lower: 'legs', mark: 'none' },
  },
  {
    id: 'ray', name: 'レイ', type: 'shot', cry: 'バシュ',
    note: '砲を積んだ遠距離型',
    stats: { power: 2, speed: 2, range: 4, stamina: 2, precision: 3 },
    colors: { main: '#3fae7d', sub: '#1f4d3d', glow: '#7dffc4' },
    parts: { head: 'visor', eyes: 'cross', shoulder: 'wing', arm: 'cannon', body: 'core', lower: 'legs', mark: 'circuit' },
  },
  {
    id: 'hound', name: 'ハウンド', type: 'auto', cry: 'ガブ',
    note: '命令しなくても勝手に噛みつく',
    stats: { power: 3, speed: 3, range: 3, stamina: 2, precision: 2 },
    colors: { main: '#8a6b4a', sub: '#2b2118', glow: '#ff9d4d' },
    parts: { head: 'skull', eyes: 'round', shoulder: 'spike', arm: 'claw', body: 'ribs', lower: 'legs', mark: 'stripe' },
  },
  {
    id: 'volcano', name: 'ボルケイノ', type: 'flame', cry: 'ゴォッ',
    note: '前を焼きはらい、相手を燃やす',
    stats: { power: 3, speed: 2, range: 3, stamina: 3, precision: 2 },
    colors: { main: '#d8574a', sub: '#b0552a', glow: '#ff9d4d' },
    parts: { head: 'horn', eyes: 'void', shoulder: 'spike', arm: 'claw', body: 'ribs', lower: 'mist', mark: 'stripe' },
  },
  {
    id: 'chain', name: 'クサリ', type: 'bind', cry: 'シャラ',
    note: '長い腕で薙ぎ、鎖で縛る',
    stats: { power: 3, speed: 3, range: 4, stamina: 2, precision: 1 },
    colors: { main: '#8a56c9', sub: '#4a3a6b', glow: '#c79bff' },
    parts: { head: 'hood', eyes: 'triple', shoulder: 'ring', arm: 'claw', body: 'coat', lower: 'mist', mark: 'dots' },
  },
  {
    id: 'aegis', name: 'イージス', type: 'mend', cry: 'コォン',
    note: '守りながら体力を戻して粘る',
    stats: { power: 2, speed: 2, range: 3, stamina: 4, precision: 2 },
    colors: { main: '#e8e3d6', sub: '#3a6d8c', glow: '#7dffc4' },
    parts: { head: 'crown', eyes: 'round', shoulder: 'ring', arm: 'slim', body: 'coat', lower: 'legs', mark: 'cross' },
  },
];

const PRESET_BY_ID = {};
PRESETS.forEach((k) => { PRESET_BY_ID[k.id] = k; });

function makePreset(id) { return presetChar(PRESET_BY_ID[id]); }
function makeMoot() { return makePreset('moot'); }
function makeWorld() { return makePreset('cat'); }

function makeBlankChar() {
  return {
    id: 'c-' + Date.now(),
    preset: null,
    name: '',
    cry: 'ドドドド',
    type: 'rush',
    level: 1,
    exp: 0,
    stats: { power: 1, speed: 1, range: 1, stamina: 1, precision: 1 },
    colors: { main: '#5a6bd8', sub: '#c3b48a', glow: '#8fd0ff' },
    parts: { head: 'horn', eyes: 'slit', shoulder: 'spike', arm: 'fist', body: 'armor', lower: 'tail', mark: 'stripe' },
    owner: 'ニャ太郎',
  };
}

/* ===================== 闘技場 ===================== */
const STAGES = {
  park:   { ja: '河川敷', floor: '#3c5240', line: '#4d6a52', accent: '#7fa06a',
            blocks: [{ x: 300, y: 250, r: 46 }, { x: 940, y: 530, r: 46 },
                     { x: 620, y: 390, w: 190, h: 34 }] },
  roof:   { ja: 'ビルの屋上', floor: '#3a3f4d', line: '#4a5162', accent: '#6f7a92',
            blocks: [{ x: 240, y: 190, w: 110, h: 90 }, { x: 1000, y: 190, w: 110, h: 90 },
                     { x: 240, y: 590, w: 110, h: 90 }, { x: 1000, y: 590, w: 110, h: 90 }] },
  mall:   { ja: '水没した地下街', floor: '#26404a', line: '#31525e', accent: '#4b8fa0',
            blocks: [{ x: 380, y: 250, r: 40 }, { x: 860, y: 250, r: 40 },
                     { x: 380, y: 530, r: 40 }, { x: 860, y: 530, r: 40 }] },
  church: { ja: '崩れた聖堂', floor: '#4a4239', line: '#5d5346', accent: '#a08c63',
            blocks: [{ x: 330, y: 200, r: 36 }, { x: 330, y: 580, r: 36 },
                     { x: 620, y: 390, w: 160, h: 160 },
                     { x: 910, y: 200, r: 36 }, { x: 910, y: 580, r: 36 }] },
  yard:   { ja: '廃車置き場', floor: '#42373a', line: '#544449', accent: '#8a6b5c',
            blocks: [{ x: 320, y: 300, w: 150, h: 70 }, { x: 900, y: 470, w: 150, h: 70 },
                     { x: 620, y: 180, w: 70, h: 130 }, { x: 620, y: 600, w: 70, h: 130 }] },
  kiln:   { ja: '製鉄所のあと', floor: '#4a3630', line: '#5c433a', accent: '#9c6a4a',
            blocks: [{ x: 420, y: 210, r: 48 }, { x: 820, y: 570, r: 48 },
                     { x: 620, y: 390, w: 120, h: 60 }] },
  dojo2:  { ja: '道場の庭', floor: '#3b4436', line: '#4a5544', accent: '#7d8a63',
            blocks: [{ x: 620, y: 250, r: 34 }, { x: 620, y: 530, r: 34 },
                     { x: 430, y: 390, w: 56, h: 150 }, { x: 810, y: 390, w: 56, h: 150 }] },
  tower:  { ja: '時計塔のてっぺん', floor: '#2e2b46', line: '#3d3960', accent: '#6f66a8',
            blocks: [{ x: 620, y: 390, r: 70 }, { x: 250, y: 200, r: 34 }, { x: 990, y: 580, r: 34 }] },
  bridge: { ja: '雪の橋', floor: '#4a5566', line: '#5a6779', accent: '#8fa0b5',
            blocks: [{ x: 620, y: 150, w: 260, h: 40 }, { x: 620, y: 630, w: 260, h: 40 },
                     { x: 450, y: 390, r: 34 }, { x: 790, y: 390, r: 34 }] },
  foundry:{ ja: '溶鉱炉のうえ', floor: '#3a2a26', line: '#4a3630', accent: '#c2603a',
            blocks: [{ x: 620, y: 250, r: 46 }, { x: 620, y: 530, r: 46 },
                     { x: 400, y: 170, w: 90, h: 90 }, { x: 840, y: 610, w: 90, h: 90 }] },
  garden: { ja: '白い庭', floor: '#4c5548', line: '#5c6657', accent: '#a8b394',
            blocks: [{ x: 480, y: 250, r: 30 }, { x: 760, y: 250, r: 30 },
                     { x: 480, y: 530, r: 30 }, { x: 760, y: 530, r: 30 },
                     { x: 620, y: 390, w: 40, h: 220 }] },
  platform:{ ja: '終電のホーム', floor: '#39404a', line: '#464e5a', accent: '#7d879a',
            blocks: [{ x: 620, y: 210, w: 420, h: 36 }, { x: 620, y: 570, w: 420, h: 36 },
                     { x: 620, y: 390, r: 30 }] },
  wreck:  { ja: '沈んだ船倉', floor: '#22343e', line: '#2c414d', accent: '#4d7f8c',
            blocks: [{ x: 520, y: 300, w: 160, h: 50 }, { x: 760, y: 480, w: 160, h: 50 },
                     { x: 620, y: 150, r: 34 }, { x: 620, y: 630, r: 34 }] },
  observ: { ja: '天文台のドーム', floor: '#2b2b40', line: '#383854', accent: '#7b76b0',
            blocks: [{ x: 620, y: 390, r: 90 }, { x: 430, y: 200, r: 26 }, { x: 810, y: 580, r: 26 }] },
  arena:  { ja: '石の闘技場', floor: '#57493a', line: '#6a5a48', accent: '#b39a72',
            blocks: [{ x: 620, y: 200, r: 34 }, { x: 620, y: 580, r: 34 },
                     { x: 450, y: 290, r: 26 }, { x: 790, y: 490, r: 26 },
                     { x: 450, y: 490, r: 26 }, { x: 790, y: 290, r: 26 }] },
  void:   { ja: '虚空', floor: '#191a2c', line: '#23243c', accent: '#5b5e9c',
            blocks: [{ x: 620, y: 390, r: 56 }, { x: 400, y: 230, r: 30 }, { x: 840, y: 550, r: 30 }] },
  dojo:   { ja: '練習場', floor: '#333a46', line: '#414a59', accent: '#5f6f86',
            blocks: [{ x: 620, y: 200, r: 38 }, { x: 620, y: 580, r: 38 }] },
};

/* ===================== 挑戦者 ===================== */
const FOES = [
  {
    id: 'f1', who: 'たま', name: 'ねこじゃらし', type: 'rush', level: 2, exp: 90, stage: 'park',
    tag: 'はじめの相手',
    stats: { power: 2, speed: 3, range: 2, stamina: 2, precision: 2 },
    colors: { main: '#d8a7c4', sub: '#5a3550', glow: '#ffdc5e' },
    parts: { head: 'hood', eyes: 'round', shoulder: 'bare', arm: 'slim', body: 'coat', lower: 'tail', mark: 'dots' },
    cry: 'タタタタ',
    lines: { in: 'わたしの幻影、けっこう手が速いよ。', win: 'ね、速さって強いでしょ。', lose: 'うわ、重い……重すぎ。' },
  },
  {
    id: 'f2', who: '大トラ', name: '鉄拳', type: 'moot', level: 3, exp: 120, stage: 'yard',
    tag: '殴り合いの相手',
    stats: { power: 4, speed: 2, range: 1, stamina: 3, precision: 2 },
    colors: { main: '#b9bec9', sub: '#7a2b2b', glow: '#ff9d4d' },
    parts: { head: 'helm', eyes: 'slit', shoulder: 'pad', arm: 'fist', body: 'armor', lower: 'legs', mark: 'stripe' },
    cry: 'ゴウン',
    lines: { in: '殴り合いだ。逃げても間合いは詰める。', win: '拳がぬるい。出直してこい。', lose: 'ぐ……その一撃、覚えたぞ。' },
  },
  {
    id: 'f3', who: 'シャム', name: '糸あやつり', type: 'bind', level: 4, exp: 150, stage: 'mall',
    tag: '動きを止めてくる',
    stats: { power: 3, speed: 3, range: 4, stamina: 2, precision: 3 },
    colors: { main: '#8fd0ff', sub: '#1f3a4d', glow: '#ffffff' },
    parts: { head: 'visor', eyes: 'triple', shoulder: 'ring', arm: 'claw', body: 'ribs', lower: 'mist', mark: 'circuit' },
    cry: 'シャラ',
    lines: { in: '止まってくれると、こちらは楽なんだけど。', win: '動けないと、なにもできないでしょう。', lose: '糸が……足りなかったか。' },
  },
  {
    id: 'f4', who: 'キジ丸', name: '遠雷', type: 'shot', level: 5, exp: 180, stage: 'roof',
    tag: '遠くから撃ってくる',
    stats: { power: 3, speed: 3, range: 5, stamina: 3, precision: 4 },
    colors: { main: '#c9a227', sub: '#22252f', glow: '#ffdc5e' },
    parts: { head: 'crown', eyes: 'cross', shoulder: 'wing', arm: 'cannon', body: 'core', lower: 'legs', mark: 'cross' },
    cry: 'バシュ',
    lines: { in: '近づけると思う？ 距離はこちらが決める。', win: '間合いを詰められないなら、勝ち目はないよ。', lose: '懐に入られた……そこが弱点か。' },
  },
  {
    id: 'f5', who: 'チャトラ', name: '陽炎', type: 'flame', level: 6, exp: 200, stage: 'kiln',
    tag: '燃やしてくる',
    stats: { power: 3, speed: 4, range: 3, stamina: 3, precision: 3 },
    colors: { main: '#d8574a', sub: '#b0552a', glow: '#ff9d4d' },
    parts: { head: 'horn', eyes: 'void', shoulder: 'spike', arm: 'claw', body: 'ribs', lower: 'mist', mark: 'stripe' },
    cry: 'ゴォッ',
    lines: { in: '一度ついた火は、離れても消えないよ。', win: '燃えたまま逃げても、おなじことでしょ。', lose: '火が……先に消えた。' },
  },
  {
    id: 'f6', who: 'ミケ', name: 'まもり手', type: 'mend', level: 6, exp: 210, stage: 'church',
    tag: '倒しても立ち上がる',
    stats: { power: 3, speed: 3, range: 3, stamina: 5, precision: 3 },
    colors: { main: '#e8e3d6', sub: '#4a3a6b', glow: '#7dffc4' },
    parts: { head: 'hood', eyes: 'void', shoulder: 'ring', arm: 'slim', body: 'coat', lower: 'mist', mark: 'none' },
    cry: 'コォン',
    lines: { in: '痛いのは苦手なので、治しながらいきます。', win: '削りきれませんでしたね。', lose: '治すより速く……壊されました。' },
  },
  {
    id: 'f7', who: 'ハチワレ', name: '白刃', type: 'blade', level: 7, exp: 240, stage: 'dojo2',
    tag: '一歩外から斬る',
    stats: { power: 4, speed: 4, range: 4, stamina: 3, precision: 4 },
    colors: { main: '#e8e3d6', sub: '#2f3a52', glow: '#8fd0ff' },
    parts: { head: 'visor', eyes: 'slit', shoulder: 'bare', arm: 'blade', body: 'armor', lower: 'legs', mark: 'none' },
    cry: 'シャッ',
    lines: { in: 'こちらの間合いに入った時点で、もう斬れている。', win: '一歩ぶん、届いていなかったね。', lose: '踏み込まれた。……見事。' },
  },
  {
    id: 'f8', who: '黒ブチ', name: '番猫', type: 'auto', level: 8, exp: 260, stage: 'yard',
    tag: '幻影が勝手に襲う',
    stats: { power: 4, speed: 4, range: 4, stamina: 4, precision: 3 },
    colors: { main: '#8a6b4a', sub: '#2b2118', glow: '#ff6f91' },
    parts: { head: 'skull', eyes: 'round', shoulder: 'spike', arm: 'claw', body: 'ribs', lower: 'legs', mark: 'stripe' },
    cry: 'ガブ',
    lines: { in: 'こいつは俺が命令しなくても噛みつくぞ。爪も牙も止まらん。', win: '番猫に勝てないやつが、なにを狙うって？', lose: 'よし……こいつを黙らせたか。' },
  },
  {
    id: 'f9', who: 'シロ', name: '万象', type: 'omni', level: 10, exp: 340, stage: 'tower',
    tag: 'ここからが本番',
    stats: { power: 5, speed: 5, range: 4, stamina: 5, precision: 5 },
    colors: { main: '#2f3a52', sub: '#c3b48a', glow: '#c79bff' },
    parts: { head: 'crown', eyes: 'triple', shoulder: 'wing', arm: 'blade', body: 'core', lower: 'mist', mark: 'circuit' },
    cry: 'ゴゴゴ',
    lines: { in: 'あなたの幻影は、あなたそのものだ。時も止めて見せてもらう。', win: 'まだ、あなたの形になっていない。', lose: 'いい形だ。それがあなたなんだね。' },
  },
  {
    id: 'f10', who: 'クロ', name: '黒羽', type: 'blade', level: 10, exp: 380, stage: 'bridge',
    tag: '強敵：一撃が飛ぶ',
    stats: { power: 5, speed: 4, range: 4, stamina: 4, precision: 4 },
    colors: { main: '#2f3a52', sub: '#22252f', glow: '#8fd0ff' },
    parts: { head: 'visor', eyes: 'slit', shoulder: 'wing', arm: 'blade', body: 'armor', lower: 'legs', mark: 'stripe' },
    cry: 'ザン',
    lines: { in: '橋の上は逃げ場がない。斬られる側に立つ覚悟はあるか。', win: '踏み込みが浅い。届いていないよ。', lose: '……その一歩は、たしかに速かった。' },
  },
  {
    id: 'f11', who: 'ヒノ', name: '熔鉄', type: 'flame', level: 10, exp: 400, stage: 'foundry',
    tag: '強敵：足もとが燃える',
    stats: { power: 5, speed: 4, range: 4, stamina: 5, precision: 3 },
    colors: { main: '#c2603a', sub: '#5a2318', glow: '#ffb347' },
    parts: { head: 'horn', eyes: 'void', shoulder: 'spike', arm: 'claw', body: 'ribs', lower: 'mist', mark: 'circuit' },
    cry: 'ゴォォ',
    lines: { in: 'ここは炉のうえだ。立っているだけで焦げるぞ。', win: '燃えつきたな。次は水でも被ってこい。', lose: '火が……お前のほうが熱かったか。' },
  },
  {
    id: 'f12', who: 'シオリ', name: '白亜', type: 'mend', level: 11, exp: 420, stage: 'garden',
    tag: '強敵：削りきれない',
    stats: { power: 4, speed: 4, range: 4, stamina: 5, precision: 5 },
    colors: { main: '#e8e3d6', sub: '#a8b394', glow: '#7dffc4' },
    parts: { head: 'crown', eyes: 'round', shoulder: 'ring', arm: 'slim', body: 'coat', lower: 'mist', mark: 'cross' },
    cry: 'シャン',
    lines: { in: 'この庭では、傷はぜんぶ元に戻るの。', win: '削るのが、少しだけ足りなかったわね。', lose: '戻すより速く壊されたのは、はじめて。' },
  },
  {
    id: 'f13', who: 'ハヤテ', name: '疾風', type: 'world', level: 11, exp: 450, stage: 'platform',
    tag: '強敵：時を止めてくる',
    stats: { power: 4, speed: 5, range: 3, stamina: 4, precision: 5 },
    colors: { main: '#7d879a', sub: '#22252f', glow: '#ffe98f' },
    parts: { head: 'helm', eyes: 'cross', shoulder: 'bare', arm: 'fist', body: 'armor', lower: 'legs', mark: 'none' },
    cry: 'ドドド',
    lines: { in: '終電まであと少し。……止めてしまえば、時間は無限だけどね。', win: '止まった世界では、きみは何もできない。', lose: 'この数秒を、よく耐えたな。' },
  },
  {
    id: 'f14', who: 'ヌマ', name: '深海', type: 'bind', level: 11, exp: 470, stage: 'wreck',
    tag: '強敵：縛って削る',
    stats: { power: 4, speed: 4, range: 5, stamina: 5, precision: 4 },
    colors: { main: '#4d7f8c', sub: '#14232b', glow: '#6effe9' },
    parts: { head: 'hood', eyes: 'triple', shoulder: 'ring', arm: 'claw', body: 'ribs', lower: 'mist', mark: 'dots' },
    cry: 'ズルリ',
    lines: { in: '沈んだ船のなかは、逃げる場所がないよ。', win: '巻きついたら、あとは待つだけだ。', lose: 'ほどかれた……あの一瞬で。' },
  },
  {
    id: 'f15', who: 'ルカ', name: '流星', type: 'shot', level: 11, exp: 500, stage: 'observ',
    tag: '強敵：三方向に撃ってくる',
    stats: { power: 4, speed: 4, range: 5, stamina: 3, precision: 4 },
    colors: { main: '#7b76b0', sub: '#2b2b40', glow: '#c79bff' },
    parts: { head: 'crown', eyes: 'triple', shoulder: 'wing', arm: 'cannon', body: 'core', lower: 'mist', mark: 'circuit' },
    cry: 'ヒュン',
    lines: { in: 'ドームの中なら、どこへ逃げても弾は届く。', win: '星は避けるものじゃなくて、当たるものなの。', lose: '懐まで来られたら、さすがに撃てないね。' },
  },
  {
    id: 'f16', who: 'ガリム', name: '牙王', type: 'auto', level: 12, exp: 530, stage: 'arena',
    tag: '強敵：勝手に噛みついてくる',
    stats: { power: 5, speed: 5, range: 4, stamina: 5, precision: 4 },
    colors: { main: '#b39a72', sub: '#3a2a1e', glow: '#ff6f91' },
    parts: { head: 'skull', eyes: 'void', shoulder: 'spike', arm: 'claw', body: 'ribs', lower: 'legs', mark: 'stripe' },
    cry: 'ガァッ',
    lines: { in: '観客はいない。骨だけが残る。', win: '牙は命令を待たない。だから速い。', lose: 'この闘技場で、はじめて負けた。' },
  },
  {
    id: 'f17', who: '終焉', name: '無限', type: 'omni', level: 13, exp: 600, stage: 'void',
    tag: '最後の挑戦者',
    stats: { power: 5, speed: 5, range: 5, stamina: 5, precision: 5 },
    colors: { main: '#191a2c', sub: '#5b5e9c', glow: '#ffffff' },
    parts: { head: 'crown', eyes: 'void', shoulder: 'wing', arm: 'blade', body: 'core', lower: 'mist', mark: 'circuit' },
    cry: 'ゴゴゴゴ',
    lines: { in: 'ここには床も空もない。あるのは、あなたと私の幻影だけ。', win: 'まだ形が足りない。もう一度、育ててからおいで。', lose: 'ひとつの形が、すべてに勝った。それでいい。' },
  },
];

/* ===================== ものがたり ===================== */
/* at は「倒した挑戦者の数」。その数になったときに出る。 */
const STORY = [
  {
    id: 's0', at: 0, title: 'プロローグ　路地の矢',
    lines: [
      'ニャ太郎は、駅裏の路地でくらすキジトラの猫だった。昼はシャッターの上で寝て、夜はゴミ捨て場のにおいをかいで歩く。それだけの毎日だった。',
      'ある晩、積み上がった箱の奥で、なにかが光った。近づいて前足でつついたとたん、するどい矢じりが肉球をかすめた。傷はすぐにふさがったのに、その夜は熱が下がらなかった。',
      '朝、水たまりをのぞきこんで、ニャ太郎は自分のうしろに立っているものに気づいた。ひとまわり大きな猫のかたちをした、金の目のなにか。呼びかけると、それは同じ動きで前足をふった。',
      'その日から街のようすが変わった。あちこちの猫が同じものを連れ、縄張り争いは幻影どうしの殴り合いになった。ニャ太郎の相棒には、いつのまにか名前がついていた。スタープラチニャ。',
    ],
  },
  {
    id: 's1', at: 3, title: '第二章　屋根づたいの噂',
    lines: [
      '三匹を退けたころには、路地のうわさはひとつにまとまっていた。矢は一本ではない。この街には何本も落ちている。',
      '屋根づたいに聞いてまわると、どの猫も同じ方角を見た。街のまんなかに立つ、動かなくなった時計塔。',
      '「あそこから黒いのが降りてきて、置いていったんだ」と、片耳のない三毛が言った。「拾ったやつから、順におかしくなった」',
      'ニャ太郎は塔のほうへ鼻先を向けた。うしろで、スタープラチニャが指の骨を鳴らした。',
    ],
  },
  {
    id: 's2', at: 6, title: '第三章　時計塔の主',
    lines: [
      '時計塔のてっぺんには、雪のように白い猫がすわっていた。名前をシロといい、この街のすべての幻影を上から眺めていた。',
      '「矢を配ったのは私だよ」とシロは言った。「でも作ったわけじゃない。私も拾っただけ」',
      '「もとの持ち主は、この街の外側にいる。床も空もないところに」',
      'シロの幻影「万象」は、四つの力を順ぐりに使った。時さえ止めてみせた。それでも最後に立っていたのは、ニャ太郎のほうだった。',
    ],
  },
  {
    id: 's3', at: 9, title: '第四章　矢に呼ばれた猫たち',
    lines: [
      '塔を越えてからの相手は、それまでとまるで違った。橋の上で刃を飛ばす黒猫、炉のうえで足もとを燃やす茶トラ、いくら削っても白く戻る庭の猫。',
      'どの猫も、矢を拾ったのではなかった。矢に呼ばれて、自分から出てきていた。',
      '「あなたも呼ばれた側でしょう」と、庭のシオリが言った。「ここまで来たなら、もうわかっているはず」',
      'ニャ太郎は答えなかった。ただ、うしろの幻影がこぶしを固めるのを、背中で感じていた。',
    ],
  },
  {
    id: 's4', at: 13, title: '第五章　虚空へ',
    lines: [
      '街のいちばん高いところ、天文台のドームの上に、行き止まりの道があった。その先には、なにもない。床も空もない、ただの暗がりが広がっている。',
      'そこに一匹だけ、黒い猫がすわっていた。矢のもとの持ち主。名前を「終焉」といった。',
      '「ここまで来た猫は久しぶりだ」と終焉は言った。「矢は、強くなりたいと思った者のところへ落ちる。おまえも、そう思ったから拾ったんだ」',
      'ニャ太郎は虚空に前足をおろした。踏むところなどないはずなのに、そこにはたしかに地面があった。',
    ],
  },
  {
    id: 's5', at: 17, title: 'おわり　路地へ帰る', ending: true,
    lines: [
      '終焉が倒れると、虚空はほどけて、朝の光が街に落ちてきた。',
      '矢は音もなく砕け、猫たちのうしろに立っていた幻影は、順に薄くなって消えていった。争いも、それといっしょに消えた。',
      'ニャ太郎が水たまりをのぞくと、そこにはまだ、金の目をした大きな猫が立っていた。消えないのか、と聞いても、幻影は肩をすくめるだけだった。',
      '二匹は駅裏の路地へ帰った。シャッターの上はいつもどおり温かく、その日もニャ太郎はよく眠った。うしろに、いつもの相棒を立たせたまま。',
    ],
  },
];

function storyAt(rank) { return STORY.find((s) => s.at === rank) || null; }
