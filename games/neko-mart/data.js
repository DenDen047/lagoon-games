/* =========================================================================
   NEKO MART ― データ
   商品 / 素材 / 作れる物 / 家具 / 猫の毛色 / 天気 / 目標
   ========================================================================= */
'use strict';

const TILE = 48;            // 1マスの大きさ (ワールド座標)
const OUT = 7;              // お店の左右に見える外の幅 (マス)
const PREP_MIN = 8 * 60;    // じゅんび中の時計
const OPEN_MIN = 9 * 60;    // 開店
const CLOSE_MIN = 18 * 60;  // 閉店
const MIN_SEC = 0.32;       // ゲーム内1分 = 現実0.32秒 (1日およそ3分)
const BOX_MAX = 12;         // 箱1つに入る数
const SLOT_CAP = 6;         // 棚の1列に並ぶ数

/* お店の広さ。左上を基準に右と下へ広がる */
const SHOP_SIZES = [
  { w: 8, h: 6, cost: 0 },
  { w: 10, h: 7, cost: 8000 },
  { w: 12, h: 8, cost: 20000 },
  { w: 14, h: 9, cost: 45000 },
  { w: 16, h: 10, cost: 90000 },
];

/* 商品の種類と、並べる場所 */
const KINDS = {
  food:   { name: '食べもの',   icon: '🍙', store: 'shelf' },
  toy:    { name: 'おもちゃ・人形', icon: '🧸', store: 'shelf' },
  drink:  { name: '飲みもの',   icon: '🥤', store: 'fridge' },
  frozen: { name: '冷凍食品',   icon: '🍕', store: 'freezer' },
  ice:    { name: 'アイス',     icon: '🍦', store: 'icecase' },
};
const STORES = {
  shelf:   { name: 'たな・ワゴン' },
  fridge:  { name: '飲み物の冷蔵庫' },
  freezer: { name: '冷凍庫' },
  icecase: { name: 'アイスケース' },
};

/* 問屋で仕入れる、ほかの人が作った商品。fair は「目安の値段」 */
const GOODS = [
  { id: 'onigiri',  name: 'おにぎり',         kind: 'food',   emoji: '🍙', cost: 70,  fair: 120 },
  { id: 'bread',    name: 'パン',             kind: 'food',   emoji: '🍞', cost: 80,  fair: 140, tags: ['sweet'] },
  { id: 'senbei',   name: 'おせんべい',       kind: 'food',   emoji: '🍘', cost: 50,  fair: 90 },
  { id: 'candy',    name: 'キャンディ',       kind: 'food',   emoji: '🍬', cost: 30,  fair: 60, tags: ['sweet'] },
  { id: 'niboshi',  name: 'にぼしスナック',   kind: 'food',   emoji: '🐟', cost: 90,  fair: 160, tags: ['fish'] },
  { id: 'sandwich', name: 'サンドイッチ',     kind: 'food',   emoji: '🥪', cost: 120, fair: 200, tags: ['egg'] },
  { id: 'jarashi',  name: 'ねこじゃらし',     kind: 'toy',    emoji: '🎣', cost: 150, fair: 260 },
  { id: 'yarnball', name: 'けいとだま',       kind: 'toy',    emoji: '🧶', cost: 120, fair: 210 },
  { id: 'bear',     name: 'くまのぬいぐるみ', kind: 'toy',    emoji: '🧸', cost: 300, fair: 520 },
  { id: 'tea',      name: 'おちゃ',           kind: 'drink',  emoji: '🍵', cost: 60,  fair: 110, tags: ['bitter'] },
  { id: 'milk',     name: 'ミルク',           kind: 'drink',  emoji: '🥛', cost: 70,  fair: 120, tags: ['milk'] },
  { id: 'soda',     name: 'ソーダ',           kind: 'drink',  emoji: '🥤', cost: 80,  fair: 140, tags: ['fizzy'] },
  { id: 'ojuice',   name: 'オレンジジュース', kind: 'drink',  emoji: '🧃', cost: 90,  fair: 150, tags: ['fruit'] },
  { id: 'pizza',    name: '冷凍ピザ',         kind: 'frozen', emoji: '🍕', cost: 200, fair: 340, tags: ['milk'] },
  { id: 'gyoza',    name: '冷凍ぎょうざ',     kind: 'frozen', emoji: '🥟', cost: 180, fair: 300 },
  { id: 'ebifry',   name: '冷凍エビフライ',   kind: 'frozen', emoji: '🍤', cost: 220, fair: 380, tags: ['fish'] },
  { id: 'softcream', name: 'ソフトクリーム',  kind: 'ice',    emoji: '🍦', cost: 90,  fair: 160, tags: ['sweet', 'milk'] },
  { id: 'kakigori', name: 'かき氷',           kind: 'ice',    emoji: '🍧', cost: 80,  fair: 150, tags: ['sweet'] },
  { id: 'cupice',   name: 'カップアイス',     kind: 'ice',    emoji: '🍨', cost: 110, fair: 190, tags: ['sweet', 'milk'] },
];
const GOOD = Object.fromEntries(GOODS.map((g) => [g.id, g]));

