/* MECH FRONTIER のデータ: パーツ・メカ 50 種・ぶき・ざいりょう・たてもの部品 */
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const seeded = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ざいりょう
const MATS = {
  scrap: { name: 'スクラップ', icon: '[scrap]', sell: 6, buy: 20 },
  iron: { name: '鉄鉱', icon: '[iron]', sell: 18, buy: 55 },
  core: { name: 'エネルギーコア', icon: '[core]', sell: 70, buy: 220 },
  rare: { name: 'レアパーツ', icon: '[rare]', sell: 300, buy: 0 },
};
const MAT_KEYS = ['scrap', 'iron', 'core', 'rare'];
const costText = (c) => MAT_KEYS.filter(k => c[k]).map(k => MATS[k].icon + c[k]).join(' ');

// メカの色
const PAL = [0xd8dde6, 0x39414f, 0xe04a3a, 0xf28c28, 0xf2d13a, 0x58c44e, 0x2fa98c, 0x3fa7e8, 0x3558d6, 0x8a55e0,
  0xe060b8, 0x8b5a3c, 0x9aa7b5, 0x1d2026, 0xf6f6f2, 0x7fe0e8];
const PAL_NAMES = ['白', 'グレー', '赤', 'オレンジ', '黄', '緑', '深緑', '水色', '青', '紫', 'ピンク', '茶', '銀', '黒', 'ミルク', 'シアン'];

/* パーツ。じさくメカは この 4 しゅるいを くみあわせる。
   spd: はやさ(m/秒) / jump: ジャンプ力 / hp: たいりょく / cost: つくる ざいりょう */
const PARTS = {
  legs: [
    { name: '二足', hp: 90, spd: 11, jump: 13, turn: 5, cost: { scrap: 6 } },
    { name: '逆関節', hp: 70, spd: 14, jump: 18, turn: 6, cost: { scrap: 14, iron: 4 } },
    { name: '四脚', hp: 120, spd: 10, jump: 11, turn: 5, cost: { scrap: 16, iron: 6 } },
    { name: 'キャタピラ', hp: 190, spd: 8, jump: 6, turn: 2.6, cost: { scrap: 20, iron: 10 } },
    { name: 'ホバー', hp: 60, spd: 15, jump: 12, turn: 6, cost: { scrap: 16, iron: 6, core: 3 } },
    { name: 'クモ脚', hp: 100, spd: 13, jump: 15, turn: 7, cost: { scrap: 22, iron: 8, core: 1 } },
    { name: '重装脚', hp: 220, spd: 7.5, jump: 9, turn: 3, cost: { scrap: 30, iron: 16, core: 2 } },
    { name: 'タイヤ', hp: 80, spd: 18, jump: 8, turn: 4, cost: { scrap: 14, iron: 8 } },
  ],
  body: [
    { name: 'スタンダード', hp: 160, cost: { scrap: 6 } },
    { name: 'スリム', hp: 110, spdMul: 1.12, cost: { scrap: 10, iron: 3 } },
    { name: 'ヘビー', hp: 280, spdMul: .9, cost: { scrap: 24, iron: 12 } },
    { name: 'ボール', hp: 200, cost: { scrap: 20, iron: 10, core: 2 } },
    { name: 'タイタン', hp: 520, spdMul: .82, cost: { scrap: 50, iron: 30, core: 8, rare: 3 } },
    { name: 'ディスク', hp: 170, cost: { scrap: 18, iron: 8, core: 2 } },
    { name: 'ビースト', hp: 190, spdMul: 1.1, cost: { scrap: 22, iron: 10, core: 1 } },
    { name: 'ドラム', hp: 240, cost: { scrap: 18, iron: 10 } },
  ],
  head: [
    { name: 'バイザー', hp: 30, cost: { scrap: 4 } },
    { name: 'ドーム', hp: 40, cost: { scrap: 8, iron: 2 } },
    { name: 'モノアイ', hp: 30, cost: { scrap: 8, iron: 2 } },
    { name: 'センサー', hp: 25, cost: { scrap: 8, core: 1 } },
    { name: 'ツノ付き', hp: 45, cost: { scrap: 12, iron: 4 } },
    { name: 'キャノピー', hp: 35, cost: { scrap: 10, iron: 3, core: 1 } },
  ],
  arms: [
    { name: 'ノーマルアーム', hp: 40, cost: { scrap: 4 } },
    { name: 'ガンアーム', hp: 50, dmgMul: 1.15, cost: { scrap: 12, iron: 6 } },
    { name: 'クローアーム', hp: 60, meleeMul: 1.4, cost: { scrap: 14, iron: 6 } },
    { name: 'ウェポンポッド', hp: 50, dmgMul: 1.1, cost: { scrap: 12, iron: 4, core: 1 } },
    { name: 'ロングアーム', hp: 35, meleeMul: 1.2, cost: { scrap: 10, iron: 4 } },
    { name: 'シールドアーム', hp: 90, cost: { scrap: 16, iron: 10 } },
  ],
};
const PART_KEYS = ['head', 'body', 'arms', 'legs'];
const PART_LABEL = { head: 'コックピット', body: '胴体', arms: '腕', legs: '脚' };

