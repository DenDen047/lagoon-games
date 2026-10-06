/* =========================================================================
   ORE TO ARMADA ― データ
   ブロック / アイテム / レシピ / 船の型 / 乗員 / 銀河 / 数値の初期値
   数値はすべて調整前の初期値 (DESIGN.md 参照)。
   ========================================================================= */
'use strict';

const TUNE = {
  tilePx: 16,
  maxSpeed: 40,          // マス/秒
  maxSpin: 2.6,          // ラジアン/秒
  dayLength: 900,        // ゲーム内1日 = 実時間15分 (秒)
  suitO2: 180,           // 宇宙服の酸素 (秒)
  suitPower: 100,
  jetForce: 9,           // ジェットパックの加速 (マス/秒^2)
  jetDrain: 1.2,         // ジェットパック使用中のスーツ電力消費 (/秒)
  walkSpeed: 4.2,
  sectorRadius: 1500,
  startCredits: 200,
  buildRange: 10,
  refundRate: 0.8,
  markup: 1.5,           // 完成品・輸入部品の割高率
  maxGridSize: 128,
  maxBaseSize: 256,
  maxGrids: 60,
  maxBlocksActive: 50000,
  maxBullets: 800,
  maxCrew: 40,
  maxFleet: 12,
  maxDrones: 24,
  fragmentMin: 9,        // これ未満のブロック数の破片は回収物になる
  deathFine: 0.1,
  towFine: 0.2,
  surfaceR: 460,         // 惑星の地上の広さ (半径、マス)
};

/* ---------------- アイテム ---------------- */
const ITEMS = {};
function defItem(id, name, kind, price, color, extra) { ITEMS[id] = Object.assign({ id, name, kind, price, color }, extra || {}); }
// 鉱石
defItem('ore_iron', '鉄鉱石', 'ore', 2, '#b5793f', { mat: 'm_iron', ring: 0 });
defItem('ore_si', 'ケイ素', 'ore', 3, '#c9c3a6', { mat: 'm_si', ring: 0 });
defItem('ore_ice', '氷', 'ore', 2, '#9fe0ff', { ring: 0 });
defItem('ore_ni', 'ニッケル', 'ore', 6, '#8fbf8a', { mat: 'm_ni', ring: 1 });
defItem('ore_au', '金', 'ore', 15, '#ffd24a', { mat: 'm_au', ring: 1 });
defItem('ore_u', 'ウラン', 'ore', 25, '#7dff5a', { mat: 'm_u', ring: 2 });
defItem('ore_prism', '虹晶石', 'ore', 60, '#ff7ae0', { mat: 'm_prism', ring: 2 });
defItem('ore_void', 'ヴォイド結晶', 'ore', 150, '#9a6bff', { mat: 'm_void', ring: 3 });
// 素材 (精錬後。売値はおよそ鉱石の2倍)
defItem('m_iron', '鉄材', 'mat', 4, '#c98a52');
defItem('m_si', 'ケイ素材', 'mat', 6, '#ddd6b8');
defItem('m_ni', 'ニッケル材', 'mat', 12, '#a6d8a0');
defItem('m_au', '金材', 'mat', 30, '#ffe07a');
defItem('m_u', 'ウラン材', 'mat', 50, '#a4ff8a');
defItem('m_prism', '虹晶材', 'mat', 120, '#ffa6ec');
defItem('m_void', 'ヴォイド材', 'mat', 300, '#b89aff');
// 部品
defItem('p_steel', '鋼板', 'part', 6, '#9aa4b2');
defItem('p_armor', '重装甲板', 'part', 36, '#6f7b88');
defItem('p_glass', 'ガラス板', 'part', 8, '#9fe0ff');
defItem('p_circuit', '回路', 'part', 14, '#5fd18a');
defItem('p_adv', '上位回路', 'part', 50, '#ffd24a');
defItem('p_thr', '推進部品', 'part', 14, '#ff9a4a');
defItem('p_advthr', '上位推進部品', 'part', 36, '#ff6a2a');
defItem('p_lens', '光学レンズ', 'part', 150, '#ff7ae0');
defItem('p_barrier', 'バリア結晶', 'part', 160, '#8a7aff');
defItem('p_void', '虚空コア', 'part', 380, '#9a6bff');
// 燃料・弾・消耗品
defItem('fuel_rod', '核燃料棒', 'fuel', 70, '#7dff5a');
defItem('ammo', '弾薬箱', 'ammo', 10, '#e0c070');
defItem('missile', 'ミサイル', 'ammo', 30, '#ff6a4a');
defItem('o2_bottle', '酸素ボトル', 'use', 8, '#9fe0ff');
defItem('battery_pack', '予備バッテリー', 'use', 12, '#ffe35a');

const ORE_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'ore');

