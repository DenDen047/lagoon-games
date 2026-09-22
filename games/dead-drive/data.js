/* =========================================================================
   DEAD DRIVE ― データ
   部品 / 武器 / ゾンビ / 強化 / 砲台 / 施設 / 行き先 / 仲間 / 夜の出来事 / 遺産
   ========================================================================= */
'use strict';

const CS = 14;            // 車のマス1つの大きさ（ワールド座標の px）
const MAX_DAY = 10;       // 10日目の夜を越えればクリア
const RAID_NIGHTS = [2, 4, 6, 8, 10];

/* ------------------------------- 車の部品 ------------------------------- */
/* bp: true の部品は設計図を手に入れるまで置けない。
   rot: true の部品は向きを持つ（0=前 1=右 2=後ろ 3=左）。 */
const PARTS = {
  cabin:   { name: '運転席',     cat: 'core',   cost: 0,  hp: 150, mass: 3.0, col: '#d9b44a', seats: 1, cargo: 4,
             desc: 'あなたが乗る席。ここが壊れたら終わり。小さなエンジンと荷物入れがついている。' },
  frame:   { name: '鉄フレーム', cat: 'body',   cost: 3,  hp: 34,  mass: 0.5, col: '#7d858f',
             desc: '軽くて安い骨組み。車の形を広げるのに使う。' },
  armor:   { name: '装甲板',     cat: 'body',   cost: 9,  hp: 90,  mass: 1.5, col: '#8d97a3',
             desc: '分厚い鉄板。外側に貼ると内側の部品をゾンビの手から守る。' },
  heavy:   { name: '重装甲',     cat: 'body',   cost: 22, hp: 220, mass: 3.4, col: '#5d6873', bp: true,
             desc: '戦車の板。とても硬いがとても重い。' },
  ram:     { name: '衝角',       cat: 'body',   cost: 14, hp: 130, mass: 2.0, col: '#c9cfd6', rot: true, ram: 2.4,
             desc: '向けた方向でゾンビにぶつかると大ダメージ。自分はほとんど傷つかない。' },
  spikes:  { name: 'トゲ',       cat: 'body',   cost: 10, hp: 70,  mass: 1.0, col: '#9aa3ad', contact: 45,
             desc: '触れているゾンビを刺しつづける。しがみつかれても平気になる。' },
  saw:     { name: '回転ノコ',   cat: 'weapon', cost: 28, hp: 80,  mass: 1.6, col: '#d0d6dc', contact: 160, bp: true,
             desc: '触れたゾンビを切り刻む丸ノコ。車の角に付けると強い。' },
  engine:  { name: 'エンジン',   cat: 'util',   cost: 20, hp: 60,  mass: 2.0, col: '#b0563c', power: 5,
             desc: '馬力が上がる。重い車ほど何基も要る。' },
  nitro:   { name: 'ニトロ',     cat: 'util',   cost: 16, hp: 40,  mass: 0.7, col: '#3d8fd6', nitro: 1,
             desc: 'Shift / Space で急加速。タンクが多いほど長く吹ける。' },
  cargo:   { name: '荷台',       cat: 'util',   cost: 7,  hp: 45,  mass: 0.7, col: '#9b7447', cargo: 8,
             desc: '食料や燃料を積める量が増える。' },
  seat:    { name: '座席',       cat: 'util',   cost: 9,  hp: 45,  mass: 0.7, col: '#6a5b8c', seats: 2,
             desc: '助けた人を乗せられる数が2人増える。' },
  magnet:  { name: '磁石',       cat: 'util',   cost: 16, hp: 45,  mass: 1.0, col: '#c9453b', magnet: 70, bp: true,
             desc: '落ちているスクラップや食料を引き寄せる。' },
  repair:  { name: '修理アーム', cat: 'util',   cost: 34, hp: 55,  mass: 1.2, col: '#58a36c', repair: 4, bp: true,
             desc: 'となりの部品を走りながら少しずつ直す。' },
  mg:      { name: '機関銃',     cat: 'weapon', cost: 18, hp: 55,  mass: 1.0, col: '#4a5159', rot: true, weapon: 'mg',
             desc: '向けた方向の前にいるゾンビを自動で撃つ。連射が速い。' },
  shotgun: { name: '散弾銃',     cat: 'weapon', cost: 24, hp: 60,  mass: 1.1, col: '#6d4c35', rot: true, weapon: 'shotgun', bp: true,
             desc: '近くの群れにまとめて撃ちこむ。はね飛ばす力もある。' },
  flamer:  { name: '火炎放射器', cat: 'weapon', cost: 30, hp: 60,  mass: 1.2, col: '#c2542d', rot: true, weapon: 'flamer', bp: true,
             desc: '短い距離を焼きはらう。燃えたゾンビはしばらく燃えつづける。' },
  rocket:  { name: 'ロケット砲', cat: 'weapon', cost: 40, hp: 60,  mass: 1.5, col: '#5d6b3a', rot: true, weapon: 'rocket', bp: true,
             desc: '遅いが、当たると周りごと吹き飛ばす。' },
  turret:  { name: '旋回機銃',   cat: 'weapon', cost: 36, hp: 70,  mass: 1.4, col: '#39424c', weapon: 'turret', bp: true,
             desc: '360度まわる機銃。向きを気にしなくていい。' },
  tesla:   { name: '電撃コイル', cat: 'weapon', cost: 44, hp: 60,  mass: 1.3, col: '#3c6fa8', weapon: 'tesla', bp: true,
             desc: '近くのゾンビに電撃を落とし、となりへ連鎖させる。' },
  mines:   { name: '地雷投下機', cat: 'weapon', cost: 30, hp: 60,  mass: 1.2, col: '#7a6a3a', weapon: 'mines', bp: true,
             desc: '走っていると後ろに地雷を落としていく。追ってくる群れに強い。' },
};
const PART_ORDER = ['frame', 'armor', 'heavy', 'ram', 'spikes', 'saw', 'mg', 'shotgun', 'flamer', 'rocket', 'turret', 'tesla', 'mines', 'engine', 'nitro', 'cargo', 'seat', 'magnet', 'repair'];
const PART_CATS = [
  { id: 'body', name: '車体' },
  { id: 'weapon', name: '武器' },
  { id: 'util', name: '装備' },
];
const BP_POOL = PART_ORDER.filter((id) => PARTS[id].bp);