/* メカ 50 種: [なまえ, あし, からだ, あたま, うで, 大きさ, 色1, 色2, ねだん] */
const FRAMES = [
  // にそく
  ['ルーキー', 0, 0, 0, 0, 1.0, 0, 8, 900], ['ソルジャー', 0, 0, 2, 1, 1.05, 5, 1, 1800], ['コマンダー', 0, 2, 4, 0, 1.15, 8, 4, 4200],
  ['スナイパー', 0, 1, 3, 4, 1.0, 6, 13, 3600], ['ナイト', 0, 0, 4, 5, 1.1, 12, 2, 5200],
  // ぎゃくかんせつ
  ['ホッパー', 1, 1, 1, 0, .9, 4, 1, 1500], ['ラプター', 1, 6, 2, 2, 1.0, 2, 13, 3900], ['ストライダー', 1, 0, 3, 1, 1.1, 7, 1, 4600],
  ['ファルコン', 1, 1, 5, 4, .95, 14, 8, 6200], ['レイヴン', 1, 6, 4, 1, 1.15, 13, 9, 9000],
  // よんきゃくボール (ころがる・ほうだい・コマ)
  ['コロボール', 2, 3, 1, 3, .85, 3, 1, 2600], ['ガトリングボール', 2, 3, 2, 1, 1.0, 5, 13, 5600], ['スピンボール', 2, 3, 3, 3, 1.05, 7, 14, 8200],
  ['ギガボール', 2, 3, 0, 1, 1.35, 2, 13, 14000], ['ボールキング', 2, 3, 4, 3, 1.6, 4, 9, 26000],
  // キャタピラ
  ['ドーザー', 3, 0, 0, 2, 1.0, 4, 1, 2200], ['タンクボーイ', 3, 7, 1, 1, 1.05, 6, 11, 3800], ['ブルタンク', 3, 2, 2, 1, 1.2, 1, 3, 7000],
  ['フォートレス', 3, 2, 3, 3, 1.4, 12, 2, 12000], ['ランドシップ', 3, 5, 5, 3, 1.6, 8, 14, 21000],
  // ホバー
  ['フロート', 4, 5, 1, 0, .9, 7, 14, 3200], ['スカイディスク', 4, 5, 5, 3, 1.0, 15, 8, 6400], ['ミラージュ', 4, 1, 3, 4, 1.0, 9, 15, 8800],
  ['ストームライダー', 4, 6, 2, 1, 1.1, 13, 7, 12500], ['セラフ', 4, 1, 4, 5, 1.2, 14, 4, 19000],
  // クモあし
  ['クロウラー', 5, 7, 2, 0, .9, 11, 13, 2900], ['タランチュラ', 5, 3, 2, 2, 1.0, 13, 2, 6800], ['ウィーバー', 5, 5, 3, 3, 1.05, 9, 5, 9500],
  ['スコーピオ', 5, 6, 4, 2, 1.2, 3, 13, 13500], ['アラクネ', 5, 2, 5, 1, 1.4, 10, 13, 22000],
  // じゅうそう
  ['ガードマン', 6, 0, 0, 5, 1.1, 12, 8, 4800], ['ブレイカー', 6, 2, 4, 2, 1.25, 2, 1, 8600], ['ジャガーノート', 6, 7, 2, 1, 1.35, 1, 4, 13000],
  ['アイアンウォール', 6, 2, 1, 5, 1.5, 6, 12, 18500], ['コロッサス', 6, 2, 3, 3, 1.7, 13, 3, 27000],
  // タイヤ
  ['バギー', 7, 1, 5, 0, .85, 4, 13, 2000], ['ローダー', 7, 0, 0, 2, .95, 3, 1, 3300], ['スピードスター', 7, 6, 3, 1, .95, 2, 14, 7400],
  ['パトロール', 7, 5, 1, 3, 1.0, 14, 8, 9800], ['サンダーホイール', 7, 6, 4, 4, 1.15, 4, 9, 15500],
  // ビースト (よんきゃく・クモ)
  ['ハウンド', 2, 6, 2, 2, .95, 11, 13, 4400], ['ライノ', 2, 2, 4, 2, 1.25, 12, 1, 11000], ['ドラグーン', 2, 6, 4, 1, 1.4, 2, 4, 20000],
  ['マンティス', 5, 1, 3, 2, 1.0, 5, 13, 8000], ['ベヒモス', 2, 7, 4, 3, 1.7, 1, 2, 30000],
  // タイタン (たてモード)
  ['タイタン', 6, 4, 0, 0, 1.6, 12, 8, 24000], ['タイタンガード', 6, 4, 1, 5, 1.75, 8, 4, 34000], ['タイタンクロー', 0, 4, 4, 2, 1.7, 2, 13, 38000],
  ['ギガタイタン', 6, 4, 2, 1, 2.05, 13, 3, 55000], ['タイタンゼロ', 6, 4, 5, 3, 2.3, 14, 15, 80000],
].map((r, i) => ({ id: i, name: r[0], legs: r[1], body: r[2], head: r[3], arms: r[4], size: r[5], c1: r[6], c2: r[7], price: r[8] }));

