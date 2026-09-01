/* =========================================================================
   MOKO GOD ― 星のきまり（地形・時代・いきもの・奇跡・ことば）
   ========================================================================= */
'use strict';

/* ------------------------------- 地形 ------------------------------- */
const T = {
  SEA: 0, SHALLOW: 1, SAND: 2, PLAIN: 3, GRASS: 4, FOREST: 5,
  HILL: 6, ROCK: 7, SNOW: 8, DESERT: 9, FIELD: 10, FLOWER: 11, MARSH: 12,
};

/* c1 = 地の色, c2 = 模様の色, walk = 歩ける, fer = 実りやすさ, build = 街をひらける */
const TILE_DEF = [
  { id: T.SEA,     name: '海',     c1: '#1c3f76', c2: '#2b5b9e', walk: false, fer: 0,    build: false },
  { id: T.SHALLOW, name: '浅瀬',   c1: '#3d7fb8', c2: '#5aa3d6', walk: false, fer: 0.2,  build: false },
  { id: T.SAND,    name: '砂浜',   c1: '#ddc98d', c2: '#eeddab', walk: true,  fer: 0.15, build: true },
  { id: T.PLAIN,   name: '草原',   c1: '#5d9950', c2: '#71ae5e', walk: true,  fer: 0.85, build: true },
  { id: T.GRASS,   name: '野原',   c1: '#6fa85a', c2: '#86c06c', walk: true,  fer: 1.0,  build: true },
  { id: T.FOREST,  name: '森',     c1: '#2f6b3c', c2: '#3f8a4a', walk: true,  fer: 0.6,  build: true },
  { id: T.HILL,    name: '丘',     c1: '#7c8a5a', c2: '#94a06c', walk: true,  fer: 0.4,  build: true },
  { id: T.ROCK,    name: '岩山',   c1: '#6b6b74', c2: '#8a8a95', walk: true,  fer: 0.05, build: false },
  { id: T.SNOW,    name: '雪原',   c1: '#d8e6f2', c2: '#f2f8ff', walk: true,  fer: 0.1,  build: true },
  { id: T.DESERT,  name: '砂漠',   c1: '#cfae6a', c2: '#e0c684', walk: true,  fer: 0.05, build: true },
  { id: T.FIELD,   name: '畑',     c1: '#8a6f3a', c2: '#a8894a', walk: true,  fer: 1.6,  build: true },
  { id: T.FLOWER,  name: '花畑',   c1: '#6fa85f', c2: '#8ac06c', walk: true,  fer: 1.2,  build: true },
  { id: T.MARSH,   name: '湿原',   c1: '#4a7a5a', c2: '#5f9670', walk: true,  fer: 0.7,  build: true },
];
const isLand = (t) => t >= T.SAND;
const isWater = (t) => t <= T.SHALLOW;

/* ------------------------------- 時代 -------------------------------
   街は人の数と知恵がたまると、つぎの時代へすすむ。            */
const ERAS = [
  {
    name: 'はじまりの時代', short: 'はじまり', pop: 0, tech: 0, house: 'nest',
    line: 'モコたちは草をあつめて、まるい巣をつくった。',
    tip: '火はまだない。実をひろって暮らしている。',
  },
  {
    name: '火の時代', short: '火', pop: 12, tech: 20, house: 'hut',
    line: 'まんなかで火が燃えはじめた。夜が、こわくなくなった。',
    tip: '夜も起きているモコがいる。',
  },
  {
    name: '実りの時代', short: '実り', pop: 30, tech: 60, house: 'farm',
    line: 'モコたちは土をたがやし、種をまくことをおぼえた。',
    tip: '畑ができると、食べものがぐんと増える。',
  },
  {
    name: '石の時代', short: '石', pop: 60, tech: 130, house: 'stone',
    line: '石を切り出して家を建て、あなたのための社をつくった。',
    tip: '社があると、信仰がたまりやすい。',
  },
  {
    name: '歯車の時代', short: '歯車', pop: 110, tech: 240, house: 'gear',
    line: '煙突から白い煙。モコたちは歯車をまわしはじめた。',
    tip: '知恵はすすむが、森がへっていく。',
  },
  {
    name: '星の時代', short: '星', pop: 190, tech: 400, house: 'spire',
    line: '塔のうえに光がともった。モコたちは空を見あげている。',
    tip: 'この星の子どもたちは、いつか星へ出ていく。',
  },
];

/* ---------------------------- いきもの ----------------------------
   god が「いのちを生む」で置ける。群れごとに世界地図の上を移動する。 */
