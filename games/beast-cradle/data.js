/* =========================================================================
   BEAST CRADLE ― 種族・わざ・餌・ランクのデータ
   数値の調整はほぼこのファイルだけで済むようにまとめてある。
   ========================================================================= */
'use strict';

/* 属性は三すくみ。剛は妙に強く、妙は迅に強く、迅は剛に強い。 */
const TYPES = {
  go:  { id: 'go',  name: '剛', yomi: 'ごう',   color: '#ef8a4c', beats: 'myo' },
  jin: { id: 'jin', name: '迅', yomi: 'じん',   color: '#4cb6f2', beats: 'go'  },
  myo: { id: 'myo', name: '妙', yomi: 'みょう', color: '#b477ea', beats: 'jin' },
};
const TYPE_ADV = 1.45;   /* 有利なときの倍率 */
const TYPE_DIS = 0.74;   /* 不利なときの倍率 */

/* 能力は4つだけ。育成メニューの4項目とそのまま対応している。 */
const STATS = [
  { id: 'power', name: 'ちから',   kanji: '力', color: '#ff8f5e', note: '打撃わざの重さ' },
  { id: 'speed', name: 'すばやさ', kanji: '速', color: '#45d6bd', note: '行動の速さ、かわす力、会心' },
  { id: 'vital', name: 'たいりょく', kanji: '体', color: '#7fd96a', note: '体力の最大値と、こらえる力' },
  { id: 'tech',  name: 'わざ',     kanji: '技', color: '#a98cff', note: '技わざの威力と当てやすさ' },
];
const STAT_IDS = STATS.map((s) => s.id);
const STAT_BY_ID = {};
STATS.forEach((s) => { STAT_BY_ID[s.id] = s; });

/* =========================================================================
   せいかく
   育ちかたの癖と、闘技場でのちいさな特技をひとつずつ持つ。
   ========================================================================= */
const PERSONALITIES = [
  { id: 'ganbari', name: 'がんばりや',   train: 1.08, fatigue: 1.12, mood: 0,
    note: '疲れても伸びを落としにくい。',           battle: 'HPが1/4を切ると与ダメージ +25%' },
  { id: 'abare',   name: 'あばれんぼう', train: 1.00, fatigue: 1.05, mood: -1, focus: 'power', focusMul: 1.3,
    note: '殴る練習がよく伸びる。',                 battle: '会心率 +10%' },
  { id: 'sincho',  name: 'しんちょう',   train: 1.00, fatigue: 0.94, mood: 0,  focus: 'tech',  focusMul: 1.3,
    note: '技の練習がよく伸びる。',                 battle: '受ける会心が半分。ガードがより硬い' },
  { id: 'kimagure',name: 'きまぐれ',     train: 1.02, fatigue: 1.00, mood: 1,  variance: 2.0,
    note: '伸びの当たり外れが大きい。',             battle: '与ダメージの振れ幅が大きい' },
  { id: 'namake',  name: 'なまけもの',   train: 0.93, fatigue: 1.32, mood: 2,
    note: '疲れやすいが、ごきげんは落ちにくい。',   battle: '気合の溜まりが 1.6 倍' },
  { id: 'sunao',   name: 'すなお',       train: 1.05, fatigue: 0.98, mood: 1,
    note: 'なんでも平均的に伸びる。',               battle: '状態異常が1ターン早く抜ける' },
  { id: 'tsuyogari',name:'つよがり',     train: 1.03, fatigue: 1.15, mood: -2, focus: 'speed', focusMul: 1.25,
    note: '走りこみがよく伸びる。ごきげんは荒れやすい。', battle: 'ひるまない。回避 +6%' },
  { id: 'oyabun',  name: 'おやぶん',     train: 1.00, fatigue: 1.00, mood: 0,  focus: 'vital', focusMul: 1.3,
    note: '体づくりがよく伸びる。',                 battle: '味方が倒れると仲間全員の攻撃 +12%' },
];
const PERSONALITY_BY_ID = {};
PERSONALITIES.forEach((p) => { PERSONALITY_BY_ID[p.id] = p; });

/* =========================================================================
   わざ
   kind: strike=ちから依存 / tech=わざ依存 / finish=必殺（気合100を使う）
   ========================================================================= */
