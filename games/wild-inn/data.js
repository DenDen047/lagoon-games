/* =========================================================================
   WILD INN ― データ
   建物の大きさ / 生息地 / 動物 / えさ / 家具 / 電話のせりふ / 目標
   ========================================================================= */
'use strict';

const TILE = 40;
const OUT = 3;                 // 1F の建物の外 (左右と下) に歩けるマスの幅
const DAY_START = 8 * 60;      // 朝 8:00 に開く
const DAY_END = 20 * 60;       // 夜 8:00 で1日が終わる
const CALL_END = 18 * 60;      // 電話とお客さんが来るのはこの時刻まで
const MIN_PER_SEC = 3;         // 1秒でゲームの中の3分進む (1日 = 約4分)
const PATIENCE = 150;          // 受付で待ってくれる時間 (ゲームの中の分)

/* 土地の広さ。広げると上と右にマスが足される */
const LANDS = [
  { w: 14, h: 10, cost: 0 },
  { w: 18, h: 12, cost: 18000 },
  { w: 22, h: 14, cost: 40000 },
];
const FLOOR_COST = [0, 12000, 30000];   // 1F, 2F, 3F
const MAX_FLOORS = FLOOR_COST.length;
const ROOM_MIN = 3, ROOM_MAX_W = 10, ROOM_MAX_H = 8;
const TILE_COST = 60;          // 部屋の床 1マスのお金
const SLOT_AREA = 5;           // 部屋の広さ 5マスで1ぴき分

/* 生息地 = 部屋の種類 */
const HABITATS = {
  town: {
    name: 'どこでも', fname: 'おうち', room: 'おうちの部屋', icon: '🏠', cost: 1200, market: 1500, star: 0,
    floor: '#e9c99a', wall: '#f6ead8', trim: '#b98a56',
    phone: 'ふだんは、ふつうのおうちでくらしています。',
    desc: '町のおうちで人といっしょにくらす動物。どこにでもいる。',
  },
  jungle: {
    name: '熱帯雨林', fname: '熱帯雨林', room: '熱帯雨林の部屋', icon: '🌴', cost: 2500, market: 3000, star: 0,
    floor: '#5e9e58', wall: '#8a6a3e', trim: '#4e3a20',
    phone: 'あたたかくて、木がいっぱいの熱帯雨林の生まれです。',
    desc: '一年中あたたかくて雨の多い森。高い木と、しめった土。',
  },
  savanna: {
    name: 'サバンナ', fname: 'サバンナ', room: 'サバンナの部屋', icon: '🦒', cost: 3000, market: 3600, star: 0,
    floor: '#dcc069', wall: '#c99a5e', trim: '#8a5e30',
    phone: '広い草原、サバンナの生まれです。',
    desc: 'アフリカの広い草原。草とまばらな木と、強い日ざし。',
  },
  desert: {
    name: 'さばく', fname: 'さばく', room: 'さばくの部屋', icon: '🌵', cost: 2500, market: 2800, star: 2,
    floor: '#f0d49a', wall: '#d9a86a', trim: '#9a6a36',
    phone: '暑くてかわいた、さばくの生まれです。',
    desc: '雨がほとんどふらない砂の土地。昼は暑く、夜は寒い。',
  },
  polar: {
    name: 'こおりの国', fname: 'こおりの国', room: 'こおりの部屋', icon: '🧊', cost: 3500, market: 4000, star: 3,
    floor: '#e6f3fb', wall: '#a9d3ea', trim: '#5b8fb0',
    phone: '寒い寒い、こおりの国の生まれです。',
    desc: '北極や南極のような、雪と氷の世界。とても寒い。',
  },
};
const HAB_ORDER = ['town', 'jungle', 'savanna', 'desert', 'polar'];

/* えさ (1回分の値段) */
const FOODS = {
  kibble: { name: 'ペットフード', icon: '🥫', cost: 60 },
  meat: { name: 'お肉', icon: '🍖', cost: 120 },
  fish: { name: 'お魚', icon: '🐟', cost: 90 },
  veggie: { name: 'やさい', icon: '🥕', cost: 40 },
  fruit: { name: 'くだもの', icon: '🍌', cost: 60 },
  grass: { name: 'ほし草', icon: '🌾', cost: 30 },
  leaves: { name: '木の葉', icon: '🌿', cost: 40 },
  seeds: { name: 'たね', icon: '🌻', cost: 30 },
  bugs: { name: '虫', icon: '🦗', cost: 50 },
};
const FOOD_ORDER = ['kibble', 'meat', 'fish', 'veggie', 'fruit', 'grass', 'leaves', 'seeds', 'bugs'];