const SPECIES = {
  pyonta: {
    name: 'ぴょんた', icon: '🐇', form: 'hop', c1: '#f2e3c8', c2: '#d8b98a',
    biome: [T.PLAIN, T.GRASS, T.FLOWER, T.FOREST], food: 1.4, danger: 0, cost: 20,
    desc: '草原をはねる小さないきもの。モコの食べものになる。',
  },
  kumohitsuji: {
    name: 'くも羊', icon: '🐑', form: 'wool', c1: '#f6f8ff', c2: '#cdd8ee',
    biome: [T.HILL, T.GRASS, T.SNOW, T.PLAIN], food: 0.8, danger: 0, tech: 0.6, cost: 34,
    desc: 'ふわふわの毛がとれる。モコの知恵をすこし進める。',
  },
  gulpa: {
    name: 'ガルパ', icon: '🦬', form: 'beast', c1: '#7f63c8', c2: '#d8c2ff',
    biome: [T.FOREST, T.MARSH, T.HILL], food: 2.2, danger: 0.4, cost: 48,
    desc: 'ひとつ目の大きな獣。ちからは強いが、なつけば運び手になる。',
  },
  tobiuo: {
    name: 'とび魚', icon: '🐟', form: 'fish', c1: '#7ec8ff', c2: '#cdefff',
    biome: [T.SHALLOW, T.SEA], food: 1.8, danger: 0, cost: 24,
    desc: '浅瀬をとびはねる魚。海べの街がよろこぶ。',
  },
  tsunomushi: {
    name: 'つのむし', icon: '🪲', form: 'bug', c1: '#6a4a8a', c2: '#b48ae0',
    biome: [T.FOREST, T.MARSH, T.DESERT], food: 0.3, danger: 1.2, cost: 12,
    desc: 'かたい角をもつ虫。畑をあらすこともある。',
  },
  kagemushi: {
    name: 'かげむし', icon: '🕷', form: 'shadow', c1: '#2a1a3a', c2: '#7a3fa8',
    biome: [T.FOREST, T.ROCK, T.MARSH, T.DESERT], food: 0, danger: 2.4, cost: 0, evil: true,
    desc: '城から流れてくる影。モコをこわがらせる。',
  },
};

/* ------------------------------- 奇跡 -------------------------------
   where: 'map' 世界地図の上から / 'ground' 地上で立っている場所に      */
const MIRACLES = [
  { id: 'land',   name: '土もり',     icon: '⛰', cost: 12, r: 2, desc: '海を陸にかえる。島や大地をひろげる。' },
  { id: 'sea',    name: '海引き',     icon: '🌊', cost: 10, r: 2, desc: '陸を海にかえす。やりすぎると街がしずむ。' },
  { id: 'forest', name: '森を生む',   icon: '🌳', cost: 8,  r: 2, desc: '草原を森にかえる。木は食べものと材木になる。' },
  { id: 'rain',   name: 'めぐみの雨', icon: '🌧', cost: 14, r: 6, desc: '土をうるおす。畑の実りがしばらく増える。' },
  { id: 'sun',    name: '陽だまり',   icon: '☀️', cost: 14, r: 6, desc: 'あたたかい光。モコたちの気もちが明るくなる。' },
  { id: 'life',   name: 'いのちを生む', icon: '🐾', cost: 20, r: 0, desc: 'えらんだいきものを、その場に生みだす。', pick: true },
  { id: 'town',   name: '街をひらく', icon: '🏠', cost: 60, r: 0, desc: 'あたらしいモコの街をひらく。陸のうえだけ。' },
  { id: 'bless',  name: 'みちびき',   icon: '🕊', cost: 25, r: 0, desc: '街に知恵をさずける。時代がすすみやすくなる。' },
  { id: 'light',  name: '奇跡の光',   icon: '💫', cost: 30, r: 5, desc: '影をはらう。わざわいを止め、城の力をけずる。' },
  { id: 'bolt',   name: 'いかずち',   icon: '⚡️', cost: 18, r: 1, desc: '雷を落とす。森も家も焼ける。モコはあなたをこわがる。' },
];

/* ------------------------- 街のできごと（わざわい） ------------------------- */
const DISASTERS = [
  { id: 'plague', name: '流行り病', icon: '🤒', text: '{town} で病がはやっている。', pop: -0.12, happy: -18 },
  { id: 'storm',  name: 'あらし',   icon: '🌀', text: '{town} を大あらしがおそった。', food: -0.35, happy: -12 },
  { id: 'famine', name: 'ききん',   icon: '🍂', text: '{town} の畑がかれてしまった。', food: -0.5, happy: -14 },
  { id: 'fear',   name: '影のささやき', icon: '👁', text: '{town} のモコが、黒い城の夢を見ている。', happy: -22, faith: -0.3 },
  { id: 'quarrel', name: 'いさかい', icon: '💢', text: '{town} で言いあらそいが起きた。', happy: -16, tech: -8 },
];

