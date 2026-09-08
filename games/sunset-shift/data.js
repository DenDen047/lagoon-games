/* =========================================================================
   SUNSET SHIFT ― 設定データ
   ヒーロー3人、能力テーブル、敵、事件、会社の仕事
   ========================================================================= */
'use strict';

const COMPANY = {
  name: 'トウワ物流',
  dept: '第三営業部',
  pay: 9800,        // 1日ぶんの基本給
  rent: 62000,      // 7日目に引かれる家賃
};

/* =========================== 1. 主人公 ===========================
   生まれつきの力。生後すぐの検査で骨のあいだに「重核」が見つかった。
   訓練で伸ばした技ではないので、本人はずっと持て余している。       */
const GRAVITON = {
  id: 'grav',
  name: '天羽 迅',
  code: 'GRAVITON',
  kindLabel: '生まれつき',
  origin: '生まれつき、みぞおちの奥に重核と呼ばれる器官がある。触れたものの重さを一時的に書き換えられる。訓練で得た技ではないため、加減がへたで、使いすぎると自分の血液まで重くなって動けなくなる。',
  colors: { suit: '#3a4f9e', accent: '#7fe0ff', trim: '#eef3ff', skin: '#e9b189', hair: '#1d2136' },
  gauge: { name: '重核', color: '#6fd3ff', max: 100, regen: 11 },
  base: { hp: 130, atk: 1.0, spd: 1.0 },
  passive: '重力を抜いて二段ジャンプ。低い屋根なら跳び乗れるし、落ちても平気。',
  skills: {
    skill1: { id: 'pull', name: '引き寄せ', cost: 16, cd: 0.7, desc: '前方のものを引っぱる。敵は足を取られ、止まった車はこちらへ転がってくる。' },
    skill2: { id: 'slam', name: '重力衝撃', cost: 32, cd: 1.2, desc: '重さを一点に集めて叩きつける。空中で使うと落下しながら着弾する。' },
  },
  grab: '止まっている車のそばで E。持ち上げたら、もう一度 E で向いている方へ投げる。',
};

/* =========================== 2. 頭脳派 ===========================
   能力はゼロ。頭のよさの中身を先に決めておく。
   ・機構逆算  … 一度見た機械を、頭の中で部品単位の図に開ける
   ・並列見積り … 弾道・電力残量・敵の重心を同時に、常に暗算している
   ・再設計    … 手持ちの部品だけで別の機能に組み替える
   モジュールは「自分で選んで」作る。作るには金と解析データが要る。   */
const BLUEPRINT = {
  id: 'tech',
  name: '灰崎 玲',
  code: 'BLUEPRINT',
  kindLabel: '能力なし・頭脳',
  origin: '超常の力は一切ない。持っているのは三つの癖だけ。見た機械を頭の中で部品図に開く「機構逆算」、弾道と電力と相手の重心を同時に暗算し続ける「並列見積り」、手持ちの部品を別の機能に組み替える「再設計」。スーツは全部その三つで自作した。',
  brains: [
    { t: '機構逆算', d: '一度見た機械を、頭の中で部品単位の設計図に開ける。敵のドローンは初見で弱点が分かる。' },
    { t: '並列見積り', d: '弾道、電力残量、相手の重心の移動を、意識せずに同時に暗算し続けている。' },
    { t: '再設計', d: '手元にある部品だけで別の機能に組み替える。だから現場で足りなくても何とかする。' },
  ],
  colors: { suit: '#98a4b6', accent: '#ffb454', trim: '#39415a', skin: '#f0c49e', hair: '#3a2b22' },
  gauge: { name: '電力', color: '#ffb454', max: 100, regen: 7 },
  base: { hp: 100, atk: 0.85, spd: 0.95 },
  passive: 'スーツの推力で浮ける。屋上まで上がれるが、電力が切れると、ただの人になる。',
  weakness: '電力がゼロのあいだは攻撃力が半分。',
};

