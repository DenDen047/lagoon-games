/* =========================================================================
   CASTAWAY PLANET ― データ定義
   アイテム / 道具 / アーム / 設備 / 植物 / 鉱石 / 宇宙人 / レシピ / 惑星
   ========================================================================= */
'use strict';

const TILE = 32;

/* ------------------------------ アイテム ------------------------------
   kind: mat 素材 / food 食料 / fuel 燃料 / seed 種 / tool 道具 /
         arm ロボットアーム / station 設置物 / part 宇宙船部品 / kit ロボ素体  */
const ITEMS = {
  /* 素材 */
  fiber:        { name: '植物繊維', icon: '🌾', kind: 'mat' },
  wood:         { name: '木材', icon: '🪵', kind: 'mat' },
  resin:        { name: '樹脂', icon: '🍯', kind: 'mat' },
  stone:        { name: '石', icon: '🪨', kind: 'mat' },
  coal:         { name: '燃石', icon: '⚫', kind: 'fuel', fuel: 2 },
  scrap:        { name: '船の残骸', icon: '🔩', kind: 'mat' },

  ore_iron:     { name: '鉄鉱石', icon: '🟫', kind: 'mat' },
  ore_copper:   { name: '銅鉱石', icon: '🟩', kind: 'mat' },
  ore_quartz:   { name: '石英', icon: '⬜', kind: 'mat' },
  ore_titan:    { name: 'チタン鉱石', icon: '⬛', kind: 'mat' },
  ore_sulfur:   { name: '硫黄晶', icon: '🟨', kind: 'mat' },
  ore_cryo:     { name: '冷輝石', icon: '🟦', kind: 'mat' },
  ore_obsidian: { name: '黒曜石', icon: '🟪', kind: 'mat' },
  ore_lumina:   { name: 'ルミナ鉱', icon: '🟥', kind: 'mat' },

  ingot_iron:   { name: '鉄インゴット', icon: '🧱', kind: 'mat' },
  ingot_copper: { name: '銅インゴット', icon: '🥉', kind: 'mat' },
  ingot_titan:  { name: 'チタン板', icon: '🪞', kind: 'mat' },
  glass:        { name: '石英ガラス', icon: '🔷', kind: 'mat' },
  darkglass:    { name: '黒曜ガラス', icon: '🔶', kind: 'mat' },
  part:         { name: '機械部品', icon: '⚙️', kind: 'mat' },
  circuit:      { name: '回路基板', icon: '🟢', kind: 'mat' },
  cell:         { name: '動力セル', icon: '🔋', kind: 'mat' },
  alloy:        { name: '複合合金', icon: '💠', kind: 'mat' },

  /* 食料 */
  berry:        { name: 'スパイアの実', icon: '🍎', kind: 'food', stamina: 18 },
  puff:         { name: 'パフキャップ', icon: '🍄', kind: 'food', stamina: 25 },
  cactus_fruit: { name: 'サンスパインの実', icon: '🍐', kind: 'food', stamina: 22 },
  frost_moss:   { name: '氷苔', icon: '🧊', kind: 'food', stamina: 15 },
  ember_herb:   { name: '火炎草', icon: '🌶️', kind: 'fuel', fuel: 3, stamina: 8 },
  meal:         { name: '温かい食事', icon: '🍲', kind: 'food', stamina: 55 },
  feed_ball:    { name: 'エサ玉', icon: '🍡', kind: 'feed', tame: 100, desc: '四足獣ガルパの大好物。ひとつでなつく。' },

  /* 種 */
  seed_glowleaf:  { name: 'グロウリーフの種', icon: '🌱', kind: 'seed', plant: 'glowleaf' },
  seed_spire:     { name: 'スパイア樹の種', icon: '🌰', kind: 'seed', plant: 'spire' },
  seed_puff:      { name: 'パフキャップの胞子', icon: '🍄', kind: 'seed', plant: 'puff' },
  seed_sunspine:  { name: 'サンスパインの種', icon: '🌵', kind: 'seed', plant: 'sunspine' },
  seed_glassbloom:{ name: 'ガラス花の種', icon: '💎', kind: 'seed', plant: 'glassbloom' },
  seed_frostmoss: { name: '氷苔の胞子', icon: '❄️', kind: 'seed', plant: 'frostmoss' },
  seed_crystree:  { name: 'クリスタル樹の種', icon: '🔮', kind: 'seed', plant: 'crystree' },
  seed_emberherb: { name: '火炎草の種', icon: '🔥', kind: 'seed', plant: 'emberherb' },
  seed_ashvine:   { name: '灰蔦の種', icon: '🍂', kind: 'seed', plant: 'ashvine' },

  /* 道具（自分の手で使う） */
  tool_pick:  { name: 'ピッケル', icon: '⛏️', kind: 'tool', act: 'mine', hardness: 1, stamina: 3 },
  tool_axe:   { name: '斧', icon: '🪓', kind: 'tool', act: 'chop', stamina: 3 },
  tool_hoe:   { name: 'クワ', icon: '⚒️', kind: 'tool', act: 'till', stamina: 2 },
  tool_can:   { name: 'ジョウロ', icon: '🚿', kind: 'tool', act: 'water', stamina: 1, tank: 12 },
  tool_baton: { name: 'スタンバトン', icon: '🔦', kind: 'tool', act: 'hit', dmg: 12, stamina: 2 },

  /* ロボット */
  robot_kit:  { name: 'ロボット素体', icon: '🤖', kind: 'kit' },

  /* 宇宙船の修理部品 */
  part_hull:   { name: '船体パネル', icon: '🛸', kind: 'part' },
  part_cooler: { name: '冷却装置', icon: '🌡️', kind: 'part' },
  part_nav:    { name: '航法コア', icon: '🧭', kind: 'part' },
  part_warp:   { name: 'ワープコア', icon: '🌀', kind: 'part' },
};

