/* =========================================================================
   CELLHOUSE ― 定義データ
   床・壁・扉・設備・部屋・職員・研究・補助金・日課・囚人の素性
   ========================================================================= */
'use strict';

const TILE = 32;
const MAP_W = 96, MAP_H = 68;
const ROAD_Y = MAP_H - 3;        /* 車道は ROAD_Y と ROAD_Y+1 の2車線 */
const WALK_Y = ROAD_Y - 1;       /* 歩道。ここから下は塀の外あつかい */
const HOUR_SEC = 60;             /* ゲーム内 1 時間 = 等速で 60 秒 */
const GRID_POWER = 20;           /* 電力会社から引いている分 */

/* ------------------------------- 床 ------------------------------- */
const FLOORS = [
  null,
  { key: 'concrete', name: 'コンクリート床', cost: 30,  indoor: true,  color: '#b3b0a7' },
  { key: 'tile',     name: '白タイル',       cost: 60,  indoor: true,  color: '#dde3e4' },
  { key: 'wood',     name: '板張り',         cost: 80,  indoor: true,  color: '#b5844f' },
  { key: 'carpet',   name: 'じゅうたん',     cost: 90,  indoor: true,  color: '#5d6a8f' },
  { key: 'paving',   name: '屋外の舗装',     cost: 20,  indoor: false, color: '#a29d92' },
];

/* ------------------------------- 壁 ------------------------------- */
const WALLS = [
  null,
  { key: 'brick',    name: 'れんが壁',       cost: 150, hp: 100, see: false, color: '#8b4a3a', top: '#b0634c' },
  { key: 'concrete', name: 'コンクリート壁', cost: 300, hp: 250, see: false, color: '#6f757c', top: '#a3a9ae' },
  { key: 'fence',    name: 'フェンス',       cost: 50,  hp: 60,  see: true,  color: '#8d949b', top: '#c4cad0' },
];

/* ------------------------------- 扉 ------------------------------- */
/* who: all=だれでも / staff=職員だけ / jail=施錠時間は囚人を通さない */
const DOORS = [
  null,
  { key: 'door',  name: 'ふつうの扉', cost: 400, who: 'all',   hp: 80,  color: '#b8864a',
    desc: 'だれでも通れる。囚人の区画の中で使う。' },
  { key: 'staff', name: '職員用扉',   cost: 700, who: 'staff', hp: 160, color: '#3d6fa6',
    desc: '職員と護送中の囚人だけが通れる。外周や厨房の出入口に。' },
  { key: 'jail',  name: '監房扉',     cost: 900, who: 'jail',  hp: 200, color: '#8f979f',
    desc: '睡眠と施錠の時間は閉まり、囚人は自分の房に入る以外は通れない。' },
];

/* ------------------------------- 設備 ------------------------------- */
/* use: on=その上に乗って使う / front=正面のマスで使う / sides=両脇に座る / ends=両端に立つ
   spots: on のとき使えるマス (first=先頭だけ / all=全部) */
const OBJ_CATS = [
  { id: 'cell',   name: '監房' },
  { id: 'food',   name: '食事' },
  { id: 'care',   name: '衛生・医療' },
  { id: 'office', name: '事務・警備' },
  { id: 'fun',    name: '娯楽' },
  { id: 'work',   name: '作業・教育' },
  { id: 'infra',  name: '設備・屋外' },
];