const mechKind = (s) => s.body === 4 ? 'titan' : (s.body === 3 && s.legs === 2) ? 'ball' : '';
const BALL_MODES = ['歩行', '回転', '砲台', 'コマ'];
function mechStats(s) {
  const L = PARTS.legs[s.legs], B = PARTS.body[s.body], H = PARTS.head[s.head], A = PARTS.arms[s.arms], z = s.size;
  return {
    hp: Math.round((L.hp + B.hp + H.hp + A.hp) * z * z),
    spd: L.spd * (B.spdMul || 1) / (.7 + .3 * z), jump: L.jump * (.8 + .2 * z), turn: L.turn / (.6 + .4 * z),
    dmg: (A.dmgMul || 1) * (.75 + .25 * z), melee: (A.meleeMul || 1) * (.6 + .4 * z),
    r: 1.05 * z, h: 4.2 * z, hover: s.legs === 4, kind: mechKind(s),
  };
}
function partsCost(s) {
  const c = {};
  for (const k of PART_KEYS) for (const m in PARTS[k][s[k]].cost) c[m] = (c[m] || 0) + PARTS[k][s[k]].cost[m];
  return c;
}

/* ぶき。kind: gun (じゅう) / melee (きんきょり) / shield (たて)
   dmg ダメージ, rate うつ かんかく(秒), spd たまの はやさ, spread ばらつき, n どうじに 出る数,
   range とどく きょり, proj たまの しゅるい, aoe ばくはつの 大きさ */