/* ------------------------------- 武器 ------------------------------- */
/* arc は射界の半分の角度。rate は1秒あたりの発射数。 */
const WEAPONS = {
  mg:      { kind: 'bullet', range: 330, arc: 0.5,  rate: 8,   dmg: 8,   speed: 980, spread: 0.06 },
  shotgun: { kind: 'bullet', range: 230, arc: 0.7,  rate: 1.25, dmg: 9,  speed: 820, spread: 0.32, pellets: 7, knock: 170 },
  flamer:  { kind: 'flame',  range: 165, arc: 0.45, rate: 18,  dmg: 3,   speed: 330, spread: 0.2, burn: 9 },
  rocket:  { kind: 'rocket', range: 480, arc: 0.35, rate: 0.6, dmg: 55,  speed: 520, spread: 0.02, radius: 88 },
  turret:  { kind: 'bullet', range: 300, arc: Math.PI, rate: 4.5, dmg: 11, speed: 980, spread: 0.04 },
  tesla:   { kind: 'tesla',  range: 200, arc: Math.PI, rate: 1.0, dmg: 28, chain: 4 },
  mines:   { kind: 'mine',   range: 0,   arc: Math.PI, rate: 0.5, dmg: 80, radius: 84 },
};

/* ------------------------------- ゾンビ ------------------------------- */
const ZOMBIES = {
  walker:  { name: 'ゾンビ',       hp: 24,  r: 9,  speed: 36,  dmg: 4,  rate: 1.0, mass: 1,   xp: 1,  skin: '#7c9a63', shirt: '#5b6d86', scrap: 0.10 },
  runner:  { name: '走るゾンビ',   hp: 16,  r: 8,  speed: 112, dmg: 4,  rate: 1.3, mass: 0.8, xp: 1,  skin: '#8fae6f', shirt: '#9a4f4f', scrap: 0.10 },
  dog:     { name: 'ゾンビ犬',     hp: 13,  r: 7,  speed: 175, dmg: 4,  rate: 1.6, mass: 0.6, xp: 1,  skin: '#6d5b48', shirt: '#6d5b48', scrap: 0.05, dog: true },
  fat:     { name: '太っちょ',     hp: 120, r: 15, speed: 26,  dmg: 11, rate: 0.8, mass: 4,   xp: 4,  skin: '#93a86a', shirt: '#c9b98f', scrap: 0.5, splash: true },
  spitter: { name: '吐くゾンビ',   hp: 32,  r: 9,  speed: 40,  dmg: 5,  rate: 1.0, mass: 1,   xp: 3,  skin: '#a4c050', shirt: '#4f7a4a', scrap: 0.25, spit: { range: 270, rate: 0.45, dmg: 9 } },
  bomber:  { name: '爆弾ゾンビ',   hp: 20,  r: 10, speed: 70,  dmg: 0,  rate: 1.0, mass: 1.2, xp: 2,  skin: '#b08a52', shirt: '#d6632c', scrap: 0.2, bomb: { dmg: 38, radius: 70 } },
  armored: { name: '機動隊ゾンビ', hp: 70,  r: 10, speed: 40,  dmg: 7,  rate: 1.0, mass: 1.6, xp: 3,  skin: '#7c9a63', shirt: '#2f3845', scrap: 0.4, armor: 0.35 },
  brute:   { name: '巨体',         hp: 950, r: 26, speed: 58,  dmg: 34, rate: 0.7, mass: 26,  xp: 40, skin: '#6f8a57', shirt: '#4a3b35', scrap: 6, boss: true },
};