const OBJECTS = {
  bed:        { name: 'ベッド',       cat: 'cell',   w: 1, h: 2, cost: 200,  solid: true,  use: 'on', spots: 'first', desc: '房に1台。眠る場所。' },
  toilet:     { name: 'トイレ',       cat: 'cell',   w: 1, h: 1, cost: 150,  solid: true,  use: 'on', desc: '房に1台。' },
  cooker:     { name: 'コンロ',       cat: 'food',   w: 1, h: 1, cost: 450,  solid: true,  use: 'front', power: 4, desc: '厨房。調理師がここで料理する。' },
  fridge:     { name: '冷蔵庫',       cat: 'food',   w: 1, h: 1, cost: 350,  solid: true,  use: 'front', power: 2, desc: '厨房に1台いる。' },
  sink:       { name: '流し台',       cat: 'food',   w: 1, h: 1, cost: 120,  solid: true,  use: 'front', desc: '厨房に1台いる。' },
  serving:    { name: '配膳台',       cat: 'food',   w: 3, h: 1, cost: 300,  solid: true,  use: 'front', desc: '食堂。できた料理がここに並ぶ。' },
  table:      { name: '食卓',         cat: 'food',   w: 3, h: 1, cost: 250,  solid: true,  use: 'sides', desc: '食堂。両脇に6人座れる。上下のマスは空けておく。' },
  shower:     { name: 'シャワー',     cat: 'care',   w: 1, h: 1, cost: 200,  solid: true,  use: 'on', desc: '浴場。' },
  washer:     { name: '洗濯機',       cat: 'care',   w: 2, h: 1, cost: 600,  solid: true,  use: 'front', power: 3, desc: '洗濯室。作業に出た囚人が洗うと、全員の清潔が保たれやすくなる。' },
  medbed:     { name: '診察台',       cat: 'care',   w: 1, h: 2, cost: 700,  solid: true,  use: 'on', spots: 'first', desc: '医務室。けが人がここで休む。' },
  wardenDesk: { name: '所長の机',     cat: 'office', w: 2, h: 1, cost: 700,  solid: true,  use: 'front', desc: '所長室に1台。' },
  desk:       { name: '事務机',       cat: 'office', w: 2, h: 1, cost: 400,  solid: true,  use: 'front', desc: '事務室。幹部1人につき1台。' },
  monitor:    { name: '監視卓',       cat: 'office', w: 2, h: 1, cost: 1000, solid: true,  use: 'front', power: 3, research: 'cctv', desc: '警備室。カメラの映像を集める。' },
  camera:     { name: '監視カメラ',   cat: 'office', w: 1, h: 1, cost: 300,  solid: false, use: 'none',  power: 1, research: 'cctv', desc: '周り7マスで起きたことに、看守がすぐ気づく。警備室が要る。' },
  detector:   { name: '金属探知機',   cat: 'office', w: 1, h: 1, cost: 1200, solid: false, use: 'none',  power: 3, research: 'detector', desc: '通路に置く。上を通った囚人の工具・刃物・携帯電話を見つける。' },
  tv:         { name: 'テレビ',       cat: 'fun',    w: 1, h: 1, cost: 350,  solid: true,  use: 'none',  power: 1, desc: '近くのソファや長椅子で見ると楽しい。' },
  sofa:       { name: 'ソファ',       cat: 'fun',    w: 2, h: 1, cost: 180,  solid: true,  use: 'on', spots: 'all', desc: '座ってくつろぐ。' },
  bench:      { name: '長椅子',       cat: 'fun',    w: 2, h: 1, cost: 80,   solid: true,  use: 'on', spots: 'all', desc: '屋外にも置ける。' },
  weights:    { name: 'トレーニング台', cat: 'fun',  w: 2, h: 1, cost: 300,  solid: true,  use: 'on', spots: 'first', desc: '運動場に置くと体を動かせる。' },
  phone:      { name: '電話',         cat: 'fun',    w: 1, h: 1, cost: 250,  solid: true,  use: 'front', desc: '家族に電話できる。' },
  pingpong:   { name: '卓球台',       cat: 'fun',    w: 3, h: 2, cost: 600,  solid: true,  use: 'ends', desc: 'ふたりで遊ぶ。' },
  bookshelf:  { name: '本棚',         cat: 'fun',    w: 2, h: 1, cost: 250,  solid: true,  use: 'front', desc: '図書室。読むと気が晴れる。' },
  workbench:  { name: '作業台',       cat: 'work',   w: 2, h: 1, cost: 450,  solid: true,  use: 'front', research: 'labor', desc: '作業場。製品を組み立てる。' },
  press:      { name: '板金プレス',   cat: 'work',   w: 2, h: 2, cost: 1500, solid: true,  use: 'front', power: 6, research: 'labor', desc: '作業場。金属の看板を打ち出す。' },
  schoolDesk: { name: '学習机',       cat: 'work',   w: 1, h: 1, cost: 150,  solid: true,  use: 'on', research: 'education', desc: '教室。' },
  blackboard: { name: '黒板',         cat: 'work',   w: 2, h: 1, cost: 200,  solid: true,  use: 'front', research: 'education', desc: '教室。教師がここに立つ。' },
  visitTable: { name: '面会テーブル', cat: 'work',   w: 2, h: 1, cost: 300,  solid: true,  use: 'sides', research: 'visits', desc: '面会室。仕切りの両側に囚人と家族が座る。' },
  generator:  { name: '発電機',       cat: 'infra',  w: 3, h: 2, cost: 2500, solid: true,  use: 'none', supply: 60, desc: '電力を60増やす。' },
  plant:      { name: '観葉植物',     cat: 'infra',  w: 1, h: 1, cost: 50,   solid: true,  use: 'none', desc: 'まわりが少し快適になる。' },
  tree:       { name: '木',           cat: 'infra',  w: 1, h: 1, cost: 40,   solid: true,  use: 'none', desc: '外に植える。' },
};

