/* =========================================================================
   SLIME AGE ― データ
   スライムの色 / 武器（文明の順） / 時代とボス / セーブの中身
   ========================================================================= */
'use strict';

/* ------------------------------ スライムの色 ------------------------------ */
/* 色ごとに とくいなことがある。くっつけると、まざった色の とくいが ぜんぶつく。 */
const COLORS = {
  blue:   { name: 'あお',     col: '#4aa8ff', trait: 'たいりょくが おおい' },
  red:    { name: 'あか',     col: '#ff5d5d', trait: 'こうげきが つよい' },
  green:  { name: 'みどり',   col: '#47cf73', trait: 'すこしずつ かいふくする' },
  yellow: { name: 'きいろ',   col: '#ffcf33', trait: 'うごきが はやい' },
  purple: { name: 'むらさき', col: '#b57bff', trait: 'ひらめきが たまりやすい' },
};
const COLOR_IDS = Object.keys(COLORS);

const MAX_MEMBERS = 8;   // 1ぴきに くっつけられる数
const MAX_BODIES = 8;    // チームの数（くっついたものは 1ぴきと数える）

function sizeName(n) {
  return n >= 8 ? 'キングスライム' : n >= 6 ? 'メガスライム' : n >= 4 ? 'ジャンボスライム' : n >= 2 ? 'ビッグスライム' : 'スライム';
}
/* くっつくほど 大きくなって、もてる武器が ふえる */
function slotCount(n) { return n >= 7 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : 1; }
function bodyRadius(n) { return 17 + 8 * Math.pow(n - 1, 0.8); }

/* からだの 色は いちばん 多い 色（同じ数なら さきに いた 色）。ほかの 色は つぶで 見せる。
   ぜんぶ まぜると はい色に なってしまうので まぜない */
function bodyColor(members) {
  let best = members[0], bn = 0;
  for (const m of members) {
    const n = members.reduce((s, x) => s + (x === m ? 1 : 0), 0);
    if (n > bn) { best = m; bn = n; }
  }
  return COLORS[best].col;
}

/* --------------------------------- 武器 --------------------------------- */
/* kind
   swing  … ふりまわして まえの はんいを たたく（reach: とどく長さ、arc: はばの角度）
   thrust … まっすぐ つく（hits があると なんども あたる）
   smash  … じめんを たたいて まわりを ふっとばす（aoe: はんい）
   shoot  … たまを とばす（proj）
   throw  … なげて ばくはつ（aoe）
   dmg はスライム1ぴきが もったときの こうげき力。cd は つぎに つかえるまでの びょう。 */
