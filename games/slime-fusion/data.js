/* =========================================================================
   SLIME FUSION ― データ
   色 (ぞくせい) / パーツ / わざ / とくせい / スライム 123 種 / ごうせいのきまり / とうばつの地図
   ========================================================================= */
'use strict';

/* ------------------------------ 色 (ぞくせい) ------------------------------ */
/* plain は「ただの いろ」。あいしょうが ない */
const COLORS = {
  plain:   { name: 'ただ',     c: '#9fe0b8', d: '#4f9c72' },
  fire:    { name: 'あか',     c: '#ff5a3c', d: '#a8261a' },
  water:   { name: 'あお',     c: '#3a9cff', d: '#1a4fa8' },
  grass:   { name: 'みどり',   c: '#46c34a', d: '#1d7424' },
  thunder: { name: 'きいろ',   c: '#ffd23a', d: '#b08410' },
  ice:     { name: 'しろ',     c: '#d6f4ff', d: '#6aa6c4' },
  earth:   { name: 'ちゃいろ', c: '#c08a4c', d: '#6e4520' },
  dark:    { name: 'くろ',     c: '#5a4d78', d: '#221a36' },
  light:   { name: 'ピンク',   c: '#ff8ad8', d: '#b23c8c' },
};
const ELEMS = ['fire', 'water', 'grass', 'thunder', 'ice', 'earth', 'dark', 'light'];

/* こうげきの色 → つよい あいての色 */
const STRONG = {
  fire: ['grass', 'ice'],
  water: ['fire', 'earth'],
  grass: ['water', 'earth'],
  thunder: ['water'],
  ice: ['grass'],
  earth: ['fire', 'thunder'],
  dark: ['light'],
  light: ['dark'],
};
function affinity(atk, def) {
  if (!atk || atk === 'plain' || !def || def === 'plain') return 1;
  if (STRONG[atk].includes(def)) return 2;
  if (STRONG[def] && STRONG[def].includes(atk) && atk !== def) return 0.5;
  if (atk === def) return 0.75;
  return 1;
}

/* ------------------------------ パーツ ------------------------------ */
/* cap(size) = その大きさで いくつまで つけられるか */
const PARTS = {
  horn:  { name: 'つの',     icon: '🦄', cap: (s) => (s >= 4 ? 3 : 2), stat: { atk: 0.06 }, info: 'こうげき アップ。わざ「つのつき」' },
  spike: { name: 'トゲ',     icon: '🌵', cap: (s) => 2 + s * 2, stat: { def: 0.03 }, info: 'ぼうぎょ アップ。わざ「トゲミサイル」。4こ いじょうで とくせい「トゲトゲ」' },
  wing:  { name: 'はね',     icon: '🕊️', cap: () => 2, stat: { spd: 0.08 }, info: 'すばやさ アップ。わざ「はばたきアタック」' },
  tail:  { name: 'しっぽ',   icon: '🦎', cap: () => 1, stat: { atk: 0.05, hp: 0.04 }, info: 'わざ「しっぽビンタ」。あいてが ひるむ ことが ある' },
  claw:  { name: 'ツメ',     icon: '🐾', cap: () => 2, stat: { atk: 0.05 }, info: 'わざ「れんぞくひっかき」。2かい こうげき' },
  ears:  { name: 'みみ',     icon: '👂', cap: () => 2, stat: { hp: 0.05 }, info: 'わざ「おうえんのうた」。なかま みんなを かいふく' },
  gem:   { name: 'ほうせき', icon: '💎', cap: (s) => 1 + Math.floor(s / 2), stat: { atk: 0.03, def: 0.03 }, info: 'わざ「ほうせきビーム」。いまの 色で うつ つよい ビーム' },
};
const PART_IDS = Object.keys(PARTS);

