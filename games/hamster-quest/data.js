/* =========================================================================
   ハムスターの冒険 ― データ
   アイテム / 装備 / つくりかた / 魔法 / 魔物 / 店 / 町の人 / 塔
   ========================================================================= */
'use strict';

const STACK = 20;          /* カバン 1 枠に入る数 */
const HERO_DEFAULT = 'ハム太';

/* ------------------------------ アイテム ------------------------------
   kind: mat = 材料, food = 食べもの (heal / mp) */
const ITEMS = {
  wood:     { name: '木', icon: '🪵', kind: 'mat', sell: 2, desc: '木をたたくと手に入る。剣・カバン・つり橋の材料。' },
  grass:    { name: '草', icon: '🌿', kind: 'mat', sell: 1, desc: '草むらをたたくと手に入る。ロープやカバンになる。' },
  stone:    { name: '石', icon: '🪨', kind: 'mat', sell: 3, desc: '岩をつるはしでたたくと手に入る。' },
  rope:     { name: 'ロープ', icon: '🪢', kind: 'mat', sell: 6, desc: '草をよりあわせたひも。カバンやつり橋に使う。' },
  silk:     { name: 'クモの糸', icon: '🕸️', kind: 'mat', sell: 5, desc: 'イモムシやクモが落とす。布になる。' },
  cloth:    { name: '布', icon: '🧶', kind: 'mat', sell: 10, desc: 'リュックや服の材料。よろず屋でも買える。' },
  shell:    { name: '虫のカラ', icon: '🪲', kind: 'mat', sell: 6, desc: 'カブトムシのかたいカラ。よろいになる。' },
  iron:     { name: '鉄', icon: '🔩', kind: 'mat', sell: 12, desc: '山の鉄の岩から取れる。じょうぶな道具になる。' },
  leather:  { name: '皮', icon: '🟫', kind: 'mat', sell: 12, desc: 'トカゲやヘビが落とす。冒険リュックの材料。' },
  fur:      { name: '毛皮', icon: '🧤', kind: 'mat', sell: 14, desc: 'イタチの毛皮。あたたかいコートになる。' },
  feather:  { name: '羽', icon: '🪶', kind: 'mat', sell: 10, desc: '鳥やコウモリが落とす。' },
  crystal:  { name: '水晶', icon: '💎', kind: 'mat', sell: 25, desc: '鉄のつるはしで掘れる、すきとおった石。' },
  snowflower: { name: 'ゆきの花', icon: '💮', kind: 'mat', sell: 15, desc: '雪の中にさく白い花。' },
  ice:      { name: 'こおりの結晶', icon: '❄️', kind: 'mat', sell: 20, desc: 'ゆきオバケが落とす。とけない氷。' },
  moon:     { name: '月のかけら', icon: '🌙', kind: 'mat', sell: 40, desc: '月の野原で手に入る、ほんのり光る石。' },
  dust:     { name: 'まほうの粉', icon: '✨', kind: 'mat', sell: 30, desc: 'ネコまどうしが落とす、きらきらの粉。' },
  goldseed: { name: '金のタネ', icon: '🌟', kind: 'mat', sell: 60, desc: 'とてもめずらしい金色のタネ。' },
  seed:     { name: 'ひまわりのタネ', icon: '🌻', kind: 'food', heal: 8, sell: 2, desc: 'ハムスターの大好物。HP を 8 回復。' },
  acorn:    { name: 'どんぐり', icon: '🌰', kind: 'food', heal: 14, sell: 4, desc: 'たまに木から落ちる。HP を 14 回復。' },
  honey:    { name: 'はちみつ', icon: '🍯', kind: 'food', heal: 28, sell: 8, desc: 'ハチが落とす。HP を 28 回復。' },
  mushroom: { name: 'きのこ', icon: '🍄', kind: 'food', heal: 16, sell: 8, desc: '谷に生えている。HP を 16 回復。' },
  dango:    { name: 'タネだんご', icon: '🍡', kind: 'food', heal: 36, sell: 9, desc: 'タネを丸めただんご。HP を 36 回復。' },
  soup:     { name: 'きのこスープ', icon: '🍲', kind: 'food', heal: 70, sell: 22, desc: 'あったかいスープ。HP を 70 回復。' },
  potion:   { name: 'くすり', icon: '🧪', kind: 'food', heal: 55, sell: 15, desc: 'よく効くくすり。HP を 55 回復。' },
  plank:    { name: '板', icon: '🪧', kind: 'mat', sell: 6, desc: '製材機で木を切った板。ベッドや床、木箱の材料。売ると木より高い。' },
  honeydew: { name: 'あまつゆ', icon: '🫧', kind: 'food', heal: 12, sell: 4, desc: 'アブラムシからもらえる、あまいしずく。HP を 12 回復。' },
  ether:    { name: 'まほうの水', icon: '💧', kind: 'food', mp: 20, sell: 18, desc: 'MP を 20 回復。' },
};