const WLIST = [
  { id: 'pistol', name: 'ハンドガン', kind: 'gun', dmg: 14, rate: .32, spd: 110, spread: .012, range: 90, proj: 'bullet', price: 0, cost: {} },
  { id: 'mg', name: 'マシンガン', kind: 'gun', dmg: 9, rate: .09, spd: 120, spread: .028, range: 110, proj: 'bullet', price: 600, cost: { scrap: 12, iron: 4 } },
  { id: 'shotgun', name: 'ショットガン', kind: 'gun', dmg: 8, rate: .7, spd: 100, spread: .09, n: 8, range: 45, proj: 'bullet', price: 1100, cost: { scrap: 16, iron: 8 } },
  { id: 'rifle', name: 'ライフル', kind: 'gun', dmg: 60, rate: 1.0, spd: 220, spread: .002, range: 220, proj: 'bullet', price: 2200, cost: { scrap: 14, iron: 12, core: 1 } },
  { id: 'gatling', name: 'ガトリング', kind: 'gun', dmg: 7, rate: .045, spd: 125, spread: .045, range: 100, proj: 'bullet', price: 4500, cost: { scrap: 30, iron: 20, core: 2 } },
  { id: 'grenade', name: 'グレネード', kind: 'gun', dmg: 55, rate: .9, spd: 42, spread: .01, range: 90, proj: 'grenade', aoe: 7, price: 2600, cost: { scrap: 20, iron: 8, core: 2 } },
  { id: 'rocket', name: 'ロケット', kind: 'gun', dmg: 90, rate: 1.3, spd: 62, spread: .005, range: 170, proj: 'rocket', aoe: 8, price: 5200, cost: { scrap: 24, iron: 16, core: 4 } },
  { id: 'missile', name: 'ホーミングミサイル', kind: 'gun', dmg: 38, rate: .55, spd: 55, spread: .12, range: 160, proj: 'missile', aoe: 5, price: 8800, cost: { scrap: 30, iron: 18, core: 6, rare: 1 } },
  { id: 'flame', name: '火炎放射', kind: 'gun', dmg: 5, rate: .04, spd: 34, spread: .09, range: 26, proj: 'flame', price: 3400, cost: { scrap: 18, iron: 10, core: 3 } },
  { id: 'laser', name: 'レーザー', kind: 'gun', dmg: 13, rate: .1, spd: 0, spread: 0, range: 150, proj: 'laser', price: 9500, cost: { scrap: 20, iron: 14, core: 10 } },
  { id: 'plasma', name: 'プラズマ砲', kind: 'gun', dmg: 130, rate: 1.6, spd: 75, spread: .004, range: 160, proj: 'plasma', aoe: 10, price: 16000, cost: { iron: 30, core: 14, rare: 2 } },
  { id: 'rail', name: 'レールガン', kind: 'gun', dmg: 240, rate: 2.4, spd: 0, spread: 0, range: 300, proj: 'laser', big: 1, price: 24000, cost: { iron: 40, core: 18, rare: 4 } },
  { id: 'pipe', name: '鉄パイプ', kind: 'melee', dmg: 26, reach: 2.4, cd: .5, shape: 'pipe', col: 0x8a8f98, price: 0, cost: {} },
  { id: 'sword', name: 'メカソード', kind: 'melee', dmg: 55, reach: 3.0, cd: .55, shape: 'sword', col: 0xd0d6e0, price: 900, cost: { scrap: 12, iron: 8 } },
  { id: 'hammer', name: 'ハンマー', kind: 'melee', dmg: 110, reach: 2.8, cd: 1.1, shape: 'hammer', col: 0x6c7078, price: 2400, cost: { scrap: 20, iron: 18 } },
  { id: 'lance', name: 'ランス', kind: 'melee', dmg: 80, reach: 4.6, cd: .8, shape: 'lance', col: 0xc8b070, price: 3200, cost: { scrap: 16, iron: 14, core: 1 } },
  { id: 'saber', name: 'ビームセイバー', kind: 'melee', dmg: 95, reach: 3.6, cd: .4, shape: 'saber', col: 0x5ff0ff, glow: 1, price: 9000, cost: { iron: 16, core: 10 } },
  { id: 'gigaaxe', name: 'ギガアックス', kind: 'melee', dmg: 190, reach: 3.6, cd: 1.3, shape: 'axe', col: 0xff7a3a, glow: 1, price: 18000, cost: { iron: 30, core: 12, rare: 3 } },
  { id: 'shield', name: '鉄の盾', kind: 'shield', block: .6, col: 0x8a93a3, price: 800, cost: { scrap: 14, iron: 6 } },
  { id: 'tower', name: 'タワーシールド', kind: 'shield', block: .8, big: 1, col: 0x4a6ea8, price: 3800, cost: { scrap: 24, iron: 22 } },
  { id: 'eshield', name: 'エネルギーシールド', kind: 'shield', block: .92, glow: 1, col: 0x60e8ff, price: 11000, cost: { iron: 16, core: 12, rare: 1 } },
];
const WEAPONS = {}; for (const w of WLIST) WEAPONS[w.id] = w;

/* たてもの部品。boxes: [x, y, z, 幅, 高さ, 奥行き, 色ばんごう, あたり判定(0/1)]
   1 マス = 4m、1 かい = 3m。かべは マスの 北のへり に立つ (R で まわす)。色ばんごう 0 は えらんだ色。 */