/* 日ごとに出てくるゾンビの割合 */
function zombieMix(day, mods = {}) {
  const m = [
    { id: 'walker', w: 10 },
    { id: 'runner', w: day >= 2 ? 2 + day * 0.4 : 0.6 },
    { id: 'fat', w: day >= 3 ? 1 + day * 0.15 : 0 },
    { id: 'bomber', w: day >= 3 ? 0.8 + day * 0.1 : 0 },
    { id: 'spitter', w: day >= 4 ? 0.8 + day * 0.12 : 0 },
    { id: 'armored', w: day >= 5 ? 0.8 + day * 0.15 : 0 },
    { id: 'dog', w: day >= 6 ? 1 + day * 0.1 : 0 },
  ];
  if (mods.dogs) m.find((o) => o.id === 'dog').w += 6;
  return m.filter((o) => o.w > 0);
}

/* ------------------------------- 強化 ------------------------------- */
/* レベルが上がるたびに3つから1つ選ぶ。ランが終わるまで効きつづける。 */
const PERKS = [
  { id: 'ram',     icon: '💥', name: '重いバンパー',   max: 5, desc: '轢いたときのダメージ +35%' },
  { id: 'armor',   icon: '🛡️', name: '装甲コーティング', max: 4, desc: '部品が受けるダメージ -10%' },
  { id: 'rate',    icon: '⚡', name: '速射',           max: 5, desc: '武器の連射 +15%', needWeapon: true },
  { id: 'dmg',     icon: '🔫', name: '大口径',         max: 5, desc: '武器の威力 +18%', needWeapon: true },
  { id: 'pierce',  icon: '➶',  name: '貫通弾',         max: 2, desc: '弾がゾンビを1体多く貫く', needWeapon: true },
  { id: 'range',   icon: '🎯', name: '長い照準',       max: 3, desc: '武器の射程 +15%', needWeapon: true },
  { id: 'fire',    icon: '🔥', name: '焼夷弾',         max: 3, desc: '弾が当たったゾンビが燃える', needWeapon: true },
  { id: 'crit',    icon: '✦',  name: '急所',           max: 3, desc: '弾が2.5倍のダメージになる確率 +15%', needWeapon: true },
  { id: 'spikes',  icon: '🦔', name: 'トゲ強化',       max: 3, desc: 'トゲ・ノコの接触ダメージ +50%。外側の部品すべてが少し刺さる' },
  { id: 'repair',  icon: '🔧', name: '轢いて直す',     max: 3, desc: '轢くたびに、いちばん傷んだ部品が少し直る' },
  { id: 'nitro',   icon: '🚀', name: 'ニトロ過給',     max: 3, desc: 'ニトロの回復 +40%、容量 +30%' },
  { id: 'speed',   icon: '🏁', name: 'チューンドエンジン', max: 4, desc: '最高速 +8%、加速 +12%' },
  { id: 'grip',    icon: '🌀', name: 'ドリフト',       max: 3, desc: '曲がりやすく、滑りにくくなる' },
  { id: 'magnet',  icon: '🧲', name: '長い腕',         max: 3, desc: '拾える範囲 +60%' },
  { id: 'explode', icon: '💣', name: '誘爆',           max: 3, desc: '倒したゾンビが一定の確率で爆発する（12% / 20% / 28%）' },
  { id: 'scrap',   icon: '🔩', name: '拾い上手',       max: 3, desc: '拾うスクラップ +25%' },
  { id: 'shock',   icon: '🌊', name: '衝撃波',         max: 2, desc: 'ニトロを吹いた瞬間、まわりのゾンビをはね飛ばす' },
  { id: 'chain',   icon: '⛓️', name: '連鎖',           max: 3, desc: '電撃の連鎖 +2、爆発の範囲 +20%' },
  { id: 'xp',      icon: '📘', name: '学び',           max: 2, desc: '経験値 +25%' },
  { id: 'turret',  icon: '🏰', name: '砲台の指導',     max: 4, desc: '基地の砲台の威力 +15%' },
  { id: 'cargo',   icon: '📦', name: '詰めこみ',       max: 2, desc: '積める量 +30%' },
  { id: 'heal',    icon: '❤️', name: '応急処置',       max: 99, desc: 'いますぐ車のすべての部品を40%直す', once: true },
];
const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));
const xpNeed = (lv) => Math.round(14 + (lv - 1) * 9 + Math.pow(lv - 1, 1.6) * 2);