/* -------------------------------- 装備 --------------------------------
   slot: weapon / staff / body / hat / bag / tool
   weapon.kind: paw (すで) / sword / spear / hammer */
const GEAR = {
  paw:      { slot: 'weapon', name: 'すで', icon: '🐾', atk: 2, kind: 'paw' },
  stick:    { slot: 'weapon', name: '木の棒', icon: '🦯', atk: 3, kind: 'sword', col: '#9a6a3a', stick: true, sell: 1 },
  wsword:   { slot: 'weapon', name: '木の剣', icon: '🗡️', atk: 4, kind: 'sword', col: '#c08a52', sell: 8 },
  ssword:   { slot: 'weapon', name: '石の剣', icon: '🗡️', atk: 7, kind: 'sword', col: '#a3a8ae', sell: 20 },
  cspear:   { slot: 'weapon', name: '銅のやり', icon: '🔱', atk: 9, kind: 'spear', col: '#d0864a', price: 150, sell: 60 },
  isword:   { slot: 'weapon', name: '鉄の剣', icon: '⚔️', atk: 13, kind: 'sword', col: '#d8dde4', price: 380, sell: 120 },
  hammer:   { slot: 'weapon', name: '岩くだきハンマー', icon: '🔨', atk: 17, kind: 'hammer', col: '#8a8f99', price: 560, sell: 200, mine: 2 },
  csword:   { slot: 'weapon', name: '水晶の剣', icon: '🗡️', atk: 21, kind: 'sword', col: '#9fe8ff', sell: 260 },
  ksword:   { slot: 'weapon', name: '騎士の剣', icon: '⚔️', atk: 26, kind: 'sword', col: '#f0f4ff', price: 1500, sell: 500 },
  sunblade: { slot: 'weapon', name: 'ひまわりの聖剣', icon: '🌞', atk: 36, kind: 'sword', col: '#ffd84a', sell: 1200 },

  wstaff:   { slot: 'staff', name: '木の杖', icon: '🪄', mag: 5, mp: 5, col: '#a8743f', gem: '#7fe0ff', price: 100, sell: 40 },
  cstaff:   { slot: 'staff', name: '水晶の杖', icon: '🪄', mag: 10, mp: 12, col: '#c9d6e6', gem: '#b6f2ff', price: 680, sell: 240 },
  mstaff:   { slot: 'staff', name: '月の杖', icon: '🪄', mag: 17, mp: 22, col: '#6a5aa8', gem: '#ffe680', sell: 600 },

  leafsuit: { slot: 'body', name: '葉っぱの服', icon: '🍃', def: 1, col: '#6fbf4a', sell: 5 },
  shirtB:   { slot: 'body', name: '青い服', icon: '👕', def: 2, col: '#4f8fe0', price: 60, sell: 20 },
  shirtR:   { slot: 'body', name: '赤い服', icon: '👕', def: 2, col: '#e0544f', price: 60, sell: 20 },
  shirtY:   { slot: 'body', name: '黄色い服', icon: '👕', def: 2, col: '#f2c83a', price: 60, sell: 20 },
  beetle:   { slot: 'body', name: 'カブトのよろい', icon: '🪲', def: 5, col: '#6a3f2a', armor: true, sell: 40 },
  coat:     { slot: 'body', name: 'けがわのコート', icon: '🧥', def: 4, warm: true, col: '#b98a5c', trim: '#f4ecdd', price: 220, sell: 80 },
  robe:     { slot: 'body', name: '魔法使いのローブ', icon: '🥻', def: 4, mag: 3, mp: 10, col: '#6a4ac8', trim: '#ffd86a', price: 480, sell: 160 },
  knight:   { slot: 'body', name: '騎士のよろい', icon: '🛡️', def: 9, col: '#b8c0cc', armor: true, price: 950, sell: 320 },
  royal:    { slot: 'body', name: '王さまのマント', icon: '👑', def: 13, warm: true, mag: 3, col: '#c8364a', trim: '#ffe28a', sell: 700 },

  straw:    { slot: 'hat', name: 'むぎわらぼうし', icon: '👒', def: 0, price: 30, sell: 10 },
  ribbon:   { slot: 'hat', name: 'リボン', icon: '🎀', def: 0, price: 30, sell: 10 },
  acornhat: { slot: 'hat', name: 'どんぐりぼうし', icon: '🌰', def: 1, sell: 10 },
  knitcap:  { slot: 'hat', name: '毛糸のぼうし', icon: '🧢', def: 1, price: 80, sell: 25 },
  wizhat:   { slot: 'hat', name: 'とんがりぼうし', icon: '🎩', def: 0, mag: 2, mp: 8, price: 220, sell: 70 },
  helmet:   { slot: 'hat', name: '鉄のかぶと', icon: '⛑️', def: 3, price: 320, sell: 100 },
  crown:    { slot: 'hat', name: '王冠', icon: '👑', def: 4, mag: 4, mp: 10, sell: 999 },

  cheek:    { slot: 'bag', name: 'ほおぶくろ', icon: '🐹', slots: 4 },
  leafbag:  { slot: 'bag', name: '葉っぱのカバン', icon: '🍃', slots: 8, col: '#5fae3e' },
  clothbag: { slot: 'bag', name: '布のリュック', icon: '🎒', slots: 14, col: '#d8b98a', price: 180 },
  advbag:   { slot: 'bag', name: '冒険リュック', icon: '🎒', slots: 22, col: '#8a5a32', price: 750 },
  magicbag: { slot: 'bag', name: 'まほうのカバン', icon: '👜', slots: 32, col: '#7a4ad0' },

  pick:     { slot: 'tool', name: '木のつるはし', icon: '⛏️', mine: 1, col: '#c08a52', price: 50 },
  ipick:    { slot: 'tool', name: '鉄のつるはし', icon: '⛏️', mine: 2, col: '#d8dde4', price: 300 },
};
const SLOT_NAMES = { weapon: '武器', staff: '杖', body: '服', hat: 'ぼうし', bag: 'カバン', tool: 'どうぐ' };

