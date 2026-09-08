/* =========================================================================
   MOKO GOD ― 世界のきまり
   地形 / 魔物 / 武器・防具・道具 / 魔法 / 村 / ことば
   ========================================================================= */
'use strict';

/* ------------------------------- 地形 ------------------------------- */
const T = {
  SEA: 0, SHALLOW: 1, SAND: 2, PLAIN: 3, GRASS: 4, FOREST: 5,
  HILL: 6, ROCK: 7, SNOW: 8, DESERT: 9, ROAD: 10, FLOWER: 11, MARSH: 12, ASH: 13,
};

/* c1 = 地の色, c2 = 模様の色, walk = 歩ける, zone = 出る魔物の土地 */
const TILE_DEF = [
  { id: T.SEA,     name: '海',     c1: '#1c3f76', c2: '#2b5b9e', walk: false, zone: null },
  { id: T.SHALLOW, name: '浅瀬',   c1: '#3d7fb8', c2: '#5aa3d6', walk: false, zone: null },
  { id: T.SAND,    name: '砂浜',   c1: '#ddc98d', c2: '#eeddab', walk: true,  zone: 'field' },
  { id: T.PLAIN,   name: '草原',   c1: '#5d9950', c2: '#71ae5e', walk: true,  zone: 'field' },
  { id: T.GRASS,   name: '野原',   c1: '#6fa85a', c2: '#86c06c', walk: true,  zone: 'field' },
  { id: T.FOREST,  name: '森',     c1: '#2f6b3c', c2: '#3f8a4a', walk: true,  zone: 'forest' },
  { id: T.HILL,    name: '丘',     c1: '#7c8a5a', c2: '#94a06c', walk: true,  zone: 'field' },
  { id: T.ROCK,    name: '岩山',   c1: '#6b6b74', c2: '#8a8a95', walk: true,  zone: 'frost' },
  { id: T.SNOW,    name: '雪原',   c1: '#d8e6f2', c2: '#f2f8ff', walk: true,  zone: 'frost' },
  { id: T.DESERT,  name: '砂漠',   c1: '#cfae6a', c2: '#e0c684', walk: true,  zone: 'waste' },
  { id: T.ROAD,    name: '道',     c1: '#a8935f', c2: '#c0ab74', walk: true,  zone: null },
  { id: T.FLOWER,  name: '花畑',   c1: '#6fa85f', c2: '#8ac06c', walk: true,  zone: 'field' },
  { id: T.MARSH,   name: '湿原',   c1: '#4a7a5a', c2: '#5f9670', walk: true,  zone: 'forest' },
  { id: T.ASH,     name: '灰の地', c1: '#443a4e', c2: '#5c5068', walk: true,  zone: 'castle' },
];
const isWater = (t) => t <= T.SHALLOW;

/* 土地ごとの「強さ」。ここに出る魔物のおおよそのレベル。 */
const ZONE_DEF = {
  field:  { name: '草の地',   lv: 1,  color: '#8ac06c' },
  forest: { name: '深い森',   lv: 5,  color: '#3f8a4a' },
  waste:  { name: '灼けた砂', lv: 9,  color: '#e0c684' },
  frost:  { name: '凍る峰',   lv: 13, color: '#cfe6ff' },
  castle: { name: '灰の地',   lv: 18, color: '#a878d0' },
};

/* ------------------------------- 魔物 -------------------------------
   form が見た目の種類。hp/atk/def は「そのレベルでの基本値」。         */