const MOVE_LIST = [
  /* ---- 打撃 ---- */
  { id: 'taiatari',  name: 'たいあたり',     kind: 'strike', power: 26, acc: 96, type: null,
    text: '体ごとぶつかる。誰でもできる基本の一手。' },
  { id: 'kamituki',  name: 'かみつき',       kind: 'strike', power: 33, acc: 94, type: null,
    text: '牙で食らいつく。' },
  { id: 'zutuki',    name: 'ずつき',         kind: 'strike', power: 36, acc: 93, type: 'go',
    text: '頭から突っこむ。剛の一撃。' },
  { id: 'nagurituke',name: 'なぐりつけ',     kind: 'strike', power: 40, acc: 90, type: null,
    text: '腕を振りぬく。' },
  { id: 'renda',     name: 'れんだ',         kind: 'strike', power: 13, acc: 93, type: 'jin', hits: [2, 4],
    text: '2〜4回続けて打つ。かわされにくい。' },
  { id: 'tsunoduki', name: 'つのづき',       kind: 'strike', power: 44, acc: 88, type: 'go',
    text: '角を突きたてる。' },
  { id: 'kakato',    name: 'かかとおとし',   kind: 'strike', power: 37, acc: 87, type: null, defDown: 2,
    text: '相手の守りを2ターン崩す。' },
  { id: 'iainuki',   name: 'いあいぬき',     kind: 'strike', power: 31, acc: 95, type: 'jin', crit: 35,
    text: '抜き打ち。会心がとても出やすい。' },
  { id: 'tossin',    name: 'とっしん',       kind: 'strike', power: 48, acc: 86, type: 'go', recoil: 0.12,
    text: '全身でぶつかる。自分も少し傷つく。' },
  { id: 'jigoku',    name: 'じごくぐるま',   kind: 'strike', power: 62, acc: 72, type: null,
    text: '投げ落とす大技。当たれば重いが外れやすい。' },

  /* ---- 技 ---- */
  { id: 'hikaridama',name: 'ひかりだま',     kind: 'tech', power: 30, acc: 96, type: null,
    text: '光の玉をぶつける。外しにくい。' },
  { id: 'ishitubute',name: 'いしのつぶて',   kind: 'tech', power: 35, acc: 93, type: 'go',
    text: '石を巻きあげて飛ばす。' },
  { id: 'kazeyaiba', name: 'かぜのやいば',   kind: 'tech', power: 38, acc: 92, type: 'jin',
    text: '風を刃にして飛ばす。' },
  { id: 'katayaburi',name: 'かたやぶり',     kind: 'tech', power: 22, acc: 96, type: null, defDown: 3,
    text: '守りの型を3ターン崩す。' },
  { id: 'dokunokona',name: 'どくのこな',     kind: 'tech', power: 10, acc: 90, type: 'myo', status: 'doku',
    text: '毒の粉をまく。毎ターン削れる。' },
  { id: 'shibirekona',name:'しびれごな',     kind: 'tech', power: 0,  acc: 82, type: 'myo', status: 'shibire',
    text: 'しびれさせる。動けない番が出る。' },
  { id: 'kiaiotoshi',name: 'きあいおとし',   kind: 'tech', power: 16, acc: 88, type: null, status: 'sukumi',
    text: '気をくじく。相手の攻撃が下がる。' },
  { id: 'iyashinouta',name:'いやしのうた',   kind: 'tech', power: 0,  acc: 100, type: null, heal: 0.34, target: 'ally',
    text: '味方ひとりの体力を回復する。' },
  { id: 'midaregasumi',name:'みだれがすみ',  kind: 'tech', power: 0,  acc: 100, type: 'jin', self: 'evade',
    text: '姿をぼかす。3ターンかわしやすくなる。' },
  { id: 'tokinokane',name: 'ときのかね',     kind: 'tech', power: 12, acc: 90, type: 'myo', slowAll: true, all: true,
    text: '敵全体をおそくする。' },
  { id: 'kodamajin', name: 'こだまのじん',   kind: 'tech', power: 30, acc: 90, type: 'myo', all: true,
    text: '音を反射させて敵全体を打つ。' },
  { id: 'inazuma',   name: 'いなずま',       kind: 'tech', power: 50, acc: 84, type: 'jin',
    text: '雷を落とす。重いが少し外れる。' },

  /* ---- 必殺（気合100を使いきる） ---- */
  { id: 'bakuretsu', name: 'ばくれつごう',   kind: 'finish', stat: 'power', power: 94,  acc: 100, type: 'go',
    text: '溜めた力を一点に叩きこむ。' },
  { id: 'senkou',    name: 'せんこうづき',   kind: 'finish', stat: 'power', power: 86,  acc: 100, type: 'jin', crit: 40,
    text: '見えない速さで踏みこむ。会心が出やすい。' },
  { id: 'hikaritsubasa',name:'ひかりのつばさ',kind: 'finish', stat: 'tech', power: 98,  acc: 100, type: 'myo',
    text: '光の翼で薙ぎはらう。' },
  { id: 'geneiran',  name: 'げんえいらん',   kind: 'finish', stat: 'tech', power: 62,  acc: 100, type: 'myo', all: true,
    text: '幻を散らして敵全体を斬る。' },
  { id: 'daichi',    name: 'だいちのいかり', kind: 'finish', stat: 'power', power: 58,  acc: 100, type: 'go', all: true, selfDefDown: 2,
    text: '地面ごと揺らす。自分の守りも2ターン下がる。' },
  { id: 'konshin',   name: 'こんしんのいちげき', kind: 'finish', stat: 'power', power: 112, acc: 100, type: null, recoil: 0.18,
    text: '文字どおり渾身。自分も大きく傷つく。' },
];
const MOVES = {};
MOVE_LIST.forEach((m) => { MOVES[m.id] = m; });

