/* =========================================================================
   SNOW HAUNT ― データ
   やしきの広さ / こわがらせ方 / しかけ / オバケ / おきゃくさん / できごと / もくひょう
   ========================================================================= */
'use strict';

/* やしきのマス。いりぐちと でぐちは 左はしの 2マスで、動かせない。 */
const MAP_W = 14, MAP_H = 10;
const CELL = { WALL: 0, FLOOR: 1, LOCK: 2 };
const ENTRANCE = { x: 0, y: 2 };
const EXIT = { x: 0, y: 7 };
/* やしきの 外。うけつけの カウンター と ならぶ れつ と でぐちの みち */
const OUT = { left: -2.9, lane: -1.15, exit: -0.45, deskY: ENTRANCE.y + 1.6, staff: -2.4 };
const BOOTH = { x0: -2.05, x1: -1.55, y0: OUT.deskY - 0.55, y1: OUT.deskY + 0.3 };
const PATIENCE = 30;
/* やしきの 下の ひろば。y が この はんいの マスに かざりや おみせを おく */
const PARK_Y0 = MAP_H, PARK_Y1 = MAP_H + 3, GATE_Y = MAP_H + 4.4;
const PARK_X0 = -3;
const RAIL_COST = 15;            // カウンターで まってくれる 秒
const NIGHT_LEN = 100;          // 夜の長さ (秒、はやさ 1 のとき)
const SPAWN_END = 0.78;         // 夜のこの割合までに おきゃくさんが 来おわる

/* やしきを ひろげる。cols は 使える列の数。 */
const EXPAND = [
  { cols: 8, cost: 0 },
  { cols: 11, cost: 1200, star: 2 },
  { cols: 14, cost: 3500, star: 3 },
];

/* こわがらせ方は 3しゅるい。おきゃくさんには にがてな ものが ある。 */
const KINDS = {
  bikkuri:  { name: 'びっくり', color: '#ff8a5a' },
  zokuzoku: { name: 'ぞくぞく', color: '#b48aff' },
  hiehie:   { name: 'ひえひえ', color: '#6ad0ff' },
};

/* しかけ。かべの マスに おく。
   power: 1回の こわさ / cd: つぎに うごくまでの 秒 / aura: ちかくに いるあいだ 1秒ごとに ふえる こわさ
   range: とどく きょり (マス) / star: おけるように なる ひょうばん */
const PROPS = {
  candle:     { name: 'ゆれる ろうそく', cost: 30, kind: 'zokuzoku', aura: 2.5, range: 1.6, star: 1, light: true,
                desc: 'まわりを ぼんやり てらす。ちかくの しかけと オバケが 2わり こわくなる。' },
  icicle:     { name: 'おちる つらら', cost: 60, kind: 'hiehie', power: 14, cd: 5, range: 1.3, star: 1,
                desc: 'あたまの うえから ひゅっと おちてくる。' },
  snowman:    { name: 'ふりむく ゆきだるま', cost: 100, kind: 'bikkuri', power: 18, cd: 6, range: 1.3, star: 1,
                desc: 'とおりすぎた とたんに ぐるっと ふりむく。' },
  portrait:   { name: 'めが うごく え', cost: 140, kind: 'zokuzoku', power: 12, cd: 4, range: 2.1, star: 2,
                desc: 'とおくからでも じーっと みている。' },
  mirror:     { name: 'こおりの かがみ', cost: 200, kind: 'zokuzoku', power: 22, cd: 7, range: 1.3, star: 2,
                desc: 'うつった じぶんの うしろに なにかが いる…。' },
  blizzard:   { name: 'ふぶきマシン', cost: 260, kind: 'hiehie', aura: 4, slow: 0.5, range: 1.9, star: 2,
                desc: 'つめたい かぜで おきゃくさんの あしが おそくなる。ほかの しかけに ながく ひっかかる。' },
  musicbox:   { name: 'ひとりでに なる オルゴール', cost: 340, kind: 'zokuzoku', aura: 6, range: 2.3, star: 3,
                desc: 'だれも いないのに しずかに なりだす。' },
  coffin:     { name: 'こおりの ひつぎ', cost: 450, kind: 'bikkuri', power: 38, cd: 12, range: 1.3, star: 3,
                desc: 'ふたが ばたんと あいて 手が でてくる。とても こわい。' },
  chandelier: { name: 'ゆれる シャンデリア', cost: 650, kind: 'bikkuri', power: 26, cd: 9, range: 2.3, star: 4, multi: true,
                desc: 'がしゃーんと ゆれて、ちかくの おきゃくさん みんなを おどかす。' },
};