/* -------------------------------- 名まえ -------------------------------- */
const PLANET_NAMES = ['モコロ', 'ふわり', 'ぽこぽ', 'しろつき', 'あまつぶ', 'こもれび', 'ゆりかご', 'まるほし', 'ねむり', 'たまゆら', 'ひだまり', 'あおまる'];
const TOWN_NAMES = ['もこ村', 'ふわ丘', 'ぽこ浜', 'しろ谷', 'あま里', 'こもれ森', 'たま原', 'ゆら川', 'ねむ台', 'ひだま', 'まる岬', 'つゆ野', 'そら口', 'はな辻', 'みず端', 'ゆき窓'];
const MOKO_NAMES = ['モコ', 'ポコ', 'フワ', 'ムク', 'ミミ', 'ノノ', 'ララ', 'クル', 'テト', 'ソラ', 'コメ', 'ハネ', 'ぽち', 'まる', 'つぶ', 'もち'];
const GOD_DEFAULT = 'しろモコ';

/* モコが神さまに話しかけることば。時代ごとに変わる。 */
const MOKO_LINES = [
  ['……！（まっしろなモコを、じっと見あげている）', 'モコ？　モコ、モコ……', '（そっと草の実をさしだしてきた）'],
  ['あっ、火のむこうから来た！', 'よるがこわくないの、あなたのおかげ？', 'まっしろだ……ゆきみたい。'],
  ['神さま、ことしの実りはどうでしょう。', '畑にね、あめをふらせてくれてありがとう。', 'うちの子が、あなたの絵をかいたの。'],
  ['神さま、社を建てました。気に入るといいのですが。', '石の家はあたたかいですよ。とまっていきますか。', '本に、あなたのことを書きのこしています。'],
  ['歯車がまわると、なんでもつくれるんです。', '……最近、けむりで空が見えにくくて。すみません。', 'こんな時代でも、あなたを見あげる子はいます。'],
  ['神さま。わたしたち、星へ行ってみようと思います。', 'あなたが最初にもりあげた丘、まだ残っています。', 'いつか、また会えますか。'],
];

const CHILD_LINES = ['かみさま、ほんとにいたんだ！', 'わのところ、さわってもいい？', 'あのね、えほんで見たよ！', 'ふわふわだ〜'];

/* ------------------------------ 黒い城 ------------------------------ */
const DEMON = {
  name: 'クロモコ',
  title: 'モコの悪魔',
  lines: [
    'ようこそ。雲のはしっこへ。',
    'あの子たちは、おまえがいなくても生きるさ。',
    'いのっている顔と、こわがっている顔。よく似ているだろう？',
  ],
  defeat: 'ふふ……また、こわい夜がくれば、わたしはもどるよ。',
};

/* ------------------------------- えほん -------------------------------
   art はイラストの種類、who がしゃべる人、text が本文。               */
const BOOK_PAGES = [
  { art: 'room', who: 'ママモコ', text: 'さあ、ねるまえに一つだけね。……「雲の上のモコ」のおはなし。' },
  { art: 'room', who: 'こモコ', text: 'それしってる！　まっしろで、あたまに わっかが ういてるモコでしょ！' },
  { art: 'plate_god', who: '', text: 'むかし、むかし。この星に、まだ名前もなかったころ。雲の上には、まっしろなモコがすんでいました。' },
  { art: 'plate_land', who: '', text: 'まっしろなモコは、海に土をもりあげて、はじめての丘をつくりました。丘には草がはえ、草のあいだから、モコたちが生まれました。' },
  { art: 'plate_pray', who: '', text: 'モコたちは火をかこんで、雲の上のモコにお礼を言いました。それが、いちばんはじめの、おいのり。' },
  { art: 'plate_castle', who: '', text: 'けれど雲のはしっこには、黒い城がひとつ建っています。そこには、こわい夢をくばって歩く、わるいモコがすんでいるのです。' },
  { art: 'room', who: 'こモコ', text: 'ねえ、ママ。かみさまって、いまも いるの？' },
  { art: 'room', who: 'ママモコ', text: 'いるよ。いまも、ずっと、この星を見ていてくれる。……ほら、もう おやすみ。' },
  { art: 'wake', who: '', text: '――そして、あなたが目をさます。雲の上で。' },
];