/* ------------------------------ わざ ------------------------------ */
/* el: 'color' は「いまの 色」で うつ。all: ぜんたい。cost: スライムパワー */
const MOVES = {
  tackle: { name: 'たいあたり', el: 'plain', pow: 40, cost: 0, contact: true, info: 'パワーを つかわない きほんの わざ' },
  color:  { name: 'いろわざ', el: 'color', pow: 55, cost: 1, info: 'いまの 色で こうげき。色を かえると わざも かわる' },
  horn:   { name: 'つのつき', el: 'plain', pow: 70, cost: 1, contact: true, crit: 0.25, info: 'きゅうしょに あたりやすい' },
  spike:  { name: 'トゲミサイル', el: 'plain', pow: 34, cost: 2, all: true, info: 'てき ぜんいんに トゲを とばす' },
  wing:   { name: 'はばたきアタック', el: 'plain', pow: 50, cost: 1, contact: true, selfSpd: true, info: 'うったあと すばやさが あがる' },
  tail:   { name: 'しっぽビンタ', el: 'plain', pow: 55, cost: 1, contact: true, flinch: 0.3, info: 'あいてが ひるんで うごけなく なる ことが ある' },
  claw:   { name: 'れんぞくひっかき', el: 'plain', pow: 30, cost: 1, contact: true, hits: 2, info: '2かい ひっかく' },
  ears:   { name: 'おうえんのうた', el: 'plain', pow: 0, cost: 2, heal: 0.22, info: 'なかま みんなの HP を かいふく' },
  gem:    { name: 'ほうせきビーム', el: 'color', pow: 82, cost: 2, info: 'いまの 色で うつ つよい ビーム' },
};
/* いろわざの なまえ。[よわい, つよい(3だんかい いじょう)] */
const COLOR_MOVE = {
  plain: ['ぷるぷるパンチ', 'ぷるぷるラッシュ'],
  fire: ['ひのこ', 'かえんだん'],
  water: ['みずでっぽう', 'アクアキャノン'],
  grass: ['はっぱカッター', 'リーフストーム'],
  thunder: ['でんげき', 'ギガボルト'],
  ice: ['こおりのいき', 'つららおとし'],
  earth: ['すなかけ', 'いわなだれ'],
  dark: ['やみのたま', 'シャドーボール'],
  light: ['ひかりのや', 'シャイニーレイ'],
};
/* ひっさつわざ。3だんかい いじょうの スライムが もつ */
const SIG_BY_EL = {
  fire: { name: 'ばくえんだん', pow: 115 },
  water: { name: 'だいつなみ', pow: 70, all: true },
  grass: { name: 'もりのいかり', pow: 105, drain: 0.3 },
  thunder: { name: 'かみなりおとし', pow: 120 },
  ice: { name: 'ブリザードブレス', pow: 68, all: true, slow: true },
  earth: { name: 'だいちのいかり', pow: 72, all: true },
  dark: { name: 'やみのうず', pow: 110, drain: 0.3 },
  light: { name: 'せいなるひかり', pow: 100, healAll: 0.12 },
  plain: { name: 'スライムプレス', pow: 110 },
};
const STATUS_TEXT = { flinch: 'ひるみ', slow: 'のろい', guard: 'ガード' };