/* 精錬: 鉱石1 → 素材1。氷は水素になってタンクへ入る。 */
const REFINE = {
  ore_iron: { out: 'm_iron', t: 1.0 }, ore_si: { out: 'm_si', t: 1.0 }, ore_ni: { out: 'm_ni', t: 1.4 },
  ore_au: { out: 'm_au', t: 1.8 }, ore_u: { out: 'm_u', t: 2.2 }, ore_prism: { out: 'm_prism', t: 2.6 },
  ore_void: { out: 'm_void', t: 3.2 }, ore_ice: { h2: 10, t: 0.8 },
};
/* 組立: 素材 → 部品。 */
const ASSEMBLE = [
  { out: 'p_steel', n: 1, in: { m_iron: 1 }, t: 1.0 },
  { out: 'p_glass', n: 1, in: { m_si: 1 }, t: 1.0 },
  { out: 'p_circuit', n: 1, in: { m_si: 1, m_iron: 1 }, t: 1.6 },
  { out: 'p_thr', n: 1, in: { m_iron: 1, m_si: 1 }, t: 1.6 },
  { out: 'p_armor', n: 1, in: { m_ni: 2, m_iron: 1 }, t: 2.4 },
  { out: 'p_advthr', n: 1, in: { m_ni: 2 }, t: 2.4 },
  { out: 'p_adv', n: 1, in: { m_au: 1, m_si: 1 }, t: 3.0 },
  { out: 'p_lens', n: 1, in: { m_prism: 1 }, t: 3.4 },
  { out: 'p_barrier', n: 1, in: { m_prism: 1 }, t: 3.4 },
  { out: 'p_void', n: 1, in: { m_void: 1 }, t: 4.0 },
  { out: 'fuel_rod', n: 1, in: { m_u: 1 }, t: 3.0 },
  { out: 'ammo', n: 1, in: { m_iron: 1 }, t: 0.8 },
  { out: 'missile', n: 1, in: { m_iron: 1, p_circuit: 1 }, t: 1.6 },
  { out: 'o2_bottle', n: 1, in: { m_iron: 1 }, t: 0.6 },
  { out: 'battery_pack', n: 1, in: { m_iron: 1, m_si: 1 }, t: 0.8 },
];

/* ---------------- ブロック ----------------
   air: 'seal' 気密 / 'room' 空気がたまり歩ける / 'leak' 空気が抜ける
   walk: 人が歩けるか。gridSolid: 別の船とぶつかるか。
   tier: 1..5 (解放時期)。'boss' はボスの戦利品。
   rot は DIRS の番号。推進器は「噴射の向き」、武器と操縦席は「向いている方」。 */
const CAT = {
  struct: { name: '構造', color: '#8b95a3' },
  control: { name: '運転', color: '#8fd3ff' },
  power: { name: '電力', color: '#ffd84a' },
  thrust: { name: '推進', color: '#ff9a4a' },
  defense: { name: '防御', color: '#9a7cff' },
  weapon: { name: '武器', color: '#ff5a5a' },
  life: { name: '生活', color: '#5fd18a' },
  prod: { name: '生産', color: '#b0875a' },
  dock: { name: '発着', color: '#5ec8b8' },
  station: { name: '施設', color: '#8fd3ff' },
  rock: { name: '岩', color: '#6b5d52' },
  bio: { name: '生体', color: '#b04a8a' },
};