/* 素材屋で買う素材。word は商品名を考えるときに使う */
const MATS = [
  { id: 'flour',  name: 'こむぎこ',     emoji: '🌾', cost: 20, word: '' },
  { id: 'rice',   name: 'ごはん',       emoji: '🍚', cost: 15, word: '' },
  { id: 'honey',  name: 'はちみつ',     emoji: '🍯', cost: 20, word: 'はちみつ', tags: ['sweet'] },
  { id: 'milk',   name: 'ミルク',       emoji: '🥛', cost: 25, word: 'ミルク', tags: ['milk'] },
  { id: 'cheese', name: 'チーズ',       emoji: '🧀', cost: 30, word: 'チーズ', tags: ['milk'] },
  { id: 'egg',    name: 'たまご',       emoji: '🥚', cost: 15, word: 'たまご', tags: ['egg'] },
  { id: 'berry',  name: 'いちご',       emoji: '🍓', cost: 30, word: 'いちご', tags: ['fruit', 'sweet'] },
  { id: 'orange', name: 'みかん',       emoji: '🍊', cost: 25, word: 'みかん', tags: ['fruit'] },
  { id: 'apple',  name: 'りんご',       emoji: '🍎', cost: 25, word: 'りんご', tags: ['fruit'] },
  { id: 'choco',  name: 'チョコ',       emoji: '🍫', cost: 30, word: 'チョコ', tags: ['sweet', 'bitter'] },
  { id: 'tea',    name: 'おちゃっぱ',   emoji: '🍃', cost: 15, word: '抹茶', tags: ['bitter'] },
  { id: 'soda',   name: 'ソーダのもと', emoji: '💧', cost: 15, word: 'ソーダ', tags: ['fizzy'] },
  { id: 'fish',   name: 'おさかな',     emoji: '🐟', cost: 40, word: 'おさかな', tags: ['fish'] },
  { id: 'shrimp', name: 'えび',         emoji: '🦐', cost: 40, word: 'えび', tags: ['fish'] },
  { id: 'yarn',   name: 'けいと',       emoji: '🧶', cost: 40, word: '' },
  { id: 'cotton', name: 'わた',         emoji: '☁️', cost: 20, word: '' },
  { id: 'button', name: 'ボタン',       emoji: '🔘', cost: 10, word: 'ボタン', tags: ['cute'] },
  { id: 'ribbon', name: 'リボン',       emoji: '🎀', cost: 20, word: 'リボン', tags: ['cute'] },
  { id: 'bell',   name: 'すず',         emoji: '🔔', cost: 25, word: 'すず', tags: ['cute', 'bell'] },
];
const MAT = Object.fromEntries(MATS.map((m) => [m.id, m]));

