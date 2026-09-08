/* =========================================================================
   KAIJU CLASH ― 怪獣とステージのデータ
   数値はすべて 60fps 換算。box は自分の足元を原点にして、
   x = 体の中心から前方への距離、y = 地面からの高さ（箱の中心）。
   ========================================================================= */
'use strict';

/* 技の共通の型
   startup  出るまで
   active   当たっているあいだ
   recovery 戻るまで
   dmg      体力を削る量（体力は 1000）
   box      当たり判定 {x, y, w, h}
   kb       ふっとばし（横）
   lift     打ち上げ（縦）
   stun     当たった相手が動けないフレーム
   chip     ガードされたときに削れる量
   gauge    当てたときに溜まる怒り（100 で超必殺）
   step     技を出しながら自分が進む距離
   cancel   true なら当たったあと強攻撃につなげられる
*/

const KAIJU = [
  /* ------------------------------------------------------------------ */
  {
    id: 'gaion', name: 'ガイオン', en: 'GAION', title: '黒鉄の王',
    form: 'saurian', size: 142,
    hp: 1000, speed: 3.5, jump: 15.5, weight: 1.05, defense: 1.0,
    colors: {
      main: '#3d4a52', dark: '#1b2329', belly: '#96a6ad',
      accent: '#6fe3ff', eye: '#ffd23f', glow: '#8ef0ff',
    },
    desc: '海溝の底で眠っていた王。背びれが青く灯ると口の奥に熱がたまり、まっすぐな光の線が街を割る。攻めも守りもひととおりこなせるので、まず最初に触るならこの怪獣。',
    tips: '尾の薙ぎ払いはリーチが長い。熱線は溜めがあるぶん遠くまで届く。',
    moves: {
      light: { name: 'かぎ爪', startup: 6, active: 4, recovery: 10, dmg: 42, box: { x: 74, y: 104, w: 66, h: 54 }, kb: 4, lift: 0, stun: 15, chip: 5, gauge: 6, step: 6, cancel: true },
      heavy: { name: '尾の薙ぎ払い', startup: 14, active: 7, recovery: 22, dmg: 92, box: { x: 96, y: 62, w: 116, h: 60 }, kb: 13, lift: 5, stun: 26, chip: 11, gauge: 10, step: 10 },
      air: { name: '飛び蹴り', startup: 7, active: 12, recovery: 8, dmg: 62, box: { x: 56, y: -18, w: 76, h: 62 }, kb: 8, lift: 0, stun: 20, chip: 7, gauge: 8 },
      special: {
        name: '熱線', type: 'beam', startup: 22, active: 26, recovery: 26,
        dmg: 16, tick: 4, kb: 4, lift: 0, stun: 8, chip: 3, gauge: 5,
        beam: { y: 118, thick: 26, len: 720, color: '#8ef0ff', core: '#ffffff' },
      },
      super: {
        name: '背びれ全開・大熱線', type: 'beam', startup: 34, active: 46, recovery: 34,
        dmg: 22, tick: 3, kb: 6, lift: 2, stun: 10, chip: 6, gauge: 0,
        beam: { y: 122, thick: 58, len: 1300, color: '#a8f4ff', core: '#ffffff' },
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'triga', name: 'トライガ', en: 'TRIGA', title: '黄金の三首',
    form: 'hydra', size: 154,
    hp: 940, speed: 3.7, jump: 17.5, weight: 0.85, defense: 0.95, flyer: true,
    colors: {
      main: '#e0b23c', dark: '#8a6413', belly: '#f6dd9a',
      accent: '#ffe57a', eye: '#ff3b5c', glow: '#ffd75e',
    },
    desc: '三つの首がそれぞれ勝手に敵を狙う金色の竜。翼があるので空を長く飛べる。首から吐く引力光線は三方向に散り、遠くからじわじわ削るのが得意。',
    tips: '空中でもう一度ジャンプできる。飛びながらの引力光線が強い。',
    moves: {
      light: { name: '三連の噛みつき', startup: 7, active: 5, recovery: 11, dmg: 38, box: { x: 82, y: 132, w: 72, h: 58 }, kb: 4, lift: 0, stun: 14, chip: 4, gauge: 7, step: 5, cancel: true },
      heavy: { name: '翼の一撃', startup: 15, active: 8, recovery: 21, dmg: 84, box: { x: 84, y: 96, w: 108, h: 92 }, kb: 12, lift: 8, stun: 25, chip: 10, gauge: 10, step: 14 },
      air: { name: '急降下', startup: 6, active: 14, recovery: 10, dmg: 66, box: { x: 44, y: -22, w: 84, h: 66 }, kb: 9, lift: 0, stun: 20, chip: 7, gauge: 8 },
      special: {
        name: '引力光線', type: 'shot', startup: 16, active: 6, recovery: 24,
        dmg: 44, kb: 7, lift: 2, stun: 18, chip: 5, gauge: 6,
        shot: { count: 3, spread: 0.22, speed: 11, size: 17, y: 140, color: '#ffe57a', trail: '#ffb03a', gravity: 0 },
      },
      super: {
        name: '三首斉射', type: 'shot', startup: 26, active: 30, recovery: 32,
        dmg: 34, kb: 6, lift: 3, stun: 14, chip: 7, gauge: 0,
        shot: { count: 3, spread: 0.3, speed: 13, size: 24, y: 142, color: '#fff3b0', trail: '#ff8a2b', gravity: 0, waves: 5, interval: 6 },
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'goriga', name: 'ゴリガ', en: 'GORIGA', title: '島の主',
    form: 'ape', size: 128,
    hp: 1080, speed: 3.9, jump: 16.5, weight: 1.1, defense: 1.05,
    colors: {
      main: '#5b4331', dark: '#2c1f16', belly: '#a98a63',
      accent: '#ffb45c', eye: '#ffd9a0', glow: '#ffcf8a',
    },
    desc: '孤島の頂に住んでいた大猿。飛び道具は持たないかわりに殴りが重く、足も速い。胸を叩いて気合いを入れると、しばらく攻撃力が上がる。',
    tips: '両手の叩きつけは地面を割って離れた相手にも届く。近づいて殴り続けるのが本領。',
    moves: {
      light: { name: 'フック', startup: 6, active: 4, recovery: 9, dmg: 44, box: { x: 70, y: 92, w: 62, h: 52 }, kb: 5, lift: 0, stun: 15, chip: 5, gauge: 7, step: 8, cancel: true },
      heavy: { name: '両手の叩きつけ', startup: 17, active: 8, recovery: 24, dmg: 98, box: { x: 68, y: 44, w: 108, h: 78 }, kb: 10, lift: 12, stun: 28, chip: 12, gauge: 11, step: 6, quake: 1 },
      air: { name: '空中つかみ落とし', startup: 6, active: 13, recovery: 9, dmg: 64, box: { x: 50, y: -14, w: 74, h: 60 }, kb: 7, lift: 0, stun: 20, chip: 7, gauge: 8 },
      special: {
        name: '瓦礫投げ', type: 'shot', startup: 18, active: 5, recovery: 22,
        dmg: 58, kb: 9, lift: 4, stun: 20, chip: 6, gauge: 7,
        shot: { count: 1, spread: 0, speed: 13, size: 26, y: 116, color: '#8b7355', trail: '#5b4331', gravity: 0.32, spin: 1, kind: 'rock' },
      },
      super: {
        name: '猛り狂う乱打', type: 'rush', startup: 18, active: 54, recovery: 30,
        dmg: 26, tick: 6, kb: 3, lift: 1, stun: 10, chip: 5, gauge: 0,
        rush: { hits: 8, finishDmg: 120, finishKb: 22, finishLift: 14, reach: 96, quake: 1 },
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'rinne', name: 'リンネ', en: 'RINNE', title: '光の翅',
    form: 'moth', size: 130,
    hp: 860, speed: 4.2, jump: 14.5, weight: 0.7, defense: 0.9, flyer: true,
    colors: {
      main: '#d9723f', dark: '#8a3f1c', belly: '#f4d7a8',
      accent: '#7fd4ff', eye: '#4fe0c8', glow: '#bff3ff',
    },
    desc: '島の祈りに応えて現れる巨大な蛾。体は軽く打たれ弱いが、ふわりと浮いて相手の上を取れる。撒いた鱗粉はその場に残り、触れた相手の動きを鈍らせる。',
    tips: '鱗粉を置いてから近づくと戦いやすい。落下がゆっくりなので空中戦が得意。',
    moves: {
      light: { name: '前脚の突き', startup: 5, active: 4, recovery: 9, dmg: 34, box: { x: 66, y: 96, w: 60, h: 46 }, kb: 4, lift: 0, stun: 13, chip: 4, gauge: 7, step: 7, cancel: true },
      heavy: { name: '翅のはたき', startup: 13, active: 9, recovery: 20, dmg: 76, box: { x: 78, y: 88, w: 118, h: 86 }, kb: 15, lift: 4, stun: 22, chip: 9, gauge: 10, step: 4, wind: 1 },
      air: { name: '舞い降り', startup: 6, active: 15, recovery: 8, dmg: 56, box: { x: 46, y: -12, w: 80, h: 56 }, kb: 7, lift: 0, stun: 18, chip: 6, gauge: 8 },
      special: {
        name: '鱗粉', type: 'cloud', startup: 14, active: 8, recovery: 20,
        dmg: 9, tick: 12, kb: 1, lift: 0, stun: 4, chip: 2, gauge: 5,
        cloud: { x: 120, y: 90, r: 96, life: 240, color: '#bff3ff', slow: 0.55 },
      },
      super: {
        name: '光の鱗粉嵐', type: 'storm', startup: 30, active: 90, recovery: 26,
        dmg: 13, tick: 8, kb: 2, lift: 1, stun: 5, chip: 4, gauge: 0,
        storm: { w: 500, color: '#dff8ff', motes: 110 },
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'zeroga', name: 'ゼロガ', en: 'ZEROGA', title: '対怪獣兵器',
    form: 'mecha', size: 136,
    hp: 1020, speed: 3.3, jump: 15, weight: 1.2, defense: 1.1,
    colors: {
      main: '#9aa7b4', dark: '#454f5b', belly: '#c9d4de',
      accent: '#ff5a3c', eye: '#ff2d2d', glow: '#ff8a5c',
    },
    desc: '人間が怪獣に対抗するために組み上げた鋼の機体。動きは重いが装甲が厚く、肩のミサイルと右腕のドリルで遠近どちらもさばける。',
    tips: 'ミサイルは相手のいる高さに向かって飛ぶ。ドリルは当てたぶんだけ削り続ける。',
    moves: {
      light: { name: '装甲パンチ', startup: 7, active: 4, recovery: 11, dmg: 42, box: { x: 76, y: 98, w: 64, h: 48 }, kb: 5, lift: 0, stun: 15, chip: 5, gauge: 6, step: 6, cancel: true },
      heavy: { name: 'ドリル突き', startup: 16, active: 14, recovery: 22, dmg: 88, box: { x: 92, y: 96, w: 96, h: 44 }, kb: 11, lift: 2, stun: 24, chip: 11, gauge: 10, step: 18 },
      air: { name: '降下踏みつけ', startup: 8, active: 12, recovery: 12, dmg: 66, box: { x: 40, y: -20, w: 78, h: 60 }, kb: 8, lift: 0, stun: 20, chip: 7, gauge: 8 },
      special: {
        name: 'ミサイル斉射', type: 'shot', startup: 18, active: 12, recovery: 24,
        dmg: 34, kb: 6, lift: 2, stun: 15, chip: 5, gauge: 5,
        shot: { count: 1, spread: 0, speed: 10, size: 14, y: 128, color: '#ff8a5c', trail: '#ffd0a8', gravity: 0, homing: 0.07, kind: 'missile', waves: 3, interval: 6 },
      },
      super: {
        name: '全砲門斉射', type: 'barrage', startup: 28, active: 66, recovery: 32,
        dmg: 30, kb: 5, lift: 2, stun: 12, chip: 6, gauge: 0,
        barrage: { shells: 10, interval: 5, color: '#ffb27a' },
        beamFrom: 0.5, tick: 4,
        beam: { y: 126, thick: 44, len: 1150, color: '#ffb27a', core: '#fff6ea' },
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'gameld', name: 'ガメルド', en: 'GAMELD', title: '護りの甲羅',
    form: 'turtle', size: 118,
    hp: 1150, speed: 2.9, jump: 13.5, weight: 1.3, defense: 1.25,
    colors: {
      main: '#4f7a4a', dark: '#22381f', belly: '#d3c48a',
      accent: '#ff9b3d', eye: '#ffe08a', glow: '#ffb85c',
    },
    desc: '背に山を負ったような甲羅の怪獣。誰よりも打たれ強く、ガードが硬い。甲羅に籠って火を噴き、回転しながら地面を滑って突っ込む。',
    tips: '体力とガードの硬さが売り。回転突進は当たると相手を大きく押し込む。',
    moves: {
      light: { name: '噛みつき', startup: 6, active: 4, recovery: 10, dmg: 40, box: { x: 66, y: 82, w: 58, h: 46 }, kb: 4, lift: 0, stun: 14, chip: 5, gauge: 7, step: 5, cancel: true },
      heavy: { name: '甲羅アッパー', startup: 15, active: 7, recovery: 23, dmg: 90, box: { x: 62, y: 86, w: 88, h: 96 }, kb: 8, lift: 16, stun: 26, chip: 11, gauge: 10, step: 6 },
      air: { name: '落下プレス', startup: 7, active: 14, recovery: 13, dmg: 70, box: { x: 24, y: -22, w: 92, h: 56 }, kb: 6, lift: 0, stun: 21, chip: 8, gauge: 8, quake: 1 },
      special: {
        name: '回転突進', type: 'dash', startup: 14, active: 34, recovery: 22,
        dmg: 72, kb: 14, lift: 4, stun: 24, chip: 9, gauge: 8,
        dash: { speed: 12, box: { x: 8, y: 58, w: 104, h: 96 }, armor: 1 },
      },
      super: {
        name: '噴射大回転', type: 'dash', startup: 22, active: 74, recovery: 28,
        dmg: 42, tick: 14, kb: 12, lift: 6, stun: 18, chip: 8, gauge: 0,
        dash: { speed: 17, box: { x: 8, y: 58, w: 122, h: 110 }, armor: 2, bounce: 1, flame: 1 },
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'octoga', name: 'オクトガ', en: 'OCTOGA', title: '湾の八腕',
    form: 'cephalopod', size: 132,
    hp: 960, speed: 3.4, jump: 14.5, weight: 0.95, defense: 0.95,
    colors: {
      main: '#a8467e', dark: '#5b1f45', belly: '#f2c2d8',
      accent: '#7be0d0', eye: '#fff0a0', glow: '#8ff0e0',
    },
    desc: '湾の底から上がってきた八本腕。腕が長いので、相手が届かない間合いから殴れる。吐いた墨は相手にまとわりついて狙いを鈍らせる。',
    tips: '間合いを保ったまま触腕を振るのが強い。近づかれたら墨で仕切り直す。',
    moves: {
      light: { name: '触腕の鞭', startup: 7, active: 5, recovery: 11, dmg: 36, box: { x: 96, y: 92, w: 92, h: 40 }, kb: 5, lift: 0, stun: 14, chip: 4, gauge: 7, step: 3, cancel: true },
      heavy: { name: '八腕の叩きつけ', startup: 18, active: 8, recovery: 24, dmg: 88, box: { x: 118, y: 52, w: 150, h: 76 }, kb: 12, lift: 6, stun: 26, chip: 11, gauge: 10, step: 4 },
      air: { name: '巻きつき落とし', startup: 7, active: 13, recovery: 10, dmg: 60, box: { x: 52, y: -16, w: 96, h: 58 }, kb: 8, lift: 0, stun: 19, chip: 7, gauge: 8 },
      special: {
        name: '墨', type: 'cloud', startup: 15, active: 8, recovery: 22,
        dmg: 11, tick: 10, kb: 2, lift: 0, stun: 5, chip: 3, gauge: 6,
        cloud: { x: 150, y: 100, r: 108, life: 200, color: '#2a1030', slow: 0.7, blind: 1 },
      },
      super: {
        name: '大渦', type: 'vortex', startup: 26, active: 78, recovery: 30,
        dmg: 16, tick: 7, kb: 3, lift: 2, stun: 8, chip: 5, gauge: 0,
        vortex: { x: 190, r: 168, pull: 1.6, color: '#7be0d0' },
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'volga', name: 'ヴォルガ', en: 'VOLGA', title: '燃える岩塊',
    form: 'golem', size: 146,
    hp: 1120, speed: 3.0, jump: 14, weight: 1.25, defense: 1.15,
    colors: {
      main: '#4a3a38', dark: '#241a19', belly: '#ff7a2e',
      accent: '#ff5a1e', eye: '#ffe14f', glow: '#ff9a3c',
    },
    desc: '火口から立ち上がった岩の巨人。体の割れ目から溶岩がこぼれ、歩いたあとに火が残る。動きは遅いが一発が重く、地面から噴き上がる火柱で間合いを潰す。',
    tips: '火柱は相手の足元に出る。当たると打ち上がるので、そこから追撃できる。',
    moves: {
      light: { name: '岩の拳', startup: 8, active: 5, recovery: 11, dmg: 46, box: { x: 76, y: 100, w: 68, h: 54 }, kb: 5, lift: 0, stun: 16, chip: 6, gauge: 6, step: 5, cancel: true },
      heavy: { name: '溶岩の振り下ろし', startup: 19, active: 8, recovery: 25, dmg: 104, box: { x: 78, y: 50, w: 110, h: 92 }, kb: 11, lift: 10, stun: 29, chip: 13, gauge: 11, step: 5, quake: 1 },
      air: { name: '落岩', startup: 8, active: 13, recovery: 13, dmg: 72, box: { x: 30, y: -20, w: 88, h: 60 }, kb: 7, lift: 0, stun: 21, chip: 8, gauge: 8, quake: 1 },
      special: {
        name: '火柱', type: 'pillar', startup: 20, active: 18, recovery: 24,
        dmg: 66, kb: 5, lift: 15, stun: 24, chip: 8, gauge: 7,
        pillar: { at: 'foe', w: 74, h: 260, color: '#ff7a2e', core: '#ffe14f' },
      },
      super: {
        name: '噴火', type: 'rain', startup: 32, active: 84, recovery: 30,
        dmg: 46, kb: 6, lift: 8, stun: 16, chip: 7, gauge: 0,
        rain: { count: 18, interval: 5, size: 17, color: '#ff7a2e', spread: 620 },
      },
    },
  },
];

const KAIJU_BY_ID = {};
KAIJU.forEach((k) => { KAIJU_BY_ID[k.id] = k; });

/* =========================================================================
   ステージ
   ground は地面の上面の色、buildings は壊せる建物の並べ方。
   ========================================================================= */
const STAGES = [
  {
    id: 'bay-city', name: '新東京・臨海区', en: 'Bay City', when: '夜',
    lead: 'ネオンの灯った高層ビル街。ここで暴れると街の明かりが一つずつ消えていく。',
    sky: ['#0a1030', '#1d2a5c', '#4a3f6e'],
    haze: '#2a3a6b', moon: { x: 0.78, y: 0.16, r: 34, color: '#fff6d8' },
    far: { color: '#141c3d', style: 'city', lit: '#ffd98a', density: 1.0 },
    mid: { color: '#1b2650', style: 'city', lit: '#9fd4ff', density: 1.1 },
    ground: { top: '#39405c', body: '#232840', line: '#4c5578', style: 'asphalt' },
    weather: 'clear', neon: 1,
    buildings: { kinds: ['office', 'tower', 'block'], count: 15, palette: ['#3a4670', '#31406a', '#455280'], lit: '#ffe9a8' },
  },
  {
    id: 'bridge', name: '大鉄橋', en: 'Great Bridge', when: '夕暮れ',
    lead: '湾をまたぐ吊り橋の上。海面が夕日を返し、主塔がゆっくり傾いていく。',
    sky: ['#2b1c4a', '#8a3f5e', '#f0894a'],
    haze: '#c96a4e', sun: { x: 0.2, y: 0.62, r: 58, color: '#ffd07a' },
    far: { color: '#4a2c46', style: 'mountain', density: 0.8 },
    mid: { color: '#5c3350', style: 'bridge', density: 1.0 },
    ground: { top: '#6b5064', body: '#3b2b3c', line: '#8d6a7d', style: 'deck' },
    weather: 'clear', sea: '#803d54',
    buildings: { kinds: ['pylon', 'block'], count: 10, palette: ['#7a4a5e', '#63384e'], lit: '#ffc98a' },
  },
  {
    id: 'refinery', name: '石油コンビナート', en: 'Refinery', when: '深夜',
    lead: '燃料タンクの列。壊すたびに火柱が上がり、空が赤く染まっていく。',
    sky: ['#160b12', '#3a1416', '#7a2a18'],
    haze: '#8a3418',
    far: { color: '#241016', style: 'stacks', lit: '#ff9a4a', density: 1.0 },
    mid: { color: '#33161c', style: 'stacks', lit: '#ffb35c', density: 1.2 },
    ground: { top: '#4a3a34', body: '#2a1f1e', line: '#6b544a', style: 'concrete' },
    weather: 'ash', flare: 1,
    buildings: { kinds: ['tank', 'stack', 'block'], count: 14, palette: ['#6b5a52', '#57463f', '#7a6558'], lit: '#ffb26a', volatile: 1 },
  },
  {
    id: 'airport', name: '国際空港', en: 'Airport', when: '朝焼け',
    lead: '滑走路と管制塔。飛び立てなかった旅客機が並んだまま朝を迎えている。',
    sky: ['#1c2c5a', '#5b6fa8', '#f2b078'],
    haze: '#a2b3d4', sun: { x: 0.82, y: 0.66, r: 42, color: '#fff0c0' },
    far: { color: '#3c4a72', style: 'mountain', density: 0.7 },
    mid: { color: '#4c5a84', style: 'hangar', density: 0.9 },
    ground: { top: '#5d6377', body: '#383d4d', line: '#8b93a8', style: 'runway' },
    weather: 'clear',
    buildings: { kinds: ['hangar', 'tower', 'plane'], count: 12, palette: ['#8a93aa', '#6f7890', '#9aa3b8'], lit: '#ffe9c0' },
  },
  {
    id: 'castle', name: '城下町', en: 'Castle Town', when: '春の宵',
    lead: '天守を囲む古い町並み。桜が舞うなかで屋根瓦が一枚ずつ剥がれていく。',
    sky: ['#241a3e', '#5c3a66', '#c76a86'],
    haze: '#9a5f7c', moon: { x: 0.24, y: 0.2, r: 28, color: '#ffe9f2' },
    far: { color: '#33254a', style: 'mountain', density: 0.9 },
    mid: { color: '#412d55', style: 'castle', density: 1.0 },
    ground: { top: '#4c4152', body: '#2a2333', line: '#6d5c72', style: 'stone' },
    weather: 'sakura',
    buildings: { kinds: ['machiya', 'keep', 'gate'], count: 13, palette: ['#6a4f5e', '#7b5a63', '#5c4552'], lit: '#ffd39a' },
  },
  {
    id: 'tower', name: '電波塔の丘', en: 'Tower Hill', when: '雷雨',
    lead: '街を見下ろす巨大な電波塔。落ちる雷が怪獣の輪郭を白く抜く。',
    sky: ['#080c18', '#141d33', '#243450'],
    haze: '#2c3a55',
    far: { color: '#101828', style: 'city', lit: '#7fa8d8', density: 0.9 },
    mid: { color: '#16203a', style: 'radio', lit: '#ff6b6b', density: 1.0 },
    ground: { top: '#333a46', body: '#1c212a', line: '#4a5464', style: 'wet' },
    weather: 'rain', lightning: 1,
    buildings: { kinds: ['radio', 'office', 'block'], count: 14, palette: ['#2e3950', '#28324a', '#39445e'], lit: '#9fd0ff' },
  },
];

const STAGE_BY_ID = {};
STAGES.forEach((s) => { STAGE_BY_ID[s.id] = s; });

/* =========================================================================
   アーケード
   5 戦したあと、最後に強化された三首竜が出る。
   ========================================================================= */
const ARCADE_LENGTH = 6;

const BOSS = {
  id: 'triga-omega', base: 'triga', name: 'トライガ・オメガ', en: 'TRIGA OMEGA',
  hpMul: 1.35, powerMul: 1.15, speedMul: 1.1,
  colors: { main: '#c8c8d8', dark: '#4a4a62', belly: '#f0f0ff', accent: '#a86bff', eye: '#7bffe0', glow: '#c79bff' },
  stage: 'tower',
  lead: '大気圏の外から降りてきた三首竜。鱗は白く灼け、光線は紫に変わっている。',
};

/* 難易度の名前 */
const DIFFICULTIES = [
  { id: 0, name: 'やさしい', note: '相手の手が遅く、こちらの体力が多い' },
  { id: 1, name: 'ふつう', note: '素直な強さ' },
  { id: 2, name: 'つよい', note: '割り込みも対空も飛んでくる' },
];