const MONSTERS = {
  kagemoko: {
    name: 'かげモコ', form: 'shade', zone: 'field', lv: 1,
    hp: 22, atk: 6, def: 0, speed: 46, exp: 10, coin: 4,
    c1: '#3a2a4e', c2: '#6a4a8a', eye: '#ff5a7a',
    ai: 'chase', reach: 26, cool: 1.1,
  },
  tsunomushi: {
    name: 'つのむし', form: 'bug', zone: 'field', lv: 3,
    hp: 34, atk: 9, def: 2, speed: 62, exp: 18, coin: 6,
    c1: '#6a4a8a', c2: '#b48ae0', ai: 'charge', reach: 24, cool: 1.6,
  },
  kinoko: {
    name: 'あばれ茸', form: 'mush', zone: 'forest', lv: 5,
    hp: 58, atk: 12, def: 4, speed: 34, exp: 32, coin: 10,
    c1: '#c8546a', c2: '#f2e0c8', ai: 'burst', reach: 30, cool: 2.2,
    burst: { n: 6, speed: 130, dmg: 9, color: '#ff9ab4' },
  },
  moriookami: {
    name: '森オオカミ', form: 'wolf', zone: 'forest', lv: 7,
    hp: 74, atk: 16, def: 5, speed: 96, exp: 48, coin: 14,
    c1: '#5a6a52', c2: '#8fa07a', ai: 'charge', reach: 28, cool: 1.2,
  },
  sunasasori: {
    name: '砂サソリ', form: 'scorp', zone: 'waste', lv: 10,
    hp: 96, atk: 20, def: 8, speed: 70, exp: 72, coin: 22,
    c1: '#a8783a', c2: '#e0c07a', ai: 'shoot', reach: 210, cool: 1.6,
    shot: { speed: 200, dmg: 14, color: '#c8e06a', r: 5 },
  },
  honoseirei: {
    name: '炎の精', form: 'wisp', zone: 'waste', lv: 12,
    hp: 84, atk: 22, def: 4, speed: 84, exp: 88, coin: 26, fly: true, glow: '#ffb347',
    c1: '#ff8a3a', c2: '#ffe08a', ai: 'shoot', reach: 240, cool: 1.3,
    shot: { speed: 240, dmg: 17, color: '#ffb347', r: 6 },
  },
  ishigolem: {
    name: '岩ゴーレム', form: 'golem', zone: 'frost', lv: 14,
    hp: 190, atk: 28, def: 16, speed: 40, exp: 140, coin: 44,
    c1: '#6b6b74', c2: '#9aa0ac', ai: 'slam', reach: 40, cool: 2.4,
  },
  hyouga: {
    name: '氷牙獣', form: 'beast', zone: 'frost', lv: 16,
    hp: 150, atk: 32, def: 12, speed: 108, exp: 164, coin: 50,
    c1: '#8fb4d8', c2: '#e8f6ff', ai: 'charge', reach: 30, cool: 1.0,
  },
  honekishi: {
    name: '骨の騎士', form: 'knight', zone: 'castle', lv: 19,
    hp: 230, atk: 40, def: 20, speed: 78, exp: 240, coin: 70,
    c1: '#d8d2c0', c2: '#6a6070', ai: 'chase', reach: 40, cool: 1.0,
  },
  kagemadoushi: {
    name: '影の魔導士', form: 'mage', zone: 'castle', lv: 20,
    hp: 180, atk: 38, def: 12, speed: 62, exp: 270, coin: 88,
    c1: '#3a2a5e', c2: '#a878d0', ai: 'shoot', reach: 280, cool: 1.1,
    shot: { speed: 210, dmg: 26, color: '#c88aff', r: 7, home: 1.6 },
  },
};

/* ------------------------- 土地の主（中ボス） -------------------------
   倒すと「印」が手に入る。三つそろうと城の門がひらく。               */