/* 作業台で作れる物の「かたち」。need は必ず使う素材、choices は味やかざりの候補 */
const FORMS = [
  { id: 'juice', name: 'ジュース', kind: 'drink', emoji: '🧃', baseCost: 20, need: {}, slots: 2, minFlavor: 1,
    choices: ['berry', 'orange', 'apple', 'milk', 'choco', 'tea', 'soda', 'honey', 'fish'], color: '#ffd6e2',
    pack: 'びん', tail: 'ジュース' },
  { id: 'cookie', name: 'クッキー', kind: 'food', emoji: '🍪', baseCost: 10, need: { flour: 1, honey: 1 }, slots: 1, minFlavor: 0,
    choices: ['choco', 'berry', 'orange', 'tea', 'cheese', 'fish'], color: '#ffe6b8', pack: 'ふくろ', tail: 'クッキー' },
  { id: 'onigiri', name: 'おにぎり', kind: 'food', emoji: '🍙', baseCost: 5, need: { rice: 1 }, slots: 1, minFlavor: 0,
    choices: ['fish', 'shrimp', 'egg', 'cheese', 'tea'], color: '#e8f4ff', pack: 'フィルム', tail: 'おにぎり' },
  { id: 'pizza', name: '冷凍ピザ', kind: 'frozen', emoji: '🍕', baseCost: 20, need: { flour: 1, cheese: 1 }, slots: 2, minFlavor: 0,
    choices: ['fish', 'shrimp', 'egg', 'apple', 'honey'], color: '#ffe0c0', pack: 'はこ', tail: 'ピザ' },
  { id: 'ice', name: 'アイス', kind: 'ice', emoji: '🍨', baseCost: 10, need: { milk: 1, honey: 1 }, slots: 2, minFlavor: 0,
    choices: ['berry', 'orange', 'apple', 'choco', 'tea', 'soda', 'fish'], color: '#dff4ff', pack: 'カップ', tail: 'アイス' },
  { id: 'doll', name: 'ぬいぐるみ', kind: 'toy', emoji: '🧸', baseCost: 20, need: { yarn: 2, cotton: 1 }, slots: 2, minFlavor: 0,
    choices: ['button', 'ribbon', 'bell'], color: '#fff0f6', pack: 'ふくろ', tail: 'ぬいぐるみ' },
];
const FORM = Object.fromEntries(FORMS.map((f) => [f.id, f]));
const DOLL_SHAPES = [
  { id: 'cat', name: 'ねこ' }, { id: 'dog', name: 'いぬ' }, { id: 'bear', name: 'くま' }, { id: 'rabbit', name: 'うさぎ' }, { id: 'fish', name: 'さかな' },
];
const DOLL_COLORS = ['#f2a65a', '#f7f3ea', '#3b3a45', '#ff9fb8', '#8fc9f2', '#a7d98b', '#c6a6f0', '#ffd75e'];

/* 家具。w,h はマス数。display はその家具に並べられる商品の置き場 */
const FURN = {
  register: { name: 'レジ', icon: '🧾', w: 2, h: 1, cost: 0, unique: true, keep: true,
    desc: 'お客さんがお会計に来る。うしろ側に立つと接客できる' },
  stock:    { name: '倉庫だな', icon: '📦', w: 2, h: 1, cost: 0, unique: true, keep: true,
    desc: '仕入れた商品と作った商品がここに入る。箱を取り出して売り場へ運ぶ' },
  shelf:    { name: '商品だな', icon: '🗄️', w: 2, h: 1, cost: 600, display: 'shelf', slots: 4,
    desc: '食べもの・おもちゃ・人形を並べる' },
  wagon:    { name: 'ワゴン', icon: '🧺', w: 1, h: 1, cost: 300, display: 'shelf', slots: 2,
    desc: '小さな売り台。食べもの・おもちゃ・人形を並べる' },
  fridge:   { name: '飲み物の冷蔵庫', icon: '🧊', w: 2, h: 1, cost: 1800, display: 'fridge', slots: 4,
    desc: 'ジュースやお茶を冷やして並べる' },
  freezer:  { name: '冷凍食品の冷凍庫', icon: '❄️', w: 2, h: 1, cost: 2400, display: 'freezer', slots: 4,
    desc: 'ピザやぎょうざなど、こおった食べものを並べる' },
  icecase:  { name: 'アイスケース', icon: '🍦', w: 2, h: 1, cost: 2600, display: 'icecase', slots: 4,
    desc: 'アイスを並べる。暑い日によく売れる' },
  bench:    { name: '作業台', icon: '🛠️', w: 2, h: 1, cost: 2000,
    desc: '素材からオリジナル商品を作る' },
  trash:    { name: 'ゴミ箱', icon: '🗑️', w: 1, h: 1, cost: 400,
    desc: 'お客さんが食べたあとのゴミを捨ててくれる。いっぱいになったら中身を出す' },
  umbrella: { name: 'かさ立て', icon: '☂️', w: 1, h: 1, cost: 500,
    desc: '雨の日、お客さんがかさを置いていく。ないと床がびしょびしょになる' },
  plant:    { name: '観葉植物', icon: '🪴', w: 1, h: 1, cost: 500,
    desc: 'お店がおしゃれになって、お客さんの気分が少しよくなる' },
  survey:   { name: 'アンケート台', icon: '📝', w: 1, h: 1, cost: 300,
    desc: 'お客さんが「こんなのがほしい」を紙に書いてくれる。台で紙を読める' },
};
const FURN_ORDER = ['shelf', 'wagon', 'fridge', 'freezer', 'icecase', 'bench', 'trash', 'umbrella', 'survey', 'plant'];