/* ------------------------------ とくせい ------------------------------ */
const TRAITS = {
  sturdy:   { name: 'がんじょう', info: 'たおれる こうげきを 1かいだけ HP1で たえる' },
  regen:    { name: 'さいせい', info: 'まいターン HP が すこし もどる' },
  thorny:   { name: 'トゲトゲ', info: 'さわって こうげきしてきた あいてにも ダメージ' },
  rage:     { name: 'いかり', info: 'HP が 3ぶんの1 いかで こうげき 1.5ばい' },
  swift:    { name: 'すばやい', info: 'すばやさ 1.3ばい' },
  hard:     { name: 'かたい', info: 'ぼうぎょ 1.3ばい' },
  strong:   { name: 'ちからもち', info: 'こうげき 1.2ばい' },
  hoard:    { name: 'ためこみ', info: 'パワーを 2 ためた じょうたいで はじまる' },
  absorb:   { name: 'きゅうしゅう', info: 'あたえた ダメージの 4ぶんの1 かいふく' },
  chameleon:{ name: 'カメレオン', info: '色を かえると パワーが 1 たまる' },
  wobbly:   { name: 'ぷるぷる', info: '15% で こうげきを よける' },
  sticky:   { name: 'ねばねば', info: 'こうげきした あいてを のろく する' },
  lucky:    { name: 'ラッキー', info: 'きゅうしょに あたりやすい' },
  boss:     { name: 'おやぶん', info: 'なかま みんなの こうげき 1.1ばい' },
  grit:     { name: 'まけずぎらい', info: 'なかまが たおれると こうげき 1.5ばい' },
  brave:    { name: 'ゆうき', info: 'さいしょの ターンは かならず さきに うごく' },
  prism:    { name: 'プリズム', info: 'どの 色の わざも 1.2ばい' },
  big:      { name: 'きょだい', info: 'HP 1.4ばい' },
};

/* ------------------------------ スライム ------------------------------ */
/* el: 色 (1〜2こ)、tier: だんかい、grant: うまれたとき つけられるように なる パーツ */
const SPECIES = [];
const SP = {};
function addSp(o) {
  o.el = o.el || ['plain'];
  o.shape = o.shape || 'round';
  SPECIES.push(o); SP[o.id] = o;
  return o;
}
addSp({ id: 'plain', name: 'ただのスライム', tier: 0, trait: 'wobbly', grant: 'horn' });

const LINE = {
  fire:    { names: ['あかスライム', 'ひのこスライム', 'ほのおスライム', 'マグマスライム', 'フェニックススライム'], grants: ['horn', 'tail', 'spike', 'wing'], traits: ['strong', 'rage'] },
  water:   { names: ['あおスライム', 'しずくスライム', 'なみスライム', 'うずしおスライム', 'リヴァイアスライム'], grants: ['tail', 'ears', 'gem', 'wing'], traits: ['regen', 'wobbly'] },
  grass:   { names: ['みどりスライム', 'ふたばスライム', 'もりスライム', 'たいじゅスライム', 'せかいじゅスライム'], grants: ['spike', 'ears', 'horn', 'gem'], traits: ['regen', 'sticky'] },
  thunder: { names: ['きいろスライム', 'ぴりぴりスライム', 'いなずまスライム', 'らいうんスライム', 'らいじんスライム'], grants: ['horn', 'spike', 'wing', 'gem'], traits: ['swift', 'brave'] },
  ice:     { names: ['しろスライム', 'ゆきだまスライム', 'つららスライム', 'ひょうがスライム', 'ブリザードスライム'], grants: ['spike', 'horn', 'wing', 'gem'], traits: ['hard', 'sticky'] },
  earth:   { names: ['ちゃいろスライム', 'どろだんごスライム', 'ごつごつスライム', 'がんせきスライム', 'マウンテンスライム'], grants: ['claw', 'horn', 'spike', 'tail'], traits: ['hard', 'sturdy'] },
  dark:    { names: ['くろスライム', 'かげスライム', 'よぞらスライム', 'あんこくスライム', 'まおうスライム'], grants: ['horn', 'wing', 'claw', 'tail'], traits: ['absorb', 'lucky'] },
  light:   { names: ['ピンクスライム', 'きらりスライム', 'ひかりスライム', 'せいなるスライム', 'めがみスライム'], grants: ['wing', 'gem', 'ears', 'horn'], traits: ['boss', 'hoard'] },
};
const TIER_SHAPE = ['round', 'round', 'drop', 'round', 'tall', 'tall'];
for (const e of ELEMS) {
  const L = LINE[e];
  for (let t = 1; t <= 5; t++) {
    addSp({
      id: e + t, name: L.names[t - 1], el: [e], tier: t, line: e,
      shape: TIER_SHAPE[t], grant: t >= 2 ? L.grants[t - 2] : null,
      trait: t === 5 ? (e === 'fire' ? 'regen' : e === 'light' ? 'prism' : L.traits[0]) : L.traits[(t + 1) % 2],
      sig: t >= 3,
    });
  }
}