/* モジュール。ラボで選んで作る。active はスキル枠2つに好きに割り当てる。 */
const MODULES = [
  { id: 'railgun', slot: 'active', name: 'レールガン', icon: '⚡', price: 0, data: 0, energy: 24, cd: 0.9,
    desc: '押しっぱなしで溜め、離すと撃つ。溜めきると敵を貫通する。', owned: true },
  { id: 'boost', slot: 'active', name: 'ブースター', icon: '🔥', price: 0, data: 0, energy: 0, cd: 0,
    desc: '押しているあいだ浮き上がる。屋上へも上がれる。電力を毎秒18消費。', owned: true },
  { id: 'drone', slot: 'active', name: '随伴ドローン', icon: '🛸', price: 38000, data: 2, energy: 30, cd: 8,
    desc: '2機を切り離す。18秒のあいだ、勝手に敵を撃つ。' },
  { id: 'shield', slot: 'active', name: '反応装甲', icon: '🛡', price: 26000, data: 1, energy: 20, cd: 3,
    desc: '向いている方に板を張る。当たったぶんを体力ではなく電力で払う。' },
  { id: 'emp', slot: 'active', name: 'EMPパルス', icon: '💥', price: 44000, data: 3, energy: 34, cd: 4,
    desc: '周囲の機械を止める。ドローンと重機兵に特に効く。' },
  { id: 'anchor', slot: 'active', name: 'マグネットアンカー', icon: '🧲', price: 32000, data: 2, energy: 18, cd: 1.2,
    desc: '正面の金属に打ちこんで引き寄せる。相手が重ければ自分のほうが飛ぶ。' },
  { id: 'missile', slot: 'active', name: 'マイクロミサイル', icon: '🚀', price: 52000, data: 4, energy: 28, cd: 2.4,
    desc: '4発を撒く。曲がって追いかける。' },
  { id: 'overclock', slot: 'active', name: 'オーバークロック', icon: '⏱', price: 60000, data: 5, energy: 40, cd: 14,
    desc: '8秒だけ全性能を上げる。切れたあと、電力の戻りが遅くなる。' },

  { id: 'capacitor', slot: 'passive', name: '大容量セル', icon: '🔋', price: 22000, data: 1, desc: '電力の上限が40上がる。' },
  { id: 'nano', slot: 'passive', name: 'ナノ修復', icon: '🩹', price: 30000, data: 2, desc: '戦っていないあいだ、体力が少しずつ戻る。' },
  { id: 'servo', slot: 'passive', name: '高出力サーボ', icon: '🦾', price: 34000, data: 2, desc: '殴る力が25%上がる。' },
  { id: 'analyzer', slot: 'passive', name: '解析装置', icon: '🔍', price: 28000, data: 3, desc: '敵の弱点が見えるようになり、与ダメージが15%増える。事件のたびに解析データが1つ多く手に入る。' },
  { id: 'lightframe', slot: 'passive', name: '軽量骨格', icon: '🪶', price: 24000, data: 1, desc: '動きが速くなるが、受けるダメージが15%増える。' },
];

/* =========================== 3. 生物系 ===========================
   何の遺伝子を拾ったかは毎回変わる。能力は選べない。
   はじめの3つも、あとから増える1つも、その場で抽選される。       */