/* かべに付ける物と、お店の前に置く物 */
const WALLS = {
  window:   { name: '窓', icon: '🪟', cost: 800, desc: 'お店の前のかべに付けると、通りの猫が中をのぞいて入りやすくなる' },
  poster:   { name: 'ポスター', icon: '🖼️', cost: 200, desc: '自分でかいたポスターをはる。目立って入りやすくなる' },
  autodoor: { name: '自動ドア', icon: '🚪', cost: 4000, desc: '入り口を自動ドアにする。入りやすくなる' },
  sign:     { name: '看板', icon: '🪧', cost: 1000, desc: '自分でかいた看板をお店の前に置く。いちばん目立つ' },
};
const MAX_SIGNS = 2;

/* 猫の毛色 */
const COATS = [
  { id: 'orange', name: 'ちゃとら', base: '#f2a65a', pat: 'tabby', stripe: '#cf7a36' },
  { id: 'gray',   name: 'さばとら', base: '#a7adb7', pat: 'tabby', stripe: '#687080' },
  { id: 'brown',  name: 'きじとら', base: '#b08e66', pat: 'tabby', stripe: '#6a5034' },
  { id: 'black',  name: 'くろねこ', base: '#3d3c48', pat: 'solid' },
  { id: 'white',  name: 'しろねこ', base: '#f8f4ec', pat: 'solid' },
  { id: 'tux',    name: 'はちわれ', base: '#3d3c48', pat: 'tux', white: '#f8f4ec' },
  { id: 'calico', name: 'みけねこ', base: '#f8f4ec', pat: 'calico', p1: '#f0a050', p2: '#3d3c48' },
  { id: 'siam',   name: 'シャム',   base: '#f3e4ca', pat: 'point', point: '#6e4c3a' },
  { id: 'cream',  name: 'クリーム', base: '#f4d9a6', pat: 'solid' },
  { id: 'blue',   name: 'ブルー',   base: '#8e99aa', pat: 'solid' },
];
const COAT = Object.fromEntries(COATS.map((c) => [c.id, c]));
/* 目の色。はじめの4色はふつうの猫にもいる色 */
const EYES = ['#56b46a', '#e3b331', '#5a8fe0', '#c27a38', '#8fd6f5', '#a98be0', '#ff8fb0', '#e0564a'];
const NATURAL_EYES = EYES.slice(0, 4);
const CLOTH_COLORS = ['#ff8fa3', '#ff5f6a', '#ff9b5a', '#ffcf5a', '#8fd17a', '#3fae6a', '#6cc3e8', '#3a6fd0',
  '#b59cf0', '#7a5ac8', '#3d3c48', '#f8f4ec', '#a87850'];