/* まざった色のスライム。[ふつう, つよい] */
const HYBRID_NAMES = {
  'fire+water': ['ゆげスライム', 'スチームスライム'],
  'fire+grass': ['たきびスライム', 'とうがらしスライム'],
  'fire+thunder': ['はなびスライム', 'ばくはつスライム'],
  'fire+ice': ['ゆきどけスライム', 'ひょうえんスライム'],
  'fire+earth': ['れんがスライム', 'かざんスライム'],
  'fire+dark': ['おにびスライム', 'ごくえんスライム'],
  'fire+light': ['ろうそくスライム', 'サンライトスライム'],
  'water+grass': ['かえるスライム', 'はすのはスライム'],
  'water+thunder': ['でんきうなぎスライム', 'らいうスライム'],
  'water+ice': ['かきごおりスライム', 'アイスバーグスライム'],
  'water+earth': ['どろみずスライム', 'かいがらスライム'],
  'water+dark': ['しんかいスライム', 'クラーケンスライム'],
  'water+light': ['シャボンスライム', 'にじしずくスライム'],
  'grass+thunder': ['ぴかキノコスライム', 'エレキツタスライム'],
  'grass+ice': ['しもばしらスライム', 'もみのきスライム'],
  'grass+earth': ['たけのこスライム', 'どんぐりスライム'],
  'grass+dark': ['どくキノコスライム', 'のろいのきスライム'],
  'grass+light': ['たんぽぽスライム', 'ほたるぐさスライム'],
  'thunder+ice': ['ひょうらいスライム', 'プラズマスライム'],
  'thunder+earth': ['じしゃくスライム', 'てっこうスライム'],
  'thunder+dark': ['くろくもスライム', 'くろいなずまスライム'],
  'thunder+light': ['ネオンスライム', 'スタースライム'],
  'ice+earth': ['とうどスライム', 'マンモススライム'],
  'ice+dark': ['ゆきおんなスライム', 'こおりのまじょスライム'],
  'ice+light': ['ゆきのけっしょうスライム', 'ダイヤスライム'],
  'earth+dark': ['どうくつスライム', 'ドクロスライム'],
  'earth+light': ['こがねスライム', 'オパールスライム'],
  'dark+light': ['たそがれスライム', 'エクリプススライム'],
};
const HYB_TRAITS = ['strong', 'regen', 'swift', 'hard', 'absorb', 'chameleon', 'lucky', 'sticky', 'rage', 'wobbly', 'grit', 'brave'];
let hi = 0;
for (const key in HYBRID_NAMES) {
  const [a, b] = key.split('+');
  const nm = HYBRID_NAMES[key];
  for (let k = 0; k < 2; k++) {
    addSp({
      id: `${a}_${b}_${k ? 'b' : 'a'}`, name: nm[k], el: [a, b], tier: k ? 4 : 2, hyb: key,
      shape: k ? 'tall' : 'drop', grant: k ? LINE[b].grants[1] : LINE[a].grants[0],
      trait: k ? 'chameleon' : HYB_TRAITS[hi % HYB_TRAITS.length], sig: !!k,
      sigName: k ? nm[1].replace('スライム', '') + 'バースト' : null,
    });
    hi++;
  }
}
function hybridId(a, b, strong) {
  const ia = ELEMS.indexOf(a), ib = ELEMS.indexOf(b);
  const [x, y] = ia < ib ? [a, b] : [b, a];
  return `${x}_${y}_${strong ? 'b' : 'a'}`;
}