const GUARDIANS = {
  mori: {
    key: 'mori', name: '森の主 ヨモギ', form: 'wolf', zone: 'forest', lv: 8,
    hp: 2400, atk: 30, def: 8, speed: 118, exp: 1200, coin: 220, scale: 1.9,
    ai: 'charge', reach: 44, cool: 1.1,
    c1: '#3f5a3a', c2: '#a8d08a', seal: 'seal_leaf',
    line: 'グルル……この森は、まだ影に渡さん。おまえの力を見せてみろ。',
    down: '……よかろう。葉の印を持っていけ。',
  },
  suna: {
    key: 'suna', name: '砂の王 ザラム', form: 'scorp', zone: 'waste', lv: 12,
    hp: 4200, atk: 42, def: 14, speed: 88, exp: 2600, coin: 340, scale: 2.0,
    ai: 'shoot', reach: 300, cool: 1.3,
    c1: '#8a5a2a', c2: '#f2d894', seal: 'seal_sun',
    line: 'ジャリ……砂の下で千年、影の来る日を待っていた。',
    down: 'ジャ……陽の印を、持っていけ。',
    shot: { speed: 230, dmg: 20, color: '#ffe08a', r: 7 },
  },
  koori: {
    key: 'koori', name: '氷の女王 シラユキ', form: 'mage', zone: 'frost', lv: 16,
    hp: 7000, atk: 56, def: 18, speed: 74, exp: 4500, coin: 520, scale: 2.0,
    ai: 'shoot', reach: 340, cool: 1.2,
    c1: '#5a7fa8', c2: '#e8f6ff', seal: 'seal_ice',
    line: 'ここから先は、こごえる道。それでも行くのですか。',
    down: '……行きなさい。氷の印を、あなたに。',
    shot: { speed: 200, dmg: 26, color: '#9fe8ff', r: 8, home: 1.2 },
  },
};

/* ------------------------------ 魔王 ------------------------------ */
const DEMON = {
  name: 'クロモコ',
  title: '神を名のる者',
  lv: 24, hp: 20000, atk: 78, def: 22, speed: 96, exp: 4000, coin: 2000, reach: 52, cool: 1.2,
  lines: [
    'よくここまで来たね。ちいさなモコ。',
    'この星に神なんていない。だからわたしが、そう名のることにした。',
    'こわがられるのは、いのられるのと、よく似ているんだよ。',
  ],
  defeat: 'ああ……こわい夜が、おわってしまう。',
};

/* ------------------------------ 武器 ------------------------------
   atk = 攻撃力, spd = ふり終わるまでの秒, range = とどく長さ, arc = 広さ */
const WEAPONS = [
  { id: 'w_stick',  name: 'きの棒',       icon: '🪵', atk: 5,  spd: 0.40, range: 34, arc: 1.5, price: 0,    desc: '村のはずれで拾った棒。ないよりまし。' },
  { id: 'w_bronze', name: 'どうの剣',     icon: '🗡', atk: 11, spd: 0.38, range: 40, arc: 1.6, price: 90,   desc: 'まっとうな剣。まずはこれから。' },
  { id: 'w_steel',  name: 'はがねの剣',   icon: '⚔️', atk: 22, spd: 0.36, range: 44, arc: 1.7, price: 320,  desc: 'よく研がれた刃。ひとふりが重い。' },
  { id: 'w_axe',    name: '大おの',       icon: '🪓', atk: 42, spd: 0.62, range: 48, arc: 2.5, price: 780,  desc: 'おそいが、まわりごと薙ぎはらう。' },
  { id: 'w_light',  name: '光のつるぎ',   icon: '✨', atk: 40, spd: 0.30, range: 46, arc: 1.8, price: 1400, desc: 'ふるたび光がはしる。速さが命。' },
  { id: 'w_star',   name: '星わりの剣',   icon: '🌟', atk: 68, spd: 0.34, range: 52, arc: 2.0, price: 3000, desc: '空から落ちた金属でできた剣。' },
];