const BLOCKS = {};
const BLOCK_LIST = [];
function B(id, o) {
  const d = Object.assign({
    id, cat: 'struct', tier: 1, size: [1, 1], hp: 60, mass: 1, cost: { p_steel: 1 },
    air: 'seal', walk: false, gridSolid: true, power: 0, armor: 'normal', desc: '',
  }, o);
  d.index = BLOCK_LIST.length;
  BLOCKS[id] = d; BLOCK_LIST.push(d);
  return d;
}
// 構造
B('wall', { name: '鋼鉄の壁', hp: 100, mass: 1, cost: { p_steel: 2 }, star: true, desc: '気密。いちばん安い外壁' });
B('wall_slope', { name: '斜めの鋼鉄の壁', hp: 80, mass: 0.7, cost: { p_steel: 1 }, slope: true, star: true, desc: '三角形。船の輪郭を整える' });
B('armor', { name: '重装甲の壁', tier: 2, hp: 400, mass: 4, cost: { p_armor: 2 }, armor: 'heavy', star: true, desc: '気密。光線のダメージを半分にする' });
B('armor_slope', { name: '斜めの重装甲の壁', tier: 2, hp: 320, mass: 3, cost: { p_armor: 1 }, armor: 'heavy', slope: true, star: true, desc: '重装甲の三角形' });
B('glass', { name: '窓ガラス', hp: 40, mass: 0.5, cost: { p_glass: 1 }, glass: true, star: true, desc: '気密。視線と光を通す' });
B('glass_r', { name: '強化ガラス', tier: 3, hp: 160, mass: 1, cost: { p_glass: 2, p_lens: 1 }, glass: true, star: true, desc: '気密で丈夫。視線と光を通す' });
B('floor', { name: '床', hp: 30, mass: 0.3, cost: { p_steel: 1 }, air: 'room', walk: true, desc: '人が歩けるマス。壁で囲うと部屋になる' });
B('frame', { name: '骨組み', hp: 50, mass: 0.3, cost: { p_steel: 1 }, air: 'leak', desc: '軽くて安いが気密ではない' });
B('door', { name: 'ドア', hp: 80, mass: 1, cost: { p_steel: 2, p_circuit: 1 }, door: true, walk: true, desc: '人が通ると開く。穴があいた部屋の隣では閉まる' });
B('airlock', { name: 'エアロック', size: [1, 2], hp: 120, mass: 2, cost: { p_steel: 4, p_circuit: 2 }, walk: true, desc: '空気を逃がさずに船外へ出入りする' });
// 運転
B('cockpit', { cat: 'control', name: '小型操縦席', hp: 80, mass: 1.5, cost: { p_steel: 2, p_circuit: 2, p_glass: 1 }, seat: 'pilot', torque: 1500, star: true, desc: '1人乗り。船を動かし、前向きの武器を撃つ' });
B('bridge', { cat: 'control', name: '艦橋', tier: 3, size: [2, 2], hp: 300, mass: 6, cost: { p_steel: 8, p_adv: 4, p_glass: 4 }, seat: 'pilot', torque: 6000, bridge: true, star: true, desc: '艦隊命令を出せる。操縦士が座ると加速と旋回が1割上がる' });
B('gunseat', { cat: 'control', name: '砲手席', tier: 2, hp: 80, mass: 1.5, cost: { p_steel: 2, p_circuit: 3 }, seat: 'gunner', star: true, desc: '砲塔を手で狙う。砲手を座らせてもよい' });
B('remote', { cat: 'control', name: '遠隔操縦器', tier: 3, hp: 60, cost: { p_circuit: 4, p_adv: 2 }, remote: true, desc: '艦隊の船にその場から乗り移る' });
B('aicore', { cat: 'control', name: 'AIコア', tier: 4, hp: 80, cost: { p_adv: 4, p_void: 1 }, aicore: true, power: -2, desc: '乗員がいなくても命令どおりに動く' });
// 電力
B('solar', { cat: 'power', name: '太陽電池板', hp: 30, mass: 0.4, cost: { p_glass: 1, p_circuit: 1 }, air: 'leak', solar: 3, star: true, desc: '燃料不要。恒星に近いほど発電する (0〜3)' });
B('h2gen', { cat: 'power', name: '水素発電機', tier: 2, size: [2, 2], hp: 200, mass: 6, cost: { p_steel: 6, p_circuit: 4, p_thr: 2 }, gen: 40, h2use: 0.5, star: true, desc: '水素を燃やして 40 発電する' });
B('reactor', { cat: 'power', name: '核融合炉', tier: 4, size: [3, 3], hp: 500, mass: 25, cost: { p_armor: 10, p_adv: 8, p_steel: 10 }, gen: 200, rodTime: 120, explode: 5, star: true, desc: '核燃料棒で 200 発電。壊れると大爆発' });
B('battery', { cat: 'power', name: 'バッテリー', hp: 60, mass: 1, cost: { p_steel: 1, p_circuit: 2 }, cap: 100, desc: '電気を 100 ためる' });
// 推進
B('thruster', { cat: 'thrust', name: '小型推進器', hp: 60, mass: 1, cost: { p_steel: 1, p_thr: 2 }, thrust: 60, pdraw: 2, desc: '電気で噴射する。向いた方と逆へ押す' });
B('thruster_l', { cat: 'thrust', name: '大型推進器', tier: 2, size: [2, 2], hp: 250, mass: 6, cost: { p_steel: 6, p_advthr: 4 }, thrust: 360, h2draw: 0.4, desc: '小型の6倍の力。水素を使う' });
B('gyro', { cat: 'thrust', name: 'ジャイロ', hp: 60, mass: 2, cost: { p_steel: 2, p_thr: 1, p_circuit: 1 }, torque: 3000, power: -1, desc: '船を回す力を足す' });
B('h2tank', { cat: 'thrust', name: '水素タンク', size: [1, 2], hp: 80, mass: 2, cost: { p_steel: 4 }, h2cap: 200, explode: 2, desc: '水素をためる。撃たれると爆発する' });
B('jumpdrive', { cat: 'thrust', name: 'ジャンプドライブ', tier: 'boss', size: [3, 3], hp: 300, mass: 20, cost: { p_advthr: 10, p_adv: 6, p_steel: 10 }, jump: true, desc: '隣の星系へ跳ぶ。30秒の充電と水素がいる' });
// 防御
B('shield', { cat: 'defense', name: 'バリア発生器', tier: 2, size: [2, 2], hp: 150, mass: 5, cost: { p_barrier: 2, p_circuit: 4, p_steel: 4 }, shieldCap: 300, shieldRegen: 20, pdraw: 15, star: true, desc: '船全体を包むバリア。容量 300、毎秒 20 回復' });
B('shield_p', { cat: 'defense', name: 'バリア投射器', tier: 3, hp: 80, mass: 1.5, cost: { p_barrier: 1, p_circuit: 2 }, arcCap: 120, arcRegen: 30, pdraw: 8, star: true, desc: '向いた側に90度の弧のバリアを張る' });
B('airbarrier', { cat: 'defense', name: 'エアバリア', tier: 2, hp: 60, mass: 0.5, cost: { p_barrier: 1, p_circuit: 1 }, walk: true, gridSolid: false, airBarrier: true, power: -1, star: true, desc: '空気は通さず、船と人は通す膜' });
B('pd', { cat: 'defense', name: '点防御砲', tier: 3, hp: 60, mass: 1.5, cost: { p_steel: 2, p_circuit: 3 }, turret: true, weapon: 'pd', desc: 'ミサイルを自動で撃ち落とす' });
// 武器
B('mg', { cat: 'weapon', name: '機関銃', hp: 70, mass: 1.5, cost: { p_steel: 2, p_circuit: 1 }, turret: true, weapon: 'mg', star: true, desc: '実弾。射程 60。速く撃ってばらまく' });
B('autocannon', { cat: 'weapon', name: 'オートキャノン', tier: 3, size: [2, 2], hp: 220, mass: 5, cost: { p_armor: 2, p_circuit: 4, p_steel: 4 }, turret: true, weapon: 'cannon', star: true, desc: '実弾。射程 90。重い弾で装甲を削る' });
B('laser', { cat: 'weapon', name: 'レーザー砲', tier: 2, hp: 70, mass: 1.5, cost: { p_lens: 1, p_circuit: 2 }, turret: true, weapon: 'laser', star: true, desc: '光線。射程 80。撃っている間は電力 8' });
B('laser_h', { cat: 'weapon', name: '重レーザー', tier: 4, size: [2, 2], hp: 200, mass: 5, cost: { p_lens: 3, p_adv: 3, p_steel: 4 }, turret: true, weapon: 'hlaser', star: true, desc: '光線。射程 120。バリアを割る' });
B('missile', { cat: 'weapon', name: 'ミサイル発射器', tier: 3, size: [2, 2], hp: 180, mass: 5, cost: { p_steel: 4, p_circuit: 4 }, turret: true, weapon: 'missile', star: true, desc: '爆発。射程 150。目標を追う' });
B('railgun', { cat: 'weapon', name: 'レールガン', tier: 5, size: [1, 4], hp: 300, mass: 12, cost: { p_void: 2, p_adv: 4, p_armor: 4 }, fixed: true, weapon: 'rail', star: true, desc: '実弾。射程 250。ためて撃ち、5枚貫く' });
B('minelaser', { cat: 'weapon', name: '採掘レーザー', hp: 50, mass: 1, cost: { p_steel: 1, p_circuit: 1, p_glass: 1 }, fixed: true, weapon: 'mine', desc: '小惑星を掘る。船にも少しだけ効く' });
B('drill', { cat: 'weapon', name: '採掘ドリル', hp: 120, mass: 2, cost: { p_steel: 3, p_thr: 1 }, fixed: true, drill: true, desc: '押し当てて掘る。レーザーの3倍速い' });
B('ammobox', { cat: 'weapon', name: '弾薬庫', hp: 60, mass: 1, cost: { p_steel: 2 }, cargo: 120, ammoOnly: true, explode: 2, desc: '弾をためる。撃たれると誘爆する' });
// 生活と乗員
B('o2gen', { cat: 'life', name: '酸素発生器', size: [1, 2], hp: 80, mass: 2, cost: { p_steel: 3, p_circuit: 2 }, o2gen: true, pdraw: 5, desc: '氷から酸素を作って部屋に送る' });
B('bed', { cat: 'life', name: '寝台', tier: 1, size: [1, 2], hp: 50, mass: 1, cost: { p_steel: 2 }, air: 'room', walk: true, bed: true, desc: '乗員1人分の寝床' });
B('medbay', { cat: 'life', name: '医療室', tier: 2, size: [2, 2], hp: 120, mass: 3, cost: { p_steel: 4, p_circuit: 3, p_glass: 2 }, air: 'room', walk: true, medbay: true, power: -3, desc: 'ケガを治す。蘇生地点にできる' });
B('charger', { cat: 'life', name: '充電台', hp: 50, mass: 1, cost: { p_steel: 1, p_circuit: 1 }, air: 'room', walk: true, charger: true, desc: '乗るとスーツ電力と酸素が満ちる' });
B('pod', { cat: 'life', name: '脱出ポッド', tier: 2, size: [1, 2], hp: 80, mass: 2, cost: { p_steel: 4, p_thr: 2, p_circuit: 2 }, pod: 4, desc: '4人乗り。船を捨てるとき乗員を逃がす' });
// 生産と貨物
B('cargo', { cat: 'prod', name: '小型貨物庫', hp: 60, mass: 1, cost: { p_steel: 2 }, cargo: 50, desc: '容量 50' });
B('cargo_l', { cat: 'prod', name: '大型貨物庫', tier: 2, size: [3, 3], hp: 300, mass: 6, cost: { p_steel: 14 }, cargo: 600, desc: '容量 600' });
B('refinery', { cat: 'prod', name: '精錬機', tier: 2, size: [2, 2], hp: 180, mass: 6, cost: { p_steel: 8, p_circuit: 3 }, refine: 1, pdraw: 10, desc: '鉱石を素材にする' });
B('assembler', { cat: 'prod', name: '組立機', tier: 2, size: [2, 2], hp: 180, mass: 6, cost: { p_steel: 6, p_circuit: 5 }, assemble: 1, pdraw: 10, desc: '素材から部品を作る' });
B('repairarm', { cat: 'prod', name: '修理アーム', tier: 3, hp: 80, mass: 1.5, cost: { p_circuit: 3, p_thr: 1, p_steel: 2 }, repair: 6, pdraw: 4, desc: '周り6マスの壊れたブロックを直す' });
B('refinery_l', { cat: 'prod', name: '大型精錬機', tier: 3, size: [3, 3], hp: 400, mass: 14, cost: { p_steel: 16, p_circuit: 6, p_thr: 2 }, refine: 4, pdraw: 25, baseOnly: true, desc: '基地専用。精錬機の4倍速い' });
B('shipyard', { cat: 'prod', name: '造船台', tier: 3, size: [3, 3], hp: 400, mass: 14, cost: { p_steel: 16, p_adv: 2, p_circuit: 6 }, shipyard: true, baseOnly: true, desc: '基地専用。設計図から船を組み上げる' });
// 発着と固定
B('connector', { cat: 'dock', name: 'ドッキング端子', tier: 2, hp: 80, mass: 1, cost: { p_steel: 2, p_circuit: 2 }, connector: true, desc: '別の船とつながり、電力と貨物を共有する' });
B('hangar', { cat: 'dock', name: '格納庫の床', tier: 3, hp: 40, mass: 0.3, cost: { p_steel: 1 }, air: 'room', walk: true, gridSolid: false, hangar: true, desc: '小型船を止めておく床' });
B('catapult', { cat: 'dock', name: '発射カタパルト', tier: 3, size: [1, 4], hp: 200, mass: 4, cost: { p_steel: 6, p_thr: 4, p_circuit: 2 }, air: 'room', walk: true, gridSolid: false, hangar: true, catapult: true, desc: '格納した小型船を打ち出す' });
B('dronebay', { cat: 'dock', name: '無人機ベイ', tier: 4, size: [2, 2], hp: 200, mass: 5, cost: { p_void: 1, p_adv: 2, p_steel: 6 }, drones: 3, pdraw: 2, desc: '戦闘用の無人機を3機まで出し入れする' });
B('anchor', { cat: 'dock', name: '固定アンカー', hp: 200, mass: 3, cost: { p_steel: 4 }, anchor: true, desc: '大きな小惑星に打ちこむと基地になる' });
// ステーションの窓口 (建てられない)
const KIOSKS = {
  k_market: '市場', k_parts: '部品屋', k_bp: '設計図屋', k_hire: '求人所',
  k_mission: '依頼板', k_med: '医療室', k_yard: '造船所', k_repair: '修理ドック',
};
for (const k in KIOSKS) B(k, { cat: 'station', name: KIOSKS[k], tier: 99, hp: 99999, mass: 5, kiosk: k, noBuild: true });
B('st_wall', { cat: 'station', name: 'ステーションの壁', tier: 99, hp: 99999, mass: 5, noBuild: true });
B('st_glass', { cat: 'station', name: 'ステーションの窓', tier: 99, hp: 99999, mass: 5, glass: true, noBuild: true });
B('gate', { cat: 'station', name: '交易ゲート', tier: 99, size: [3, 3], hp: 99999, mass: 50, air: 'leak', gate: true, noBuild: true });
// 群体の生体ブロック (敵専用)
B('bio_shell', { cat: 'bio', name: '殻', tier: 99, hp: 250, mass: 2, air: 'leak', armor: 'bio', noBuild: true });
B('bio_core', { cat: 'bio', name: '核', tier: 99, hp: 400, mass: 6, air: 'leak', bioCore: true, torque: 20000, noBuild: true });
B('bio_jaw', { cat: 'bio', name: '顎', tier: 99, hp: 180, mass: 2, air: 'leak', jaw: true, noBuild: true });
B('bio_spore', { cat: 'bio', name: '胞子砲', tier: 99, hp: 120, mass: 2, air: 'leak', turret: true, weapon: 'spore', noBuild: true });
B('bio_regen', { cat: 'bio', name: '再生腺', tier: 99, hp: 150, mass: 2, air: 'leak', regen: 6, noBuild: true });
B('bio_flesh', { cat: 'bio', name: '肉', tier: 99, hp: 120, mass: 1.5, air: 'leak', noBuild: true });
// ステーションの船の乗り場 (保存の番号がずれないよう、ブロックの一覧の最後に足す)
B('k_board', { cat: 'station', name: '船の乗り場', tier: 99, hp: 99999, mass: 5, kiosk: 'k_board', noBuild: true });