/* 動物
   k      料金の相場 (生息地の相場にかける)
   slots  部屋で何ひき分の場所をとるか (大きい動物は2)
   pet    なでられるのがどれくらい好きか (1 = 大好き)
   pred / prey  同じ部屋にいると、prey の動物はこわがる
   h      絵の高さ (ふきだしの位置とアイコンの大きさに使う) */
const SPECIES = {
  dog: { name: 'いぬ', hab: 'town', foods: ['kibble', 'meat'], fav: 'kibble', likes: 'ball', k: 1.0, slots: 1, pet: 1, h: 34, speed: 1.9,
    cols: [{ base: '#d9a066', sub: '#f7e2c2', dark: '#7a4a24' }, { base: '#f3efe6', sub: '#ffffff', dark: '#b8a890' }, { base: '#4a3d36', sub: '#c9a582', dark: '#231a15' }, { base: '#ecc27a', sub: '#fbe6bd', dark: '#a87830' }],
    desc: '人が大好きで、なでられるとしっぽをふる。ボール遊びがとくい。' },
  cat: { name: 'ねこ', hab: 'town', foods: ['kibble', 'fish'], fav: 'fish', likes: 'scratch', k: 0.9, slots: 1, pet: 0.8, pred: true, h: 30, speed: 1.6,
    cols: [{ base: '#f0a35a', sub: '#fde7cf', dark: '#b8662a' }, { base: '#9ba3ad', sub: '#e8ecf0', dark: '#5f6670' }, { base: '#3a3438', sub: '#5a5258', dark: '#1a1618' }, { base: '#f6f2ea', sub: '#ffffff', dark: '#c9b9a6' }],
    desc: 'きまぐれだけど、つめとぎがあるとごきげん。小さな動物を追いかけたくなる。' },
  rabbit: { name: 'うさぎ', hab: 'town', foods: ['veggie', 'grass'], fav: 'veggie', likes: 'bed', k: 0.8, slots: 1, pet: 0.9, prey: true, h: 30, speed: 1.7,
    cols: [{ base: '#f6f2ec', sub: '#ffffff', dark: '#e6a0a8' }, { base: '#b08a6a', sub: '#e9d6c0', dark: '#6e5038' }, { base: '#8f8f96', sub: '#d8d8de', dark: '#55555c' }],
    desc: '長い耳で小さな音も聞きのがさない。ふかふかの寝床が好き。' },
  hamster: { name: 'ハムスター', hab: 'town', foods: ['seeds', 'veggie'], fav: 'seeds', likes: 'wheel', k: 0.6, slots: 1, pet: 0.7, prey: true, h: 18, speed: 1.3,
    cols: [{ base: '#e9b072', sub: '#fff4e4', dark: '#a8703a' }, { base: '#d8d2c8', sub: '#ffffff', dark: '#8a8278' }],
    desc: 'ほっぺにたねをためこむ。回し車をいつまでも走る。' },
  chameleon: { name: 'カメレオン', hab: 'jungle', foods: ['bugs'], fav: 'bugs', likes: 'vine', k: 0.8, slots: 1, pet: 0.25, h: 22, speed: 0.7,
    cols: [{ base: '#6cc24a', sub: '#c8ef8a', dark: '#2f7a2a' }, { base: '#4ab0c0', sub: '#b8eef0', dark: '#1f6a80' }],
    desc: '体の色を変えられる。長い舌で虫をつかまえる。さわられるのはにがて。' },
  sloth: { name: 'ナマケモノ', hab: 'jungle', foods: ['leaves', 'fruit'], fav: 'leaves', likes: 'jtree', k: 1.1, slots: 1, pet: 0.7, h: 30, speed: 0.45,
    cols: [{ base: '#a8907a', sub: '#e8dccc', dark: '#5e4a3a' }],
    desc: '1日のほとんどを木にぶらさがってねむる。動きはとってもゆっくり。' },
  macaw: { name: 'コンゴウインコ', hab: 'jungle', foods: ['fruit', 'seeds'], fav: 'fruit', likes: 'perch', k: 1.0, slots: 1, pet: 0.6, h: 34, speed: 1.4,
    cols: [{ base: '#e8392f', sub: '#ffd23a', dark: '#2a6fd0' }, { base: '#2a8fe0', sub: '#ffd23a', dark: '#1a4aa0' }],
    desc: 'あざやかな羽の大きなオウム。かたいくだものもくちばしで割る。' },
  orangutan: { name: 'オランウータン', hab: 'jungle', foods: ['fruit', 'leaves'], fav: 'fruit', likes: 'jtree', k: 0.85, slots: 2, pet: 0.8, h: 40, speed: 1.1,
    cols: [{ base: '#c4642e', sub: '#e9a070', dark: '#7a3612' }],
    desc: '「森の人」という意味の名前。とてもかしこくて、木の上でくらす。' },
  lion: { name: 'ライオン', hab: 'savanna', foods: ['meat'], fav: 'meat', likes: 'rock', k: 0.9, slots: 2, pet: 0.5, pred: true, h: 42, speed: 1.6,
    cols: [{ base: '#e2b064', sub: '#f6dca8', dark: '#9a5a22' }],
    desc: '百獣の王。1日の半分以上は岩の上でごろごろしている。' },
  zebra: { name: 'シマウマ', hab: 'savanna', foods: ['grass'], fav: 'grass', likes: 'tallgrass', k: 0.8, slots: 2, pet: 0.6, prey: true, h: 46, speed: 1.9,
    cols: [{ base: '#f8f6f0', sub: '#ffffff', dark: '#26242a' }],
    desc: 'しまもようは1頭ずつちがう。草むらでのんびり草を食べる。' },
  giraffe: { name: 'キリン', hab: 'savanna', foods: ['leaves', 'grass'], fav: 'leaves', likes: 'acacia', k: 0.85, slots: 2, pet: 0.7, prey: true, h: 78, speed: 1.5,
    cols: [{ base: '#f2c66a', sub: '#fff2d0', dark: '#a8602a' }],
    desc: 'いちばん背の高い動物。高い木の葉っぱを長い舌でとって食べる。' },
  meerkat: { name: 'ミーアキャット', hab: 'savanna', foods: ['bugs', 'fruit'], fav: 'bugs', likes: 'mound', k: 0.75, slots: 1, pet: 0.6, prey: true, h: 28, speed: 1.8,
    cols: [{ base: '#d6b588', sub: '#f2e2c4', dark: '#6a4e30' }],
    desc: '後ろ足で立ってまわりを見はる。土の中の虫をほり出して食べる。' },
  fennec: { name: 'フェネック', hab: 'desert', foods: ['bugs', 'meat', 'fruit'], fav: 'bugs', likes: 'burrow', k: 1.0, slots: 1, pet: 0.8, h: 28, speed: 1.9,
    cols: [{ base: '#f0d2a0', sub: '#fff6e6', dark: '#b88a52' }],
    desc: 'とても大きな耳で体の熱をにがす、さばくの小さなキツネ。' },
  camel: { name: 'ラクダ', hab: 'desert', foods: ['grass', 'leaves'], fav: 'grass', likes: 'dune', k: 0.8, slots: 2, pet: 0.6, h: 58, speed: 1.2,
    cols: [{ base: '#d2a468', sub: '#ecd2a6', dark: '#8a6232' }],
    desc: 'せなかのこぶに栄養をためて、何日も水を飲まずに歩ける。' },
  lizard: { name: 'フトアゴヒゲトカゲ', hab: 'desert', foods: ['bugs', 'veggie'], fav: 'bugs', likes: 'heatlamp', k: 0.9, slots: 1, pet: 0.5, h: 16, speed: 1.0,
    cols: [{ base: '#d9a860', sub: '#f2d8a0', dark: '#8a6430' }],
    desc: 'あたたかいライトの下で日なたぼっこをして体温を上げる。' },
  penguin: { name: 'ペンギン', hab: 'polar', foods: ['fish'], fav: 'fish', likes: 'coldpool', k: 0.9, slots: 1, pet: 0.6, prey: true, h: 34, speed: 1.0,
    cols: [{ base: '#2c3440', sub: '#ffffff', dark: '#f2a43a' }],
    desc: '空はとべないけれど、水の中ではびゅんびゅん泳ぐ。' },
  seal: { name: 'アザラシ', hab: 'polar', foods: ['fish'], fav: 'fish', likes: 'ice', k: 0.9, slots: 1, pet: 0.8, prey: true, h: 22, speed: 0.8,
    cols: [{ base: '#b9c2cc', sub: '#e8eef2', dark: '#6a7480' }, { base: '#f4f6f8', sub: '#ffffff', dark: '#a8b4c0' }],
    desc: '氷の上でごろんとひなたぼっこ。陸ではおなかで進む。' },
  polarbear: { name: 'ホッキョクグマ', hab: 'polar', foods: ['fish', 'meat'], fav: 'fish', likes: 'snowhill', k: 0.95, slots: 2, pet: 0.4, pred: true, h: 44, speed: 1.3,
    cols: [{ base: '#f6f3ea', sub: '#ffffff', dark: '#3a3434' }],
    desc: '北極にすむ大きなクマ。白い毛の下の皮ふは、じつは黒い。' },
};
const SP_ORDER = Object.keys(SPECIES);