/* ------------------------------- 基地の砲台 ------------------------------- */
const TOWERS = {
  mg:     { name: '機銃塔', cost: 40, kind: 'bullet', range: 360, rate: 6,   dmg: 11,   speed: 980, spread: 0.05, hp: 160, col: '#4a5159',
            desc: 'よく当たる基本の砲台。' },
  flame:  { name: '火炎塔', cost: 55, kind: 'flame',  range: 175, rate: 18,  dmg: 3,   speed: 340, spread: 0.22, burn: 10, hp: 180, col: '#c2542d',
            desc: '防壁にとりついた群れを焼く。' },
  sniper: { name: '狙撃塔', cost: 70, kind: 'bullet', range: 680, rate: 0.7, dmg: 110, speed: 1800, spread: 0, pierce: 3, hp: 140, col: '#556b7d', ws: 1,
            desc: '遠くの大物を狙い、3体まで貫く。' },
  mortar: { name: '迫撃砲', cost: 80, kind: 'shell',  range: 600, min: 140, rate: 0.45, dmg: 70, radius: 100, hp: 160, col: '#5d6b3a', ws: 1,
            desc: '山なりの弾で群れのまんなかを吹き飛ばす。' },
  tesla:  { name: '電撃塔', cost: 95, kind: 'tesla',  range: 240, rate: 0.9, dmg: 34,  chain: 5, hp: 170, col: '#3c6fa8', ws: 2,
            desc: '電撃が群れのあいだを飛びまわる。' },
};
const TOWER_ORDER = ['mg', 'flame', 'sniper', 'mortar', 'tesla'];
const towerUpCost = (t, lv) => Math.round(TOWERS[t].cost * (0.8 + lv * 0.5));
const towerMult = (lv) => ({ dmg: 1 + 0.5 * (lv - 1), rate: 1 + 0.18 * (lv - 1), range: 1 + 0.08 * (lv - 1) });

/* ------------------------------- 基地の施設 ------------------------------- */
const FACILITIES = {
  wall:     { name: '防壁',   icon: '🧱', max: 4, cost: [0, 0, 50, 95, 160],
              effect: (lv) => `防壁の耐久 ${WALL_HP[lv]}・砲台の枠 ${TURRET_SLOTS[lv]}` },
  garage:   { name: 'ガレージ', icon: '🔧', max: 3, cost: [0, 0, 60, 130],
              effect: (lv) => `車を組める広さ ${GARAGE_GRID[lv][0]}×${GARAGE_GRID[lv][1]}` },
  farm:     { name: '畑',     icon: '🌱', max: 4, cost: [0, 30, 60, 100, 150],
              effect: (lv) => `毎日 食料 +${FARM_FOOD[lv]}` },
  workshop: { name: '作業場', icon: '⚙️', max: 3, cost: [0, 40, 85, 140],
              effect: (lv) => `毎日 スクラップ +${SHOP_SCRAP[lv]}${lv >= 1 ? '・狙撃塔と迫撃砲' : ''}${lv >= 2 ? '・電撃塔' : ''}` },
  radio:    { name: '無線塔', icon: '📡', max: 2, cost: [0, 35, 80],
              effect: (lv) => `行き先の候補 +${lv}${lv >= 2 ? '・避難所の人数 +1' : ''}` },
};
const FAC_ORDER = ['wall', 'garage', 'farm', 'workshop', 'radio'];
const WALL_HP = [0, 130, 200, 290, 400];
const TURRET_SLOTS = [0, 2, 4, 6, 8];
const GARAGE_GRID = [[5, 7], [5, 7], [7, 9], [9, 11]];
const FARM_FOOD = [0, 3, 6, 9, 13];
const SHOP_SCRAP = [0, 10, 20, 34];