const BUILD_CATS = ['struct', 'control', 'power', 'thrust', 'defense', 'weapon', 'life', 'prod', 'dock'];

/* 小惑星のマス。ブロックとは別に 1 バイトで持つ。 */
const TERRAIN = [
  null,
  { id: 'rock', name: '岩', hp: 25, color: '#6b5d52', ore: null },
  { id: 'rock2', name: '硬い岩', hp: 45, color: '#564a42', ore: null },
  { id: 'v_iron', name: '鉄の鉱脈', hp: 35, color: '#b5793f', ore: 'ore_iron' },
  { id: 'v_si', name: 'ケイ素の鉱脈', hp: 35, color: '#c9c3a6', ore: 'ore_si' },
  { id: 'v_ice', name: '氷', hp: 20, color: '#9fe0ff', ore: 'ore_ice' },
  { id: 'v_ni', name: 'ニッケルの鉱脈', hp: 45, color: '#8fbf8a', ore: 'ore_ni' },
  { id: 'v_au', name: '金の鉱脈', hp: 50, color: '#ffd24a', ore: 'ore_au' },
  { id: 'v_u', name: 'ウランの鉱脈', hp: 60, color: '#7dff5a', ore: 'ore_u' },
  { id: 'v_prism', name: '虹晶石の鉱脈', hp: 70, color: '#ff7ae0', ore: 'ore_prism' },
  { id: 'v_void', name: 'ヴォイド結晶', hp: 90, color: '#9a6bff', ore: 'ore_void' },
];
const TERRAIN_BY_ORE = {};
TERRAIN.forEach((t, i) => { if (t && t.ore) TERRAIN_BY_ORE[t.ore] = i; });