/* ------------------------------ つくりかた ------------------------------ */
const RECIPES = [
  { out: 'wsword', need: { wood: 5 } },
  { out: 'leafbag', need: { grass: 8, wood: 2 } },
  { out: 'pick', need: { wood: 4, grass: 3 } },
  { out: 'rope', n: 1, need: { grass: 3 } },
  { out: 'dango', n: 1, need: { seed: 3 } },
  { out: 'leafsuit', need: { grass: 6, rope: 1 } },
  { out: 'acornhat', need: { acorn: 4 } },
  { out: 'ssword', need: { stone: 4, wood: 2 } },
  { out: 'cloth', n: 1, need: { silk: 3 } },
  { out: 'beetle', need: { shell: 6, rope: 2 } },
  { out: 'clothbag', need: { cloth: 3, rope: 2 } },
  { out: 'isword', need: { iron: 5, wood: 2 } },
  { out: 'ipick', need: { iron: 4, wood: 2 } },
  { out: 'coat', need: { fur: 4, cloth: 2 } },
  { out: 'soup', n: 1, need: { mushroom: 2, seed: 2 } },
  { out: 'advbag', need: { leather: 4, cloth: 3, rope: 2 } },
  { out: 'cstaff', need: { crystal: 3, wood: 4 } },
  { out: 'csword', need: { crystal: 4, iron: 3 } },
  { out: 'royal', need: { cloth: 6, fur: 4, goldseed: 2 } },
  { out: 'sunblade', need: { goldseed: 3, crystal: 5, moon: 4 } },
];

/* -------------------------------- 魔法 -------------------------------- */
const SPELLS = {
  bolt:  { name: 'まほうだま', icon: '🔮', mp: 1, book: null, desc: '杖があれば使える。まっすぐ飛ぶ魔法のたま。' },
  fire:  { name: 'ファイア', icon: '🔥', mp: 3, book: 'fire', desc: 'ほのおのたま。当たると爆発し、いばらも燃やす。' },
  wind:  { name: 'かぜ', icon: '🌪️', mp: 4, book: 'wind', desc: 'たつまきを飛ばし、まわりの魔物をふき飛ばす。' },
  heal:  { name: 'いやし', icon: '💚', mp: 6, book: 'heal', desc: 'HP を大きく回復する。' },
  star:  { name: 'ほしふる', icon: '🌠', mp: 10, book: 'star', desc: '画面中の魔物に星をふらせる。' },
};
const SPELL_ORDER = ['bolt', 'fire', 'wind', 'heal', 'star'];