const BUILD_COLS = [0xcfd4dc, 0x8a6a4a, 0xd8c8a0, 0x6f8fb0, 0xc05848, 0x4a5058, 0x7fb070, 0xf0f0ea];
const STAIRS = []; for (let i = 0; i < 6; i++) STAIRS.push([0, .25 * (i + 1), 1.667 - i * .667, 2.4, .5 * (i + 1), .667, 0, 1]);
const PIECES = [
  { id: 'floor', name: '床', icon: '[floor]', cost: { scrap: 2 }, boxes: [[0, .15, 0, 4, .3, 4, 0, 1]] },
  { id: 'wall', name: '壁', icon: '[mats]', cost: { scrap: 3 }, boxes: [[0, 1.5, -1.8, 4, 3, .4, 0, 1]] },
  { id: 'door', name: 'ドアの壁', icon: '[door]', cost: { scrap: 3 }, boxes: [[-1.4, 1.5, -1.8, 1.2, 3, .4, 0, 1], [1.4, 1.5, -1.8, 1.2, 3, .4, 0, 1], [0, 2.65, -1.8, 1.6, .7, .4, 0, 1]] },
  { id: 'window', name: '窓の壁', icon: '[window]', cost: { scrap: 3, iron: 1 }, boxes: [[0, .5, -1.8, 4, 1, .4, 0, 1], [0, 2.6, -1.8, 4, .8, .4, 0, 1], [-1.6, 1.6, -1.8, .8, 1.2, .4, 0, 1], [1.6, 1.6, -1.8, .8, 1.2, .4, 0, 1], [0, 1.6, -1.8, 2.4, 1.2, .08, 9, 1]] },
  { id: 'bigwall', name: 'メカ用の壁', icon: '[bigwall]', cost: { scrap: 6, iron: 2 }, boxes: [[0, 3, -1.8, 4, 6, .4, 0, 1]] },
  { id: 'roof', name: '屋根', icon: '[roof]', cost: { scrap: 3 }, boxes: [[0, .2, 0, 4.4, .4, 4.4, 0, 1]] },
  { id: 'stairs', name: '階段', icon: '[stairs]', cost: { scrap: 5 }, boxes: STAIRS },
  { id: 'bed', name: 'ベッド', icon: '[bed]', cost: { scrap: 8 }, use: 'bed', boxes: [[0, .3, 0, 1.5, .6, 2.8, 10, 1], [0, .7, -.9, 1.3, .25, .7, 11, 0], [0, .62, .35, 1.5, .1, 1.9, 12, 0]] },
  { id: 'lamp', name: 'ライト', icon: '[lamp]', cost: { scrap: 3, core: 1 }, boxes: [[0, 1.4, 0, .18, 2.8, .18, 13, 1], [0, 2.95, 0, .6, .4, .6, 14, 0]] },
  { id: 'turret', name: 'タレット', icon: '[turret]', cost: { scrap: 20, iron: 10, core: 2 }, use: 'turret', boxes: [[0, .5, 0, 1.6, 1, 1.6, 13, 1]] },
  { id: 'pad', name: 'メカ台 (工房)', icon: '[wrench]', cost: { scrap: 15, iron: 8, core: 1 }, use: 'pad', boxes: [[0, .1, 0, 3.8, .2, 3.8, 13, 1], [0, .22, 0, 3, .06, 3, 15, 0]] },
];
const PIECE_FIX = { 9: 0x9fd8f0, 10: 0x7a5a40, 11: 0xf4f4f0, 12: 0x4a78c8, 13: 0x4a4f58, 14: 0xfff0b0, 15: 0xffa030 };

const FOODS = [
  { name: 'ハンバーガー', icon: '[food]', price: 60, heal: 1, hunger: 60, text: '体力が全回復、満腹度 +60' },
  { name: 'リペアキット', icon: '[kit]', price: 150, kit: 1, text: 'H キーで使う。体力を半分回復' },
];
const HUMAN_LOOKS_OLD = [
  [0x3a66c8, 0x2b2f3a, 0x3a2a1a], [0xc84a4a, 0x39414f, 0x1a1a1a], [0x4aa86a, 0x5a4a3a, 0x6a4a2a], [0xe0b040, 0x2b3550, 0x202020],
  [0x9a5ad0, 0x30303a, 0xd0b060], [0xe8e8e8, 0x3a4a6a, 0x4a3020],
];