/* ------------------------------- 部屋 ------------------------------- */
/* req: 必要な設備 { key: 台数 } / enclosed: 壁と扉で閉じている / indoor: 屋内の床 */
const ROOMS = {
  cell:       { name: '独房',       color: '#c98f5a', req: { bed: 1, toilet: 1 }, enclosed: true,  indoor: true, minTiles: 4, desc: '囚人1人の部屋。ベッドとトイレ。' },
  dorm:       { name: '雑居房',     color: '#c9a45a', req: { bed: 2, toilet: 1 }, enclosed: true,  indoor: true, desc: 'ベッドの数だけ入る相部屋。独房より安いが、ケンカが起きやすい。' },
  holding:    { name: '仮監房',     color: '#b0795a', req: {}, enclosed: true,  indoor: true, desc: '房が空くまでの待機所。2マスに1人。寝心地は悪い。' },
  solitary:   { name: '懲罰房',     color: '#8a5a6a', req: {}, enclosed: true,  indoor: true, maxTiles: 9, desc: '騒ぎを起こした囚人を閉じこめる。9マスまで。' },
  canteen:    { name: '食堂',       color: '#d9b04a', req: { serving: 1, table: 1 }, indoor: true, desc: '配膳台と食卓。' },
  kitchen:    { name: '厨房',       color: '#e0cf7a', req: { cooker: 1, fridge: 1, sink: 1 }, indoor: true, desc: 'コンロ・冷蔵庫・流し台。' },
  shower:     { name: '浴場',       color: '#6aaed0', req: { shower: 1 }, indoor: true, desc: 'シャワーを並べる。' },
  yard:       { name: '運動場',     color: '#7fb05a', req: {}, indoor: false, desc: '外でもいい。広いほど自由を感じる。' },
  common:     { name: '娯楽室',     color: '#b07ac0', req: {}, indoor: true, desc: 'テレビ・ソファ・卓球台などを置く。' },
  infirmary:  { name: '医務室',     color: '#8fd0b0', req: { medbed: 1 }, indoor: true, desc: '診察台。医師がここにいる。' },
  office:     { name: '所長室',     color: '#7a8ab0', req: { wardenDesk: 1 }, indoor: true, desc: '所長の机。所長を雇うのに要る。' },
  admin:      { name: '事務室',     color: '#8a9ac0', req: { desk: 1 }, indoor: true, desc: '幹部が座る事務机。' },
  security:   { name: '警備室',     color: '#5a7ab0', req: { monitor: 1 }, indoor: true, research: 'cctv', desc: '監視卓。これがあるとカメラが働く。' },
  workshop:   { name: '作業場',     color: '#b0805a', req: { workbench: 1, press: 1 }, indoor: true, research: 'labor', desc: '刑務作業で製品をつくって売る。' },
  laundry:    { name: '洗濯室',     color: '#9ac0d0', req: { washer: 1 }, indoor: true, desc: '洗濯機。' },
  classroom:  { name: '教室',       color: '#a0c07a', req: { schoolDesk: 2, blackboard: 1 }, indoor: true, research: 'education', desc: '学習机と黒板。教師が教える。' },
  library:    { name: '図書室',     color: '#c0a07a', req: { bookshelf: 1 }, indoor: true, desc: '本棚。' },
  visit:      { name: '面会室',     color: '#d08a8a', req: { visitTable: 1 }, indoor: true, research: 'visits', desc: '家族との面会。持ちこみに注意。' },
  deliveries: { name: '搬入口',     color: '#9a9a9a', req: {}, indoor: false, desc: '資材の置き場。職員と囚人はここから入ってくる。道路の近くに。' },
};
const ROOM_KEYS = Object.keys(ROOMS);            /* zone 値は index+1 */
const HOME_ROOMS = ['cell', 'dorm', 'holding'];