const CREATURES = [
  { id: 'spider', name: 'オニグモ', code: 'ORB', col: '#b8352f', acc: '#f2e9dd', note: '関節が増えたように動く' },
  { id: 'hornet', name: 'オオスズメバチ', code: 'VESPA', col: '#f2a922', acc: '#241a10', note: '肩甲骨のあたりが常に熱い' },
  { id: 'bat', name: 'ヒナコウモリ', code: 'ECHO', col: '#4b3f6b', acc: '#c8b8ff', note: '暗いほうがよく見える' },
  { id: 'squid', name: 'ホタルイカ', code: 'INK', col: '#2a4f7a', acc: '#7ff0d6', note: '緊張すると皮膚が光る' },
  { id: 'frog', name: 'モリアオガエル', code: 'LEAF', col: '#3f8f4e', acc: '#e6ff9b', note: '指先がいつも湿っている' },
  { id: 'eel', name: 'デンキウナギ', code: 'VOLT', col: '#3c5a6e', acc: '#8ff0ff', note: '金属に触るとぱちっとくる' },
  { id: 'gecko', name: 'トッケイヤモリ', code: 'CLING', col: '#5a7fa8', acc: '#ffd45c', note: '壁から手が離れにくい' },
  { id: 'mantis', name: 'ハナカマキリ', code: 'BLADE', col: '#d47fa8', acc: '#f7f3e8', note: '止まっていると誰も気づかない' },
  { id: 'wolf', name: 'ニホンオオカミ', code: 'FANG', col: '#6b5f52', acc: '#e8d9c0', note: '匂いで人を覚える' },
  { id: 'jelly', name: 'アカクラゲ', code: 'DRIFT', col: '#a8506b', acc: '#ffd0e0', note: '痛みが遅れてやってくる' },
  { id: 'beetle', name: 'コーカサスオオカブト', code: 'HORN', col: '#3a2b1e', acc: '#c9a227', note: '腕相撲で誰にも負けない' },
  { id: 'moth', name: 'ヨナグニサン', code: 'MOTH', col: '#8a6b4f', acc: '#ffe8b8', note: '街灯の下に立ちたくなる' },
];

const BIO_MOVE = [
  { id: 'zip', name: '糸をひく', icon: '🕸', cost: 0, desc: '前方に糸を打ちこみ、その場所まで一気に自分を引き寄せる。' },
  { id: 'leap', name: 'ため跳び', icon: '🦗', cost: 12, desc: 'ためて向いている方へ跳ぶ。低い屋根なら跳び越せる。' },
  { id: 'glide', name: '滑空', icon: '🪂', cost: 0, desc: '空中で押しっぱなしにすると、ゆっくり落ちながら前へ滑る。' },
  { id: 'roof', name: '壁のぼり', icon: '🧗', cost: 0, desc: '押しているあいだ壁を駆け上がる。屋上に出て、上から回りこめる。' },
  { id: 'blink', name: '瞬発', icon: '💨', cost: 14, desc: '正面へ一瞬で抜ける。線上にいた相手を切る。' },
];

const BIO_ATK = [
  { id: 'sting', name: '毒針', icon: '🪡', cost: 16, desc: '刺すと毒が残り、数秒のあいだ削り続ける。' },
  { id: 'shock', name: '放電', icon: '⚡', cost: 22, desc: '周囲に電気を落とす。まとめて痺れさせる。' },
  { id: 'sonic', name: '超音波', icon: '🔊', cost: 20, desc: '前方をまっすぐ貫く波。壁の裏の敵にも届く。' },
  { id: 'acid', name: '酸', icon: '🧪', cost: 18, desc: '飛ばして当てる。鎧を溶かして防御を落とす。' },
  { id: 'web', name: '拘束糸', icon: '🕷', cost: 15, desc: '相手をその場に縛る。縛られた相手は無防備。' },
  { id: 'quill', name: '射出針', icon: '🎯', cost: 12, desc: '遠くまで届く針を3本まとめて撃つ。' },
];

const BIO_UTIL = [
  { id: 'camo', name: '光学迷彩', icon: '👻', desc: '止まっていると姿が薄れる。敵に見つかりにくい。' },
  { id: 'echo', name: '反響定位', icon: '📡', desc: '画面の外にいる敵と、助けを待っている人の位置が分かる。' },
  { id: 'regen', name: '再生', icon: '💚', desc: '体力がゆっくり戻り続ける。' },
  { id: 'sense', name: '危機感知', icon: '❗', desc: '攻撃される直前に体が勝手に動く。たまに自動で避ける。' },
  { id: 'ink', name: '目くらまし', icon: '🌫', desc: 'ダメージを受けたとき煙を出し、追ってくる敵をまく。' },
  { id: 'venom', name: '毒腺', icon: '☠️', desc: '殴った相手にも毒が乗るようになる。' },
];