/* ------------------------------- 行き先 ------------------------------- */
const DEST_TYPES = {
  patrol:   { name: '近所の見回り',     icon: '🚗', goal: 'none',    desc: '燃料を使わない。拾いものは少ない。', col: '#8a9bb0' },
  market:   { name: 'スーパー',         icon: '🛒', goal: 'load',    res: 'food', desc: '搬入口に車を止めて食料を積みこむ。', col: '#e0a43a' },
  rescue:   { name: '避難所',           icon: '🆘', goal: 'rescue',  desc: '立てこもっている人たちを車に乗せる。', col: '#e2584b' },
  junk:     { name: '廃車置き場',       icon: '🔩', goal: 'collect', desc: 'スクラップの山を轢いてまわる。', col: '#9aa3ad' },
  gas:      { name: 'ガソリンスタンド', icon: '⛽', goal: 'load',    res: 'fuel', desc: '給油機の前に止まって燃料を積む。', col: '#4fb0d8' },
  police:   { name: '警察署',           icon: '🚓', goal: 'crates',  desc: '証拠品倉庫の木箱を壊して設計図を探す。', col: '#5a7fd6' },
  hospital: { name: '病院',             icon: '🏥', goal: 'rescue',  desc: '医者を助け出し、修理キットも拾える。', col: '#e8e8e8' },
  hardware: { name: 'ホームセンター',   icon: '🧰', goal: 'load',    res: 'scrap', desc: '資材置き場に止まってスクラップを積む。', col: '#e07b3a' },
};
const DEST_POOL = ['market', 'market', 'rescue', 'rescue', 'junk', 'gas', 'police', 'hospital', 'hardware'];
const AREAS = [
  { name: '駅前通り',   roof: ['#6b6f78', '#7a6f66', '#5f6a78', '#7b7d84'], park: 0.08 },
  { name: '港の倉庫街', roof: ['#6e5f52', '#5b6570', '#7d6a58', '#4f5b63'], park: 0.04 },
  { name: 'ひばり団地', roof: ['#8a8578', '#7a8088', '#8f8a80', '#6f7880'], park: 0.2 },
  { name: '工業地帯',   roof: ['#5a6068', '#6a625a', '#50585f', '#727a6e'], park: 0.03 },
  { name: '大学通り',   roof: ['#7a5f55', '#6b7178', '#86705e', '#5c6670'], park: 0.16 },
  { name: '川沿いの町', roof: ['#6f6a7a', '#7c7568', '#657582', '#80786c'], park: 0.22 },
  { name: '旧市街',     roof: ['#6e4f47', '#5f5a55', '#7a5a4c', '#66605a'], park: 0.1 },
  { name: '商店街',     roof: ['#7d6560', '#6a6f7c', '#8a7462', '#5e6a76'], park: 0.06 },
];
const MODS = [
  { id: 'horde', name: 'ゾンビが多い', danger: 1, reward: 1.35 },
  { id: 'dogs',  name: '犬の群れ',     danger: 1, reward: 1.15, minDay: 3 },
  { id: 'dusk',  name: '夕暮れ',       danger: 1, reward: 1.2 },
  { id: 'boss',  name: '巨体がいる',   danger: 2, reward: 1.5, minDay: 4 },
  { id: 'rich',  name: '手つかず',     danger: 0, reward: 1.4 },
];