/* ---------------- 武器 ----------------
   type: kinetic 実弾 / beam 光線 / blast 爆発 */
const WEAPONS = {
  mg: { type: 'kinetic', dmg: 3, rof: 8, range: 60, speed: 90, spread: 0.06, ammo: 0.02, turn: 5, sfx: 'mg' },
  cannon: { type: 'kinetic', dmg: 40, rof: 2, range: 90, speed: 80, spread: 0.02, ammo: 0.1, turn: 2.2, sfx: 'cannon', big: true },
  laser: { type: 'beam', dps: 30, range: 80, power: 8, turn: 4, sfx: 'laser' },
  hlaser: { type: 'beam', dps: 90, range: 120, power: 25, turn: 2, sfx: 'laser', big: true },
  missile: { type: 'blast', dmg: 120, radius: 2, rof: 1 / 3, range: 150, speed: 34, ammoItem: 'missile', turn: 3, sfx: 'missile', homing: true },
  rail: { type: 'kinetic', dmg: 400, pierce: 5, charge: 6, range: 250, speed: 400, power: 50, sfx: 'rail' },
  pd: { type: 'kinetic', dmg: 8, rof: 8, range: 25, speed: 120, spread: 0.03, ammo: 0.01, turn: 8, sfx: 'mg', pd: true },
  mine: { type: 'beam', dps: 16, mine: 34, range: 18, power: 1, sfx: 'mine' },
  spore: { type: 'blast', dmg: 45, radius: 1.5, rof: 0.7, range: 70, speed: 40, turn: 3, sfx: 'missile' },
  hand: { type: 'kinetic', dmg: 12, rof: 4, range: 30, speed: 70, spread: 0.02 },
  drone: { type: 'kinetic', dmg: 5, rof: 5, range: 40, speed: 90, spread: 0.05 },
};
/* ダメージ倍率 (DESIGN.md 8.2) */
const DMG_MUL = {
  kinetic: { shield: 0.5, heavy: 1.0, normal: 1.0, bio: 0.5 },
  beam: { shield: 1.5, heavy: 0.5, normal: 1.0, bio: 1.5 },
  blast: { shield: 1.0, heavy: 0.75, normal: 1.25, bio: 1.0 },
};