/* 家具
   hab   どの部屋向けか ('any' はどの部屋でもよろこぶ、'lobby' は受付まわりのかざり)
   soft  上を歩ける (動物も人も通れる)
   flat  床にしく物 (いつもいちばん下に描く) */
const FURN = {
  water: { name: '水のみ場', hab: 'any', w: 1, h: 1, cost: 200 },
  bed: { name: 'ふかふかベッド', hab: 'town', w: 1, h: 1, cost: 300 },
  scratch: { name: 'つめとぎ', hab: 'town', w: 1, h: 1, cost: 250 },
  ball: { name: 'ボール', hab: 'town', w: 1, h: 1, cost: 120, soft: true },
  wheel: { name: '回し車', hab: 'town', w: 1, h: 1, cost: 280 },
  jtree: { name: 'ジャングルの木', hab: 'jungle', w: 2, h: 2, cost: 900 },
  vine: { name: 'つる', hab: 'jungle', w: 1, h: 1, cost: 350 },
  perch: { name: 'とまり木', hab: 'jungle', w: 1, h: 1, cost: 300 },
  fern: { name: '大きな葉っぱ', hab: 'jungle', w: 1, h: 1, cost: 180, soft: true },
  pond: { name: '森の池', hab: 'jungle', w: 2, h: 1, cost: 600 },
  acacia: { name: 'アカシアの木', hab: 'savanna', w: 2, h: 2, cost: 900 },
  rock: { name: '日なたの岩', hab: 'savanna', w: 2, h: 1, cost: 500 },
  tallgrass: { name: '草むら', hab: 'savanna', w: 1, h: 1, cost: 150, soft: true },
  mound: { name: 'アリづか', hab: 'savanna', w: 1, h: 1, cost: 350 },
  waterhole: { name: '水場', hab: 'savanna', w: 2, h: 2, cost: 700 },
  cactus: { name: 'サボテン', hab: 'desert', w: 1, h: 1, cost: 250 },
  dune: { name: '砂山', hab: 'desert', w: 2, h: 1, cost: 400, soft: true },
  heatlamp: { name: 'ひなたライト', hab: 'desert', w: 1, h: 1, cost: 450 },
  burrow: { name: '巣あな', hab: 'desert', w: 1, h: 1, cost: 350 },
  ice: { name: '氷のかたまり', hab: 'polar', w: 1, h: 1, cost: 300 },
  snowhill: { name: '雪山', hab: 'polar', w: 2, h: 1, cost: 450, soft: true },
  coldpool: { name: 'つめたいプール', hab: 'polar', w: 2, h: 2, cost: 800 },
  igloo: { name: 'かまくら', hab: 'polar', w: 2, h: 2, cost: 700 },
  sofa: { name: 'ソファ', hab: 'lobby', w: 2, h: 1, cost: 600 },
  plant: { name: '観葉植物', hab: 'lobby', w: 1, h: 1, cost: 250 },
  aquarium: { name: '水そう', hab: 'lobby', w: 2, h: 1, cost: 900 },
  rug: { name: 'じゅうたん', hab: 'lobby', w: 2, h: 2, cost: 400, soft: true, flat: true },
  lamp: { name: 'スタンドライト', hab: 'lobby', w: 1, h: 1, cost: 300 },
};
const FURN_TABS = ['any', 'town', 'jungle', 'savanna', 'desert', 'polar', 'lobby'];
const FURN_TAB_NAME = { any: 'どこでも', lobby: 'ロビー' };

