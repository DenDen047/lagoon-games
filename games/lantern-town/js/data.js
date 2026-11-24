// ゲームの数値と文章。調整はここだけで済むようにしてある。

export const HERO_CLASSES = {
  Knight: {
    name: 'ナイト', hp: 120, dmg: 12, speed: 6.4, guard: 0.9,
    show: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'],
    combo: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab'],
    skill: { id: 'bash', name: 'たてアタック', cd: 5 },
    desc: 'たてで まもるのが とくい。バランスが いい。',
  },
  Barbarian: {
    name: 'バーバリアン', hp: 150, dmg: 16, speed: 6.0, guard: 0.7,
    show: ['2H_Axe', 'Barbarian_Hat', 'Barbarian_Cape'],
    combo: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop'],
    skill: { id: 'spin', name: 'かいてんぎり', cd: 6 },
    desc: 'たいりょくと ちからが じまん。',
  },
  Mage: {
    name: 'まほうつかい', hp: 95, dmg: 11, speed: 6.4, guard: 0.6,
    show: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'],
    combo: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', 'Spellcast_Shoot'],
    skill: { id: 'bolt', name: 'まほうだま', cd: 3.5 },
    desc: 'とおくから まほうで たたかう。',
  },
  Rogue: {
    name: 'とうぞく', hp: 105, dmg: 9, speed: 7.2, guard: 0.6, atkSpeed: 1.35,
    show: ['Knife', 'Knife_Offhand', 'Rogue_Cape'],
    combo: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab'],
    skill: { id: 'knives', name: 'なげナイフ', cd: 4 },
    desc: 'あしが はやくて、こうげきも すばやい。',
  },
  Rogue_Hooded: {
    name: 'フードの たびびと', hp: 105, dmg: 9, speed: 7.2, guard: 0.6, atkSpeed: 1.35,
    show: ['Knife', 'Knife_Offhand', 'Rogue_Cape'],
    combo: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab'],
    skill: { id: 'knives', name: 'なげナイフ', cd: 4 },
    desc: 'なぞの たびびと。とうぞくと おなじ わざを つかう。',
  },
};