/* ファッション。cost 0 ははじめから持っている。col はそめられる物の、はじめの色 */
const FASHION = {
  body: [
    { id: 'none', name: 'なし', cost: 0 },
    { id: 'apron', name: 'エプロン', cost: 0, col: '#ff8fa3' },
    { id: 'tshirt', name: 'Tシャツ', cost: 0, col: '#6cc3e8' },
    { id: 'dress', name: 'ワンピース', cost: 500, col: '#ffb3c8' },
    { id: 'overalls', name: 'オーバーオール', cost: 600, col: '#5a7fc0' },
    { id: 'hoodie', name: 'パーカー', cost: 700, col: '#8fd17a' },
    { id: 'happi', name: 'はっぴ', cost: 800, col: '#3a6fd0' },
    { id: 'yukata', name: 'ゆかた', cost: 1000, col: '#f2a0c0' },
    { id: 'cape', name: 'マント', cost: 1500, col: '#d8364f' },
  ],
  head: [
    { id: 'none', name: 'なし', cost: 0 },
    { id: 'ribbon', name: 'リボン', cost: 0, col: '#ff5f8a' },
    { id: 'beret', name: 'ベレーぼう', cost: 0, col: '#5a6fd0' },
    { id: 'flower', name: '花かざり', cost: 0, col: '#ff8fb8' },
    { id: 'cap', name: 'キャップ', cost: 300, col: '#4a8fe0' },
    { id: 'knit', name: 'ニットぼう', cost: 400, col: '#e8505b' },
    { id: 'straw', name: 'むぎわらぼうし', cost: 600 },
    { id: 'chef', name: 'コックぼうし', cost: 800 },
    { id: 'usamimi', name: 'うさみみ', cost: 900, col: '#f8f4ec' },
    { id: 'witch', name: 'まほうのぼうし', cost: 1200, col: '#7a5ac8' },
    { id: 'crown', name: 'おうかん', cost: 3000 },
  ],
  face: [
    { id: 'none', name: 'なし', cost: 0 },
    { id: 'glasses', name: 'まるめがね', cost: 0 },
    { id: 'sun', name: 'サングラス', cost: 300 },
    { id: 'heart', name: 'ハートめがね', cost: 500 },
    { id: 'star', name: 'ほしめがね', cost: 500 },
    { id: 'stache', name: 'つけひげ', cost: 400 },
  ],
  neck: [
    { id: 'none', name: 'なし', cost: 0 },
    { id: 'bell', name: 'すず', cost: 0, col: '#d8364f' },
    { id: 'scarf', name: 'マフラー', cost: 0, col: '#e8505b' },
    { id: 'bowtie', name: 'ちょうネクタイ', cost: 300, col: '#3a3f8f' },
    { id: 'bandana', name: 'バンダナ', cost: 300, col: '#4a8fe0' },
    { id: 'necklace', name: 'ネックレス', cost: 500 },
  ],
};
const SLOTS = [['body', 'ふく'], ['head', 'あたま'], ['face', 'かお'], ['neck', 'くび']];
const fashionOf = (slot, id) => FASHION[slot].find((f) => f.id === id) || FASHION[slot][0];

/* お客さんの動物。end は「〜にゃ」のかわりの語尾、likes はとくに好きな味、kinds は好きな種類、
   want は来たときにほしがる種類の重み、wishes はアンケートで「作って」とたのむ物 */