/* ------------------------------ 防具 ------------------------------ */
const ARMORS = [
  { id: 'a_cloth', name: 'ぬのの服',       icon: '👕', def: 0,  spd: 1.00, price: 0,    desc: '村で着ていたふだん着。' },
  { id: 'a_leath', name: 'かわのよろい',   icon: '🥋', def: 4,  spd: 1.00, price: 80,   desc: 'かるくて丈夫。旅のはじめに。' },
  { id: 'a_chain', name: 'くさりかたびら', icon: '🛡', def: 10, spd: 0.97, price: 300,  desc: '刃をよくはじく。すこし重い。' },
  { id: 'a_steel', name: 'はがねのよろい', icon: '🏛', def: 19, spd: 0.92, price: 700,  desc: '堅いが、足が鈍る。' },
  { id: 'a_star',  name: '星のマント',     icon: '🧣', def: 26, spd: 1.08, price: 1800, desc: '軽いのに、よく守る。夜に淡く光る。' },
];

/* ------------------------------ お守り ------------------------------ */
const CHARMS = [
  { id: 'c_none',  name: '（なし）',       icon: '　', price: 0,    desc: '' },
  { id: 'c_life',  name: '元気のおまもり', icon: '💗', hp: 40,  price: 220, desc: '最大HPが 40 ふえる。' },
  { id: 'c_mana',  name: '知恵の指わ',     icon: '💍', mp: 40,  price: 240, desc: '最大MPが 40 ふえる。' },
  { id: 'c_wind',  name: '風のくつ',       icon: '👟', spd: 1.22, price: 380, desc: '足が 22% はやくなる。' },
  { id: 'c_scale', name: '竜のうろこ',     icon: '🐲', def: 12, price: 620, desc: '守りが 12 あがる。' },
  { id: 'c_fang',  name: '狼のきば',       icon: '🦷', atk: 14, price: 700, desc: '攻撃が 14 あがる。' },
];

/* ------------------------------ 道具 ------------------------------ */
const ITEMS = {
  herb:    { name: 'やくそう',     icon: '🌿', price: 20,  heal: 50,  desc: 'HPを 50 もどす。' },
  water:   { name: 'まほうの水',   icon: '🧪', price: 30,  mana: 40,  desc: 'MPを 40 もどす。' },
  elixir:  { name: 'エリクサー',   icon: '🍯', price: 160, heal: 999, mana: 999, desc: 'HPもMPも全部もどる。' },
  seal_leaf: { name: '葉の印', icon: '🍃', quest: true, desc: '森の主から受けとった印。' },
  seal_sun:  { name: '陽の印', icon: '🌞', quest: true, desc: '砂の王から受けとった印。' },
  seal_ice:  { name: '氷の印', icon: '❄️', quest: true, desc: '氷の女王から受けとった印。' },
};

/* ------------------------------ 魔法 ------------------------------ */
const SKILLS = [
  {
    id: 'fire', name: 'ファイア', icon: '🔥', lv: 1, mp: 6, cool: 0.45, kind: 'bolt',
    dmg: 18, speed: 300, r: 7, color: '#ff9a3a', desc: '火の玉をまっすぐ飛ばす。',
  },
  {
    id: 'heal', name: 'ヒール', icon: '💚', lv: 4, mp: 14, cool: 1.2, kind: 'heal',
    heal: 60, color: '#8ef0a8', desc: 'HPを 60 もどす。',
  },
  {
    id: 'bolt', name: 'サンダー', icon: '⚡️', lv: 7, mp: 18, cool: 1.4, kind: 'nova',
    dmg: 46, r: 130, color: '#ffe08a', desc: '自分のまわりに雷を落とす。',
  },
  {
    id: 'ice', name: 'アイスの矢', icon: '❄️', lv: 10, mp: 16, cool: 0.9, kind: 'spread',
    dmg: 26, speed: 340, n: 3, spread: 0.5, r: 6, color: '#9fe8ff', slow: 1.6,
    desc: '氷の矢を3本。あたると相手がおそくなる。',
  },
  {
    id: 'ward', name: 'まもりの光', icon: '🛡', lv: 13, mp: 24, cool: 6, kind: 'ward',
    time: 9, color: '#9fd8ff', desc: '9秒のあいだ、受けるダメージが半分になる。',
  },
  {
    id: 'holy', name: '聖なる爆発', icon: '💫', lv: 17, mp: 40, cool: 3, kind: 'nova',
    dmg: 160, r: 210, color: '#fff2c8', desc: 'まわり一面を光で薙ぎはらう。',
  },
];