/* ------------------------------- 職員 ------------------------------- */
const STAFF = {
  worker:     { name: '作業員',   wage: 150, color: '#e0a03a', desc: '建てる・壊す・直す。' },
  guard:      { name: '看守',     wage: 220, color: '#2f4f7f', desc: '見回り、ケンカの仲裁、懲罰房への連行、一斉捜索。' },
  cook:       { name: '調理師',   wage: 180, color: '#f2f2ee', desc: '厨房で料理して配膳台に運ぶ。' },
  doctor:     { name: '医師',     wage: 400, color: '#e8f0f0', desc: 'けが人を手当てする。' },
  janitor:    { name: '清掃員',   wage: 120, color: '#5a9a6a', research: 'janitor', desc: '汚れた床を掃除する。' },
  teacher:    { name: '教師',     wage: 300, color: '#7a6ab0', research: 'education', desc: '教室で授業をする。' },
  warden:     { name: '所長',     wage: 800, color: '#2a2a30', unique: true, needRoom: 'office', desc: '所長室の机に座る。幹部を雇えるようになり、方針の研究を進める。' },
  chief:      { name: '警備主任', wage: 500, color: '#3a3a5a', unique: true, admin: true, desc: '警備の研究。監視カメラ、金属探知機、機動装備。' },
  foreman:    { name: '作業長',   wage: 450, color: '#8a6a3a', unique: true, admin: true, desc: '施設の研究。清掃員、刑務作業。' },
  accountant: { name: '会計士',   wage: 450, color: '#4a6a5a', unique: true, admin: true, desc: 'お金の研究。融資、給与の見直し、補助の増額。' },
  psych:      { name: '心理士',   wage: 450, color: '#6a4a6a', unique: true, admin: true, desc: '心の研究。危険度の見える化、教育課程、面会制度。' },
};
const STAFF_ORDER = ['worker', 'guard', 'cook', 'doctor', 'janitor', 'teacher', 'warden', 'chief', 'foreman', 'accountant', 'psych'];