/* 状態異常の表示と効果 */
const AILMENTS = {
  doku:    { name: 'どく',   icon: '☠', color: '#a86ce0', note: '毎ターン最大HPの8%が減る' },
  shibire: { name: 'しびれ', icon: '⚡', color: '#f0c419', note: '25%の確率で動けない。すばやさ -30%' },
  sukumi:  { name: 'すくみ', icon: '↓', color: '#7d8ba0', note: '与えるダメージ -25%' },
};

/* =========================================================================
   種族
   base   … 生まれたときの能力
   cap    … 才能100%のときの上限（個体の才能でさらに前後する）
   grow   … 育成の伸びやすさ
   unlock … このランクに上がると店に並ぶ
   ========================================================================= */
const SPECIES_LIST = [
  {
    id: 'mofumo', name: 'モフモ', type: 'go', unlock: 0, price: 0, plan: 'blob',
    lead: 'まるい毛玉に短い足。おっとりしていて、打たれ強い。',
    base: { power: 32, speed: 24, vital: 44, tech: 28 },
    cap:  { power: 158, speed: 126, vital: 232, tech: 148 },
    grow: { power: 1.00, speed: 0.82, vital: 1.32, tech: 0.92 },
    start: ['taiatari', 'hikaridama'],
    learn: ['zutuki', 'nagurituke', 'kakato', 'ishitubute', 'iyashinouta', 'katayaburi', 'jigoku', 'bakuretsu'],
    art: { main: '#f2d7a6', dark: '#cfae79', light: '#fff2d8', belly: '#fff7ea', eye: '#3a2a1c' },
  },
  {
    id: 'kagizume', name: 'カギヅメ', type: 'jin', unlock: 0, price: 150, plan: 'cat',
    lead: '鉤づめの四足獣。とにかく速く、先手をとる。',
    base: { power: 34, speed: 44, vital: 30, tech: 28 },
    cap:  { power: 168, speed: 226, vital: 138, tech: 146 },
    grow: { power: 1.02, speed: 1.34, vital: 0.84, tech: 0.92 },
    start: ['kamituki', 'kazeyaiba'],
    learn: ['renda', 'iainuki', 'nagurituke', 'midaregasumi', 'kakato', 'inazuma', 'senkou'],
    art: { main: '#8fa6c9', dark: '#5d7396', light: '#c3d3e8', belly: '#eef3fa', eye: '#f7d24a' },
  },
  {
    id: 'tsunosuke', name: 'ツノスケ', type: 'go', unlock: 0, price: 160, plan: 'goat',
    lead: '一本角の山羊。踏みこみが重く、正面からの押しが強い。',
    base: { power: 46, speed: 30, vital: 36, tech: 24 },
    cap:  { power: 232, speed: 142, vital: 176, tech: 122 },
    grow: { power: 1.34, speed: 0.96, vital: 1.06, tech: 0.78 },
    start: ['zutuki', 'ishitubute'],
    learn: ['tsunoduki', 'nagurituke', 'tossin', 'kakato', 'jigoku', 'katayaburi', 'bakuretsu', 'daichi'],
    art: { main: '#e0e4ea', dark: '#b3b9c4', light: '#ffffff', belly: '#f6f8fb', eye: '#c8663c' },
  },
  {
    id: 'hanebi', name: 'ハネビ', type: 'myo', unlock: 1, price: 240, plan: 'bird',
    lead: '燃える羽をもつ小鳥。技の冴えは随一だが、打たれ弱い。',
    base: { power: 26, speed: 38, vital: 26, tech: 48 },
    cap:  { power: 126, speed: 190, vital: 122, tech: 238 },
    grow: { power: 0.80, speed: 1.16, vital: 0.78, tech: 1.38 },
    start: ['taiatari', 'hikaridama'],
    learn: ['kazeyaiba', 'inazuma', 'kodamajin', 'midaregasumi', 'iainuki', 'katayaburi', 'hikaritsubasa', 'geneiran'],
    art: { main: '#f2793f', dark: '#c0491f', light: '#ffc46b', belly: '#ffe7bd', eye: '#fff4d0' },
  },
  {
    id: 'hirenaga', name: 'ヒレナガ', type: 'myo', unlock: 1, price: 250, plan: 'fish',
    lead: '長いひれを引いて宙を泳ぐ。搦め手を得意とする。',
    base: { power: 28, speed: 40, vital: 32, tech: 44 },
    cap:  { power: 132, speed: 198, vital: 152, tech: 216 },
    grow: { power: 0.84, speed: 1.20, vital: 0.94, tech: 1.28 },
    start: ['taiatari', 'kazeyaiba'],
    learn: ['dokunokona', 'shibirekona', 'tokinokane', 'iyashinouta', 'kodamajin', 'midaregasumi', 'inazuma', 'geneiran'],
    art: { main: '#4fbfd8', dark: '#2b7f96', light: '#9fe6f2', belly: '#e6fbff', eye: '#20323c' },
  },
  {
    id: 'iwagon', name: 'イワゴン', type: 'go', unlock: 2, price: 340, plan: 'shell',
    lead: '岩の甲羅を背負う四足。とにかく落ちない。',
    base: { power: 40, speed: 18, vital: 56, tech: 26 },
    cap:  { power: 196, speed: 96, vital: 286, tech: 130 },
    grow: { power: 1.16, speed: 0.62, vital: 1.46, tech: 0.84 },
    start: ['zutuki', 'ishitubute'],
    learn: ['tsunoduki', 'tossin', 'jigoku', 'kakato', 'katayaburi', 'iyashinouta', 'daichi', 'bakuretsu'],
    art: { main: '#8c8577', dark: '#5f5a50', light: '#bdb5a4', belly: '#d9d2c2', eye: '#f0a63c' },
  },
  {
    id: 'kageroh', name: 'カゲロウ', type: 'jin', unlock: 2, price: 360, plan: 'wisp',
    lead: '影そのもののような細身。速さと会心だけで戦う。',
    base: { power: 34, speed: 52, vital: 24, tech: 34 },
    cap:  { power: 172, speed: 258, vital: 116, tech: 168 },
    grow: { power: 1.04, speed: 1.48, vital: 0.72, tech: 1.02 },
    start: ['kamituki', 'midaregasumi'],
    learn: ['iainuki', 'renda', 'kazeyaiba', 'kiaiotoshi', 'kakato', 'inazuma', 'senkou', 'geneiran'],
    art: { main: '#4a4666', dark: '#26243a', light: '#7d76a8', belly: '#5d5880', eye: '#6ff0d0' },
  },
  {
    id: 'kinokobo', name: 'キノコ坊', type: 'myo', unlock: 3, price: 450, plan: 'cap',
    lead: '傘をかぶった小さな体。粉をまいて相手を崩す。',
    base: { power: 30, speed: 30, vital: 40, tech: 42 },
    cap:  { power: 146, speed: 152, vital: 198, tech: 222 },
    grow: { power: 0.90, speed: 0.94, vital: 1.18, tech: 1.32 },
    start: ['taiatari', 'dokunokona'],
    learn: ['shibirekona', 'kiaiotoshi', 'tokinokane', 'iyashinouta', 'kodamajin', 'katayaburi', 'geneiran', 'hikaritsubasa'],
    art: { main: '#d95f6a', dark: '#9c3946', light: '#f59aa2', belly: '#f7ead2', eye: '#3b2530' },
  },
  {
    id: 'ohgami', name: 'オウガミ', type: 'jin', unlock: 4, price: 660, plan: 'wolf',
    lead: '大狼。速さも力も高い水準でそろう。',
    base: { power: 48, speed: 46, vital: 42, tech: 34 },
    cap:  { power: 226, speed: 224, vital: 196, tech: 164 },
    grow: { power: 1.28, speed: 1.28, vital: 1.10, tech: 0.98 },
    start: ['kamituki', 'kazeyaiba'],
    learn: ['renda', 'iainuki', 'tossin', 'jigoku', 'kakato', 'inazuma', 'senkou', 'konshin'],
    art: { main: '#5a6b8c', dark: '#33405c', light: '#93a5c4', belly: '#dbe3f0', eye: '#f2e35a' },
  },
  {
    id: 'nushi', name: 'ヌシ', type: 'go', unlock: 5, price: 980, plan: 'dragon',
    lead: '沼の主と呼ばれる竜。何もかもが規格外。',
    base: { power: 52, speed: 40, vital: 54, tech: 46 },
    cap:  { power: 246, speed: 206, vital: 262, tech: 232 },
    grow: { power: 1.30, speed: 1.14, vital: 1.34, tech: 1.20 },
    start: ['zutuki', 'inazuma'],
    learn: ['tsunoduki', 'jigoku', 'tossin', 'kodamajin', 'katayaburi', 'iyashinouta', 'konshin', 'bakuretsu', 'hikaritsubasa'],
    art: { main: '#3f8f6a', dark: '#22553f', light: '#79c99b', belly: '#ddf2cf', eye: '#ffb03a' },
  },
];
const SPECIES = {};
SPECIES_LIST.forEach((s) => { SPECIES[s.id] = s; });