/* ------------------------------ アーム ------------------------------
   ロボットに乗っているときだけ使える「手」。左右に1本ずつ付け替える。
   range 1 は 3x3、0 は 1マス。 */
const ARMS = {
  arm_grab: {
    name: 'グラバーアーム', icon: '🦾', act: 'gather', range: 1, batt: 0.7, shape: 'claw',
    desc: '草や木をまとめて掴み取る。3×3に届く。',
  },
  arm_drill1: {
    name: 'ドリルアーム Mk1', icon: '🔧', act: 'mine', hardness: 1, range: 0, batt: 1.4, shape: 'drill',
    desc: '硬さ1までの鉱脈を掘る。1マスずつ。',
  },
  arm_drill2: {
    name: 'ドリルアーム Mk2', icon: '🔩', act: 'mine', hardness: 2, range: 1, batt: 2.0, shape: 'drill',
    desc: '硬さ2まで掘れる。3×3の鉱脈をまとめて砕く。',
  },
  arm_drill3: {
    name: 'ドリルアーム Mk3', icon: '💥', act: 'mine', hardness: 3, range: 1, batt: 2.8, shape: 'drill',
    desc: '黒曜石やルミナ鉱まで掘り抜く最上位ドリル。',
  },
  arm_till: {
    name: '耕運アーム', icon: '🌀', act: 'till', range: 1, batt: 0.9, shape: 'blade',
    desc: '3×3を一度に耕して畑にする。',
  },
  arm_seed: {
    name: '播種アーム', icon: '🌱', act: 'seed', range: 1, batt: 0.7, shape: 'tube',
    desc: '選んでいる種を3×3の畑へ一度に蒔く。',
  },
  arm_water: {
    name: '散水アーム', icon: '💧', act: 'water', range: 1, batt: 0.6, water: 1, shape: 'nozzle',
    desc: '3×3へ水をまく。水は機体のタンクから出る。',
  },
  arm_harvest: {
    name: '収穫アーム', icon: '🧺', act: 'harvest', range: 1, batt: 0.8, shape: 'claw',
    desc: '育ちきった作物を3×3から刈り取る。',
  },
  arm_blast: {
    name: 'ブラスターアーム', icon: '🔫', act: 'shoot', batt: 1.1, dmg: 16, shape: 'barrel',
    desc: 'エネルギー弾を撃つ。敵対的な生き物を追い払える。',
  },
};