const SPECIES = {
  cat: { name: 'ねこ', end: 'にゃ', w: 40, size: [0.84, 1.0], likes: ['fish'],
    wishes: [{ form: 'onigiri', flav: 'fish' }, { form: 'doll', shape: 'fish' }, { form: 'juice', flav: 'milk' }, { form: 'pizza', flav: 'fish' }] },
  dog: { name: 'いぬ', end: 'ワン', w: 12, size: [0.88, 1.04], ears: 'flop', tail: 'wag', muzzle: true, nose: 'big', likes: ['milk'], kinds: ['toy'], want: { toy: 1.8 },
    cols: [{ base: '#e0a868', sub: '#fff3dc', ear: '#c0844a', point: true }, { base: '#f6f1e6', sub: '#fffaf2', ear: '#c79a6a' },
      { base: '#3d3c48', sub: '#e0a868', ear: '#3d3c48' }, { base: '#b98a5e', sub: '#f3e2c6', ear: '#7a5236' }],
    wishes: [{ form: 'cookie', flav: 'cheese' }, { form: 'doll', shape: 'dog' }, { form: 'juice', flav: 'milk' }] },
  rabbit: { name: 'うさぎ', end: 'ぴょん', w: 10, size: [0.82, 0.96], ears: 'long', tail: 'puff', nose: 'bunny', whisk: true, likes: ['fruit', 'sweet'], want: { drink: 1.3 },
    cols: [{ base: '#f8f4ec', sub: '#ffffff' }, { base: '#b8946c', sub: '#efe0c8' }, { base: '#a7adb7', sub: '#eef0f3' }],
    wishes: [{ form: 'juice', flav: 'apple' }, { form: 'ice', flav: 'berry' }, { form: 'doll', shape: 'rabbit' }, { form: 'cookie', flav: 'berry' }] },
  bear: { name: 'くま', end: 'クマ', w: 7, size: [0.98, 1.12], ears: 'round', tail: 'stub', muzzle: true, nose: 'big', likes: ['sweet', 'fish'], want: { food: 1.4 },
    cols: [{ base: '#9a6b45', sub: '#d9b48a' }, { base: '#d9a35a', sub: '#f3d9a8' }, { base: '#f4f1ea', sub: '#ffffff' }],
    wishes: [{ form: 'juice', flav: 'honey' }, { form: 'doll', shape: 'bear' }, { form: 'onigiri', flav: 'fish' }] },
  panda: { name: 'パンダ', end: 'パン', w: 5, size: [0.94, 1.06], ears: 'round', tail: 'stub', panda: true, likes: ['bitter', 'sweet'], want: { drink: 1.4 },
    cols: [{ base: '#f8f6f0', sub: '#2f2e36', ear: '#2f2e36' }],
    wishes: [{ form: 'ice', flav: 'tea' }, { form: 'juice', flav: 'tea' }, { form: 'cookie', flav: 'tea' }] },
  tanuki: { name: 'たぬき', end: 'ポン', w: 6, size: [0.88, 1.0], ears: 'round', tail: 'bushy', mask: true, nose: 'big', kinds: ['food'], likes: [], want: { food: 2 },
    cols: [{ base: '#9d8466', sub: '#eadfcc', mark: '#4a3d33', ear: '#4a3d33' }],
    wishes: [{ form: 'onigiri', flav: 'egg' }, { form: 'pizza', flav: 'egg' }, { form: 'cookie', flav: 'choco' }] },
  fox: { name: 'きつね', end: 'コン', w: 6, size: [0.86, 1.0], ears: 'fox', tail: 'bushy', cheeks: true, nose: 'small', likes: ['egg', 'fish'], want: { frozen: 1.5 },
    cols: [{ base: '#ec8f45', sub: '#fff6ea', mark: '#4a3430' }, { base: '#e8d2a8', sub: '#fffaf0', mark: '#8a6a4a' }],
    wishes: [{ form: 'onigiri', flav: 'shrimp' }, { form: 'pizza', flav: 'shrimp' }, { form: 'juice', flav: 'orange' }] },
  hamster: { name: 'ハムスター', end: 'ハム', w: 5, size: [0.7, 0.78], ears: 'small', tail: 'none', hamster: true, nose: 'bunny', whisk: true, likes: ['sweet', 'fruit'], want: { food: 1.5 }, budget: 0.6,
    cols: [{ base: '#e9b26a', sub: '#fff6e8' }, { base: '#c9c4c0', sub: '#ffffff' }],
    wishes: [{ form: 'cookie', flav: 'orange' }, { form: 'ice', flav: 'apple' }, { form: 'juice', flav: 'berry' }] },
  penguin: { name: 'ペンギン', end: 'ペン', w: 4, size: [0.82, 0.94], ears: 'none', tail: 'none', penguin: true, likes: ['fish'], kinds: ['ice'], want: { ice: 2.5 },
    cols: [{ base: '#3a3f52', sub: '#ffffff', foot: '#ffa94d' }],
    wishes: [{ form: 'ice', flav: 'soda' }, { form: 'ice', flav: 'fish' }, { form: 'pizza', flav: 'fish' }] },
};
const voice = (text, sp) => (sp && sp !== 'cat' ? text.replace(/にゃ/g, SPECIES[sp].end) : text);

const CAT_NAMES = ['タマ', 'ミケ', 'クロ', 'シロ', 'トラ', 'モモ', 'ハナ', 'レオ', 'ソラ', 'コテツ', 'ミルク', 'ココア',
  'きなこ', 'あずき', 'むぎ', 'こむぎ', 'マロン', 'ルナ', 'チビ', 'ポテト', 'おもち', 'だいふく', 'ゴマ', 'のり', 'ショコラ',
  'ラテ', 'こはる', 'はるまき', 'ちくわ', 'すもも'];

/* 天気。walk は通りを歩く猫の多さ、want は欲しがる種類の重み */
const WEATHER = {
  sunny:  { name: 'はれ',   icon: '☀️', walk: 1.0, want: {}, tip: 'お出かけ日和。いつもどおり売れそう' },
  hot:    { name: 'あつい', icon: '🔥', walk: 0.95, want: { drink: 2.2, ice: 2.4 }, tip: '飲み物とアイスがよく売れそう' },
  cloudy: { name: 'くもり', icon: '☁️', walk: 0.9, want: { food: 1.3 }, tip: 'すずしい日。食べものが売れそう' },
  rain:   { name: 'あめ',   icon: '☔', walk: 0.65, want: { frozen: 1.8, food: 1.2, ice: 0.5 }, tip: 'かさ立てがないと床がぬれる。冷凍食品が売れそう' },
};