/* とくべつな スライム。deco: かざり、hint: ずかんに でる ヒント */
const SPECIALS = [
  { id: 'mini', name: 'ミニスライム', tier: 1, trait: 'wobbly', deco: 'mini', hint: 'ただのスライム どうしの ルーレットで まれに' },
  { id: 'twin', name: 'ふたごスライム', tier: 2, trait: 'grit', deco: 'twin', hint: 'ただのスライム どうしの ルーレットで まれに' },
  { id: 'triple', name: 'みつごスライム', tier: 3, trait: 'grit', deco: 'triple', sig: true, hint: 'ふたごスライム ＋ ただのスライム' },
  { id: 'daiou', name: 'スライムだいおう', tier: 4, trait: 'boss', deco: 'crown', sig: true, hint: 'いちばん 大きい ただのスライム どうし' },
  { id: 'giant', name: 'ジャイアントスライム', tier: 4, trait: 'big', deco: 'giant', sig: true, hint: 'いちばん 大きい スライム どうし (ただのスライム いがい)' },
  { id: 'goldy', name: 'きんぴかスライム', el: ['earth', 'light'], tier: 4, trait: 'lucky', deco: 'gold', sig: true, hint: 'ルーレットで ごく まれに。または ちゃいろ・ピンク ＋ ほうせき' },
  { id: 'silvery', name: 'ぎんぴかスライム', el: ['ice', 'earth'], tier: 4, trait: 'hard', deco: 'silver', sig: true, hint: 'ルーレットで ごく まれに。または しろ・ちゃいろ ＋ ほうせき' },
  { id: 'dragon', name: 'スライムドラゴン', el: ['fire', 'dark'], tier: 5, trait: 'rage', deco: 'dragon', sig: true, hint: 'あか ＋ つの ＋ はね' },
  { id: 'devil', name: 'あくまスライム', el: ['dark', 'fire'], tier: 4, trait: 'absorb', deco: 'devil', sig: true, hint: 'くろ ＋ つの ＋ しっぽ' },
  { id: 'spirit', name: 'せいれいスライム', el: ['light', 'water'], tier: 4, trait: 'regen', deco: 'halo', sig: true, hint: 'ピンク ＋ はね ＋ ほうせき' },
  { id: 'ninja', name: 'にんじゃスライム', el: ['dark', 'grass'], tier: 4, trait: 'swift', deco: 'ninja', sig: true, hint: 'くろ ＋ ツメ ＋ みみ' },
  { id: 'knight', name: 'ゼリーナイト', el: ['earth', 'light'], tier: 4, trait: 'sturdy', deco: 'helm', sig: true, hint: 'つの ＋ ツメ ＋ トゲ (色は なんでも)' },
  { id: 'samurai', name: 'さむらいスライム', el: ['earth', 'fire'], tier: 4, trait: 'brave', deco: 'samurai', sig: true, hint: 'ちゃいろ ＋ つの ＋ ツメ' },
  { id: 'wizard', name: 'まほうつかいスライム', el: ['light', 'dark'], tier: 4, trait: 'prism', deco: 'wizard', sig: true, hint: 'ピンク ＋ くろ ＋ ほうせき' },
  { id: 'robo', name: 'ロボスライム', el: ['thunder', 'earth'], tier: 4, trait: 'hard', deco: 'robo', shape: 'square', sig: true, hint: 'きいろ ＋ ちゃいろ ＋ ほうせき' },
  { id: 'ghost', name: 'ゆうれいスライム', el: ['dark', 'ice'], tier: 4, trait: 'wobbly', deco: 'ghost', sig: true, hint: 'くろ ＋ しろ ＋ はね' },
  { id: 'space', name: 'うちゅうスライム', el: ['dark', 'light'], tier: 5, trait: 'prism', deco: 'space', sig: true, hint: 'くろ・ピンク・しろ・きいろ の 4色' },
  { id: 'stardust', name: 'ほしくずスライム', el: ['light', 'thunder'], tier: 4, trait: 'lucky', deco: 'stars', sig: true, hint: 'ピンク ＋ きいろ ＋ はね' },
  { id: 'time', name: 'タイムスライム', el: ['ice', 'thunder'], tier: 4, trait: 'swift', deco: 'clock', sig: true, hint: 'しろ ＋ きいろ ＋ ほうせき' },
  { id: 'princess', name: 'プリンセススライム', el: ['light', 'water'], tier: 4, trait: 'boss', deco: 'tiara', sig: true, hint: 'ピンク ＋ ほうせき ＋ みみ' },
  { id: 'cat', name: 'ねこスライム', tier: 3, trait: 'swift', deco: 'cat', sig: true, hint: 'みみ ＋ しっぽ ＋ ツメ' },
  { id: 'dog', name: 'いぬスライム', tier: 3, trait: 'brave', deco: 'dog', sig: true, hint: 'みみ ＋ しっぽ (ツメ なし)' },
  { id: 'rabbit', name: 'うさぎスライム', el: ['grass'], tier: 3, trait: 'swift', deco: 'rabbit', sig: true, hint: 'みどり ＋ みみ' },
  { id: 'bear', name: 'くまスライム', el: ['earth'], tier: 3, trait: 'strong', deco: 'bear', sig: true, hint: 'ちゃいろ ＋ みみ ＋ ツメ' },
  { id: 'rainbow', name: 'にじいろスライム', el: ELEMS.slice(), tier: 5, trait: 'prism', deco: 'rainbow', sig: true, hint: '8つの 色を ぜんぶ もった スライムを つくる' },
  { id: 'chaos', name: 'カオススライム', el: ['dark', 'light'], tier: 6, trait: 'chameleon', deco: 'chaos', sig: true, hint: 'スライムのおしろの ボスを たおす。または にじいろ ＋ あくま' },
];
for (const s of SPECIALS) addSp(Object.assign({ special: true, grant: null }, s));