/* ------------------------------ 設備 ------------------------------ */
const STATIONS = {
  st_workbench: { name: '作業台', icon: '🛠️', ui: 'craft', color: '#a9793f', desc: '基本の道具と設備を作る。' },
  st_smelter:   { name: '製錬炉', icon: '🔥', ui: 'craft', color: '#8a5a4a', light: 90, desc: '燃料を焚いて鉱石をインゴットにする。' },
  st_assembler: { name: '組立台', icon: '⚙️', ui: 'craft', color: '#5f7d92', desc: '部品・回路・宇宙船の修理部品を組む。' },
  st_robotbay:  { name: 'ロボット工房', icon: '🤖', ui: 'robot', color: '#4c6b8a', light: 60, desc: 'ロボットを組み立て、色とアームを変える。近くにいると充電される。' },
  st_chest:     { name: '貯蔵箱', icon: '📦', ui: 'chest', color: '#8d6a3f', desc: '荷物を預ける。' },
  st_charger:   { name: 'ソーラー充電器', icon: '🔆', ui: 'charge', color: '#3f6f8a', desc: '昼のあいだ、隣のロボットを充電する。' },
  st_tank:      { name: '貯水タンク', icon: '💧', ui: 'water', color: '#3f7f9a', desc: '水を汲める。畑の近くに置くと楽。' },
  st_lamp:      { name: 'ランプ', icon: '💡', color: '#c8a24a', light: 150, desc: '夜のあいだ周りを照らす。' },
  st_bed:       { name: '簡易ベッド', icon: '🛏️', ui: 'sleep', color: '#9a5f6a', desc: '眠って朝まで進める。体力が全快する。' },
};

/* ------------------------------ 植物 ------------------------------
   form: bush 草 / tree 木 / fungus キノコ / cactus サボテン / crystal 結晶
   grow: 1段階進むのに必要なゲーム内時間 (時間)。水がないと進まない。   */
const PLANTS = {
  glowleaf: {
    name: 'グロウリーフ', form: 'bush', c1: '#5fbf6a', c2: '#c6ff9b', stages: 3, grow: 5, glow: true,
    seed: 'seed_glowleaf', yield: [['fiber', 3], ['seed_glowleaf', 1]],
  },
  spire: {
    name: 'スパイア樹', form: 'tree', c1: '#4a7f4f', c2: '#7fbf5f', stages: 4, grow: 9, solid: true,
    seed: 'seed_spire', yield: [['wood', 4], ['berry', 2], ['seed_spire', 1]],
  },
  puff: {
    name: 'パフキャップ', form: 'fungus', c1: '#d8a2e0', c2: '#f2d8f6', stages: 3, grow: 4,
    seed: 'seed_puff', yield: [['puff', 2], ['seed_puff', 1]],
  },
  sunspine: {
    name: 'サンスパイン', form: 'cactus', c1: '#6aa85f', c2: '#d2e07a', stages: 3, grow: 7,
    seed: 'seed_sunspine', yield: [['cactus_fruit', 2], ['fiber', 2], ['seed_sunspine', 1]],
  },
  glassbloom: {
    name: 'ガラス花', form: 'crystal', c1: '#9fd8e8', c2: '#eaffff', stages: 3, grow: 8, glow: true,
    seed: 'seed_glassbloom', yield: [['ore_quartz', 2], ['seed_glassbloom', 1]],
  },
  frostmoss: {
    name: '氷苔', form: 'bush', c1: '#7fc2c8', c2: '#dff6ff', stages: 3, grow: 6,
    seed: 'seed_frostmoss', yield: [['frost_moss', 3], ['seed_frostmoss', 1]],
  },
  crystree: {
    name: 'クリスタル樹', form: 'tree', c1: '#6f9fc8', c2: '#bfeaff', stages: 4, grow: 11, solid: true, glow: true,
    seed: 'seed_crystree', yield: [['wood', 3], ['ore_cryo', 2], ['seed_crystree', 1]],
  },
  emberherb: {
    name: '火炎草', form: 'bush', c1: '#c8542a', c2: '#ffb347', stages: 3, grow: 6, glow: true,
    seed: 'seed_emberherb', yield: [['ember_herb', 3], ['seed_emberherb', 1]],
  },
  ashvine: {
    name: '灰蔦', form: 'bush', c1: '#6a5a52', c2: '#a89484', stages: 3, grow: 5,
    seed: 'seed_ashvine', yield: [['fiber', 2], ['resin', 2], ['seed_ashvine', 1]],
  },
};