/* ------------------------------- 研究 ------------------------------- */
/* by: 研究する幹部 / hours: ゲーム内の時間 (机に座っている間だけ進む) */
const RESEARCH = [
  { id: 'deputies',  by: 'warden',     name: '幹部の登用',     cost: 500,  hours: 3,  desc: '警備主任・作業長・会計士・心理士を雇えるようになる。事務室の机が1人1台いる。' },
  { id: 'lockdown',  by: 'warden',     name: '非常施錠',       cost: 400,  hours: 4,  desc: 'ボタン1つで全部の扉を閉め、囚人を足止めできる。' },
  { id: 'maxsec',    by: 'warden',     name: '重警備の受け入れ', cost: 1500, hours: 8, req: ['deputies'], desc: '重警備の囚人を受け入れられる。1人あたりの支払いが大きい。' },
  { id: 'cctv',      by: 'chief',      name: '監視カメラ',     cost: 1500, hours: 6,  desc: '監視カメラ・監視卓・警備室。' },
  { id: 'detector',  by: 'chief',      name: '金属探知機',     cost: 2000, hours: 8,  req: ['cctv'], desc: '持ちこまれた金属を見つける。' },
  { id: 'patrol',    by: 'chief',      name: '巡回ルート',     cost: 800,  hours: 4,  desc: '看守が回る地点を自分で決められる。' },
  { id: 'riotgear',  by: 'chief',      name: '機動装備',       cost: 2500, hours: 10, req: ['patrol'], desc: '看守に盾を持たせる。取り押さえが速く、けがをしにくい。' },
  { id: 'police',    by: 'chief',      name: '機動隊との協定', cost: 1500, hours: 6,  desc: '機動隊を呼ぶ費用が半分になる。' },
  { id: 'janitor',   by: 'foreman',    name: '清掃員',         cost: 600,  hours: 3,  desc: '清掃員を雇える。' },
  { id: 'labor',     by: 'foreman',    name: '刑務作業',       cost: 1500, hours: 6,  desc: '作業台・板金プレス・作業場。つくった看板を売れる。' },
  { id: 'maint',     by: 'foreman',    name: '保守点検',       cost: 1000, hours: 6,  req: ['janitor'], desc: '作業員の修理と建築が速くなる。' },
  { id: 'loan',      by: 'accountant', name: '銀行融資',       cost: 0,    hours: 2,  desc: 'すぐに ¥30,000 を借りる。20日間、毎日 ¥1,800 ずつ返す。' },
  { id: 'payroll',   by: 'accountant', name: '給与の見直し',   cost: 800,  hours: 6,  desc: '職員の給料が1割下がる。' },
  { id: 'subsidy',   by: 'accountant', name: '補助の増額',     cost: 2000, hours: 10, req: ['payroll'], desc: '囚人1人あたりの支払いが15%増える。' },
  { id: 'danger',    by: 'psych',      name: '危険度の見える化', cost: 600, hours: 4, desc: '囚人の苛立ちと危険度が見えるようになる。' },
  { id: 'education', by: 'psych',      name: '教育課程',       cost: 1500, hours: 8,  desc: '教師・学習机・黒板・教室。修了すると再犯が減る。' },
  { id: 'visits',    by: 'psych',      name: '面会制度',       cost: 1000, hours: 5,  desc: '面会テーブルと面会室。家族に会えると落ちつく。' },
  { id: 'counsel',   by: 'psych',      name: 'カウンセリング', cost: 1200, hours: 6,  req: ['danger'], desc: '懲罰房にいる間の苛立ちが早く下がる。' },
];

/* ------------------------------- 日課 ------------------------------- */
const SCHED = {
  sleep:  { name: '睡眠', color: '#34406e' },
  lock:   { name: '施錠', color: '#5d4f80' },
  eat:    { name: '食事', color: '#d08a36' },
  shower: { name: '入浴', color: '#3a93c8' },
  yard:   { name: '運動', color: '#5a9e48' },
  free:   { name: '自由', color: '#8c949e' },
  work:   { name: '作業', color: '#a0583a' },
};
const SCHED_KEYS = Object.keys(SCHED);
const DEFAULT_SCHED = [
  'sleep', 'sleep', 'sleep', 'sleep', 'sleep', 'sleep',
  'shower', 'eat', 'work', 'work', 'work', 'work',
  'eat', 'work', 'work', 'work', 'yard', 'free',
  'eat', 'free', 'free', 'lock', 'sleep', 'sleep',
];

/* ------------------------------- 囚人 ------------------------------- */
const SEC = [
  { name: '軽警備', short: '軽', pay: 650,  color: '#4f9fb0', dark: '#3a7a88' },
  { name: '中警備', short: '中', pay: 950, color: '#d9a13a', dark: '#a8792a' },
  { name: '重警備', short: '重', pay: 1600, color: '#b8483e', dark: '#8a342c' },
];

const CRIMES = [
  ['万引き', '窃盗', '詐欺', '横領', '偽造', '賭博', '器物損壊', '無免許運転'],
  ['住居侵入', '恐喝', '密輸', '傷害', 'ひき逃げ', '闇金', '盗品売買'],
  ['強盗', '放火', '組織犯罪', '重傷害', '脱獄'],
];

const TRAITS = {
  volatile: { name: '短気',     desc: '苛立ちやすく、ケンカを起こしやすい。' },
  escapee:  { name: '脱走癖',   desc: 'すきあらば外を目指す。' },
  clever:   { name: '知恵者',   desc: '隠し物が見つかりにくく、穴を掘るのも速い。' },
  strong:   { name: '腕っぷし', desc: '殴る力が強く、取り押さえにくい。' },
  timid:    { name: '気弱',     desc: '自分からは手を出さないが、危ない場所を怖がる。' },
  model:    { name: '模範囚',   desc: 'めったに苛立たない。' },
  glutton:  { name: '大食い',   desc: 'すぐにお腹がすく。' },
  reader:   { name: '読書好き', desc: '本や授業でよく気が晴れる。' },
  family:   { name: '家族思い', desc: '家族と話せないとつらい。' },
  smuggler: { name: '顔が広い', desc: '面会で物を持ちこみやすい。' },
};
const TRAIT_KEYS = Object.keys(TRAITS);