/* ずかんに のせる ならび */
const DEX = SPECIES.map((s) => s.id);

/* ------------------------------ のうりょく ------------------------------ */
const EL_W = {
  plain: [1, 1, 1, 1], fire: [1, 1.3, 0.8, 1], water: [1.2, 1, 1, 0.9], grass: [1.3, 0.9, 1.1, 0.8],
  thunder: [0.9, 1.1, 0.8, 1.3], ice: [1, 1, 1.3, 0.8], earth: [1.2, 1, 1.3, 0.6], dark: [0.9, 1.3, 0.8, 1.1], light: [1.1, 1, 1, 1],
};
function speciesBase(sp) {
  const total = 100 + sp.tier * 42;
  const w = [0, 0, 0, 0];
  const els = sp.el.slice(0, 2);
  for (const e of els) EL_W[e].forEach((v, i) => (w[i] += v / els.length));
  const sum = w[0] + w[1] + w[2] + w[3];
  return { hp: (total * w[0]) / sum, atk: (total * w[1]) / sum, def: (total * w[2]) / sum, spd: (total * w[3]) / sum };
}

/* ------------------------------ ごうせいの ひみつレシピ ------------------------------ */
/* c: 2ひきの 色を あわせたもの、p: 2ひきに ついている パーツの しゅるい。上から じゅんに しらべる */
const RECIPES = [
  { id: 'chaos', test: (c, p, A, B) => (A.sp === 'rainbow' && B.sp === 'devil') || (A.sp === 'devil' && B.sp === 'rainbow') },
  { id: 'triple', test: (c, p, A, B) => (A.sp === 'twin' && B.sp === 'plain') || (A.sp === 'plain' && B.sp === 'twin') },
  { id: 'space', test: (c) => ['dark', 'light', 'ice', 'thunder'].every((e) => c.has(e)) },
  { id: 'dragon', test: (c, p) => c.has('fire') && p.has('horn') && p.has('wing') },
  { id: 'devil', test: (c, p) => c.has('dark') && p.has('horn') && p.has('tail') },
  { id: 'knight', test: (c, p) => p.has('horn') && p.has('claw') && p.has('spike') },
  { id: 'samurai', test: (c, p) => c.has('earth') && p.has('horn') && p.has('claw') },
  { id: 'bear', test: (c, p) => c.has('earth') && p.has('ears') && p.has('claw') },
  { id: 'ninja', test: (c, p) => c.has('dark') && p.has('claw') && p.has('ears') },
  { id: 'cat', test: (c, p) => p.has('ears') && p.has('tail') && p.has('claw') },
  { id: 'dog', test: (c, p) => p.has('ears') && p.has('tail') },
  { id: 'princess', test: (c, p) => c.has('light') && p.has('gem') && p.has('ears') },
  { id: 'wizard', test: (c, p) => c.has('light') && c.has('dark') && p.has('gem') },
  { id: 'spirit', test: (c, p) => c.has('light') && p.has('wing') && p.has('gem') },
  { id: 'stardust', test: (c, p) => c.has('light') && c.has('thunder') && p.has('wing') },
  { id: 'ghost', test: (c, p) => c.has('dark') && c.has('ice') && p.has('wing') },
  { id: 'time', test: (c, p) => c.has('ice') && c.has('thunder') && p.has('gem') },
  { id: 'robo', test: (c, p) => c.has('thunder') && c.has('earth') && p.has('gem') },
  { id: 'goldy', test: (c, p) => c.has('earth') && c.has('light') && p.has('gem') },
  { id: 'silvery', test: (c, p) => c.has('ice') && c.has('earth') && p.has('gem') },
  { id: 'rabbit', test: (c, p) => c.has('grass') && p.has('ears') },
];