/* ------------------------------ 鉱石 ------------------------------ */
const ORES = {
  stone:    { name: '岩', hardness: 0, hp: 3, c1: '#8b8b93', c2: '#b6b6bf', yield: [['stone', 3]] },
  coal:     { name: '燃石', hardness: 1, hp: 4, c1: '#3a3a42', c2: '#5c5c66', yield: [['coal', 3]] },
  iron:     { name: '鉄鉱脈', hardness: 1, hp: 5, c1: '#8a5f42', c2: '#c88a5c', yield: [['ore_iron', 2], ['stone', 1]] },
  copper:   { name: '銅鉱脈', hardness: 1, hp: 5, c1: '#3f8a72', c2: '#6fd8b0', yield: [['ore_copper', 2], ['stone', 1]] },
  quartz:   { name: '石英脈', hardness: 1, hp: 5, c1: '#9fb4c8', c2: '#e8f6ff', yield: [['ore_quartz', 2]] },
  titan:    { name: 'チタン鉱脈', hardness: 2, hp: 8, c1: '#7f8a9a', c2: '#d2dcea', yield: [['ore_titan', 2], ['stone', 1]] },
  sulfur:   { name: '硫黄晶', hardness: 2, hp: 7, c1: '#a8922a', c2: '#f2e05c', yield: [['ore_sulfur', 2]] },
  cryo:     { name: '冷輝石', hardness: 2, hp: 8, c1: '#4f8aa8', c2: '#9fe8ff', yield: [['ore_cryo', 2]] },
  obsidian: { name: '黒曜石', hardness: 3, hp: 12, c1: '#2f2838', c2: '#6a5a80', yield: [['ore_obsidian', 2]] },
  lumina:   { name: 'ルミナ鉱', hardness: 3, hp: 12, c1: '#a83f8a', c2: '#ff8ae0', yield: [['ore_lumina', 2]], glow: true },
};

/* ------------------------------ 宇宙人 ------------------------------
   form: blob もこもこ / bug 多脚 / tall 長身 / drone 機械 / beast 獣    */