/* 欲求。値が大きいほど満たされていない。 */
const NEEDS = {
  hunger:   { name: '空腹',   rate: 6.5 },
  sleep:    { name: '睡眠',   rate: 4.5 },
  bladder:  { name: 'トイレ', rate: 11 },
  hygiene:  { name: '清潔',   rate: 3.5 },
  exercise: { name: '運動',   rate: 3.5 },
  fun:      { name: '娯楽',   rate: 3 },
  family:   { name: '家族',   rate: 1.3 },
  freedom:  { name: '自由',   rate: 2.6 },
  comfort:  { name: '快適',   rate: 0 },
  safety:   { name: '安全',   rate: 0 },
};
const NEED_KEYS = Object.keys(NEEDS);

const CONTRABAND = {
  tool:  { name: '工具',     metal: true,  desc: '房の床に穴を掘れる。' },
  blade: { name: '刃物',     metal: true,  desc: 'ケンカのけがが重くなる。' },
  phone: { name: '携帯電話', metal: true,  desc: '家族と話せるが、脱走の手引きにもなる。' },
  cards: { name: '賭け札',   metal: false, desc: '気晴らしになるが、もめごとの種になる。' },
};

const FAMILY_NAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '前田', '藤田', '小川', '岡田', '後藤', '長谷川', '石井', '村上', '近藤', '坂本', '遠藤', '青木', '藤井', '西村', '福田', '太田', '三浦', '岡本', '松田', '中川', '中野', '原田', '小野', '田村', '竹内', '金子', '和田', '中山', '石田', '上田', '森田', '柴田', '酒井', '工藤', '横山', '宮崎', '宮本', '内田', '高木', '安藤', '谷口', '大野', '丸山', '今井', '河野', '藤原', '小島', '久保', '松井', '野口', '菊地', '千葉', '岩崎', '桜井', '木下', '野村'];
const GIVEN_NAMES = ['大輔', '健太', '翔', '拓也', '直樹', '亮', '剛', '誠', '浩二', '和也', '達也', '雄一', '隆', '修', '豊', '学', '勇気', '蓮', '悠斗', '陸', '颯太', '航', '樹', '湊', '大和', '智也', '賢治', '俊介', '洋平', '光太郎', '勝', '稔', '茂', '正人', '哲也', '昇', '義男', '健二', '秀樹', '誠司', '功', '進', '辰也', '亘', '慎吾', '幸平'];
const STAFF_GIVEN = ['美咲', '陽子', '由美', '真理子', '恵', '彩', '優子', '奈々', '千尋', '麻衣', '里奈', '智子', '瑞穂', '香織', '直美', '大輔', '健太', '拓也', '直樹', '誠', '和也', '隆', '修', '悠斗', '航', '智也', '俊介', '洋平', '哲也', '慎吾'];

const SKIN = ['#f1c9a5', '#e4b48c', '#d6a27a', '#c58c62', '#a8714a', '#8a5a3a', '#f5d6b8'];
const HAIR = ['#1e1a18', '#2e241e', '#3e2f24', '#5a4030', '#7a6a5a', '#9a9a9a', '#c8c0b0', '#6a3a22'];