const WEAPONS = {
  branch:      { name: 'えだ',           era: 0, kind: 'swing',  dmg: 4,  cd: 0.42, reach: 30, arc: 1.7, kb: 140, desc: 'そのへんに おちていた えだ。ぺちぺち たたく。' },
  club:        { name: '木のぼう',       era: 0, kind: 'swing',  dmg: 7,  cd: 0.55, reach: 34, arc: 1.6, kb: 230, desc: 'じょうぶな 木を けずった こんぼう。ゴツンと おもい。' },
  woodsword:   { name: '木の剣',         era: 0, kind: 'swing',  dmg: 9,  cd: 0.45, reach: 40, arc: 1.9, kb: 180, desc: 'はじめての 剣。かたちを まねして 木で つくった。' },
  stoneaxe:    { name: '石のオノ',       era: 1, kind: 'swing',  dmg: 15, cd: 0.6,  reach: 38, arc: 1.7, kb: 260, desc: 'とがった 石を ひもで しばった オノ。おもくて つよい。' },
  spear:       { name: '石のヤリ',       era: 1, kind: 'thrust', dmg: 13, cd: 0.5,  reach: 72, arc: 0.5, kb: 200, desc: 'ながい ぼうの さきに 石。とおくから つける。' },
  sling:       { name: 'いしなげひも',   era: 1, kind: 'shoot',  dmg: 9,  cd: 0.6,  kb: 120, proj: { spd: 520, life: 0.75, r: 6, pierce: 0, shape: 'stone' }, desc: 'ひもを ふりまわして 石を とばす。はじめての とびどうぐ。' },
  bronzesword: { name: '青銅の剣',       era: 2, kind: 'swing',  dmg: 20, cd: 0.45, reach: 46, arc: 1.9, kb: 200, desc: 'どうと すずを まぜた きんぞくの 剣。ぴかぴか ひかる。' },
  bow:         { name: '弓矢',           era: 2, kind: 'shoot',  dmg: 15, cd: 0.55, kb: 120, proj: { spd: 700, life: 0.8, r: 5, pierce: 0, shape: 'arrow' }, desc: 'しなる 木で 矢を とばす。とおくの てきも ねらえる。' },
  ironsword:   { name: '鉄の剣',         era: 3, kind: 'swing',  dmg: 27, cd: 0.42, reach: 50, arc: 2.0, kb: 220, desc: 'ほのおで きたえた 鉄。かたくて おれない。' },
  hammer:      { name: '鉄のハンマー',   era: 3, kind: 'smash',  dmg: 32, cd: 0.85, reach: 40, aoe: 72, kb: 380, desc: 'じめんごと たたいて、まわりの てきを ふっとばす。' },
  greatsword:  { name: 'はがねの大剣',   era: 4, kind: 'swing',  dmg: 42, cd: 0.62, reach: 64, arc: 2.6, kb: 300, desc: 'ねばりの ある はがねの おおきな 剣。ぐるっと なぎはらう。' },
  crossbow:    { name: 'クロスボウ',     era: 4, kind: 'shoot',  dmg: 30, cd: 0.7,  kb: 160, proj: { spd: 860, life: 0.75, r: 5, pierce: 2, shape: 'bolt' }, desc: 'しかけで つよく ひいた 矢。てきを つらぬく。' },
  katana:      { name: 'カタナ',         era: 5, kind: 'swing',  dmg: 30, cd: 0.3,  reach: 54, arc: 2.0, kb: 170, desc: 'うすく するどい 刀。すばやく なんども きれる。' },
  musket:      { name: '火なわじゅう',   era: 5, kind: 'shoot',  dmg: 75, cd: 1.1,  kb: 320, proj: { spd: 1100, life: 0.6, r: 5, pierce: 1, shape: 'bullet' }, desc: 'ひのついた なわで 火薬を ばくはつさせる。いちげきが おもい。' },
  drill:       { name: 'ドリル',         era: 6, kind: 'thrust', dmg: 26, cd: 0.5,  reach: 62, arc: 0.6, kb: 110, hits: 3, desc: 'モーターで まわる ドリル。ガガガッと 3かい あたる。' },
  dynamite:    { name: 'ダイナマイト',   era: 6, kind: 'throw',  dmg: 90, cd: 1.3,  kb: 420, aoe: 95, proj: { range: 360, flight: 0.6 }, desc: 'なげると ドカーン！ まわりの てきを まとめて ふっとばす。' },
  beamsword:   { name: 'ビームソード',   era: 7, kind: 'swing',  dmg: 80, cd: 0.4,  reach: 72, arc: 2.4, kb: 260, desc: 'ひかりの 刃。なんでも スパッと きれる みらいの 剣。' },
  laser:       { name: 'レーザーじゅう', era: 7, kind: 'shoot',  dmg: 48, cd: 0.28, kb: 100, proj: { spd: 1400, life: 0.5, r: 6, pierce: 3, shape: 'laser' }, desc: 'ひかりの たまを れんしゃする。てきを まとめて つらぬく。' },
};
/* 文明が すすむ順。この順に はつめいしていく */
const WEAPON_ORDER = ['branch', 'club', 'woodsword', 'stoneaxe', 'spear', 'sling', 'bronzesword', 'bow', 'ironsword', 'hammer', 'greatsword', 'crossbow', 'katana', 'musket', 'drill', 'dynamite', 'beamsword', 'laser'];
const rankOf = (id) => WEAPON_ORDER.indexOf(id);
const KIND_NAME = { swing: 'ふりまわす', thrust: 'つく', smash: 'まわりを たたく', shoot: 'とばす', throw: 'なげる' };