/* ---------------- 船の型 ----------------
   文字 → [ブロック, 向き]。'+' は複数マスのブロックの続き、'.' と ' ' は空き。
   'w' は武器の枠 (勢力の武器から選ぶ)、'a' は外壁の枠 (強さに応じて重装甲)。 */
const LEGEND = {
  '#': ['wall', 0], 'A': ['armor', 0], '=': ['glass', 0], '_': ['floor', 0], '%': ['frame', 0], 'D': ['door', 0],
  '1': ['wall_slope', 0], '2': ['wall_slope', 1], '3': ['wall_slope', 2], '4': ['wall_slope', 3],
  '5': ['armor_slope', 0], '6': ['armor_slope', 1], '7': ['armor_slope', 2], '8': ['armor_slope', 3],
  'L': ['airlock', 0], 'l': ['airlock', 1],
  'C': ['cockpit', 0], 'U': ['bridge', 0], 'p': ['gunseat', 0], 'V': ['aicore', 0],
  'S': ['solar', 0], 'B': ['battery', 0], 'W': ['h2gen', 0], 'E': ['reactor', 0],
  '^': ['thruster', 0], '>': ['thruster', 1], 'v': ['thruster', 2], '<': ['thruster', 3], 'T': ['thruster_l', 2],
  'G': ['gyro', 0], 'H': ['h2tank', 0], 'J': ['jumpdrive', 0],
  'Q': ['shield', 0], 'x': ['shield_p', 0], 'f': ['airbarrier', 0], 'P': ['pd', 0],
  'g': ['mg', 0], 'N': ['autocannon', 0], 'z': ['laser', 0], 'Z': ['laser_h', 0], 'I': ['missile', 0], 'R': ['railgun', 0],
  'M': ['minelaser', 0], 'd': ['drill', 0], '!': ['ammobox', 0],
  'O': ['o2gen', 0], 'b': ['bed', 0], 'm': ['medbay', 0], 'c': ['charger', 0], 'e': ['pod', 0],
  'K': ['cargo', 0], 'k': ['cargo_l', 0], 'F': ['refinery', 0], 'Y': ['assembler', 0], 'r': ['repairarm', 0],
  'X': ['connector', 0], 'h': ['hangar', 0], 'j': ['catapult', 0], 'y': ['dronebay', 0], 'n': ['anchor', 0],
};