const BOOKS = {
  fire: { name: 'ほのおの本', icon: '📕', desc: 'ファイアの魔法がつかえるようになる。' },
  wind: { name: 'かぜの本', icon: '📗', desc: 'かぜの魔法がつかえるようになる。' },
  heal: { name: 'いやしの本', icon: '📘', desc: 'いやしの魔法がつかえるようになる。', price: 400 },
  star: { name: '星の魔法の本', icon: '📙', desc: 'ハムスターの町の宝。ほしふるの魔法がつかえる。' },
};

/* -------------------------------- 魔物 --------------------------------
   ai: walker (まっすぐ来る) / charger (ため→とっしん) / flyer (空をとぶ) / shooter (はなれて撃つ) */
const MOBS = {
  ant:      { name: 'アリ', hp: 6, atk: 2, spd: 55, exp: 2, coin: [0, 2], r: 9, ai: 'walker', drops: [['seed', 0.35]] },
  worm:     { name: 'イモムシ', hp: 9, atk: 2, spd: 26, exp: 3, coin: [0, 2], r: 10, ai: 'walker', drops: [['silk', 0.55]] },
  beetle:   { name: 'カブトムシ', hp: 24, atk: 4, spd: 42, exp: 7, coin: [1, 4], r: 12, ai: 'charger', drops: [['shell', 0.7]] },
  bee:      { name: 'ハチ', hp: 10, atk: 3, spd: 88, exp: 4, coin: [0, 3], r: 8, ai: 'flyer', drops: [['honey', 0.35]] },
  spider:   { name: 'クモ', hp: 20, atk: 4, spd: 48, exp: 6, coin: [1, 3], r: 11, ai: 'shooter', shot: 'web', drops: [['silk', 0.7]] },
  centi:    { name: 'ムカデ', hp: 32, atk: 5, spd: 68, exp: 9, coin: [1, 4], r: 11, ai: 'walker', drops: [['shell', 0.5]] },
  lizard:   { name: 'トカゲ', hp: 34, atk: 6, spd: 66, exp: 10, coin: [2, 5], r: 11, ai: 'charger', drops: [['leather', 0.5]] },
  weasel:   { name: 'イタチ', hp: 48, atk: 8, spd: 80, exp: 16, coin: [3, 7], r: 12, ai: 'charger', drops: [['fur', 0.6]] },
  crow:     { name: 'カラス', hp: 30, atk: 6, spd: 105, exp: 12, coin: [2, 6], r: 11, ai: 'flyer', drops: [['feather', 0.7]] },
  yeti:     { name: 'ゆきオバケ', hp: 42, atk: 7, spd: 36, exp: 14, coin: [3, 6], r: 13, ai: 'shooter', shot: 'snow', drops: [['ice', 0.45]] },
  snake:    { name: 'ヘビ', hp: 62, atk: 11, spd: 58, exp: 22, coin: [4, 9], r: 16, ai: 'charger', drops: [['leather', 0.6]] },
  bat:      { name: 'コウモリ', hp: 36, atk: 9, spd: 118, exp: 16, coin: [3, 7], r: 10, ai: 'flyer', drops: [['feather', 0.4]] },
  shroom:   { name: 'キノコおばけ', hp: 54, atk: 9, spd: 32, exp: 20, coin: [4, 8], r: 13, ai: 'shooter', shot: 'spore', drops: [['mushroom', 0.7]] },
  catsol:   { name: 'ネコ兵', hp: 95, atk: 14, spd: 66, exp: 34, coin: [6, 12], r: 13, ai: 'walker', drops: [['moon', 0.3]] },
  catmage:  { name: 'ネコまどうし', hp: 72, atk: 13, spd: 46, exp: 34, coin: [6, 12], r: 12, ai: 'shooter', shot: 'dark', drops: [['dust', 0.4]] },
  owl:      { name: 'フクロウ', hp: 85, atk: 15, spd: 105, exp: 36, coin: [6, 12], r: 13, ai: 'flyer', drops: [['feather', 0.6]] },
  /* 町をおそう大きな魔物。騎士だけではたおしきれない */
  boar:     { name: '大イノシシ', hp: 200, atk: 7, spd: 46, exp: 40, coin: [40, 60], r: 24, ai: 'raider', heavy: true, drops: [['leather', 1], ['acorn', 1]] },
  troll:    { name: '森のトロル', hp: 480, atk: 12, spd: 40, exp: 110, coin: [90, 130], r: 26, ai: 'raider', heavy: true, drops: [['fur', 1], ['iron', 1]] },
  golem:    { name: '岩のゴーレム', hp: 1000, atk: 18, spd: 34, exp: 260, coin: [180, 240], r: 28, ai: 'raider', heavy: true, drops: [['crystal', 1], ['goldseed', 0.5]] },
  catknight:{ name: 'ネコ騎士', hp: 150, atk: 17, spd: 58, exp: 50, coin: [10, 18], r: 14, ai: 'charger', drops: [['moon', 0.5]] },
};