/* =========================================================================
   餌・走りこみ・殴る練習・技の練習
   week … かかる週。すべて1週。
   ========================================================================= */
const FOODS = [
  { id: 'hay',   name: '干し草',     cost: 0,  icon: '🌾',
    note: '一日のんびり食べさせる。休養がわりで、少し体もつく。',
    gain: { vital: 2 }, fatigue: -30, mood: 4, weight: 3 },
  { id: 'meat',  name: 'なま肉',     cost: 14, icon: '🍖',
    note: 'ちからと たいりょく が同時につく。ただしよく太る。',
    gain: { power: 4, vital: 5 }, fatigue: -12, mood: 3, weight: 5 },
  { id: 'nuts',  name: '木の実',     cost: 12, icon: '🌰',
    note: '大好物。ごきげんがぐっと上がる。',
    gain: { speed: 2, tech: 1, vital: 1 }, fatigue: -16, mood: 20, weight: 2 },
  { id: 'fish',  name: '川魚',       cost: 16, icon: '🐟',
    note: '頭が冴える。わざと体を少しずつ。',
    gain: { tech: 4, speed: 1, vital: 2 }, fatigue: -14, mood: 4, weight: 2 },
  { id: 'soup',  name: '特製スープ', cost: 40, icon: '🍲',
    note: '疲れもけがも一気に抜ける。値は張る。',
    gain: { power: 3, speed: 3, vital: 4, tech: 3 }, fatigue: -55, mood: 12, weight: 3, cure: true },
];