/* ------------------------------- 仲間 ------------------------------- */
const NAMES = ['タケシ', 'ミカ', 'ケンジ', 'ユイ', 'ゴロウ', 'サクラ', 'ハルト', 'アオイ', 'ダイチ', 'リン', 'ソウタ', 'ナナ',
  'トオル', 'メイ', 'イサム', 'チヒロ', 'マコト', 'カナ', 'ジロウ', 'ヒナ', 'レン', 'ミオ', 'ショウ', 'エマ', 'ゲン', 'ノア', 'タクミ', 'ルナ'];
const TRAITS = {
  none:     { name: 'ふつうの人', desc: '砲台に立てる。' },
  mechanic: { name: '整備士',     desc: '車の修理費 -25%' },
  gunner:   { name: '射撃手',     desc: '砲台に立つと威力 +25%' },
  cook:     { name: '料理人',     desc: '仲間の食料の消費 -2 / 日' },
  farmer:   { name: '農家',       desc: '畑の収穫 +3 / 日（畑がなくても +1）' },
  scav:     { name: '拾い屋',     desc: '毎日 スクラップ +6' },
  doctor:   { name: '医者',       desc: '食料が足りないとき、去っていく仲間が半分になる。毎朝 車を10%直す' },
  dog:      { name: '番犬',       desc: '食料を食べない。襲撃で本部の耐久 +150' },
};
const TRAIT_POOL = ['none', 'none', 'none', 'mechanic', 'gunner', 'gunner', 'cook', 'farmer', 'scav', 'doctor'];

/* ------------------------------- 夜の出来事 ------------------------------- */
/* 襲撃のない夜に1枚引く。choices の apply は結果の文を返す。 */
const EVENTS = [
  {
    id: 'trader', title: '旅の商人', text: '荷車を引いた男が門をたたいた。「食べ物と鉄くず、どっちも欲しいんだろう？」',
    choices: [
      { label: '食料 8 → スクラップ 50', ok: (r) => r.food >= 8, apply: (r) => { r.food -= 8; r.scrap += 50; return 'スクラップを 50 手に入れた。'; } },
      { label: 'スクラップ 60 → 設計図', ok: (r) => r.scrap >= 60 && Run.lockedParts().length > 0, apply: (r) => { r.scrap -= 60; return Run.giveBlueprint(); } },
      { label: 'ことわる', apply: () => '男は肩をすくめて去っていった。' },
    ],
  },
  {
    id: 'radio', title: '無線', text: '雑音の向こうから声がする。「……まだ生きてる人がいる。こっちは5人。明日、誰か来てくれないか」',
    choices: [
      { label: '向かうと答える', apply: (r) => { r.flags.sos = true; return '明日の行き先に、大きな避難所が加わる。'; } },
      { label: '聞かなかったことにする', apply: () => '無線を切った。' },
    ],
  },
  {
    id: 'wounded', title: '門の前のけが人', text: '血を流した人が門の前に座りこんでいる。噛まれてはいないようだ。',
    choices: [
      { label: '食料 4 で手当てする', ok: (r) => r.food >= 4, apply: (r) => { r.food -= 4; const s = Run.addSurvivor(chance(0.5) ? 'doctor' : null); return `${s.name}（${TRAITS[s.trait].name}）が仲間になった。`; } },
      { label: '門を開けない', apply: () => '朝には、もういなかった。' },
    ],
  },
  {
    id: 'drop', title: '夜空のパラシュート', text: '補給物資らしい箱が、街のほうへゆっくり落ちていく。',
    choices: [
      { label: 'いますぐ取りに行く', apply: (r) => {
        r.scrap += 35;
        if (chance(0.4)) { Run.damageCar(0.25); return 'スクラップを 35 手に入れた。帰り道で囲まれ、車が傷んだ。'; }
        return 'スクラップを 35 手に入れた。';
      } },
      { label: '朝まで待つ', apply: (r) => { r.scrap += 12; return '朝には半分ほど持ち去られていた。スクラップ +12'; } },
    ],
  },
  {
    id: 'thief', title: '減っている食料', text: '倉庫の食料が、数えるたびに少しずつ減っている。',
    choices: [
      { label: '見張りを立てる（スクラップ 15）', ok: (r) => r.scrap >= 15, apply: (r) => { r.scrap -= 15; return '犯人はネズミだった。穴をふさいだ。'; } },
      { label: '気にしない', apply: (r) => { const n = Math.ceil(r.food * 0.2); r.food -= n; return `食料が ${n} なくなった。`; } },
    ],
  },
  {
    id: 'overtime', title: '夜なべ', text: '仲間が言う。「作業場を夜通し動かせば、もう少し鉄くずが作れる」',
    choices: [
      { label: '頼む（食料 -4）', ok: (r) => r.food >= 4, apply: (r) => { r.food -= 4; r.scrap += 28; return 'スクラップ +28'; } },
      { label: '休ませる', apply: () => 'みんなよく眠った。' },
    ],
  },
  {
    id: 'dog', title: '迷いこんだ犬', text: 'やせた犬が門のすきまから入ってきて、しっぽを振っている。',
    choices: [
      { label: '食料 2 をあげて飼う', ok: (r) => r.food >= 2, apply: (r) => { r.food -= 2; Run.addSurvivor('dog', 'ポチ'); return 'ポチが番犬になった。'; } },
      { label: '追いはらう', apply: () => '犬は闇に消えた。' },
    ],
  },
  {
    id: 'quiet', title: '静かな夜', text: 'うめき声も聞こえない。ひさしぶりに、みんなでゆっくり眠れた。',
    choices: [
      { label: 'おやすみ', apply: () => { Run.repairCarFree(0.2); return '整備にも手が回った。車が少し直った。'; } },
    ],
  },
  {
    id: 'blueprint', title: 'がれきの中の紙', text: '廃材を仕分けていた仲間が、油で汚れた設計図を見つけた。',
    choices: [
      { label: '広げてみる', ok: () => Run.lockedParts().length > 0, apply: () => Run.giveBlueprint() },
      { label: '燃料にする', apply: (r) => { r.fuel += 1; return '燃料 +1'; } },
    ],
  },
  {
    id: 'kids', title: '子どもたち', text: '近くの家に隠れていた兄妹が、白い旗を振って歩いてきた。',
    choices: [
      { label: '迎え入れる', apply: () => { const a = Run.addSurvivor(null), b = Run.addSurvivor(null); return `${a.name} と ${b.name} が仲間になった。食べる口が増える。`; } },
      { label: '食料 4 を持たせて帰す', ok: (r) => r.food >= 4, apply: (r) => { r.food -= 4; return 'ふたりは何度も振り返りながら帰っていった。'; } },
    ],
  },
];