const BOSSES = {
  queen:   { name: 'クモの女王アラクネ', hp: 650, atk: 6, r: 30, exp: 90, coin: 150, book: 'fire' },
  eagle:   { name: 'あらしの大ワシ', hp: 1500, atk: 10, r: 32, exp: 260, coin: 400, book: 'wind' },
  catking: { name: 'ノラネコ大王', hp: 3600, atk: 17, r: 38, exp: 800, coin: 1000, book: 'star' },
};

/* ------------------------------- 地方 ------------------------------- */
const REGIONS = {
  forest:   { name: 'ひまわりの森', music: 'forest', spawn: [['ant', 4]] },
  deepwood: { name: 'ふかい森', music: 'forest', spawn: [['ant', 2], ['beetle', 3], ['centi', 2]] },
  lake:     { name: 'かがみ湖', music: 'forest', spawn: [['ant', 2]] },
  town:     { name: 'ほおぶくろタウン', music: 'town', spawn: [], safe: true },
  outskirt: { name: '町はずれ', music: 'town', spawn: [['ant', 2]] },
  mountain: { name: 'ゴツゴツ山', music: 'mountain', spawn: [['lizard', 3], ['crow', 2], ['weasel', 2]] },
  snow:     { name: 'ゆきの山頂', music: 'snow', spawn: [['yeti', 3], ['weasel', 2], ['crow', 1]], cold: true },
  valley:   { name: 'きりの谷', music: 'valley', spawn: [['snake', 3], ['bat', 3], ['shroom', 3]] },
  moon:     { name: '月の野原', music: 'moon', spawn: [['catsol', 3], ['catmage', 2], ['owl', 2]] },
  kingdom:  { name: '湖の王国 ミナモ', music: 'town', spawn: [], safe: true },
};

/* -------------------------------- 塔 -------------------------------- */
const TOWERS = {
  forest: {
    name: '森の塔', floors: 3, boss: 'queen', music: 'tower',
    mobs: [['spider', 3], ['centi', 2], ['beetle', 1]], base: 4,
    pal: { floor: '#8a7a5c', floor2: '#7d6d52', wall: '#4d5e3a', wallTop: '#6a7d4c', accent: '#9bd36a' },
    chests: { 2: { coins: 80, items: [['potion', 2], ['rope', 3]] } },
  },
  wind: {
    name: '風の塔', floors: 4, boss: 'eagle', music: 'tower',
    mobs: [['crow', 2], ['bat', 2], ['weasel', 2], ['yeti', 1]], base: 5,
    pal: { floor: '#8c96a6', floor2: '#7e8898', wall: '#4a5468', wallTop: '#68748c', accent: '#bfe8ff' },
    chests: { 2: { gear: 'magicbag' }, 3: { gear: 'helmet', items: [['ether', 2]] } },
  },
  moon: {
    name: '月の塔', floors: 5, boss: 'catking', music: 'tower',
    mobs: [['catsol', 3], ['catmage', 2], ['catknight', 1], ['owl', 1]], base: 5,
    pal: { floor: '#4a4266', floor2: '#423a5c', wall: '#262040', wallTop: '#3c3462', accent: '#ffe680' },
    chests: { 2: { gear: 'mstaff' }, 4: { coins: 400, items: [['goldseed', 2], ['potion', 3]] } },
  },
};