const RUN_MENU = [
  { id: 'river', name: '川べりを流す', icon: '🌊', note: '軽く走る。疲れにくい。',
    gain: { speed: 3 }, fatigue: 9,  mood: 2,  weight: -1 },
  { id: 'hill',  name: '坂道ダッシュ', icon: '⛰', note: '本気の走りこみ。',
    gain: { speed: 6, vital: 3 },     fatigue: 24, mood: -4, weight: -2 },
  { id: 'mount', name: '山ごもり',     icon: '🏔', note: '一週まるごと山。伸びるが荒れる。',
    gain: { speed: 11, vital: 5 },    fatigue: 44, mood: -14, weight: -3, injury: 0.10 },
];

const HIT_MENU = [
  { id: 'sandbag', name: 'サンドバッグ', icon: '🥊', note: '型どおりに打ちこむ。',
    gain: { power: 5 },              fatigue: 18, mood: -2, weight: -1, mastery: 8,  spark: 0.16, masteryKind: 'strike' },
  { id: 'rock',    name: '岩わり',       icon: '🪨', note: '拳を岩に叩きつける。けがに注意。',
    gain: { power: 9, vital: 3 },    fatigue: 34, mood: -8, weight: -1, injury: 0.13, mastery: 13, spark: 0.20, masteryKind: 'strike' },
  { id: 'spar',    name: '組手',         icon: '🤼', note: '仲間とぶつける。二匹とも伸び、絆が育つ。',
    gain: { power: 5, speed: 1, vital: 1 }, fatigue: 26, mood: 3, weight: -1, injury: 0.05, pair: true, mastery: 7, spark: 0.13, masteryKind: 'strike' },
];

