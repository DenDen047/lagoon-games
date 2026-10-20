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
  ether:    { name: 'まほうの水', icon: '💧', kind: 'food', mp: 20, sell: 18, desc: 'MP を 20 回復。' },
};

/* -------------------------------- 装備 --------------------------------
   slot: weapon / staff / body / hat / bag / tool
   weapon.kind: paw (すで) / sword / spear / hammer */
const GEAR = {
  paw:      { slot: 'weapon', name: 'すで', icon: '🐾', atk: 2, kind: 'paw' },
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
  snake:    { name: 'ヘビ', hp: 62, atk: 11, spd: 58, exp: 22, coin: [4, 9], r: 12, ai: 'charger', drops: [['leather', 0.6]] },
  bat:      { name: 'コウモリ', hp: 36, atk: 9, spd: 118, exp: 16, coin: [3, 7], r: 10, ai: 'flyer', drops: [['feather', 0.4]] },
  shroom:   { name: 'キノコおばけ', hp: 54, atk: 9, spd: 32, exp: 20, coin: [4, 8], r: 13, ai: 'shooter', shot: 'spore', drops: [['mushroom', 0.7]] },
  catsol:   { name: 'ネコ兵', hp: 95, atk: 14, spd: 66, exp: 34, coin: [6, 12], r: 13, ai: 'walker', drops: [['moon', 0.3]] },
  catmage:  { name: 'ネコまどうし', hp: 72, atk: 13, spd: 46, exp: 34, coin: [6, 12], r: 12, ai: 'shooter', shot: 'dark', drops: [['dust', 0.4]] },
  owl:      { name: 'フクロウ', hp: 85, atk: 15, spd: 105, exp: 36, coin: [6, 12], r: 13, ai: 'flyer', drops: [['feather', 0.6]] },
  catknight:{ name: 'ネコ騎士', hp: 150, atk: 17, spd: 58, exp: 50, coin: [10, 18], r: 14, ai: 'charger', drops: [['moon', 0.5]] },
};

const BOSSES = {
  queen:   { name: 'クモの女王アラクネ', hp: 650, atk: 6, r: 30, exp: 90, coin: 150, book: 'fire' },
  eagle:   { name: 'あらしの大ワシ', hp: 1500, atk: 10, r: 32, exp: 260, coin: 400, book: 'wind' },
  catking: { name: 'ノラネコ大王', hp: 3600, atk: 17, r: 38, exp: 800, coin: 1000, book: 'star' },
};

/* ------------------------------- 地方 ------------------------------- */
const REGIONS = {
  forest:   { name: 'ひまわりの森', music: 'forest', spawn: [['ant', 4], ['worm', 3]] },
  deepwood: { name: 'ふかい森', music: 'forest', spawn: [['ant', 2], ['worm', 2], ['beetle', 3], ['bee', 3]] },
  lake:     { name: 'かがみ湖', music: 'forest', spawn: [['bee', 2], ['worm', 2]] },
  town:     { name: 'ほおぶくろタウン', music: 'town', spawn: [], safe: true },
  outskirt: { name: '町はずれ', music: 'town', spawn: [['ant', 2], ['bee', 1]] },
  mountain: { name: 'ゴツゴツ山', music: 'mountain', spawn: [['lizard', 3], ['crow', 2], ['weasel', 2]] },
  snow:     { name: 'ゆきの山頂', music: 'snow', spawn: [['yeti', 3], ['weasel', 2], ['crow', 1]], cold: true },
  valley:   { name: 'きりの谷', music: 'valley', spawn: [['snake', 3], ['bat', 3], ['shroom', 3]] },
  moon:     { name: '月の野原', music: 'moon', spawn: [['catsol', 3], ['catmage', 2], ['owl', 2]] },
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
  first: [
    'よく来たのう、森の小さな旅人よ。',
    'この町は むかしから「星の魔法の本」に守られてきた。ところが ある夜、ノラネコ大王がその本をうばい、谷の向こうの「月の塔」にとじこもってしもうた。',
    'それからというもの、森にも山にも魔物があふれておる。',
    '月の塔の扉は「ほのおの本」と「かぜの本」をもつ者にしかひらかん。まずは北の森にある「森の塔」へ行くのじゃ。',
    '魔法の本は、杖がなければつかえん。魔法屋で杖を手に入れておきなさい。森で集めた物は よろず屋で売れるぞ。',
  ],
  hint: {
    staff: '魔法屋の「木の杖」は 100コイン じゃ。森の物を売ってためなさい。',
    forestTower: '森の塔は 森の北西じゃ。てっぺんにクモの女王がおる。',
    thorns: 'ほのおの本を手に入れたか！ 町の東の山道は いばらでふさがれておる。ファイアで燃やすのじゃ。',
    coat: '山の上は ふぶきじゃ。けがわのコートは 洋服屋で買えるし、イタチの毛皮で作ることもできる。',
    windTower: '雪の山頂に「風の塔」がある。あらしの大ワシをたおして かぜの本を手に入れるのじゃ。',
    valley: '山をこえた東に きりの谷がある。大きな割れ目に つり橋をかけるには 木12本とロープ4本がいる。',
    moonTower: 'ふたつの本がそろったな。谷の向こうの月の塔で ノラネコ大王をたおすのじゃ！',
    done: '星の魔法の本が もどってきた！ そなたは この町の英雄じゃ。',
  },
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
  '山の鉄の岩は、ふつうの岩より黒っぽいんだ。',
];

/* -------------------------------- 看板 -------------------------------- */
const SIGNS = {
  home: 'ハム太の家。ベッドで休むとHPとMPが回復する。',
  forestCross: '← 森の塔（北西）　→ ほおぶくろタウン（東）',
  townWest: 'ようこそ ほおぶくろタウンへ！',
  mtGate: 'この先 ゴツゴツ山。いばらに注意！',
  bridgeSite: 'ここに つり橋をかけられそうだ。木12本 と ロープ4本 があれば……',
  moonGate: '月の塔。ほのおの本と かぜの本 をもつ者だけが入れる。',
  lakeSign: 'かがみ湖。およぐのは きけんです。',
  valleySign: 'きりの谷。ヘビとキノコおばけに注意。',
};