/* ------------------------------- 補助金 ------------------------------- */
/* check(g) は { done, text } を返す。text は進みぐあい。 */
const GRANTS = [
  { id: 'open',    name: '開所の準備',   reward: 12000, desc: '独房か雑居房のベッドを6つそろえ、仮監房を1つつくる。',
    check: (g) => { const b = g.stat.homeBeds(); const h = g.world.countRooms('holding'); return { done: b >= 6 && h >= 1, text: `ベッド ${Math.min(b, 6)}/6・仮監房 ${Math.min(h, 1)}/1` }; } },
  { id: 'food',    name: '給食の開始',   reward: 8000,  desc: '使える厨房と食堂を1つずつ。',
    check: (g) => { const k = g.world.countRooms('kitchen'), c = g.world.countRooms('canteen'); return { done: k >= 1 && c >= 1, text: `厨房 ${Math.min(k, 1)}/1・食堂 ${Math.min(c, 1)}/1` }; } },
  { id: 'wall',    name: '外周の囲い',   reward: 10000, desc: '房から外へ、囚人が歩いて出られる道がない。',
    check: (g) => { const r = g.stat.perimeterClosed(); return { done: r === true, text: r === null ? '扉のある房がまだない' : r ? '閉じている' : '外へ抜ける道がある' }; } },
  { id: 'wash',    name: '身だしなみ',   reward: 5000,  desc: 'シャワーが4台以上ある浴場。',
    check: (g) => { const n = g.world.countObjsInRooms('shower', 'shower'); return { done: n >= 4, text: `シャワー ${Math.min(n, 4)}/4` }; } },
  { id: 'yard',    name: '外の空気',     reward: 4000,  desc: '40マス以上の運動場。',
    check: (g) => { const n = g.world.largestRoom('yard'); return { done: n >= 40, text: `${Math.min(n, 40)}/40 マス` }; } },
  { id: 'warden',  name: '所長の着任',   reward: 8000,  desc: '所長室をつくり、所長を雇う。',
    check: (g) => { const n = g.sim.staffCount('warden'); return { done: n >= 1, text: n ? '着任' : '未着任' }; } },
  { id: 'med',     name: '医務室の開設', reward: 6000,  desc: '医務室と医師1人。',
    check: (g) => { const r = g.world.countRooms('infirmary'), d = g.sim.staffCount('doctor'); return { done: r >= 1 && d >= 1, text: `医務室 ${Math.min(r, 1)}/1・医師 ${Math.min(d, 1)}/1` }; } },
  { id: 'twenty',  name: '収容20人',     reward: 12000, desc: '囚人20人を同時に収容する。',
    check: (g) => { const n = g.sim.prisonerCount(); return { done: n >= 20, text: `${Math.min(n, 20)}/20 人` }; } },
  { id: 'labor',   name: '刑務作業',     reward: 12000, desc: '作業場で看板を30枚つくる。',
    check: (g) => { const n = g.stat.goods; return { done: n >= 30, text: `${Math.min(n, 30)}/30 枚` }; } },
  { id: 'cctv',    name: '監視体制',     reward: 8000,  desc: '警備室と監視カメラ6台。',
    check: (g) => { const r = g.world.countRooms('security'), n = g.world.countObjs('camera'); return { done: r >= 1 && n >= 6, text: `警備室 ${Math.min(r, 1)}/1・カメラ ${Math.min(n, 6)}/6` }; } },
  { id: 'edu',     name: '学び直し',     reward: 15000, desc: '教育課程の修了者5人。',
    check: (g) => { const n = g.stat.graduates; return { done: n >= 5, text: `${Math.min(n, 5)}/5 人` }; } },
  { id: 'calm',    name: '平穏な一週間', reward: 20000, desc: '脱走も暴動もない日を7日つづける。',
    check: (g) => { const n = g.stat.calmDays; return { done: n >= 7, text: `${Math.min(n, 7)}/7 日` }; } },
  { id: 'fifty',   name: '収容50人',     reward: 30000, desc: '囚人50人を同時に収容する。',
    check: (g) => { const n = g.sim.prisonerCount(); return { done: n >= 50, text: `${Math.min(n, 50)}/50 人` }; } },
];

const START_MONEY = 50000;
const START_STAFF = { worker: 4, guard: 2, cook: 1 };
const POLICE_COST = 3000;
const FOOD_COST = [8, 14, 24];                   /* 1食の原価 (安い/ふつう/上等) */
const GOODS_PRICE = 45;                          /* 看板1枚 */
/* 電力が足りないときに先に電気を回す順 (小さいほど先) */
const POWER_PRIO = { fridge: 0, cooker: 0, monitor: 1, camera: 1, detector: 1, washer: 2, press: 3, tv: 4 };