const TECH_MENU = [
  { id: 'kata',   name: '型のけいこ', icon: '🎯', note: 'えらんだわざを繰りかえす。',
    gain: { tech: 5 },              fatigue: 17, mood: -2, weight: -1, mastery: 9,  spark: 0.18, masteryKind: 'tech' },
  { id: 'live',   name: '実戦形式',   icon: '⚔️', note: '動きながら撃つ。疲れるが効く。',
    gain: { tech: 8, speed: 2 },    fatigue: 32, mood: -6, weight: -2, mastery: 15, spark: 0.24, injury: 0.06, masteryKind: 'tech' },
  { id: 'medit',  name: 'めいそう',   icon: '🧘', note: '座って考える。ひらめきが降りてくる。',
    gain: { tech: 3 },              fatigue: -6, mood: 9,  weight: 1,  mastery: 6,  spark: 0.42, masteryKind: 'tech' },
];

/* =========================================================================
   ランクと相手
   昇格戦は3連戦。あいだで少しだけ回復する。
   ========================================================================= */
const RANKS = [
  { id: 'E', name: 'E級', title: '見習い', size: 3, lv: [12, 16], boss: [18, 22], pay: 42 },
  { id: 'D', name: 'D級', title: '駆けだし', size: 3, lv: [34, 40], boss: [44, 50], pay: 78 },
  { id: 'C', name: 'C級', title: '一人前', size: 4, lv: [60, 68], boss: [74, 82], pay: 130 },
  { id: 'B', name: 'B級', title: '手練れ', size: 5, lv: [76, 86], boss: [92, 100], pay: 205 },
  { id: 'A', name: 'A級', title: '猛者',   size: 5, lv: [98, 108], boss: [112, 122], pay: 310 },
  { id: 'S', name: 'S級', title: '王者',   size: 5, lv: [112, 122], boss: [128, 138], pay: 460 },
];