/* -------------------------------- 店 -------------------------------- */
const SHOPS = {
  general: {
    name: 'よろず屋 カリカリ商店', owner: 'カリカリさん', fur: '#f0d8b0',
    hello: 'いらっしゃい！ 森で集めた物は、なんでも買い取るよ。',
    stock: [['item', 'rope', 15], ['item', 'cloth', 28], ['item', 'iron', 36], ['item', 'dango', 24], ['item', 'potion', 45], ['item', 'ether', 50], ['gear', 'pick', 50]],
  },
  weapon: {
    name: 'チューチュー武器店', owner: 'ガンジさん', fur: '#8a7a6a',
    hello: 'おう、強くなりたいなら、いい武器をもつことだ。',
    stock: [['gear', 'cspear', 150], ['gear', 'isword', 380], ['gear', 'hammer', 560, 'fire'], ['gear', 'ksword', 1500, 'wind'], ['gear', 'ipick', 300]],
  },
  clothes: {
    name: 'ふわふわ洋服店', owner: 'リリさん', fur: '#fff4ea',
    hello: 'まあ、かわいいお客さん！ ゆっくり見ていってね。',
    stock: [['gear', 'shirtB', 60], ['gear', 'shirtR', 60], ['gear', 'shirtY', 60], ['gear', 'straw', 30], ['gear', 'ribbon', 30],
      ['gear', 'knitcap', 80], ['gear', 'coat', 220], ['gear', 'clothbag', 180], ['gear', 'helmet', 320, 'fire'],
      ['gear', 'robe', 480, 'fire'], ['gear', 'advbag', 750, 'fire'], ['gear', 'knight', 950, 'wind']],
  },
  magic: {
    name: 'ほしよみ魔法店', owner: 'ほしよみおばば', fur: '#d8d0e8',
    hello: 'ひっひっ。魔法の杖がほしいのかい？',
    stock: [['gear', 'wstaff', 100], ['item', 'ether', 50], ['book', 'heal', 400], ['gear', 'wizhat', 220], ['gear', 'cstaff', 680, 'fire']],
  },
  hut: {
    name: '山小屋の売店', owner: 'ヤマじい', fur: '#b0a090',
    hello: '寒かったろう。ここで休んでいきなさい。',
    stock: [['item', 'potion', 50], ['item', 'ether', 55], ['item', 'rope', 18], ['gear', 'coat', 240], ['gear', 'ipick', 320]],
  },
  royal: {
    name: 'ミナモ王国 武具店', owner: '騎士団長 ガルド', fur: '#c8c0b0',
    hello: '王国の騎士団と おなじ武具を あつかっておる。',
    stock: [['gear', 'knight', 900, 'wind'], ['gear', 'ksword', 1400, 'wind'], ['gear', 'helmet', 300, 'fire'], ['gear', 'cspear', 140], ['item', 'potion', 40], ['item', 'ether', 45]],
  },
  camp: {
    name: '谷の行商人', owner: 'たびのクルミ', fur: '#c4a07a',
    hello: 'やあ、こんな谷までよく来たね。なんでも買い取るよ。',
    stock: [['item', 'potion', 50], ['item', 'ether', 55], ['item', 'rope', 18], ['item', 'cloth', 30], ['item', 'soup', 60], ['gear', 'ipick', 320]],
  },
};

/* ------------------------------ 町の頼みごと ------------------------------ */
const REQUESTS = {
  bread:  { who: 'パン屋のモモ', need: { seed: 10 }, coins: 60, items: [['dango', 3]],
    ask: 'ひまわりのタネを 10こ もってきてくれない？ おいしいパンを焼きたいの！',
    thanks: 'わあ、ありがとう！ お礼にタネだんごをどうぞ！' },
  wood:   { who: '大工のガンタ', need: { wood: 20 }, coins: 140,
    ask: '家を直したいんだが、木が 20本 たりないんだ。森で集めてきてくれないか？',
    thanks: '助かった！ これで屋根が直せるぞ。' },
  silk:   { who: '仕立て屋のチヨ', need: { silk: 5 }, coins: 50, gear: 'ribbon',
    ask: 'クモの糸を 5こ ほしいの。イモムシやクモが落とすのよ。',
    thanks: 'すてきな糸！ お礼にリボンをあげるわ。' },
  crystal:{ who: '学者のハカセ', need: { crystal: 3 }, coins: 300, items: [['ether', 3]],
    ask: '水晶を 3こ しらべたいのじゃ。鉄のつるはしなら掘れるはずじゃよ。',
    thanks: 'おお、これはりっぱな水晶じゃ！ お礼をうけとってくれ。' },
  honey:  { who: '湖のつりびとサバ', need: { honey: 3 }, coins: 40, items: [['goldseed', 1]],
    ask: 'はちみつが 3こ ほしいなあ。ハチをやっつけると落とすよ。',
    thanks: 'ありがとう！ 湖でひろった、きらきらのタネをあげよう。' },
};