const SHIPS = {
  starter: {
    name: 'コガネ号', rows: [
      '^MS',
      '<C>',
      'SGB',
      'vKv',
    ],
  },
  // 店で買える船
  miner2: {
    name: '採掘艇 ハヤブサ', shop: 0, rows: [
      '.M.M.',
      '^#C#^',
      '<SGS>',
      '.KBK.',
      '.v.v.',
    ],
  },
  gunboat: {
    name: '小型戦闘艇 スズメバチ', shop: 0, rows: [
      '^g.g^',
      '1#C#2',
      '<SGS>',
      '#KBK#',
      '.v.v.',
    ],
  },
  hauler: {
    name: '輸送艇 ロバ', shop: 0, rows: [
      '.^1=2^.',
      '.<#C#>.',
      'L____O#',
      '+_c__+#',
      '#b_b_K#',
      '#+_+_K#',
      'SGBKKGS',
      '.v.v.v.',
    ],
  },
  frigate: {
    name: 'フリゲート アオサギ', shop: 1, rows: [
      '...1gCg2...',
      '..1#=_=#2..',
      '^g#_____#g^',
      '<##__c__##>',
      'L_D_____D_L',
      '+#b_b_b_b#+',
      '##+_+_+_+##',
      '#H_______K#',
      '#+B_O_Q+BK#',
      'SSG#+#++GSS',
      '.T+.v.v.T+.',
      '.++.....++.',
    ],
  },
  carrier: {
    name: '空母 オオワシ', shop: 1, rows: [
      '.^##fffffff##^.',
      '..#hhhhjhhhh#..',
      '..#hhhh+hhhh#..',
      '..#hhhh+hhhh#..',
      '..#hhhh+hhhh#..',
      '..#hhhhhhhhh#..',
      '..#hhhhhhhhh#..',
      '..#hhhhhhhhh#..',
      '..#hhhhhhhhh#..',
      '..#hhhhhhhhh#..',
      '.1####D######2.',
      '<#b_b__C__b_b#>',
      '<#+_+_____+_+#>',
      '##_O__c__O_KK##',
      '##_+__Q+_+_KK##',
      '##____++_____##',
      '#HGBW+___W+BGH#',
      '#+GS++###++SG+#',
      '.T+.T+.v.T+.T+.',
      '.++.++...++.++.',
    ],
  },
  // 海賊
  pirate_scout: {
    name: 'はぐれ海賊', faction: 'pirate', rows: [
      '.w^w.',
      '<aCa>',
      '.SGB.',
      '.v.v.',
    ],
  },
  pirate_raider: {
    name: '海賊の襲撃艇', faction: 'pirate', crew: 2, rows: [
      '..^wCw^..',
      '.1a=_=a2.',
      '<aa___aa>',
      'wa_b_b_aw',
      '.D_+c+_a.',
      '.aBKOKBa.',
      '..SG+GS..',
      '..v.v.v..',
    ],
  },
  pirate_gunship: {
    name: '海賊の砲艦', faction: 'pirate', crew: 4, rows: [
      '...1wCw2...',
      '..1a=_=a2..',
      '^wa_____aw^',
      '<aa__c__aa>',
      'D_D_____D_D',
      'aab_b_b_baa',
      'aa+_+_+_+aa',
      'aH_______Ka',
      'a+B_O_Q+BKa',
      'wSG#+#++GSw',
      '.T+.v.v.T+.',
      '.++.....++.',
    ],
  },
  union_patrol: {
    name: '連合の警備艇', faction: 'union', rows: [
      '.z^z.',
      '1#C#2',
      '<SGS>',
      '#BKB#',
      '.v.v.',
    ],
  },
};

/* ---------------- ステーションと拠点の型 ---------------- */
const STATION_LEGEND = {
  '#': ['st_wall', 0], '=': ['st_glass', 0], '1': ['k_market', 0], '2': ['k_parts', 0], '3': ['k_bp', 0], '4': ['k_hire', 0],
  '5': ['k_mission', 0], '6': ['k_med', 0], '7': ['k_yard', 0], '8': ['k_repair', 0], '9': ['k_board', 0],
};
const STATION_ROWS = (() => {
  const hub = [
    '##===###===###===###===##',
    '#_____#_____#_____#_____#',
    '#__1__#__2__#__3__#__4__#',
    '#_____#_____#_____#_____#',
    '###D#####D#####D#####D###',
    'L9_____________________9L',
    '+__________c____________+',
    '###D#####D#####D#####D###',
    '#_____#_____#_____#_____#',
    '#__5__#__6__#__7__#__8__#',
    '#_____#_____#_____#_____#',
    '##===###===###===###===##',
  ];
  return hub.map((r, y) => (y === 5 || y === 6) ? '.....' + r + '.....' : 'SSSSS' + r + 'SSSSS');
})();
/* 惑星の地上にある古い基地の跡 */
const RUIN_ROWS = [
  '..#####..',
  '.##_K_##.',
  '##_____##',
  'D___c___D',
  '##_____##',
  '.##_K_##.',
  '..#=#=#..',
];
const HIDEOUT_ROWS = [
  '...w###w...',
  '..##___##..',
  '.w#_K_K_#w.',
  '##___B___##',
  'w#_K___K_#w',
  '##___B___##',
  '.w#_K_K_#w.',
  '..##___##..',
  '...w###w...',
];

/* ---------------- 乗員 ---------------- */
const CREW_NAMES = ['ミナ', 'ケンジ', 'サラ', 'トウマ', 'リオ', 'ハナ', 'ユウ', 'アキラ', 'ノア', 'レン', 'カイ', 'ソラ', 'ミオ', 'タクミ', 'ユイ', 'ジン',
  'エマ', 'ルカ', 'ナギ', 'コウ', 'リン', 'ダイチ', 'サキ', 'マルコ', 'イリヤ', 'ファティマ', 'オスカー', 'チェン', 'アナ', 'ボリス', 'ニーナ', 'ラウル',
  'ハンナ', 'ヨナス', 'アイシャ', 'パブロ', 'リー', 'グレタ', 'タオ', 'ミゲル'];