// ---------- 服 ----------
/* 服は 型 (スタイル) を買い、色は自由に変えられる。[名前, 値段] */
const CLOTHES = {
  top: [['Tシャツ', 0], ['パーカー', 300], ['ジャケット', 600], ['スーツ', 1500], ['つなぎ', 400], ['タンクトップ', 150]],
  bottom: [['長ズボン', 0], ['短パン', 150], ['スカート', 300]],
  hat: [['なし', 0], ['キャップ', 200], ['ハット', 400], ['ヘルメット', 500], ['ニット帽', 250]],
  hair: [['ショート', 0], ['ロング', 0], ['ツンツン', 0], ['坊主', 0]],
  face: [['なし', 0], ['メガネ', 300], ['サングラス', 500]],
};
const CLOTH_SLOTS = [['top', 'トップス', 'topC'], ['bottom', 'ボトムス', 'botC'], ['hat', '帽子', 'hatC'], ['hair', '髪型', 'hairC'], ['face', '顔まわり', null]];
const CLOTH_COLS = [0xf4f4f0, 0x1d2026, 0x6a7078, 0xc84a4a, 0xf28c28, 0xf2d13a, 0x4aa86a, 0x2fa98c, 0x3a66c8, 0x2b3550, 0x8a55e0, 0xe060b8, 0x8b5a3c, 0xd8c8a0, 0x3a2a1a, 0xd0b060];
const SKINS = [0xf6d2b0, 0xf0c8a0, 0xd8a878, 0xa87850, 0x7a5236];
const baseOutfit = () => ({ skin: SKINS[1], top: 0, topC: 0x3a66c8, bottom: 0, botC: 0x2b3550, hat: 0, hatC: 0xc84a4a, hair: 0, hairC: 0x3a2a1a, face: 0, shoeC: 0x2a2a2e });
function rndOutfit() {
  return { skin: pick(SKINS), top: pick([0, 0, 1, 1, 2, 3, 5]), topC: pick(CLOTH_COLS), bottom: pick([0, 0, 0, 1, 2]), botC: pick([0x1d2026, 0x2b3550, 0x6a7078, 0x8b5a3c, 0xd8c8a0, 0x3a66c8]),
    hat: pick([0, 0, 0, 0, 1, 2, 4]), hatC: pick(CLOTH_COLS), hair: pick([0, 1, 2, 3]), hairC: pick([0x1d2026, 0x3a2a1a, 0x8b5a3c, 0xd0b060, 0x6a7078]), face: pick([0, 0, 0, 1, 2]), shoeC: pick([0x2a2a2e, 0xf4f4f0, 0x8b5a3c]) };
}
const OUTFIT_POLICE = { skin: SKINS[1], top: 2, topC: 0x1c2c58, bottom: 0, botC: 0x16203c, hat: 1, hatC: 0x1c2c58, hair: 0, hairC: 0x1d2026, face: 0, shoeC: 0x101014, badge: 1 };
const OUTFIT_DEALER = { skin: SKINS[2], top: 3, topC: 0x18181c, bottom: 0, botC: 0x18181c, hat: 2, hatC: 0x18181c, hair: 0, hairC: 0x101010, face: 2, shoeC: 0x101014 };

// ---------- 仕事 ----------
const JOBS = [
  { id: 'deliver', icon: '[box]', name: '配達', text: '荷物を受け取って街の中へ届ける', pay: 200 },
  { id: 'pizza', icon: '[food]', name: 'ピザの宅配', text: '食堂で受け取り、住宅街の 3 軒に配る', pay: 420 },
  { id: 'taxi', icon: '[car]', name: 'タクシー', text: '車で客を迎えに行き、目的地まで送る', pay: 350, car: 1 },
  { id: 'trash', icon: '[mats]', name: 'ごみ収集', text: '街の 8 か所を回ってごみを集める', pay: 380 },
  { id: 'patrol', icon: '[shield]', name: '警備員', text: '決められた順に街を巡回する (夜は 2 倍)', pay: 300 },
  { id: 'farm', icon: '[veg]', name: '農場の手伝い', text: '北西の農場で野菜を 10 個収穫する (F)', pay: 400 },
  { id: 'bounty', icon: '[target]', name: 'お尋ね者退治', text: '南の荒野にいる大型メカを倒す', pay: 0, mech: 1 },
  { id: 'dealer', icon: '[dealer]', name: '闇商人退治', text: 'マンション裏の闇商人を倒す', pay: 0 },
];
const TALK = ['こんにちは！', '今日はいい天気だね', '最近、荒野のメカが増えてるらしいよ', '住宅街の家、売りに出てたよ', '釣りなら東の桟橋がおすすめ', 'そのメカ、かっこいいね', '夜は物騒だから気をつけて', '農場の野菜はおいしいよ', '服屋に新しい服が入ったって'];