/* -------------------------------- 会話 -------------------------------- */
const ELDER = {
  name: '長老ハムじい',
  tips: [
    '水車は 水べにしか建てられん。まわる力を 軸やベルトで 機械まで とどけるのじゃ。',
    '水車ひとつで 機械4つぶんの力じゃ。たりなければ 水車をふやして つなげばよい。',
    'ベルトコンベアの上に もちものを すてると、ベルトが はこんでくれる。',
    '製材機で つくった板は、木より 高く売れるぞ。',
    '木箱の前に ベルトをおくと、中身を ひとつずつ ベルトへ だしてくれる。',
    '塔のボスは 何度でも あらわれる。強くなったら 腕だめしに 行ってみなさい。',
    'ウサギやヤモリと なかよくなると、旅が ずっと楽になるぞ。',
  ],
};

const GUIDE = {
  name: '山のガイド ユキオ',
  block: 'この先は ふぶきの山頂だ。けがわのコートを着ていないと こごえてしまうよ。コートを着てから来なさい。',
  ownNotWorn: 'コートをもっているじゃないか。カバンの「そうび」で着てから来なさい。',
  open: 'よし、そのコートなら大丈夫だ。気をつけて行くんだよ！',
  after: '山頂の風の塔には、あらしの大ワシがすんでいる。',
};

const TOWNSFOLK = [
  'ひまわりのタネは、食べるとHPが回復するよ。🌻 ボタンか Fキーでたべられるんだ。',
  'カバンがいっぱいだと、落ちている物をひろえないよ。大きいカバンを作ろう！',
  '岩は つるはしがないと こわせないんだって。',
  '道しるべにさわっておくと、地図からワープできるんだよ。',
  '宿屋で休むと、HPもMPもぜんぶ回復するよ。',
  'ころがると（Shift / 💨）、ちょっとのあいだ攻撃が当たらないんだ。',
  'わたし、湖のほとりで金色のタネを見たことがあるの。',
  '湖の北のふなつき場から、湖の王国へ行けるんだって。お城の壁の上を歩けるらしいよ！',
  '町の入口は 騎士さんが守ってくれる。でも 大きな魔物がおそってきたら、いっしょに戦ってね。',
  'ウサギやリスに ひまわりのタネをあげると、なかよくなって ついてきてくれるよ。',
  '山の鉄の岩は、ふつうの岩より黒っぽいんだ。',
];

/* -------------------------------- 看板 -------------------------------- */
const SIGNS = {
  home: 'ハム太の家。ベッドで休むとHPとMPが回復する。',
  forestCross: '← 森の塔（北西）　→ ほおぶくろタウン（東）',
  townWest: 'ようこそ ほおぶくろタウンへ！',
  mtGate: 'この先 ゴツゴツ山。いばらに注意！',
  bridgeSite: 'ここに つり橋をかけられそうだ。木12本 と ロープ4本 があれば……',
  moonGate: '月の塔。てっぺんには ノラネコ大王が すんでいる。',
  lakeSign: 'かがみ湖。およぐのは きけんです。',
  valleySign: 'きりの谷。ヘビとキノコおばけに注意。',
  dock: 'ふなつき場。湖のまん中にある「湖の王国 ミナモ」へ 舟がでている。',
  ranch: 'ハム太のアブラムシ牧場。なでると あまつゆを わけてくれる。',
  kDock: '湖の王国 ミナモへ ようこそ！ 城壁には 内がわの階段から のぼれます。',
};