/* 電話をかけてくる人 */
const OWNER_NAMES = ['たなか', 'すずき', 'さとう', 'やまだ', 'こばやし', 'いのうえ', 'わたなべ', 'きむら', 'はやし', 'もりた', 'おかだ', 'ふじい', 'あおき', 'みずの', 'せがわ', 'くどう', 'のむら', 'ほしの', 'かとう', 'まつもと'];
const ZOO_NAMES = ['ひだまり動物園', 'そよかぜ動物園', 'みなと動物公園', 'にじいろサファリ', 'どうぶつ研究所', 'まちの小さな動物園'];
const PET_NAMES = ['ポチ', 'タマ', 'モモ', 'ココ', 'ハナ', 'ソラ', 'レオ', 'マロン', 'チョコ', 'きなこ', 'ルル', 'ピコ', 'ムギ', 'コタロウ', 'サクラ', 'ベル', 'ミント', 'ジジ', 'プリン', 'ユキ', 'ラッキー', 'ナナ', 'もち', 'あんず', 'テン', 'ゴロウ', 'キキ', 'リン', 'ポポ', 'ハル', 'ぽんず', 'マメ', 'ジャック', 'クッキー', 'ゆず'];
const REASONS_HOME = ['家族で旅行に行くので', '引っこしのあいだ', '出張に行くので', 'おばあちゃんの家に行くので', '家のリフォームのあいだ', '入院することになって'];
const REASONS_ZOO = ['動物園の工事のあいだ', 'おりのそうじをするので', '新しい展示の準備のあいだ', '動物のおひっこしのとちゅうで'];
const REASONS_KEEPER = ['旅行に行くので', '出張に行くので', '引っこしのあいだ', '研究の旅に出るので'];