/* オバケ。みんな ゆきの山頂に すむ ゆきオバケの なかま。
   stamina: ひとばんに おどかせる 回数 / wage: ひとばんの おきゅうりょう / hire: やとうときの おかね */
const GHOSTS = {
  yuki:   { name: 'ゆきオバケ', body: '#f6faff', line: '#8aa0c0', kind: 'bikkuri', power: 16, cd: 3.5, range: 2.0, stamina: 8,
            wage: 20, hire: 100, star: 1, desc: 'ゆきの山頂に すむ ふつうの オバケ。「ばあ!」が とくい。' },
  chibi:  { name: 'ちびオバケ', body: '#fbfdff', line: '#9ab0cc', kind: 'bikkuri', power: 9, cd: 1.8, range: 1.8, stamina: 13, scale: 0.72,
            wage: 15, hire: 80, star: 1, desc: 'ちいさくて よわいけど、なんども なんども おどかす。' },
  kori:   { name: 'こおりオバケ', body: '#d8f2ff', line: '#4a9ad0', kind: 'hiehie', power: 14, cd: 4, range: 2.0, stamina: 8, freeze: 1.2,
            wage: 30, hire: 220, star: 2, desc: 'ふれた おきゃくさんを すこしの あいだ こおらせて うごけなくする。' },
  yozora: { name: 'よぞらオバケ', body: '#3e3870', line: '#1e1a44', kind: 'zokuzoku', power: 20, cd: 5, range: 2.0, stamina: 7, hidden: true,
            wage: 40, hire: 360, star: 2, desc: 'よるの やみに とけこんで みえない。いきなり あらわれる。' },
  fubuki: { name: 'ふぶきオバケ', body: '#e6ecf4', line: '#7a8aa4', kind: 'hiehie', power: 13, cd: 5, range: 2.4, stamina: 8, multi: true,
            wage: 50, hire: 520, star: 3, desc: 'ふぶきを まきおこして、ちかくの おきゃくさん みんなを ひやす。' },
  oo:     { name: 'おおオバケ', body: '#f2f6ff', line: '#6a7a9a', kind: 'bikkuri', power: 40, cd: 9, range: 2.2, stamina: 6, scale: 1.45,
            wage: 70, hire: 820, star: 4, desc: 'からだが おおきくて、「ばあ!」の こえも とても おおきい。' },
  robo:   { name: 'ブリキロボ', robot: true, kind: 'bikkuri', power: 11, cd: 6, range: 2.0, stamina: 6, chase: 2.5, aura: 9,
            wage: 25, hire: 260, star: 2, desc: 'ガシャン ガシャンと おいかけてくる ブリキの ロボット。' },
  skull:  { name: 'ガイコツロボ', robot: true, kind: 'zokuzoku', power: 16, cd: 7, range: 2.2, stamina: 6, chase: 3.5, aura: 12,
            wage: 45, hire: 620, star: 3, desc: 'ほねの かたちの ロボット。カタカタ わらいながら どこまでも おいかける。' },
  mecha:  { name: 'メカゆきおとこ', robot: true, kind: 'hiehie', power: 24, cd: 8, range: 2.4, stamina: 5, chase: 4, aura: 15, scale: 1.25,
            wage: 80, hire: 1150, star: 4, desc: 'こおりの いきを はく おおきな ロボット。おいかけられると こごえそう。' },
  ousama: { name: 'おうさまオバケ', body: '#fffaf0', line: '#b08a3a', kind: 'zokuzoku', power: 24, cd: 5, range: 2.2, stamina: 10, boost: 0.3, crown: true,
            wage: 120, hire: 1500, star: 5, desc: 'オバケの おうさま。ちかくの オバケを 3わり こわくする。' },
};