/* ------------------------------ 王国 ------------------------------ */
const KING = {
  name: 'ミナモ王',
  first: [
    'おお、小さな旅人よ。湖の王国ミナモへ よう来た。',
    'わが国は 湖の上にたつ城壁の国。騎士たちが 魔物から民を守っておる。',
    'ほおぶくろタウンには 騎士を何人か送っておいた。大きな魔物がおそってきたら、力をかしてやってくれ。',
    'これは わしからの おくりものじゃ。旅に役立てなさい。',
  ],
  again: [
    '城壁の上からの ながめは すばらしいぞ。階段から のぼってみるとよい。',
    '湖のまわりには 水車にぴったりの 場所がたくさんあるぞ。',
    '町をおそう 大きな魔物を たおしてくれたそうじゃな。礼をいうぞ。',
  ],
};
const KNIGHT_LINES = [
  'ここは われら騎士が守る。ふつうの魔物は 通さないぞ！',
  '大きな魔物が来たら、角笛をふく。いっしょに戦ってくれ！',
  '王国の騎士団は、湖の王国ミナモから来たのだ。',
];

/* ------------------------------ 建てる物 ------------------------------
   B キーで建築。ハムスターの技術なので ぜんぶ木でできていて、力は水車でつくる。
   power: つくる力 / use: つかう力 / conduct: 力をつたえる / dir: 向きがある / flat: 上を歩ける
   recipes: 機械が自動でつくる物 (in を入れると t 秒で out ができる) */
const BUILDS = {
  waterwheel: { name: '水車', icon: '🎡', w: 3, h: 3, cost: { wood: 20, rope: 4, stone: 6 }, power: 8, water: true,
    desc: '水べに建てると まわって力をつくる。軸やベルトで 機械に力をおくる。' },
  shaft:   { name: '木の軸', icon: '🥢', w: 1, h: 1, cost: { wood: 2 }, conduct: true, flat: true, desc: '水車の力を となりへ つたえる。上を歩ける。' },
  belt:    { name: 'ベルトコンベア', icon: '⏩', w: 1, h: 1, cost: { wood: 2, grass: 2 }, conduct: true, use: 0.25, dir: true, flat: true,
    desc: '力が来ていると、のせた物を はこぶ。ハムスターも はこばれる。' },
  sawmill: { name: '製材機', icon: '🪚', w: 2, h: 2, cost: { wood: 10, stone: 4, rope: 2 }, use: 2, dir: true,
    recipes: [{ in: { wood: 1 }, out: ['plank', 2], t: 2.5 }], desc: '木を 板に する。' },
  spinner: { name: '糸車', icon: '🧵', w: 2, h: 2, cost: { wood: 8, rope: 3 }, use: 2, dir: true,
    recipes: [{ in: { grass: 3 }, out: ['rope', 1], t: 3 }, { in: { silk: 3 }, out: ['cloth', 1], t: 4 }], desc: '草を ロープに、クモの糸を 布に する。' },
  mill:    { name: '石うす', icon: '⚙️', w: 2, h: 2, cost: { stone: 10, wood: 4 }, use: 2, dir: true,
    recipes: [{ in: { seed: 3 }, out: ['dango', 1], t: 3 }, { in: { acorn: 2 }, out: ['dango', 1], t: 3 }], desc: 'タネや どんぐりを ひいて だんごに する。' },
  box:     { name: '木箱', icon: '📦', w: 1, h: 1, cost: { wood: 6 }, dir: true, store: true,
    desc: '物をしまっておける。ベルトから入れられ、前にベルトがあれば 中身を ひとつずつ だす。' },
  bed:     { name: 'わらのベッド', icon: '🛏️', w: 2, h: 1, cost: { grass: 10, plank: 4 }, desc: 'ねむると回復して、たおれたときに ここで目をさます。' },
  field:   { name: '畑', icon: '🌱', w: 1, h: 1, cost: { wood: 1, seed: 1 }, flat: true, desc: 'ひまわりが育つ。さいたら しらべて タネを とる。' },
  fence:   { name: '柵', icon: '🚧', w: 1, h: 1, cost: { wood: 1 }, desc: '魔物も ハムスターも 通れない。' },
  floor:   { name: '木の床', icon: '🟫', w: 1, h: 1, cost: { plank: 1 }, flat: true, desc: 'かざりの床。' },
  lamp:    { name: 'ランプ', icon: '🏮', w: 1, h: 1, cost: { wood: 2, grass: 1 }, desc: 'あかりの柱。' },
};
const BUILD_ORDER = ['waterwheel', 'shaft', 'belt', 'sawmill', 'spinner', 'mill', 'box', 'bed', 'field', 'fence', 'floor', 'lamp'];