const ALIENS = {
  moko: {
    name: 'モコ', form: 'blob', hostile: false, hp: 24, speed: 30, c1: '#ffc2dc', c2: '#ff8ab4', eye: '#4a2f3a',
    line: 'モコ……（あなたの荷物をじっと見ている）',
    trade: { want: ['berry', 3], give: ['ore_iron', 5], text: '実を3つくれたら、拾った鉱石をあげる' },
  },
  gulpa: {
    name: 'ガルパ', form: 'gulpa', hostile: false, mount: true, hp: 90, speed: 34, rideSpeed: 205, dmg: 16,
    c1: '#7f63c8', c2: '#d8c2ff', eye: '#f4ffd2', pupil: '#2a1f3a', mouth: '#3a1f38', glow: true,
    line: 'ゴルル…（ひとつの目がじっとこちらを向いている）',
    tameHint: '食べ物を手に持って E。エサ玉ならひと口でなつく。',
    drops: [],
  },
  raptorbug: {
    name: 'ラプター蟲', form: 'bug', hostile: true, hp: 34, speed: 68, dmg: 8, c1: '#6a4a8a', c2: '#b48ae0',
    drops: [['resin', 2], ['fiber', 1]],
  },
  zaku: {
    name: 'ザクの行商', form: 'tall', hostile: false, hp: 40, speed: 26, c1: '#e0b06a', c2: '#8a5f2a', eye: '#2a1a0a',
    line: 'ザザ……砂の下のものなら、なんでも持っている。',
    trade: { want: ['cactus_fruit', 4], give: ['ore_titan', 4], text: 'サンスパインの実4つで、チタン鉱石と交換しよう' },
  },
  scorplite: {
    name: 'スコルプ', form: 'bug', hostile: true, hp: 46, speed: 74, dmg: 12, c1: '#a8783a', c2: '#e0c07a',
    drops: [['ore_sulfur', 2], ['resin', 1]],
  },
  yukibito: {
    name: 'ユキビト', form: 'tall', hostile: false, hp: 44, speed: 24, c1: '#dff2ff', c2: '#8fbcd8', eye: '#2a4a6a',
    line: '…………（白い息だけが返ってくる）',
    trade: { want: ['meal', 1], give: ['ore_cryo', 6], text: '温かい食事ひとつと、冷輝石6つを交換したい' },
  },
  icefang: {
    name: '氷牙獣', form: 'beast', hostile: true, hp: 58, speed: 80, dmg: 15, c1: '#8fb4d8', c2: '#e8f6ff',
    drops: [['ore_cryo', 1], ['resin', 2]],
  },
  magman: {
    name: 'マグマ人', form: 'tall', hostile: false, hp: 60, speed: 22, c1: '#c85a2a', c2: '#ffb347', eye: '#fff2c8', glow: true,
    line: 'ゴ……ォ（熱で空気が揺れている）',
    trade: { want: ['frost_moss', 5], give: ['ore_lumina', 5], text: '氷苔5つで、ルミナ鉱を分けてやろう' },
  },
  drone: {
    name: '暴走ドローン', form: 'drone', hostile: true, hp: 70, speed: 66, dmg: 18, ranged: true, c1: '#4a5a6a', c2: '#ff5a4a',
    drops: [['part', 2], ['circuit', 1]],
  },
};

/* ------------------------------ レシピ ------------------------------
   station: null は手持ちで作れる。fuel: true は製錬炉の燃料を1つ消費。 */