/* ------------------------------- 遺産 ------------------------------- */
/* ランが終わるともらえる勲章で買う。次のランからずっと効く。 */
const META = [
  { id: 'scrap',  name: 'へそくり',       max: 3, cost: [3, 6, 10], desc: 'はじめのスクラップ +40' },
  { id: 'food',   name: '保存食',         max: 3, cost: [2, 5, 8],  desc: 'はじめの食料 +8' },
  { id: 'fuel',   name: '予備タンク',     max: 2, cost: [3, 7],     desc: 'はじめの燃料 +2' },
  { id: 'bp',     name: '設計図の写し',   max: 3, cost: [4, 8, 12], desc: 'はじめから設計図を1枚多く持つ' },
  { id: 'crew',   name: '古い仲間',       max: 2, cost: [4, 9],     desc: 'はじめの仲間 +1' },
  { id: 'tower',  name: '据えつけ銃座',   max: 1, cost: [6],        desc: 'はじめから機銃塔が1基ある' },
  { id: 'plate',  name: '厚い板',         max: 3, cost: [4, 8, 13], desc: '車のすべての部品の耐久 +10%' },
  { id: 'reroll', name: '迷い',           max: 2, cost: [5, 10],    desc: '強化の選び直しが1日に1回ふえる' },
];

/* はじめの車。運転席のまわりに最低限の装甲と機関銃。 */
const START_DESIGN = [
  { c: 2, r: 1, t: 'ram', rot: 0 },
  { c: 1, r: 2, t: 'armor' }, { c: 2, r: 2, t: 'mg', rot: 0 }, { c: 3, r: 2, t: 'armor' },
  { c: 1, r: 3, t: 'armor' }, { c: 2, r: 3, t: 'cabin' }, { c: 3, r: 3, t: 'armor' },
  { c: 1, r: 4, t: 'cargo' }, { c: 2, r: 4, t: 'engine' }, { c: 3, r: 4, t: 'seat' },
  { c: 2, r: 5, t: 'armor' },
];