/* --------------------------- レベルと成長 ---------------------------
   必要な経験値と、そのレベルでの素の能力。                             */
const LEVEL_MAX = 30;
const expToNext = (lv) => Math.round(24 * Math.pow(lv, 1.5) + 16 * lv);
const baseHp  = (lv) => 100 + (lv - 1) * 22;
const baseMp  = (lv) => 40 + (lv - 1) * 9;
const baseAtk = (lv) => 6 + (lv - 1) * 3.4;
const baseDef = (lv) => 2 + (lv - 1) * 1.5;

/* ------------------------------- 村 ------------------------------- */
const VILLAGE_NAMES = ['はじまりの村', 'こもれ村', 'すな辻', 'ゆき窓', 'みなと村'];

/* 村人の役どころ。job が店の種類。 */
const NPC_JOBS = {
  elder: { name: '村長', icon: '🕯', c1: '#e8dcc0', c2: '#b8a480' },
  smith: { name: '鍛冶屋', icon: '🔨', c1: '#f0b48a', c2: '#c07a4a', shop: 'gear' },
  shop:  { name: '道具屋', icon: '🧺', c1: '#a8d8f0', c2: '#6aa8d0', shop: 'item' },
  inn:   { name: '宿屋', icon: '🛏', c1: '#f0c8e0', c2: '#c08ab0', shop: 'inn' },
  sage:  { name: '物知り', icon: '📖', c1: '#c8c0f0', c2: '#8a80c8' },
};

const MOKO_NAMES = ['モコ', 'ポコ', 'フワ', 'ムク', 'ミミ', 'ノノ', 'ララ', 'クル', 'テト', 'ソラ', 'コメ', 'ハネ', 'ぽち', 'まる', 'つぶ', 'もち'];
const HERO_DEFAULT = 'モコ';

/* 村人のひとこと。印をいくつ持っているかで変わる。 */
const VILLAGE_LINES = [
  ['村の外には、影に染まったモコが出るようになったの。', 'こわいけど……あなたがいてくれるなら。', '道具屋さんで、やくそうを買っておくといいよ。'],
  ['森の主をたおしたって、ほんと？　すごい！', 'つぎは砂漠だって？　水を持っていきな。', 'あなたの話、子どもたちにしてるんだ。'],
  ['印がふたつ。あと ひとつだね。', '北の峰はさむいよ。よろいを厚くしていきな。', '……あなた、ずいぶん強くなったね。'],
  ['印が三つ。城の門が、ひらいたって聞いた。', 'いってらっしゃい。ここで待ってる。', 'ぶじに帰ってきてね。ぜったいだよ。'],
];

const ELDER_LINES = [
  ['星のはしに、黒い城が建った日から、魔物が湧くようになった。',
   '城の主はみずからを神と名のり、モコの夢に影をおくってくる。',
   '門は三つの印でしか開かぬ。森と、砂と、氷。その主たちが持っている。',
   'ゆけ。おまえの剣に、この村の明日がかかっている。'],
  ['葉の印か。よくやった。……つぎは砂の王だ。灼けた砂の底にいる。'],
  ['陽の印も。のこるは氷。北の峰の、いちばん高いところだ。'],
  ['三つそろったな。灰の地へゆけ。門はもう、おまえを拒まぬ。'],
];

const SAGE_LINES = [
  '魔法はレベルがあがると覚える。Q や数字キーで選べるよ。',
  'シフトでころがると、そのあいだは攻撃が当たらない。',
  '大きい相手は、攻撃のあとにすきができる。よく見るんだ。',
  'まもりの光を張ってから斬りこむ。これが基本さ。',
];