const SKILLS = [
  { id: 'pilot', name: '操縦', title: '操縦士' }, { id: 'gun', name: '射撃', title: '砲手' }, { id: 'repair', name: '修理', title: '技師' },
  { id: 'mine', name: '採掘', title: '採掘士' }, { id: 'med', name: '医療', title: '医師' },
];
const TRAITS = [
  { id: 'neat', name: '几帳面', desc: '修理が速い' }, { id: 'deft', name: '器用', desc: '採掘が速い' },
  { id: 'cheer', name: '陽気', desc: '同じ部屋の仲間のやる気が上がる' }, { id: 'brave', name: '勇敢', desc: '戦闘でやる気が下がらない' },
  { id: 'timid', name: '臆病', desc: '戦闘中に持ち場を離れることがある' }, { id: 'frugal', name: '倹約家', desc: '日給が安い' },
];
const SUIT_COLORS = ['#e8864a', '#4ab0e8', '#e8d24a', '#7ae84a', '#e84a8a', '#b04ae8', '#e8e8e8', '#4ae8c8'];

/* ---------------- 銀河 ---------------- */
const RINGS = [
  { name: '外縁', count: 8, danger: 1, ores: ['ore_iron', 'ore_si', 'ore_ice'], tier: 2, r: 0.9 },
  { name: '中域', count: 8, danger: 2, ores: ['ore_iron', 'ore_si', 'ore_ice', 'ore_ni', 'ore_au'], tier: 3, r: 0.62 },
  { name: '内域', count: 6, danger: 3, ores: ['ore_iron', 'ore_si', 'ore_ice', 'ore_ni', 'ore_au', 'ore_u', 'ore_prism'], tier: 4, r: 0.36 },
  { name: '中心核', count: 2, danger: 4, ores: ['ore_iron', 'ore_si', 'ore_ice', 'ore_ni', 'ore_au', 'ore_u', 'ore_prism', 'ore_void'], tier: 5, r: 0.1 },
];
const SYSTEM_NAMES = ['アルデラ', 'ベスカ', 'カリオン', 'ディーネ', 'エルマ', 'フォルテ', 'ガレア', 'ハイネ', 'イオラ', 'ジュノ', 'ケルス', 'ルミナ',
  'マイラ', 'ノクス', 'オルテ', 'パラス', 'クエラ', 'レイヴ', 'サイス', 'ティオ', 'ウルム', 'ヴァール', 'ヴォイドゲート', 'ネストコア'];
const STAR_COLORS = ['#ffd27a', '#ffb45a', '#fff0c8', '#9fc8ff', '#ff8a6a', '#ffe0a0'];
const BG_COLORS = ['#05070d', '#070510', '#04080c', '#08060a', '#050a0a'];
const NEBULA_COLORS = ['#5a3aa8', '#2a6ab0', '#a83a6a', '#2aa88a', '#a8782a'];
const BOSSES = [
  { ring: 0, key: 'boss_pirate_king', name: '海賊王の旗艦 グレイブ', drop: ['jumpdrive'], bounty: 3000 },
  { ring: 1, key: 'boss_fortress', name: '鉄の要塞艦 バルバロス', drop: [], bounty: 9000 },
  { ring: 2, key: 'boss_queen', name: '群体の女王', drop: [], bounty: 20000 },
  { ring: 3, key: 'boss_mother', name: '群体の母艦', drop: [], bounty: 50000 },
];

/* ---------------- 惑星 ----------------
   first: 地上でよく取れる鉱石。rare: 星系より1つ内側の環までの珍しい鉱石も出る。
   tex: 宇宙から見た色 (低い所・高い所・模様)。ground: 地上の地面の色。 */
const PLANET_TYPES = {
  green: { name: '緑の惑星', air: true, tex: ['#2f6e9e', '#5fae5a', '#ffffff'], ground: '#3d5e34', ground2: '#4f7442', spot: '#2c4626', first: ['ore_iron', 'ore_si'], rare: ['ore_au'], desc: '空気がある。宇宙服なしで息ができる' },
  rock: { name: '岩の惑星', tex: ['#5a4e44', '#8a7a6a', '#3e352e'], ground: '#5e5248', ground2: '#6e6056', spot: '#463d35', first: ['ore_iron'], rare: ['ore_ni', 'ore_u'], desc: '空気はない。鉄とニッケルが多い' },
  ice: { name: '氷の惑星', tex: ['#7fb0d0', '#e4f4ff', '#a8d4ec'], ground: '#b3cdd9', ground2: '#cfe2ea', spot: '#8fb0c2', first: ['ore_ice'], rare: ['ore_ni', 'ore_prism'], desc: '空気はない。氷がたくさん取れる' },
  desert: { name: '砂の惑星', tex: ['#a07040', '#e0b878', '#c89a5e'], ground: '#ab8a56', ground2: '#c09e68', spot: '#8a6c44', first: ['ore_si'], rare: ['ore_au', 'ore_prism'], desc: '空気はない。ケイ素と金が出る' },
  lava: { name: '溶岩の惑星', tex: ['#3a1e18', '#5a2a1e', '#ff7a3a'], ground: '#2e2422', ground2: '#3a2c28', spot: '#ff6a2a', first: ['ore_iron'], rare: ['ore_au', 'ore_u', 'ore_void'], desc: '空気はない。珍しい鉱石が眠っている' },
};
const PLANET_NUMS = ['I', 'II', 'III'];