/* 見送りのときのひとこと (いちばん大きな理由で選ぶ) */
const REVIEW_LINES = {
  great: ['すっかり元気いっぱい! また絶対おねがいします!', 'こんなにうれしそうな顔、はじめて見ました!', 'お部屋もえさも完ぺきでした。友だちにも教えます!'],
  good: ['楽しくすごせたみたいです。ありがとう!', 'のんびりできたみたい。また来ますね。'],
  room: ['お部屋が合わなかったみたいで、元気がなくて…', 'この子の生まれた場所に近いお部屋だとよかったな。'],
  hungry: ['おなかをすかせていたみたいです…', 'ちゃんとごはんをもらえていたのかな…'],
  lonely: ['ちょっとさみしかったみたい。もっとかまってほしかったな。'],
  scary: ['同じ部屋にこわい動物がいて、ふるえていました…'],
  crowd: ['お部屋がぎゅうぎゅうで、きゅうくつそうでした。'],
  fav: ['好きな家具があれば、もっとくつろげたかも。'],
};

/* 目標。上から順番に1つずつ */
const MISSIONS = [
  { id: 'call', text: '鳴っている電話に出て、ペットをあずかろう', reward: 300 },
  { id: 'checkin', text: '受付に来たお客さんと話して、ペットを部屋に案内しよう', reward: 0 },
  { id: 'feed', text: 'ペットに合ったえさをあげよう (近くで「えさ」)', reward: 200 },
  { id: 'pet', text: 'ペットをなでてあげよう', reward: 0 },
  { id: 'checkout', text: 'むかえに来た飼い主さんにペットを返そう', reward: 500 },
  { id: 'furn', text: 'もようがえで、部屋に家具をおこう', reward: 200 },
  { id: 'jungle', text: '熱帯雨林の部屋をつくろう', reward: 500 },
  { id: 'jungleGuest', text: '熱帯雨林の動物をあずかろう', reward: 500 },
  { id: 'resize', text: '部屋のかべをドラッグして、大きさを変えてみよう', reward: 300 },
  { id: 'savanna', text: 'サバンナの部屋をつくろう', reward: 800 },
  { id: 'five', text: '5ひきを同時にあずかろう', reward: 1000 },
  { id: 'floor2', text: '2階をつくろう', reward: 1000 },
  { id: 'star3', text: '評判を ★3 にしよう', reward: 1500 },
  { id: 'all', text: '5つの生息地の部屋を全部つくろう', reward: 3000 },
  { id: 'star5', text: '評判を ★5 にしよう', reward: 5000 },
];