export const ENEMY_TYPES = {
  Skeleton_Minion: { name: 'ガイコツ', hp: 34, dmg: 8, speed: 4.0, range: 1.9, weapon: 'Skeleton_Blade', attack: '1H_Melee_Attack_Chop', coins: [3, 7], kind: 'melee' },
  Skeleton_Warrior: { name: 'ガイコツせんし', hp: 80, dmg: 14, speed: 3.5, range: 2.3, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Small_A', attack: '1H_Melee_Attack_Jump_Chop', coins: [8, 14], kind: 'melee' },
  Skeleton_Rogue: { name: 'ガイコツの かりうど', hp: 28, dmg: 7, speed: 4.2, range: 11, weapon: 'Skeleton_Crossbow', attack: '1H_Ranged_Shoot', coins: [5, 9], kind: 'archer' },
  Skeleton_Mage: { name: 'ガイコツまどうし', hp: 32, dmg: 10, speed: 3.6, range: 10, weapon: 'Skeleton_Staff', attack: 'Spellcast_Shoot', coins: [6, 11], kind: 'mage' },
};
export const BOSS = { name: 'ガイコツ王', hp: 650, dmg: 22, speed: 3.4, scale: 1.8, coins: [250, 300] };

// お店で売っているもの。model は素材の名前。kind: furniture=家具, decor=かざり
export const CATALOG = [
  { id: 'bed_single_A', name: 'ベッド', price: 0, kind: 'furniture', use: 'bed' },
  { id: 'bed_double_A', name: 'おおきな ベッド', price: 320, kind: 'furniture', use: 'bed' },
  { id: 'chair_A_wood', name: 'きの いす', price: 40, kind: 'furniture', use: 'sit' },
  { id: 'chair_C', name: 'あおい いす', price: 60, kind: 'furniture', use: 'sit' },
  { id: 'armchair', name: 'ひじかけいす', price: 150, kind: 'furniture', use: 'sit' },
  { id: 'couch_pillows', name: 'ソファ', price: 260, kind: 'furniture', use: 'sit' },
  { id: 'table_small', name: 'ちいさな つくえ', price: 50, kind: 'furniture' },
  { id: 'table_medium', name: 'テーブル', price: 90, kind: 'furniture' },
  { id: 'table_low', name: 'ひくい テーブル', price: 80, kind: 'furniture' },
  { id: 'cabinet_small_decorated', name: 'こもの だな', price: 70, kind: 'furniture' },
  { id: 'cabinet_medium_decorated', name: 'おおきな たな', price: 160, kind: 'furniture' },
  { id: 'lamp_standing', name: 'スタンドライト', price: 90, kind: 'furniture', light: 2.3 },
  { id: 'lamp_table', name: 'テーブルライト', price: 50, kind: 'furniture', light: 0.9 },
  { id: 'rug_oval_A', name: 'まるい じゅうたん', price: 70, kind: 'furniture', flat: true },
  { id: 'rug_rectangle_stripes_A', name: 'しまもよう じゅうたん', price: 80, kind: 'furniture', flat: true },
  { id: 'cactus_medium_A', name: 'サボテン', price: 30, kind: 'furniture' },
  { id: 'cactus_small_B', name: 'ちいさな サボテン', price: 20, kind: 'furniture' },
  { id: 'pumpkin_orange', name: 'かぼちゃ', price: 30, kind: 'decor' },
  { id: 'pumpkin_orange_jackolantern', name: 'ジャックランタン', price: 70, kind: 'decor', light: 1.2 },
  { id: 'pumpkin_yellow_jackolantern', name: 'きいろい ジャックランタン', price: 70, kind: 'decor', light: 1.2 },
  { id: 'lantern_standing', name: 'ランタン', price: 60, kind: 'decor', light: 1.4 },
  { id: 'candle_triple', name: 'ろうそく', price: 40, kind: 'decor', light: 0.8 },
  { id: 'shrine_candles', name: 'ろうそくの だい', price: 180, kind: 'decor', light: 1.4 },
  // ここから下は お店では売っていない。夜の ぼちで 手に入る
  { id: 'skull_candle', name: 'ドクロの ろうそく', price: -1, kind: 'decor', light: 0.8, drop: true },
  { id: 'pumpkin_yellow_small', name: 'ちびかぼちゃ', price: -1, kind: 'decor', drop: true },
  { id: 'candle_melted', name: 'とけた ろうそく', price: -1, kind: 'decor', light: 0.6, drop: true },
  { id: 'skull', name: 'ドクロの おきもの', price: -1, kind: 'decor', drop: true },
  { id: 'coffin_decorated', name: 'ガイコツ王の ひつぎ', price: -1, kind: 'decor', drop: true, boss: true },
];
export const ITEM = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

export const WEAPON_LV = [
  { mul: 1.0, price: 0 }, { mul: 1.4, price: 150 }, { mul: 1.9, price: 400 }, { mul: 2.5, price: 900 }, { mul: 3.2, price: 1800 },
];
export const HP_LV = [{ add: 0, price: 0 }, { add: 25, price: 120 }, { add: 50, price: 320 }, { add: 80, price: 700 }];
export const STEW = { price: 25, heal: 45, max: 9 };
export const BONE_PRICE = 4;

// バーガー屋のメニュー。parts を全部 さらに のせると完成する
export const RECIPES = {
  burger: { name: 'ハンバーガー', model: 'food_burger', parts: ['bun', 'patty'], pay: 22 },
  cheese: { name: 'チーズバーガー', model: 'food_burger', parts: ['bun', 'patty', 'cheese'], pay: 32 },
  veggie: { name: 'やさいバーガー', model: 'food_vegetableburger', parts: ['bun', 'lettuce', 'tomato'], pay: 28 },
  stew: { name: 'シチュー', model: 'food_stew', parts: null, pay: 36 },
};
// 手に持てる材料。raw は「まだ使えない」(焼く・切るが必要) 状態
export const INGREDIENTS = {
  bun: { name: 'パン', model: 'food_ingredient_bun' },
  rawPatty: { name: 'なまの にく', model: 'food_ingredient_burger_uncooked', raw: true },
  patty: { name: 'やけた にく', model: 'food_ingredient_burger_cooked' },
  burnt: { name: 'こげた にく', model: 'food_ingredient_burger_trash', raw: true },
  rawCheese: { name: 'チーズ', model: 'food_ingredient_cheese', raw: true, chop: 'cheese' },
  cheese: { name: 'チーズ スライス', model: 'food_ingredient_cheese_slice' },
  rawLettuce: { name: 'レタス', model: 'food_ingredient_lettuce', raw: true, chop: 'lettuce' },
  lettuce: { name: 'きざんだ レタス', model: 'food_ingredient_lettuce_slice' },
  rawTomato: { name: 'トマト', model: 'food_ingredient_tomato', raw: true, chop: 'tomato' },
  tomato: { name: 'トマト スライス', model: 'food_ingredient_tomato_slice' },
  rawPotato: { name: 'じゃがいも', model: 'food_ingredient_potato', raw: true, chop: 'potato' },
  potato: { name: 'きった じゃがいも', model: 'food_ingredient_potato_chopped' },
  rawCarrot: { name: 'にんじん', model: 'food_ingredient_carrot', raw: true, chop: 'carrot' },
  carrot: { name: 'きった にんじん', model: 'food_ingredient_carrot_chopped' },
};

export const QUESTS = [
  { id: 'walk', text: 'まちを さんぽしよう', goal: (s) => [s.stats.walk, 120], reward: 20 },
  { id: 'sit', text: 'ベンチや いすに すわろう', goal: (s) => [s.stats.sat, 1], reward: 10 },
  { id: 'talk', text: 'まちの ひとと はなそう', goal: (s) => [s.stats.talk, 2], reward: 20 },
  { id: 'job', text: 'バーガー屋で おしごとしよう', goal: (s) => [s.stats.served, 1], reward: 30 },
  { id: 'buy', text: 'ざっかやで かぐを かおう', goal: (s) => [s.stats.bought, 1], reward: 20 },
  { id: 'place', text: 'いえに かぐを おこう', goal: (s) => [s.stats.placed, 1], reward: 20 },
  { id: 'train', text: 'くんれんじょうで かかしを たたこう', goal: (s) => [s.stats.dummy, 15], reward: 30 },
  { id: 'night', text: 'よるの ぼちに いってみよう', goal: (s) => [s.stats.nightVisit, 1], reward: 30 },
  { id: 'kill5', text: 'ガイコツを たおそう', goal: (s) => [s.stats.kills, 5], reward: 50 },
  { id: 'serve10', text: 'りょうりを 10かい だそう', goal: (s) => [s.stats.served, 10], reward: 80 },
  { id: 'weapon', text: 'ぶきを きたえよう', goal: (s) => [s.weaponLv + 1, 2], reward: 50 },
  { id: 'deco', text: 'いえに 8こ かざろう', goal: (s) => [s.house.length, 8], reward: 100 },
  { id: 'kill30', text: 'ガイコツを 30たい たおそう', goal: (s) => [s.stats.kills, 30], reward: 150 },
  { id: 'boss', text: 'ガイコツ王を たおそう', goal: (s) => [s.stats.boss, 1], reward: 300 },
  { id: 'rich', text: '3000 コイン ためよう', goal: (s) => [s.coins, 3000], reward: 0 },
];
// ガイコツ王が出てくる条件 (たおした ガイコツの数)
export const BOSS_UNLOCK = 20;

export const NPC_LINES = [
  'よるに なると、ひがしの ぼちで ガイコツが おきだすんだ。',
  'まちの なかは ランタンの ひかりで まもられているから だいじょうぶ。',
  'バーガー屋の てんちょうが、てつだいを さがしていたよ。',
  'ざっかやで かぐを かって、いえを かざろう!',
  'ベッドで ねむると、つぎの あさまで いっきに すすむよ。',
  'くんれんじょうの かかしで、わざの れんしゅうが できるよ。',
  'ガイコツを たくさん たおすと、ガイコツ王が あらわれるらしい……。',
  'シチューを たべると げんきが もどるよ。ざっかやで うってるよ。',
  'きょうも いい てんきだね。',
  'あきの はっぱが きれいだなあ。',
];