/* オーナー (あなた) の かそう。ばあ! の こわさと しゅるいが かわる。 */
const COSTUMES = {
  none:     { name: 'ふだんぎ', kind: 'bikkuri', power: 8, cost: 0, star: 1, desc: 'いつもの エプロン。あまり こわくない。' },
  sheet:    { name: 'シーツおばけ', kind: 'zokuzoku', power: 13, cost: 0, star: 1, desc: 'しろい シーツを かぶっただけ。でも くらやみでは こわい。' },
  pumpkin:  { name: 'かぼちゃおばけ', kind: 'bikkuri', power: 15, cost: 120, star: 1, desc: 'ぎざぎざの くちの かぼちゃ。' },
  snowman:  { name: 'ゆきだるま', kind: 'hiehie', power: 15, cost: 150, star: 1, desc: 'つめたそうな ゆきだるまの きぐるみ。' },
  mummy:    { name: 'ミイラ', kind: 'bikkuri', power: 20, cost: 300, star: 2, desc: 'ほうたいで ぐるぐるまき。' },
  vampire:  { name: 'きゅうけつき', kind: 'zokuzoku', power: 22, cost: 450, star: 3, desc: 'まっくろな マントと するどい きば。' },
  skeleton: { name: 'がいこつ', kind: 'bikkuri', power: 26, cost: 650, star: 3, desc: 'くらやみに ほねだけが うかびあがる。' },
  queen:    { name: 'こおりの じょおう', kind: 'hiehie', power: 30, cost: 900, star: 4, desc: 'こおりの かんむりと ドレス。いちばん こわい かそう。' },
};

/* ひろばの かざりと おみせ。cute: かわいさ / shop: おきゃくさんが かえるときに かう ねだん / photo: しゃしんで ひょうばんが ふえる */
const DECOS = {
  lantern:  { name: 'ゆきどうろう', cost: 40, cute: 3, star: 1, desc: 'ゆきで つくった とうろう。ぽっと あかりが ともる。' },
  flower:   { name: 'ゆきの 花だん', cost: 60, cute: 4, star: 1, desc: 'ゆきの中に さく しろい 花。' },
  balloon:  { name: 'オバケふうせん', cost: 80, cute: 5, star: 1, desc: 'ゆきオバケの かたちの ふうせん。ふわふわ ゆれる。' },
  bench:    { name: 'ベンチ', cost: 70, cute: 3, star: 1, desc: 'ひとやすみ できる ベンチ。' },
  cocoa:    { name: 'ホットココアやさん', cost: 250, cute: 4, shop: 6, star: 1, desc: 'かえる おきゃくさんが あったかい ココアを かっていく。' },
  pumpkin:  { name: 'かぼちゃランタン', cost: 90, cute: 5, star: 2, desc: 'にっこり わらう かぼちゃの ランタン。' },
  lights:   { name: 'ほしの イルミツリー', cost: 150, cute: 8, star: 2, desc: 'いろとりどりに ひかる モミの木。' },
  photo:    { name: 'フォトスポット', cost: 300, cute: 6, photo: true, star: 2, desc: 'オバケの かおはめパネル。しゃしんが SNSで ひろまって ひょうばんが すこし あがる。' },
  candy:    { name: 'わたあめやさん', cost: 350, cute: 5, shop: 8, star: 2, desc: 'ふわふわの ゆきいろ わたあめ。' },
  statue:   { name: 'オバケの こおりぞう', cost: 220, cute: 10, star: 3, desc: 'こおりで つくった おおきな ゆきオバケ。' },
  carousel: { name: 'オバケ メリーゴーランド', cost: 900, cute: 12, shop: 15, star: 3, desc: 'オバケの うまが くるくる まわる。' },
  wheel:    { name: 'かんらんしゃ', cost: 1600, cute: 18, shop: 20, star: 4, desc: 'ゆきやまが みわたせる かんらんしゃ。' },
  station:  { name: 'コースターの のりば', cost: 500, cute: 6, ride: 12, star: 2, one: true, desc: 'ジェットコースターの のりば。ここから レールを ぐるっと 1しゅう つなげると コースターが はしる。' },
  skelpop:  { name: 'とびだす ガイコツ', cost: 180, cute: 1, scare: 3, star: 2, desc: 'コースターが とおると ガバッと とびだす。レールの となりに おこう。' },
  spider:   { name: 'おおグモ', cost: 240, cute: 1, scare: 4, star: 2, desc: 'コースターの うえから ぶらーんと おりてくる。レールの となりに おこう。' },
  ghostgate:{ name: 'オバケの トンネル', cost: 400, cute: 3, scare: 6, star: 3, desc: 'なかで ゆきオバケたちが まちぶせしている トンネル。レールの となりに おこう。' },
  school:   { name: 'オバケ 1日たいけん', cost: 800, cute: 8, stay: { fee: 25, chance: 0.3, minR: 3 }, star: 2, one: true, desc: 'おきゃくさんが 1日だけ オバケに なれる スクール。まんぞくした おきゃくさんが たいけんしていく。' },
  hotel:    { name: 'ホラーホテル', cost: 1400, cute: 10, stay: { fee: 45, chance: 0.35, minR: 4 }, star: 3, one: true, desc: 'ゆうれいが でる ホテル。とても まんぞくした おきゃくさんが とまっていく。' },
};