const BIO_SIDE = [
  { id: 'sun', name: '日ざしに弱い', desc: '空が明るいうちは、能力の戻りが遅い。' },
  { id: 'hunger', name: '燃費が悪い', desc: 'よく減る。体力の最大値が10低い。' },
  { id: 'smell', name: '匂いに敏感', desc: 'オフィスの匂いで集中が切れる。仕事の判定がすこし厳しい。' },
  { id: 'molt', name: '脱皮する', desc: '3日に一度、攻撃力が上がるかわりに、その日は打たれ弱い。' },
  { id: 'cold', name: '体温が低い', desc: '夜は速く動けるが、昼は鈍い。' },
  { id: 'light', name: '光に寄る', desc: '街灯の下では強いが、暗がりでは弱くなる。' },
];

/* 抽選。ニューゲームのたびに走る。 */
function rollBio(rng) {
  const c = rng.pick(CREATURES);
  const move = rng.pick(BIO_MOVE);
  const atk = rng.pick(BIO_ATK);
  const util = rng.pick(BIO_UTIL);
  const side = rng.pick(BIO_SIDE);
  return {
    id: 'bio',
    name: '三雲 ナギ',
    code: c.code,
    kindLabel: '生物系・抽選',
    creature: c,
    origin: `研究所から流れ出した${c.name}の遺伝子を、通勤中に浴びた。何が身についたかは本人にも分からず、体が勝手に覚えていく。${c.note}。`,
    colors: { suit: c.col, accent: c.acc, trim: shade(c.col, -0.3), skin: '#f0c39c', hair: '#20222e' },
    gauge: { name: '体液', color: c.acc, max: 90 + rng.i(-10, 25), regen: 9 + rng.i(-2, 4) },
    base: {
      hp: 110 + rng.i(-15, 20) - (side.id === 'hunger' ? 10 : 0),
      atk: 0.9 + rng.f(0, 0.35),
      spd: 0.95 + rng.f(0, 0.3),
    },
    abil: { move, atk, util },
    side,
    mutations: 0,
  };
}

/* 変異。1つの枠だけが、勝手に別の能力へ入れ替わる。 */
function mutateBio(bio, rng) {
  const slot = rng.pick(['move', 'atk', 'util']);
  const pool = slot === 'move' ? BIO_MOVE : slot === 'atk' ? BIO_ATK : BIO_UTIL;
  const cands = pool.filter((a) => a.id !== bio.abil[slot].id);
  const before = bio.abil[slot];
  const after = rng.pick(cands);
  bio.abil[slot] = after;
  bio.mutations++;
  bio.base.hp += rng.i(4, 10);
  bio.base.atk += rng.f(0.02, 0.08);
  return { slot, before, after };
}

/* ============================== 敵 ============================== */
const ENEMIES = {
  thug:   { name: 'チンピラ', hp: 34,  atk: 6,  spd: 92,  reach: 44, kind: 'melee',  drop: 900,  w: 26, h: 62, col: '#69748f', acc: '#c4cee6' },
  robber: { name: '武装強盗', hp: 46,  atk: 9,  spd: 78,  reach: 300, kind: 'gun',   drop: 1600, w: 27, h: 64, col: '#5d5379', acc: '#ffd06b' },
  brute:  { name: '装甲兵',   hp: 92,  atk: 13, spd: 62,  reach: 52, kind: 'shield', drop: 2600, w: 34, h: 72, col: '#4c6072', acc: '#8fb4d0' },
  drone:  { name: '戦闘ドローン', hp: 38, atk: 8, spd: 130, reach: 260, kind: 'fly', drop: 2000, w: 34, h: 24, col: '#6172a0', acc: '#ff6b5f' },
  heavy:  { name: '重機兵',   hp: 170, atk: 18, spd: 52,  reach: 66, kind: 'slam',  drop: 5200, w: 46, h: 88, col: '#7a5f52', acc: '#ffa53c' },
};