/* はつめいに ひつような ひらめきの数 */
const inventCost = (rank) => 6 + Math.floor(rank * 0.5);

/* --------------------------------- 時代 --------------------------------- */
/* hp: その時代の てき1ぴきの たいりょく。total: ボスまでに たおす数。alive: いちどに 出てくる数。
   foe: てきの 武器の いりょくを この わりあいに する（あとの時代の 武器ほど つよいので 下げてある） */
const ERAS = [
  {
    id: 'wild', name: 'げんし時代', place: 'はじまりの森', hp: 14, total: 16, alive: 4, foe: 0.45,
    desc: 'まだ どうぐの ない じだい。おちている えだを ひろって たたかおう。',
    ground: ['#8fd36f', '#83c864'], edge: '#3f8a45', sky: '#bfe9a8',
    boss: { name: 'もりの ぬし', col: '#3c9c4e', wpns: ['club', 'club'] },
  },
  {
    id: 'stone', name: '石器時代', place: 'いしころの谷', hp: 32, total: 19, alive: 5, foe: 0.45,
    desc: '石を けずって どうぐを つくる じだい。オノと ヤリが できる。',
    ground: ['#cdb98c', '#c2ad7e'], edge: '#7a6646', sky: '#f3dfb0',
    boss: { name: 'マンモス スライム', col: '#9a6a44', wpns: ['stoneaxe', 'spear'] },
  },
  {
    id: 'bronze', name: '青銅器時代', place: 'こむぎの おか', hp: 55, total: 22, alive: 5, foe: 0.45,
    desc: 'はじめて きんぞくを とかした じだい。ぴかぴかの 剣と 弓矢。',
    ground: ['#d9c57c', '#cfb86c'], edge: '#8c7330', sky: '#ffe9a8',
    boss: { name: 'せいどうの おう', col: '#c98a3a', wpns: ['bronzesword', 'bow', 'bronzesword'] },
  },
  {
    id: 'iron', name: '鉄器時代', place: 'かじやの 村', hp: 85, total: 25, alive: 6, foe: 0.42,
    desc: 'ほのおで 鉄を きたえる じだい。かたい 剣と ハンマー。',
    ground: ['#8f8a7c', '#857f70'], edge: '#45403a', sky: '#d8cfc0',
    boss: { name: 'かじやの おやかた', col: '#6b6f78', wpns: ['hammer', 'ironsword', 'hammer'] },
  },
  {
    id: 'castle', name: 'きしの時代', place: 'おしろの にわ', hp: 120, total: 28, alive: 6, foe: 0.38,
    desc: 'おしろと きしの じだい。大きな 剣と クロスボウ。',
    ground: ['#aab2ba', '#9ea6af'], edge: '#545b66', sky: '#d6e2f0',
    boss: { name: 'くろきし スライム', col: '#3d4260', wpns: ['greatsword', 'crossbow', 'greatsword'] },
  },
  {
    id: 'samurai', name: 'サムライ時代', place: 'さくらの 町', hp: 160, total: 31, alive: 7, foe: 0.32,
    desc: 'カタナと 火なわじゅうの じだい。すばやく きって、ドンと うつ。',
    ground: ['#e4d6b2', '#d9caa2'], edge: '#8a6a4a', sky: '#ffe0ea',
    boss: { name: 'しょうぐん スライム', col: '#c0392b', wpns: ['katana', 'musket', 'katana', 'katana'] },
  },
  {
    id: 'machine', name: 'きかいの時代', place: 'えんとつの 町', hp: 210, total: 34, alive: 7, foe: 0.27,
    desc: 'じょうききかんと モーターの じだい。ドリルと ダイナマイト。',
    ground: ['#a07060', '#946452'], edge: '#4a3028', sky: '#e8c8b0',
    boss: { name: 'じょうき ロボ', col: '#8a8f99', wpns: ['drill', 'dynamite', 'drill', 'dynamite'] },
  },
  {
    id: 'future', name: 'みらいの時代', place: 'ネオンの 都市', hp: 270, total: 37, alive: 8, foe: 0.21,
    desc: 'ひかりの 武器の じだい。さいごの ボスが まっている。',
    ground: ['#1f2946', '#1a2340'], edge: '#0a0f22', sky: '#2a3a6a',
    boss: { name: 'ギャラクシー スライム', col: '#7a5cff', wpns: ['beamsword', 'laser', 'beamsword', 'laser'] },
  },
];
const LAST_ERA = ERAS.length - 1;