/* ただのスライム どうしの ルーレット。w は 大きさ (あたりやすさ) */
const PLAIN_WHEEL = [
  { kind: 'grow', label: 'おおきくなる', w: 30, col: '#9fe0b8' },
  { kind: 'sp', sp: 'fire1', w: 7 }, { kind: 'sp', sp: 'water1', w: 7 }, { kind: 'sp', sp: 'grass1', w: 7 },
  { kind: 'sp', sp: 'thunder1', w: 7 }, { kind: 'sp', sp: 'ice1', w: 7 }, { kind: 'sp', sp: 'earth1', w: 7 },
  { kind: 'sp', sp: 'dark1', w: 6 }, { kind: 'sp', sp: 'light1', w: 6 },
  { kind: 'sp', sp: 'mini', w: 5 }, { kind: 'sp', sp: 'twin', w: 4 },
  { kind: 'sp', sp: 'goldy', w: 1.5 }, { kind: 'sp', sp: 'silvery', w: 1.5 },
];

/* ------------------------------ とうばつ ------------------------------ */
const AREAS = [
  { id: 'meadow', name: 'はじまりのそうげん', bg: ['#8fd7ff', '#5cbf5a'], lv: 1, pool: ['plain', 'plain', 'grass1', 'water1', 'fire1', 'mini'],
    boss: { sp: 'grass2', name: 'そうげんのぬし', lv: 5, size: 3, colors: ['grass'], parts: ['horn', 'spike', 'spike'] } },
  { id: 'volcano', name: 'ほのおのかざん', bg: ['#ffb27a', '#8a3a22'], lv: 7, pool: ['fire1', 'fire2', 'earth1', 'fire_earth_a', 'earth2', 'fire2'],
    boss: { sp: 'fire3', name: 'かざんのぬし', lv: 12, size: 3, colors: ['fire', 'earth'], parts: ['horn', 'horn', 'tail', 'spike', 'spike', 'spike'] } },
  { id: 'lake', name: 'しずかなみずうみ', bg: ['#a8e8ff', '#3a8ac4'], lv: 13, pool: ['water2', 'grass2', 'water_grass_a', 'water1', 'grass1', 'water_light_a'],
    boss: { sp: 'water3', name: 'みずうみのぬし', lv: 18, size: 4, colors: ['water', 'grass'], parts: ['tail', 'gem', 'spike', 'spike'] } },
  { id: 'tower', name: 'かみなりのとう', bg: ['#6a6aa8', '#3a3a5a'], lv: 19, pool: ['thunder2', 'thunder3', 'water_thunder_a', 'thunder_earth_a', 'fire_thunder_a', 'thunder_light_a'],
    boss: { sp: 'thunder4', name: 'とうの ぬし', lv: 24, size: 3, colors: ['thunder', 'water'], parts: ['horn', 'horn', 'wing', 'wing', 'spike', 'spike'] } },
  { id: 'snow', name: 'こおりのやま', bg: ['#e8f6ff', '#9ac4dc'], lv: 25, pool: ['ice2', 'ice3', 'water_ice_a', 'ice_earth_a', 'grass_ice_a', 'ice4'],
    boss: { sp: 'ice4', name: 'やまの ぬし', lv: 31, size: 4, colors: ['ice', 'water', 'earth'], parts: ['spike', 'spike', 'spike', 'spike', 'horn', 'wing', 'wing'] } },
  { id: 'cave', name: 'くらやみのどうくつ', bg: ['#3a3048', '#1a1420'], lv: 31, pool: ['dark2', 'dark3', 'earth3', 'earth_dark_a', 'grass_dark_a', 'dark4', 'ice_dark_a'],
    boss: { sp: 'earth_dark_b', name: 'どうくつの ぬし', lv: 38, size: 5, colors: ['dark', 'earth', 'fire'], parts: ['claw', 'claw', 'horn', 'horn', 'spike', 'spike', 'spike', 'spike'] } },
  { id: 'temple', name: 'ひかりのしんでん', bg: ['#fff0fa', '#e4b4dc'], lv: 37, pool: ['light2', 'light3', 'light4', 'water_light_b', 'thunder_light_b', 'grass_light_a', 'fire_light_b'],
    boss: { sp: 'light5', name: 'しんでんの ぬし', lv: 44, size: 5, colors: ['light', 'water', 'thunder', 'grass'], parts: ['wing', 'wing', 'gem', 'gem', 'ears', 'ears', 'horn'] } },
  { id: 'castle', name: 'スライムのおしろ', bg: ['#4a2a5a', '#1a0a24'], lv: 43, pool: ['dragon', 'devil', 'knight', 'wizard', 'fire5', 'dark5', 'ice_dark_b', 'fire_dark_b', 'robo'],
    boss: { sp: 'chaos', name: 'まおうじょうの あるじ', lv: 50, size: 5, colors: ELEMS.slice(), parts: ['horn', 'horn', 'wing', 'wing', 'tail', 'gem', 'gem', 'spike', 'spike', 'spike', 'spike'] } },
];
const STAGES_PER_AREA = 5;

/* くんれんじょうの きょうかん */
const COACHES = [
  { id: 'c1', name: 'みならい きょうかん', lv: 5, team: ['fire2', 'water2', 'grass2'] },
  { id: 'c2', name: 'ベテラン きょうかん', lv: 16, team: ['thunder3', 'ice3', 'earth3'] },
  { id: 'c3', name: 'たつじん きょうかん', lv: 30, team: ['fire_water_b', 'dark4', 'light4'] },
  { id: 'c4', name: 'でんせつの ししょう', lv: 46, team: ['dragon', 'rainbow', 'daiou'] },
];

/* ショップ */
const PRICE = { plain: 30, fruit: 150, seed: 220 };
const MAX_LV = 50;
const PARTY_MAX = 3;
const BOX_MAX = 40;