const BOSS = {
  name: 'MODEL-9',
  full: '自律警備機 MODEL-9',
  hp: 900,
  intro: '親会社が街に売り込んでいる自律警備機。三人が守ってきた区画を「治安の悪い実証地区」として更地にする計画の、その一号機。',
};

/* ============================ 事件 ============================ */
const INCIDENTS = [
  { id: 'mug',   name: 'ひったくり',   icon: '🏃', time: 45, peace: 4,  pay: 3000,  desc: 'ひったくり犯を止める', waves: [['thug', 'thug']] },
  { id: 'rob',   name: '路上強盗',     icon: '🔫', time: 60, peace: 6,  pay: 5200,  desc: '強盗を制圧する', waves: [['thug', 'robber'], ['robber', 'thug']] },
  { id: 'gang',  name: '集団のもめごと', icon: '🥊', time: 70, peace: 7,  pay: 6000,  desc: '暴れている連中を鎮める', waves: [['thug', 'thug', 'thug'], ['thug', 'brute']] },
  { id: 'drone', name: 'ドローン襲撃',  icon: '🛸', time: 65, peace: 8,  pay: 7400,  desc: '飛んでいる機体を落とす', waves: [['drone', 'drone'], ['drone', 'drone', 'robber']] },
  { id: 'armor', name: '武装集団',     icon: '🛡', time: 80, peace: 10, pay: 9000,  desc: '武装した一団を止める', waves: [['brute', 'robber'], ['brute', 'brute', 'drone']] },
  { id: 'rescue',name: '車の下敷き',   icon: '🚑', time: 50, peace: 9,  pay: 6800,  desc: '事故車から人を出す', rescue: true, waves: [['thug']] },
  { id: 'heavy', name: '重機兵の暴走',  icon: '⚙️', time: 90, peace: 14, pay: 13000, desc: '重機兵を止める', waves: [['heavy'], ['heavy', 'drone']] },
];

/* ========================== 会社の仕事 ==========================
   出社すると、伝票がベルトで流れてくる。ルールは日替わり。 */
const DOC_RULES = [
  { id: 'amount', text: '金額が50万円以上なら 上長へ。新規の取引先なら 差戻し。ほかは 承認。',
    judge: (d) => (d.amount >= 500000 ? 'up' : d.isNew ? 'back' : 'ok') },
  { id: 'newfirst', text: '新規の取引先は 上長へ。金額が10万円未満なら 承認。ほかは 差戻し。',
    judge: (d) => (d.isNew ? 'up' : d.amount < 100000 ? 'ok' : 'back') },
  { id: 'late', text: '納期が今週なら 上長へ。金額が30万円以上なら 差戻し。ほかは 承認。',
    judge: (d) => (d.rush ? 'up' : d.amount >= 300000 ? 'back' : 'ok') },
  { id: 'mix', text: '新規かつ30万円以上は 上長へ。納期が今週なら 差戻し。ほかは 承認。',
    judge: (d) => (d.isNew && d.amount >= 300000 ? 'up' : d.rush ? 'back' : 'ok') },
];

const CLIENTS = ['山王製作所', '北品川運送', 'ミナト精機', '大川フーズ', '双葉電機', '桜井産業', '東雲テック', 'ヤマト紙業', '青梅化学', '中央パーツ', '光陽ロジ', '甲斐建材'];
const DOC_KINDS = ['発注書', '請求書', '見積書', '納品書', '契約更新'];

/* ============================ 買い物 ============================ */
const SHOP = [
  { id: 'drink', name: '回復ドリンク', icon: '🧃', cost: 2400, desc: '体力を60戻す。持ち歩ける。', stack: true },
  { id: 'energy', name: 'エナジーバー', icon: '🍫', cost: 3000, desc: '出撃時の能力ゲージが満タンで始まる。', stack: true },
  { id: 'info', name: '情報屋への謝礼', icon: '🗺', cost: 5000, desc: '今夜の事件の場所が最初から分かる。', stack: true },
  { id: 'coffee', name: '差し入れのコーヒー', icon: '☕', cost: 4000, desc: '社内評価が5上がる。部署に配る。', once: false },
];