/* その時代の てきが もつ武器 */
function enemyWeapon(era) {
  if (era === 0) return pick([null, null, 'branch', 'branch', 'club']);
  const here = WEAPON_ORDER.filter((id) => WEAPONS[id].era === era);
  const before = WEAPON_ORDER.filter((id) => WEAPONS[id].era === era - 1);
  return Math.random() < 0.7 ? pick(here) : pick(before);
}

/* ------------------------------ セーブの中身 ------------------------------ */
let P = null;

function newProfile() {
  return {
    v: 1,
    era: 0,              // いま いける いちばん先の時代（ぜんぶクリアで ERAS.length）
    cleared: [],
    tech: 1,             // はつめいした武器の数（WEAPON_ORDER の先頭から）。えだは さいしょから しっている
    ideas: 0,            // つぎの はつめいに ためている ひらめき
    team: [{ members: ['blue'], wpns: [] }],
    tutorial: false,
    auto: false,         // じどうで こうげきする
    sound: true,
  };
}

const Prof = {
  load() {
    try { this.read(); } catch (e) { P = newProfile(); }
    Sfx.on = P.sound !== false;
  },
  read() {
    const s = Save.read();
    P = s && s.v === 1 ? Object.assign(newProfile(), s) : newProfile();
    /* こわれたセーブでも 遊べるように 直してから使う */
    P.era = clamp(P.era | 0, 0, ERAS.length);
    P.tech = clamp(P.tech | 0, 1, WEAPON_ORDER.length);
    P.ideas = Math.max(0, +P.ideas || 0);
    if (!Array.isArray(P.cleared)) P.cleared = [];
    if (!Array.isArray(P.team)) P.team = [];
    const own = (table, id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(table, id);
    P.team = P.team.filter((t) => t && Array.isArray(t.members)).map((t) => {
      const members = t.members.filter((m) => own(COLORS, m)).slice(0, MAX_MEMBERS);
      const wpns = (Array.isArray(t.wpns) ? t.wpns : []).filter((w) => own(WEAPONS, w)).slice(0, slotCount(members.length));
      return { members, wpns };
    }).filter((t) => t.members.length).slice(0, MAX_BODIES);
    if (!P.team.length) P.team = newProfile().team;
  },
  save() { Save.write(P); },
  reset() { Save.clear(); P = newProfile(); Sfx.on = true; },
  invented(id) { return rankOf(id) < P.tech; },
  next() { return P.tech < WEAPON_ORDER.length ? WEAPON_ORDER[P.tech] : null; },
  /* なかまの 1ぴきぶんの たいりょく。時代が すすむほど つよくなる */
  memberHp() { return Math.round(40 * (1 + 0.7 * Math.min(P.era, LAST_ERA))); },
  members() { return P.team.reduce((s, t) => s + t.members.length, 0); },
};