/* 対戦相手の一座。roster は種族の並び順で、足りない分は pool から補う。 */
const FOE_TEAMS = [
  /* E級 */
  { rank: 0, master: 'わら帽子のトト',   team: 'なかよし牧場',   roster: ['mofumo', 'mofumo', 'kagizume'] },
  { rank: 0, master: '井戸端のミミ',     team: '井戸の子ら',     roster: ['kagizume', 'tsunosuke', 'mofumo'] },
  { rank: 0, master: '石工のガロ',       team: '石切り組',       roster: ['tsunosuke', 'tsunosuke', 'mofumo'], boss: true },
  /* D級 */
  { rank: 1, master: '風読みのセイ',     team: '風の一座',       roster: ['hanebi', 'kagizume', 'hirenaga'] },
  { rank: 1, master: '荷運びのドン',     team: '荷車衆',         roster: ['tsunosuke', 'mofumo', 'iwagon'] },
  { rank: 1, master: '沢のリン',         team: '沢のさざなみ',   roster: ['hirenaga', 'hanebi', 'kagizume'], boss: true },
  /* C級 */
  { rank: 2, master: '鍛冶のバン',       team: '槌の一党',       roster: ['iwagon', 'tsunosuke', 'mofumo', 'kagizume'] },
  { rank: 2, master: '毒師のクゥ',       team: '霧の薬売り',     roster: ['kinokobo', 'hirenaga', 'hanebi', 'kagizume'] },
  { rank: 2, master: '影踏みのシノ',     team: '影踏み衆',       roster: ['kageroh', 'kagizume', 'kageroh', 'hanebi'], boss: true },
  /* B級 */
  { rank: 3, master: '山主のゴウ',       team: '山主一門',       roster: ['iwagon', 'iwagon', 'tsunosuke', 'mofumo', 'kinokobo'] },
  { rank: 3, master: '唄うたいの姉妹',       team: '双子の楽団',     roster: ['hanebi', 'hanebi', 'hirenaga', 'kinokobo', 'kagizume'] },
  { rank: 3, master: '牙のリク',         team: '牙の群れ',       roster: ['ohgami', 'kageroh', 'kagizume', 'tsunosuke', 'hanebi'], boss: true },
  /* A級 */
  { rank: 4, master: '夜明けのアオ',     team: '暁の隊',         roster: ['ohgami', 'hanebi', 'kageroh', 'iwagon', 'hirenaga'] },
  { rank: 4, master: '無傷のハク',       team: '白の砦',         roster: ['iwagon', 'iwagon', 'mofumo', 'kinokobo', 'tsunosuke'] },
  { rank: 4, master: '雷紋のガイ',       team: '雷紋衆',         roster: ['ohgami', 'ohgami', 'kageroh', 'hanebi', 'kinokobo'], boss: true },
  /* S級 */
  { rank: 5, master: '沼守のウタ',       team: '沼守の社',       roster: ['nushi', 'kinokobo', 'iwagon', 'hirenaga', 'ohgami'] },
  { rank: 5, master: '天秤のレイ',       team: '天秤の館',       roster: ['nushi', 'ohgami', 'kageroh', 'hanebi', 'tsunosuke'] },
  { rank: 5, master: '先代の王 ジン',    team: '王の五体',       roster: ['nushi', 'ohgami', 'kageroh', 'iwagon', 'tsunosuke'], boss: true },
];

/* 練習試合の相手。ランクよりだいぶ弱い。 */
const SPAR_MASTERS = ['近所のヤン', '見物人のポポ', '道場やぶりのヒョウ', '旅の子リコ', '荷馬車のヌイ'];

/* 生まれてくる子につける名前の候補（自分で打ちなおせる） */
const NAME_POOL = [
  'クロ', 'シロ', 'モモ', 'ハナ', 'ソラ', 'カイ', 'テツ', 'ナギ', 'ルル', 'ボン',
  'トラ', 'ユキ', 'ゲン', 'ミオ', 'サブ', 'ノビ', 'コハク', 'アオ', 'キビ', 'ダイ',
];

/* 育成と加齢の定数 */
const TUNE = {
  ageYoung: 24,      /* この週までは伸び盛り */
  agePrime: 60,      /* ここまでが全盛 */
  ageMellow: 84,     /* ここを過ぎると老齢 */
  growYoung: 1.18,
  growPrime: 1.00,
  growMellow: 0.66,
  growOld: 0.30,
  fatigueSoft: 55,   /* これを超えると伸びが落ちはじめる */
  fatigueHard: 82,
  weightIdeal: 50,
  weightBand: 14,    /* この幅なら悪い影響なし */
  maxTeam: 5,        /* 闘技場に連れていける数 */
  maxStable: 8,      /* 牧舎に置ける数 */
  maxMoves: 6,
  startCoins: 120,
};