const GHOST_NAMES = ['ユキ', 'フユ', 'シロ', 'モチ', 'ワタ', 'ポコ', 'ミゾレ', 'アラレ', 'ツララ', 'コナ', 'フワリ', 'シズク', 'マシロ', 'ホワン', 'ヒョウ', 'ゆきみ', 'ふぶ', 'こおり'];

/* おきゃくさん。ネズミの冒険の せかいの どうぶつたち。 */
const GUESTS = {
  hamster:  { name: 'ハムスター', fur: '#f0b060', belly: '#fff4e0', ear: 'round', w: 5 },
  hamster2: { name: 'ハムスター', fur: '#c8c0b8', belly: '#ffffff', ear: 'round', w: 3 },
  rabbit:   { name: 'うさぎ', fur: '#f6f2ee', belly: '#ffffff', ear: 'long', w: 3 },
  squirrel: { name: 'リス', fur: '#c0703a', belly: '#f6dcb8', ear: 'tuft', tail: true, w: 3 },
  mouse:    { name: 'ねずみ', fur: '#a8a8b4', belly: '#e8e8ee', ear: 'big', w: 2 },
  penguin:  { name: 'ペンギン', fur: '#2e3450', belly: '#ffffff', ear: 'none', resist: 'hiehie', w: 2 },
};

/* こわがりさは 3だんかい。brave が 大きいほど こわがらない。 */
const MOODS = [
  { name: 'こわがり', brave: 0.65, w: 2 },
  { name: 'ふつう', brave: 1.0, w: 5 },
  { name: 'ゆうかん', brave: 1.45, w: 2.5 },
];

/* その夜の できごと。2日目から ときどき おきる。 */
const EVENTS = {
  fullmoon: { name: 'まんげつの よる', desc: 'オバケの こわさが 1.3ばいに なる。', ghostMul: 1.3 },
  storm:    { name: 'ふぶきの よる', desc: 'おきゃくさんは すくないけど、ひえひえの こわさが 1.5ばい。', guestMul: 0.7, kindMul: { hiehie: 1.5 } },
  tv:       { name: 'テレビの しゅざい', desc: 'レポーターが くる。こわがらせて まんぞくさせると、ひょうばんが ぐんと あがる。', reporter: true },
  school:   { name: 'えんそくの こどもたち', desc: 'こわがりな ちびっこが たくさん くる。こわがらせすぎに ちゅうい。', guestMul: 1.3, kids: 0.7 },
  brave:    { name: 'きもだめし たいかい', desc: 'ゆうかんな おきゃくさんばかり あつまる。', brave: true },
};