/* 目標。上から順に1つずつ出る。チェックの中身は sim.js */
const MISSIONS = [
  { id: 'shelve',   text: '倉庫だなで商品の箱をとって、商品だなにならべよう', reward: 0 },
  { id: 'open',     text: '「開店する」をおして、お店をあけよう', reward: 0 },
  { id: 'sell1',    text: 'お客さんがレジに来たら、レジのうしろに立って売ろう', reward: 200 },
  { id: 'day2',     text: '1日目をさいごまでがんばろう', reward: 300 },
  { id: 'order',    text: '「しいれ」で新しい商品を買おう', reward: 200 },
  { id: 'bench',    text: '「もようがえ」で作業台を置こう', reward: 300 },
  { id: 'craft',    text: '作業台で、オリジナル商品を作ろう', reward: 500 },
  { id: 'wrap',     text: '商品のラッピングに絵をかこう', reward: 300 },
  { id: 'sellOrig', text: 'オリジナル商品を3こ売ろう', reward: 500 },
  { id: 'sign',     text: '看板をかいて、お店の前に置こう', reward: 500 },
  { id: 'drink',    text: '飲み物の冷蔵庫を置いて、飲み物を売ろう', reward: 500 },
  { id: 'trash',    text: 'ゴミ箱を置こう', reward: 300 },
  { id: 'survey',   text: '「もようがえ」でアンケート台を置こう', reward: 300 },
  { id: 'wish',     text: 'アンケートを読んで、お客さんのリクエストをかなえよう', reward: 800 },
  { id: 'poster',   text: 'ポスターをかいて、かべにはろう', reward: 400 },
  { id: 'window',   text: 'お店の前のかべに窓をつけよう', reward: 300 },
  { id: 'fashion',  text: '「きせかえ」で新しいおしゃれを買おう', reward: 300 },
  { id: 'sales5k',  text: '1日の売り上げ ¥5,000 をめざそう', reward: 1000 },
  { id: 'expand',   text: 'お店を広げよう', reward: 1000 },
  { id: 'umbrella', text: 'かさ立てを置こう (雨の日に役立つ)', reward: 300 },
  { id: 'cold',     text: '冷凍庫とアイスケースをそろえよう', reward: 1000 },
  { id: 'autodoor', text: '入り口を自動ドアにしよう', reward: 1000 },
  { id: 'star4',    text: '評判を ★4 にしよう', reward: 2000 },
  { id: 'sales20k', text: '1日の売り上げ ¥20,000 をめざそう', reward: 3000 },
  { id: 'maxshop',  text: 'お店をいちばん大きくしよう', reward: 5000 },
];

/* 目標の並びを変える前のセーブを読むための、むかしの並び */
const MISSIONS_V1 = ['shelve', 'open', 'sell1', 'day2', 'order', 'bench', 'craft', 'wrap', 'sellOrig', 'sign', 'drink',
  'trash', 'poster', 'window', 'sales5k', 'expand', 'umbrella', 'cold', 'autodoor', 'star4', 'sales20k', 'maxshop'];

/* お客さんのひとこと。「にゃ」は動物ごとの語尾に変わる */
const SAY = {
  enter:   ['こんにちにゃ', 'なにがあるかにゃ', 'おじゃましますにゃ', 'いいにおい…'],
  cheap:   ['やすい!', 'おトクにゃ!', 'これはお買いどく'],
  pricey:  ['たかいにゃ…', 'ちょっと高い…', 'うーん、高い'],
  tooPricey: ['高すぎにゃ!', 'こんなに高いの!?'],
  cute:    ['かわいい!', 'すてきな絵!', 'このパッケージすき'],
  orig:    ['ここだけの商品!', 'オリジナルだ!', 'はじめて見た!'],
  fav:     ['これ大好きにゃ!', 'わーい、好きなやつ!', 'いいにおい!'],
  stylish: ['店長さん、おしゃれにゃ!', 'そのふく、すてき!', 'かわいい店長さん!'],
  noWant:  ['ほしいのがないにゃ…', 'ないのかぁ…', 'また今度にゃ'],
  empty:   ['からっぽ…', 'うりきれ?'],
  dirty:   ['ゴミが落ちてる…', 'ちょっとよごれてる'],
  wet:     ['ゆかがぬれてる…'],
  slip:    ['にゃっ!?', 'すべった!'],
  wait:    ['まだかにゃ…', 'レジにだれもいない…'],
  angry:   ['もういいにゃ!', 'まちくたびれた!'],
  thanks:  ['ありがとにゃ!', 'また来るにゃ!', 'いいお店!', 'ごちそうさまにゃ'],
  plant:   ['おしゃれなお店'],
};