const RECIPES = [
  /* 手持ち */
  { out: ['st_workbench', 1], cost: [['wood', 8], ['stone', 4]], station: null },
  { out: ['tool_pick', 1], cost: [['wood', 2], ['stone', 3]], station: null },
  { out: ['tool_axe', 1], cost: [['wood', 2], ['stone', 3]], station: null },

  /* 作業台 */
  { out: ['tool_hoe', 1], cost: [['wood', 2], ['ingot_iron', 1]], station: 'st_workbench' },
  { out: ['tool_can', 1], cost: [['ingot_iron', 2]], station: 'st_workbench' },
  { out: ['tool_baton', 1], cost: [['ingot_iron', 2], ['circuit', 1]], station: 'st_workbench' },
  { out: ['st_smelter', 1], cost: [['stone', 12], ['scrap', 2]], station: 'st_workbench' },
  { out: ['st_chest', 1], cost: [['wood', 10]], station: 'st_workbench' },
  { out: ['st_bed', 1], cost: [['wood', 8], ['fiber', 10]], station: 'st_workbench' },
  { out: ['st_tank', 1], cost: [['ingot_iron', 4], ['resin', 2]], station: 'st_workbench' },
  { out: ['st_lamp', 1], cost: [['ingot_copper', 2], ['glass', 1]], station: 'st_workbench' },
  { out: ['st_assembler', 1], cost: [['ingot_iron', 6], ['wood', 8], ['stone', 6]], station: 'st_workbench' },
  { out: ['feed_ball', 2], cost: [['fiber', 4], ['resin', 1]], station: 'st_workbench' },

  /* 製錬炉（燃料を1つ使う） */
  { out: ['ingot_iron', 1], cost: [['ore_iron', 2]], station: 'st_smelter', fuel: true },
  { out: ['ingot_copper', 1], cost: [['ore_copper', 2]], station: 'st_smelter', fuel: true },
  { out: ['glass', 1], cost: [['ore_quartz', 2]], station: 'st_smelter', fuel: true },
  { out: ['ingot_titan', 1], cost: [['ore_titan', 2]], station: 'st_smelter', fuel: true },
  { out: ['darkglass', 1], cost: [['ore_obsidian', 2]], station: 'st_smelter', fuel: true },
  { out: ['meal', 1], cost: [['berry', 2], ['puff', 1]], station: 'st_smelter', fuel: true },
  { out: ['coal', 2], cost: [['wood', 3]], station: 'st_smelter', fuel: true },

  /* 組立台 */
  { out: ['part', 2], cost: [['ingot_iron', 2], ['stone', 2]], station: 'st_assembler' },
  { out: ['circuit', 1], cost: [['ingot_copper', 2], ['glass', 1]], station: 'st_assembler' },
  { out: ['cell', 1], cost: [['circuit', 1], ['ingot_iron', 2], ['coal', 2]], station: 'st_assembler' },
  { out: ['alloy', 1], cost: [['ingot_titan', 2], ['ingot_iron', 2]], station: 'st_assembler' },
  { out: ['st_robotbay', 1], cost: [['ingot_iron', 10], ['part', 6], ['circuit', 3]], station: 'st_assembler' },
  { out: ['st_charger', 1], cost: [['ingot_copper', 4], ['glass', 2], ['circuit', 1]], station: 'st_assembler' },

  /* 宇宙船の修理部品（組立台） */
  { out: ['part_hull', 1], cost: [['ingot_iron', 8], ['glass', 3], ['part', 4]], station: 'st_assembler' },
  { out: ['part_cooler', 1], cost: [['ingot_copper', 8], ['ore_sulfur', 4], ['circuit', 2]], station: 'st_assembler' },
  { out: ['part_nav', 1], cost: [['ingot_titan', 4], ['ore_cryo', 6], ['circuit', 4]], station: 'st_assembler' },
  { out: ['part_warp', 1], cost: [['darkglass', 4], ['ore_lumina', 6], ['cell', 4], ['alloy', 2]], station: 'st_assembler' },

  /* ロボット工房 */
  { out: ['robot_kit', 1], cost: [['ingot_iron', 12], ['part', 8], ['circuit', 4], ['cell', 2]], station: 'st_robotbay' },
  { out: ['arm_grab', 1], cost: [['ingot_iron', 3], ['part', 2]], station: 'st_robotbay' },
  { out: ['arm_drill1', 1], cost: [['ingot_iron', 4], ['part', 3]], station: 'st_robotbay' },
  { out: ['arm_drill2', 1], cost: [['ingot_iron', 6], ['glass', 2], ['part', 4], ['circuit', 2]], station: 'st_robotbay' },
  { out: ['arm_drill3', 1], cost: [['alloy', 2], ['ingot_titan', 4], ['circuit', 4], ['cell', 2]], station: 'st_robotbay' },
  { out: ['arm_till', 1], cost: [['ingot_iron', 4], ['part', 2]], station: 'st_robotbay' },
  { out: ['arm_seed', 1], cost: [['ingot_iron', 3], ['part', 2], ['circuit', 1]], station: 'st_robotbay' },
  { out: ['arm_water', 1], cost: [['ingot_copper', 3], ['part', 2], ['resin', 2]], station: 'st_robotbay' },
  { out: ['arm_harvest', 1], cost: [['ingot_iron', 3], ['part', 3], ['circuit', 1]], station: 'st_robotbay' },
  { out: ['arm_blast', 1], cost: [['ingot_copper', 4], ['circuit', 3], ['cell', 1]], station: 'st_robotbay' },
];