/* もくひょう。ひとつずつ じゅんばんに でてくる。 */
const MISSIONS = [
  { text: 'おばけやしきを ひらこう', hint: '「よるを はじめる」を おしたら、カウンターへ いって「うけつけ」ボタンで おかねを もらおう', reward: 100, check: (s) => s.stats.nights >= 1 },
  { text: 'さいこう (★5) の おきゃくさんを 5にん だそう', hint: 'あたまの うえの ★が 5こ ひかったまま でぐちに つけば さいこう', reward: 150, check: (s) => s.stats.great >= 5 },
  { text: 'オバケを 2にん やとおう', hint: 'したの「オバケ」から やとえる', reward: 150, check: (s) => s.ghosts.length >= 2 },
  { text: 'ひょうばんを ★2に しよう', hint: 'まんぞくした おきゃくさんが ふえると ★が ふえる', reward: 250, check: (s) => stars(s) >= 2 },
  { text: 'コンボ ×3 を だそう', hint: 'しかけと オバケを ちかくに まとめて おくと、つづけて おどかせて コンボに なる', reward: 300, check: (s) => s.stats.bestCombo >= 3 },
  { text: 'ひとばんで 15にん むかえよう', hint: '★を ふやすか、ねだんを さげると おきゃくさんが ふえる', reward: 350, check: (s) => s.stats.bestNight >= 15 },
  { text: 'やしきを ひろげよう', hint: 'したの「ひろげる」から', reward: 400, check: (s) => s.expand >= 1 },
  { text: 'ひょうばんを ★3に しよう', hint: 'どきどきメーターが いっぱいに ならないよう、こわい ものの あいだを あけよう', reward: 500, check: (s) => stars(s) >= 3 },
  { text: 'ひとばんで 1500コイン かせごう', hint: '★が ふえたら ねだんを あげてみよう', reward: 600, check: (s) => s.stats.bestIncome >= 1500 },
  { text: 'ひょうばんを ★4に しよう', hint: 'オバケを レベルアップさせると つよくなる', reward: 800, check: (s) => stars(s) >= 4 },
  { text: 'やしきを いちばん おおきく しよう', hint: 'したの「ひろげる」から', reward: 1000, check: (s) => s.expand >= 2 },
  { text: 'ひょうばん ★5の「ゆきやま いちの おばけやしき」に なろう', hint: 'おうさまオバケを やとえるように なる', reward: 2000, check: (s) => stars(s) >= 5 },
];

/* ひょうばん (0〜100) から ★の数 (1〜5) */
function stars(s) { return clamp(1 + Math.floor(s.rep / 20), 1, 5); }
/* ★に 見合う ねだん。これより 高いと 来る人が へり、まんぞくも へる。 */
function fairPrice(s) { return 20 + stars(s) * 20; }
/* おきゃくさんが ほしい たのしさ。★が ふえるほど きたいも 大きくなる。 */
function expectThrill(s) { return 45 + stars(s) * 15; }
/* たのしさから まんぞく (★1〜5) */
function rateThrill(th, expect) { const r = th / expect; return r < 0.35 ? 1 : r < 0.65 ? 2 : r < 1 ? 3 : r < 1.35 ? 4 : 5; }
/* ひろばの かわいさ。おきゃくさんが ふえて、ながく まってくれる */
function cuteness(s) { return s.deco.reduce((a, d) => a + DECOS[d.type].cute, 0) + Math.floor(s.rails.length / 4); }
function cuteMul(s) { return 1 + Math.min(0.6, cuteness(s) / 150); }
function patienceOf(s) { return PATIENCE + Math.min(15, cuteness(s) / 6); }
/* やとえる オバケの 数 */
function ghostCap(s) { return 2 + stars(s) * 2; }