/* ------------------------------ 惑星 ------------------------------ */
const PLANETS = [
  {
    id: 'verdia', name: 'ヴェルディア', tag: '温帯の森林惑星',
    intro: '緑と苔に覆われた静かな星。空気は吸える。ここが不時着地点になった。',
    ground: '#4f8a4f', ground2: '#4a8449', sand: '#c8b482', rock: '#6f6f78', water: '#2f6f9e',
    sky: '#9fd8ea', night: '#16203a',
    plants: ['glowleaf', 'spire', 'puff'], density: 0.10, treeRatio: 0.35,
    ores: ['stone', 'iron', 'copper', 'quartz', 'coal'], oreDensity: 0.030,
    friendly: 'moko', hostile: 'raptorbug', fauna: ['gulpa'], faunaSkin: ['#7f63c8', '#d8c2ff'], hostileNight: 5, hostileDay: 2,
    part: 'part_hull',
    partHint: '船体パネルを組立台で作って、宇宙船に取り付ける。',
  },
  {
    id: 'aridna', name: 'アリドナ', tag: '乾ききった砂の惑星',
    intro: '水場が少ない。畑をやるなら、まず水の運び方を考えることになる。',
    ground: '#d8bb7a', ground2: '#d0b06e', sand: '#e8d49a', rock: '#8a7a5f', water: '#3f8aa8',
    sky: '#f0c98a', night: '#2a1e2e',
    plants: ['sunspine', 'glassbloom', 'ashvine'], density: 0.05, treeRatio: 0,
    ores: ['stone', 'iron', 'copper', 'quartz', 'coal', 'titan', 'sulfur'], oreDensity: 0.040,
    friendly: 'zaku', hostile: 'scorplite', fauna: ['gulpa'], faunaSkin: ['#c88a4a', '#ffe0a8'], hostileNight: 6, hostileDay: 3,
    part: 'part_cooler', dry: true,
    partHint: '冷却装置がないと、次の星の寒さで船が持たない。',
  },
  {
    id: 'frigis', name: 'フリギス', tag: '氷に閉ざされた惑星',
    intro: '一日中うっすら暗い。作物の育ちが遅いぶん、地面の下は資源が濃い。',
    ground: '#dfeaf2', ground2: '#d4e2ee', sand: '#eef6ff', rock: '#8fa0b0', water: '#3f6f9a',
    sky: '#c8dcea', night: '#101a2e',
    plants: ['frostmoss', 'crystree'], density: 0.07, treeRatio: 0.4,
    ores: ['stone', 'iron', 'copper', 'quartz', 'coal', 'titan', 'cryo'], oreDensity: 0.044,
    friendly: 'yukibito', hostile: 'icefang', fauna: ['gulpa'], faunaSkin: ['#5f9ac8', '#dff2ff'], hostileNight: 7, hostileDay: 3,
    part: 'part_nav', slowGrow: 1.6,
    partHint: '航法コアがあれば、最後の星まで飛べる。',
  },
  {
    id: 'obsid', name: 'オブシド', tag: '火山と黒い砂の惑星',
    intro: '地表が熱を持っている。ここでワープコアを組めば、故郷へ帰れる。',
    ground: '#4a3a3f', ground2: '#42343a', sand: '#6a5148', rock: '#3a3038', water: '#c85a2a',
    sky: '#e08a5a', night: '#1a0e14',
    plants: ['emberherb', 'ashvine'], density: 0.06, treeRatio: 0,
    ores: ['stone', 'iron', 'copper', 'quartz', 'coal', 'titan', 'obsidian', 'lumina'], oreDensity: 0.050,
    friendly: 'magman', hostile: 'drone', fauna: ['gulpa'], faunaSkin: ['#c8503f', '#ffc08a'], hostileNight: 8, hostileDay: 5,
    part: 'part_warp', lava: true,
    partHint: 'ワープコアを積めば帰還できる。',
  },
];

/* ---------------------------- 参照ヘルパー ---------------------------- */
function itemDef(id) { return ITEMS[id] || ARMS[id] || STATIONS[id] || null; }
function itemName(id) { const d = itemDef(id); return d ? d.name : id; }
function itemIcon(id) {
  if (ITEMS[id]) return ITEMS[id].icon;
  if (ARMS[id]) return ARMS[id].icon;
  if (STATIONS[id]) return STATIONS[id].icon;
  return '❔';
}
function isArm(id) { return !!ARMS[id]; }
function isStation(id) { return !!STATIONS[id]; }
