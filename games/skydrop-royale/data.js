/* =========================================================================
   SKYDROP ROYALE ― データ
   武器 125 しゅるい × レア度 5 だんかい / かいふく / 弾 / 素材 / スキン / グライダー
   ========================================================================= */
'use strict';

const RARITY = [
  { name: 'ノーマル',   color: '#b9c0c8', dmg: 1.00, rel: 1.00, mag: 1.00 },
  { name: 'アンコモン', color: '#5fd35a', dmg: 1.07, rel: 0.95, mag: 1.00 },
  { name: 'レア',       color: '#4aa8ff', dmg: 1.15, rel: 0.90, mag: 1.10 },
  { name: 'エピック',   color: '#b46cff', dmg: 1.24, rel: 0.85, mag: 1.15 },
  { name: 'レジェンド', color: '#ffb52e', dmg: 1.34, rel: 0.78, mag: 1.25 },
];

const AMMO = {
  light:  { name: 'ライトだん',   color: '#cfd7e0', icon: '▪', pick: 30, max: 999 },
  medium: { name: 'ミドルだん',   color: '#7fd0a0', icon: '▮', pick: 30, max: 999 },
  heavy:  { name: 'ヘビーだん',   color: '#5b8bd8', icon: '█', pick: 8,  max: 999 },
  shells: { name: 'ショットだん', color: '#e8685a', icon: '●', pick: 8,  max: 999 },
  rocket: { name: 'ロケットだん', color: '#c8b04a', icon: '▲', pick: 3,  max: 99 },
  energy: { name: 'エネルギー',   color: '#6ff0ff', icon: '◆', pick: 40, max: 999 },
  arrow:  { name: 'や',           color: '#d8b07a', icon: '↑', pick: 10, max: 999 },
};

const MATS = [
  { id: 'wood',  name: 'き',   color: '#c88a4a', hp: 150, grow: 0.9 },
  { id: 'stone', name: 'いし', color: '#a0a4ac', hp: 280, grow: 1.6 },
  { id: 'metal', name: 'てつ', color: '#7f9ab8', hp: 450, grow: 2.4 },
];

/* カテゴリごとの きほん値。武器ごとに うわがきする */
const CATS = {
  pistol:   { name: 'ピストル',     ammo: 'light',  spd: 1500, range: 750,  sound: 'shot',  slow: 1.0 },
  smg:      { name: 'サブマシンガン', ammo: 'light', spd: 1450, range: 650,  sound: 'shot',  slow: 1.0 },
  ar:       { name: 'ライフル',     ammo: 'medium', spd: 1800, range: 1000, sound: 'shot',  slow: 0.95 },
  shotgun:  { name: 'ショットガン', ammo: 'shells', spd: 1300, range: 380,  sound: 'shotG', slow: 0.95 },
  sniper:   { name: 'スナイパー',   ammo: 'heavy',  spd: 2800, range: 2300, sound: 'shotH', slow: 0.9 },
  lmg:      { name: 'マシンガン',   ammo: 'medium', spd: 1700, range: 950,  sound: 'shot',  slow: 0.82 },
  launcher: { name: 'ランチャー',   ammo: 'rocket', spd: 720,  range: 1200, sound: 'shotH', slow: 0.85 },
  energy:   { name: 'エネルギーじゅう', ammo: 'energy', spd: 1400, range: 950, sound: 'laser', slow: 0.95 },
  element:  { name: 'ほうしゃき',   ammo: 'energy', spd: 520,  range: 330,  sound: 'flame', slow: 0.9 },
  bow:      { name: 'ゆみ',         ammo: 'arrow',  spd: 1300, range: 1200, sound: 'bow',   slow: 0.95 },
  throw:    { name: 'なげもの',     ammo: null,     spd: 600,  range: 520,  sound: 'throw', slow: 1.0 },
  melee:    { name: 'きんせつ',     ammo: null,     spd: 0,    range: 70,   sound: 'swing', slow: 1.0 },
  toy:      { name: 'おもちゃ',     ammo: null,     spd: 900,  range: 600,  sound: 'shotS', slow: 1.0 },
  utility:  { name: 'どうぐ',       ammo: null,     spd: 1100, range: 600,  sound: 'throw', slow: 1.0 },
};

/* 武器の ひょう。
   d=ダメージ r=1びょうの はっしゃ数 m=マガジン rl=リロード秒 s=ばらつき(度) w=でやすさ
   ほかの キー: p(弾数) proj(弾の しゅるい) ex(ばくはつ半径) burn freeze poison stun knock
   pierce wallP bounce homing chain split charge burst spin scope silent build(建物への倍率)
   minR(さいていレア) stack(なげものの 最大数) */
const WEAPON_ROWS = [
  // ---------------- ピストル ----------------
  ['pistol', 'ハンドガン', 'pistol', { d: 24, r: 6, m: 16, rl: 1.4, s: 3, w: 10 }],
  ['silencer', 'サイレンサーピストル', 'pistol', { d: 26, r: 5, m: 16, rl: 1.3, s: 2, silent: 1, w: 7 }],
  ['revolver', 'リボルバー', 'pistol', { d: 54, r: 1.6, m: 6, rl: 2.2, s: 1, w: 6 }],
  ['handcannon', 'ハンドキャノン', 'pistol', { d: 75, r: 1.0, m: 7, rl: 2.0, s: 1, knock: 140, w: 3, minR: 2 }],
  ['dualpistol', 'デュアルピストル', 'pistol', { d: 22, r: 7, m: 24, rl: 2.0, s: 4, p: 2, w: 6 }],
  ['machinepistol', 'マシンピストル', 'pistol', { d: 15, r: 13, m: 30, rl: 1.8, s: 7, w: 7 }],
  ['flaregun', 'フレアガン', 'pistol', { d: 30, r: 1.2, m: 1, rl: 1.6, s: 2, proj: 'orb', spd: 900, burn: 4, col: '#ff8a3a', w: 4 }],
  ['dartpistol', 'ダーツピストル', 'pistol', { d: 14, r: 3, m: 12, rl: 1.5, s: 1, poison: 4, col: '#7dff5a', w: 5 }],
  ['rubberpistol', 'ゴムだんピストル', 'pistol', { d: 12, r: 4, m: 15, rl: 1.5, s: 3, knock: 300, col: '#ff6ad5', w: 5 }],
  ['beampistol', 'ビームピストル', 'pistol', { d: 22, r: 5, m: 20, rl: 1.5, s: 0, ammo: 'energy', proj: 'beam', col: '#ff4a6a', w: 4 }],
  ['tranq', 'ねむりピストル', 'pistol', { d: 10, r: 1, m: 5, rl: 1.8, s: 1, stun: 1.3, col: '#c8a0ff', w: 3, minR: 2 }],
  // ---------------- サブマシンガン ----------------
  ['smg', 'サブマシンガン', 'smg', { d: 17, r: 11, m: 30, rl: 2.1, s: 6, w: 10 }],
  ['compactsmg', 'コンパクトSMG', 'smg', { d: 15, r: 14, m: 40, rl: 2.4, s: 8, w: 7 }],
  ['burstsmg', 'バーストSMG', 'smg', { d: 19, r: 3, m: 24, rl: 2.0, s: 4, burst: 4, w: 6 }],
  ['silentsmg', 'サイレントSMG', 'smg', { d: 16, r: 10, m: 30, rl: 2.0, s: 5, silent: 1, w: 6 }],
  ['drumsmg', 'ドラムSMG', 'smg', { d: 14, r: 12, m: 70, rl: 3.5, s: 7, w: 5 }],
  ['spraygun', 'スプレーマシンガン', 'smg', { d: 11, r: 18, m: 50, rl: 2.6, s: 12, w: 5 }],
  ['twinsmg', 'ツインSMG', 'smg', { d: 13, r: 12, m: 50, rl: 2.8, s: 7, p: 2, w: 4 }],
  ['hornetsmg', 'ホーネットSMG', 'smg', { d: 12, r: 9, m: 30, rl: 2.2, s: 8, homing: 4, spd: 900, col: '#ffd84a', w: 3, minR: 2 }],
  ['neonsmg', 'ネオンSMG', 'smg', { d: 15, r: 12, m: 36, rl: 2.0, s: 4, ammo: 'energy', proj: 'orb', col: '#3affea', w: 4 }],
  ['sparksmg', 'スパークSMG', 'smg', { d: 10, r: 10, m: 30, rl: 2.2, s: 6, chain: 1, col: '#9ae8ff', w: 3, minR: 1 }],
  // ---------------- ライフル ----------------
  ['ar', 'アサルトライフル', 'ar', { d: 30, r: 5.5, m: 30, rl: 2.3, s: 3, w: 10 }],
  ['burstar', 'バーストライフル', 'ar', { d: 28, r: 2.2, m: 30, rl: 2.5, s: 2, burst: 3, w: 8 }],
  ['heavyar', 'ヘビーアサルトライフル', 'ar', { d: 38, r: 3.8, m: 25, rl: 2.6, s: 3.5, w: 6 }],
  ['tacar', 'タクティカルライフル', 'ar', { d: 33, r: 4.5, m: 20, rl: 2.3, s: 1.5, scope: 1.25, w: 6 }],
  ['thermalar', 'サーマルライフル', 'ar', { d: 34, r: 4, m: 20, rl: 2.4, s: 2, scope: 1.3, thermal: 1, col: '#ff7a3a', w: 3, minR: 2 }],
  ['drumar', 'ドラムライフル', 'ar', { d: 26, r: 6, m: 60, rl: 3.4, s: 4, w: 5 }],
  ['rangerrifle', 'レンジャーライフル', 'ar', { d: 44, r: 2.5, m: 15, rl: 2.2, s: 1, w: 6 }],
  ['bullpup', 'ブルパップライフル', 'ar', { d: 27, r: 7, m: 30, rl: 2.2, s: 3.5, w: 6 }],
  ['marksman', 'マークスマンライフル', 'ar', { d: 50, r: 2.0, m: 12, rl: 2.4, s: 0.5, scope: 1.4, w: 5 }],
  ['silentar', 'サイレントライフル', 'ar', { d: 28, r: 5, m: 30, rl: 2.3, s: 3, silent: 1, w: 5 }],
  ['laserar', 'レーザーライフル', 'ar', { d: 26, r: 5, m: 30, rl: 2.4, s: 0, ammo: 'energy', proj: 'beam', col: '#ff3a3a', w: 4 }],
  ['plasmarifle', 'プラズマライフル', 'ar', { d: 40, r: 3, m: 24, rl: 2.5, s: 2, ammo: 'energy', proj: 'orb', ex: 45, spd: 1100, col: '#c86aff', w: 3, minR: 2 }],
  ['striker', 'ストライカーAR', 'ar', { d: 32, r: 6, m: 30, rl: 2.1, s: 3, w: 3, minR: 2 }],
  // ---------------- ショットガン ----------------
  ['pump', 'ポンプショットガン', 'shotgun', { d: 11, p: 10, r: 1.0, m: 5, rl: 4.5, s: 14, w: 10 }],
  ['autoshotgun', 'オートショットガン', 'shotgun', { d: 8, p: 9, r: 2.6, m: 8, rl: 4.0, s: 16, w: 7 }],
  ['doublebarrel', 'ダブルバレル', 'shotgun', { d: 13, p: 10, r: 3, m: 2, rl: 2.6, s: 15, w: 6 }],
  ['dragonbreath', 'ドラゴンブレス', 'shotgun', { d: 7, p: 9, r: 1.2, m: 5, rl: 4.2, s: 16, burn: 3, col: '#ff7a2a', w: 4 }],
  ['sawedoff', 'ソードオフ', 'shotgun', { d: 12, p: 12, r: 2, m: 2, rl: 2.2, s: 26, range: 240, w: 5 }],
  ['drumshotgun', 'ドラムショットガン', 'shotgun', { d: 7, p: 8, r: 3.5, m: 15, rl: 5.0, s: 18, w: 4 }],
  ['slug', 'スラッグショットガン', 'shotgun', { d: 85, p: 1, r: 0.9, m: 4, rl: 3.8, s: 1, range: 650, w: 5 }],
  ['flechette', 'フレシェットショットガン', 'shotgun', { d: 9, p: 8, r: 1.1, m: 6, rl: 4.2, s: 10, pierce: 2, w: 4 }],
  ['thundershotgun', 'サンダーショットガン', 'shotgun', { d: 7, p: 8, r: 1.2, m: 6, rl: 4.2, s: 14, chain: 1, col: '#9cd8ff', w: 3, minR: 2 }],
  ['levershotgun', 'レバーアクションショットガン', 'shotgun', { d: 10, p: 10, r: 1.4, m: 6, rl: 4.8, s: 12, w: 6 }],
  ['chargeshotgun', 'チャージショットガン', 'shotgun', { d: 12, p: 10, r: 1.5, m: 4, rl: 4.0, s: 14, charge: 1.1, w: 4 }],
  ['scattercannon', 'スキャッターキャノン', 'shotgun', { d: 6, p: 20, r: 0.8, m: 3, rl: 4.0, s: 32, knock: 320, range: 300, w: 3, minR: 2 }],
  // ---------------- スナイパー ----------------
  ['boltsniper', 'ボルトアクションスナイパー', 'sniper', { d: 105, r: 0.6, m: 5, rl: 3.0, s: 0, scope: 1.8, w: 8 }],
  ['semisniper', 'セミオートスナイパー', 'sniper', { d: 64, r: 1.6, m: 10, rl: 2.8, s: 0.5, scope: 1.6, w: 6 }],
  ['heavysniper', 'ヘビースナイパー', 'sniper', { d: 150, r: 0.35, m: 4, rl: 3.6, s: 0, scope: 1.9, wallP: 1, build: 3, w: 3, minR: 2 }],
  ['hunting', 'ハンティングライフル', 'sniper', { d: 88, r: 0.8, m: 1, rl: 1.4, s: 0.5, w: 7 }],
  ['railgun', 'レールガン', 'sniper', { d: 120, r: 0.5, m: 3, rl: 3.0, s: 0, ammo: 'energy', proj: 'beam', pierce: 5, wallP: 1, charge: 0.6, col: '#5affff', scope: 1.6, w: 2, minR: 3 }],
  ['silentsniper', 'サイレントスナイパー', 'sniper', { d: 95, r: 0.6, m: 5, rl: 3.0, s: 0, silent: 1, scope: 1.8, w: 4 }],
  ['freezesniper', 'フリーズスナイパー', 'sniper', { d: 70, r: 0.7, m: 5, rl: 3.0, s: 0, freeze: 2.5, col: '#aef0ff', scope: 1.7, w: 3, minR: 2 }],
  ['boomsniper', 'ばくはつスナイパー', 'sniper', { d: 80, r: 0.6, m: 4, rl: 3.2, s: 0, ex: 70, scope: 1.7, w: 3, minR: 2 }],
  ['longshot', 'ちょうきょりライフル', 'sniper', { d: 95, r: 0.7, m: 6, rl: 3.0, s: 0, range: 3200, spd: 3600, scope: 2.2, w: 4 }],
  // ---------------- マシンガン ----------------
  ['lmg', 'ライトマシンガン', 'lmg', { d: 24, r: 8, m: 100, rl: 5.0, s: 6, w: 7 }],
  ['minigun', 'ミニガン', 'lmg', { d: 17, r: 16, m: 200, rl: 6.0, s: 8, spin: 1.0, slow: 0.7, w: 4 }],
  ['heavylmg', 'ヘビーマシンガン', 'lmg', { d: 33, r: 6, m: 80, rl: 5.5, s: 5, w: 5 }],
  ['triplebarrel', 'トリプルバレル', 'lmg', { d: 14, r: 10, m: 90, rl: 5.0, s: 10, p: 3, w: 3, minR: 1 }],
  ['drumlmg', 'ドラムマシンガン', 'lmg', { d: 22, r: 9, m: 150, rl: 6.0, s: 7, w: 4 }],
  // ---------------- ランチャー ----------------
  ['rocket', 'ロケットランチャー', 'launcher', { d: 100, r: 0.8, m: 1, rl: 2.6, s: 1, proj: 'rocket', ex: 110, build: 3, w: 6 }],
  ['grenadelauncher', 'グレネードランチャー', 'launcher', { d: 85, r: 1.5, m: 6, rl: 3.0, s: 3, proj: 'grenade', ex: 100, fuse: 1.2, build: 3, spd: 700, w: 5 }],
  ['hominglauncher', 'ホーミングランチャー', 'launcher', { d: 90, r: 0.8, m: 1, rl: 3.0, s: 1, proj: 'rocket', ex: 90, homing: 2.5, build: 3, w: 3, minR: 2 }],
  ['quadlauncher', 'クアッドランチャー', 'launcher', { d: 60, r: 4, m: 4, rl: 3.2, s: 4, proj: 'rocket', ex: 80, build: 3, w: 3, minR: 2 }],
  ['clusterlauncher', 'クラスターランチャー', 'launcher', { d: 60, r: 0.9, m: 2, rl: 3.0, s: 1, proj: 'rocket', ex: 80, split: 5, build: 2, w: 3, minR: 2 }],
  ['fireworks', 'はなびランチャー', 'launcher', { d: 35, p: 5, r: 1, m: 3, rl: 3.0, s: 22, proj: 'rocket', ex: 60, rainbow: 1, w: 4 }],
  ['guided', 'ガイドミサイル', 'launcher', { d: 110, r: 0.5, m: 1, rl: 3.5, s: 0, proj: 'rocket', ex: 120, guided: 1, spd: 460, build: 3, w: 2, minR: 3 }],
  ['stickylauncher', 'ねんちゃくランチャー', 'launcher', { d: 75, r: 2, m: 4, rl: 3.0, s: 2, proj: 'grenade', sticky: 1, ex: 90, fuse: 1.3, build: 3, w: 4 }],
  ['harpoon', 'ハープーンガン', 'launcher', { d: 55, r: 1, m: 1, rl: 1.5, s: 0, ammo: 'heavy', proj: 'arrow', knock: -520, spd: 1600, range: 700, col: '#cfd7e0', w: 4 }],
  // ---------------- エネルギー ----------------
  ['beamrifle', 'ビームライフル', 'energy', { d: 50, r: 1.6, m: 8, rl: 2.4, s: 0, proj: 'beam', pierce: 2, col: '#4affb0', w: 5 }],
  ['freezeray', 'フリーズレイ', 'energy', { d: 6, r: 14, m: 60, rl: 2.6, s: 4, proj: 'orb', freeze: 0.8, spd: 900, range: 480, col: '#bdf4ff', w: 4 }],
  ['chainlightning', 'チェインライトニング', 'energy', { d: 28, r: 2.5, m: 15, rl: 2.5, s: 0, proj: 'beam', chain: 3, range: 700, col: '#a8d8ff', w: 3, minR: 2 }],
  ['blackholegun', 'ブラックホールガン', 'energy', { d: 20, r: 0.4, m: 2, rl: 3.5, s: 0, proj: 'orb', hole: 1, spd: 500, range: 600, col: '#8a3aff', w: 2, minR: 3 }],
  ['bubblegun', 'バブルガン', 'energy', { d: 8, r: 6, m: 30, rl: 2.2, s: 8, proj: 'orb', freeze: 0.6, knock: 90, spd: 520, range: 520, col: '#ff9ae8', w: 5 }],
  ['gravitygun', 'グラビティガン', 'energy', { d: 10, r: 1.2, m: 6, rl: 2.5, s: 0, proj: 'beam', knock: 800, range: 420, col: '#d0a0ff', w: 4 }],
  ['plasmacannon', 'プラズマキャノン', 'energy', { d: 70, r: 0.9, m: 4, rl: 3.0, s: 1, proj: 'orb', ex: 90, spd: 800, build: 2, col: '#ff4aff', w: 3, minR: 2 }],
  ['pulsegun', 'パルスガン', 'energy', { d: 18, r: 4, m: 24, rl: 2.4, s: 3, proj: 'orb', pierce: 2, bounce: 2, col: '#4adfff', w: 4 }],
  ['lasergatling', 'レーザーガトリング', 'energy', { d: 13, r: 18, m: 120, rl: 4.5, s: 4, proj: 'beam', spin: 0.8, slow: 0.75, col: '#ff5050', w: 3, minR: 2 }],
  ['teslagun', 'テスラガン', 'energy', { d: 12, r: 8, m: 40, rl: 2.6, s: 0, proj: 'beam', chain: 2, range: 450, col: '#7ab8ff', w: 4 }],
  // ---------------- ほうしゃき ----------------
  ['flamethrower', 'かえんほうしゃき', 'element', { d: 4, r: 25, m: 100, rl: 3.0, s: 14, proj: 'flame', burn: 3, col: '#ff8a2a', build: 2, w: 5 }],
  ['cryothrower', 'れいとうほうしゃき', 'element', { d: 3, r: 25, m: 100, rl: 3.0, s: 14, proj: 'flame', freeze: 0.5, col: '#aee8ff', w: 4 }],
  ['poisonspray', 'どくガススプレー', 'element', { d: 2, r: 20, m: 100, rl: 3.0, s: 18, proj: 'flame', poison: 3, col: '#8aff4a', w: 4 }],
  ['watercannon', 'ウォーターキャノン', 'element', { d: 3, r: 20, m: 100, rl: 3.0, s: 8, proj: 'flame', knock: 110, wet: 1, col: '#4ab0ff', w: 5 }],
  // ---------------- ゆみ ----------------
  ['longbow', 'ロングボウ', 'bow', { d: 100, r: 1.5, m: 1, rl: 0.45, s: 1, proj: 'arrow', charge: 1.0, w: 6 }],
  ['firebow', 'ほのおのゆみ', 'bow', { d: 80, r: 1.5, m: 1, rl: 0.45, s: 1, proj: 'arrow', charge: 1.0, burn: 4, col: '#ff7a2a', w: 4 }],
  ['icebow', 'こおりのゆみ', 'bow', { d: 75, r: 1.5, m: 1, rl: 0.45, s: 1, proj: 'arrow', charge: 1.0, freeze: 2, col: '#aef0ff', w: 4 }],
  ['boombow', 'ばくはつのゆみ', 'bow', { d: 80, r: 1.2, m: 1, rl: 0.6, s: 1, proj: 'arrow', charge: 1.0, ex: 80, build: 2, col: '#ffcf4a', w: 3, minR: 1 }],
  ['thunderbow', 'かみなりのゆみ', 'bow', { d: 70, r: 1.5, m: 1, rl: 0.45, s: 1, proj: 'arrow', charge: 1.0, chain: 3, col: '#a8d8ff', w: 3, minR: 2 }],
  ['poisonbow', 'どくのゆみ', 'bow', { d: 60, r: 1.5, m: 1, rl: 0.45, s: 1, proj: 'arrow', charge: 1.0, poison: 6, col: '#8aff4a', w: 4 }],
  ['repeatxbow', 'れんしゃクロスボウ', 'bow', { d: 26, r: 4, m: 8, rl: 2.2, s: 2, proj: 'arrow', w: 5 }],
  ['triplebow', 'さんれんゆみ', 'bow', { d: 45, p: 3, r: 1.3, m: 1, rl: 0.5, s: 12, proj: 'arrow', charge: 1.0, w: 4 }],
  // ---------------- なげもの ----------------
  ['grenade', 'てりゅうだん', 'throw', { d: 90, r: 1.2, s: 0, proj: 'grenade', ex: 110, fuse: 1.6, build: 3, stack: 6, w: 9 }],
  ['stickygrenade', 'ねんちゃくグレネード', 'throw', { d: 85, r: 1.2, s: 0, proj: 'grenade', sticky: 1, ex: 100, fuse: 1.5, build: 3, stack: 6, w: 6 }],
  ['smokebomb', 'けむりだま', 'throw', { d: 0, r: 1, s: 0, proj: 'grenade', fuse: 0.8, area: 'smoke', stack: 4, w: 5 }],
  ['molotov', 'かえんびん', 'throw', { d: 10, r: 1, s: 0, proj: 'grenade', fuse: 0, area: 'fire', stack: 4, w: 5 }],
  ['icegrenade', 'こおりグレネード', 'throw', { d: 20, r: 1, s: 0, proj: 'grenade', fuse: 1.2, ex: 120, freeze: 3, stack: 4, col: '#aef0ff', w: 4 }],
  ['shockwave', 'ショックウェーブだん', 'throw', { d: 0, r: 1, s: 0, proj: 'grenade', fuse: 1.0, ex: 160, knock: 900, selfKnock: 1, stack: 3, col: '#7a6aff', w: 4, minR: 3 }],
  ['landmine', 'じらい', 'throw', { d: 90, r: 1, s: 0, proj: 'deploy', dep: 'mine', ex: 90, stack: 3, w: 4 }],
  ['clustergrenade', 'クラスターグレネード', 'throw', { d: 50, r: 1, s: 0, proj: 'grenade', fuse: 1.4, ex: 80, split: 6, stack: 4, w: 3, minR: 2 }],
  ['thundergrenade', 'かみなりグレネード', 'throw', { d: 40, r: 1, s: 0, proj: 'grenade', fuse: 1.2, ex: 120, stun: 1.5, stack: 4, col: '#a8d8ff', w: 3 }],
  ['blackholegrenade', 'ブラックホールだん', 'throw', { d: 15, r: 1, s: 0, proj: 'grenade', fuse: 1.0, hole: 1, stack: 2, w: 2, minR: 3 }],
  ['sleepgas', 'ねむりガス', 'throw', { d: 0, r: 1, s: 0, proj: 'grenade', fuse: 0.8, area: 'sleep', stack: 3, w: 3, minR: 1 }],
  ['healgrenade', 'かいふくグレネード', 'throw', { d: 0, r: 1, s: 0, proj: 'grenade', fuse: 0.6, area: 'heal', stack: 3, w: 4 }],
  // ---------------- きんせつ ----------------
  ['sword', 'けん', 'melee', { d: 45, r: 2.5, range: 72, arc: 100, w: 6 }],
  ['greatsword', 'だいけん', 'melee', { d: 80, r: 1.1, range: 92, arc: 150, knock: 220, w: 4 }],
  ['katana', 'かたな', 'melee', { d: 38, r: 3.5, range: 76, arc: 90, lunge: 140, w: 4, minR: 1 }],
  ['hammer', 'ハンマー', 'melee', { d: 70, r: 1.0, range: 72, arc: 110, knock: 520, build: 3, w: 4 }],
  ['spear', 'やり', 'melee', { d: 50, r: 1.8, range: 125, arc: 30, w: 4 }],
  ['axe', 'おの', 'melee', { d: 55, r: 1.6, range: 72, arc: 100, build: 2.5, w: 5 }],
  ['dualblades', 'そうけん', 'melee', { d: 25, r: 6, range: 66, arc: 120, w: 4 }],
  ['beamsword', 'ビームソード', 'melee', { d: 60, r: 2.2, range: 88, arc: 140, col: '#5affd0', w: 2, minR: 3 }],
  ['boomerang', 'ブーメラン', 'melee', { d: 40, r: 1.2, proj: 'boomerang', spd: 800, range: 480, pierce: 9, w: 4 }],
  // ---------------- おもちゃ ----------------
  ['watergun', 'みずでっぽう', 'toy', { d: 2, r: 10, m: 40, rl: 2.0, s: 6, proj: 'flame', knock: 70, wet: 1, ammo: 'energy', col: '#4ab0ff', spd: 700, range: 420, w: 5 }],
  ['piethrow', 'パイなげ', 'toy', { d: 20, r: 1.5, s: 2, proj: 'grenade', fuse: 0, ex: 50, stun: 0.9, stack: 8, col: '#ffe0a0', w: 5 }],
  ['pikohammer', 'ピコピコハンマー', 'toy', { d: 5, r: 2, range: 76, arc: 110, knock: 750, melee: 1, col: '#ff5a8a', w: 5 }],
  ['paperplane', 'かみひこうきランチャー', 'toy', { d: 25, r: 2, m: 6, rl: 2.5, s: 4, proj: 'orb', homing: 4, spd: 520, ammo: 'light', col: '#ffffff', w: 4 }],
  ['snowballer', 'ゆきだまマシン', 'toy', { d: 12, r: 5, m: 20, rl: 2.0, s: 5, proj: 'orb', freeze: 0.35, spd: 900, ammo: 'light', col: '#f4fbff', w: 5 }],
  ['banana', 'バナナのかわ', 'toy', { d: 0, r: 2, s: 0, proj: 'deploy', dep: 'banana', stack: 6, w: 5 }],
  ['toyturret', 'おもちゃタレット', 'toy', { d: 12, r: 1, s: 0, proj: 'deploy', dep: 'turret', stack: 2, w: 3, minR: 1 }],
  ['confetti', 'かみふぶきキャノン', 'toy', { d: 4, p: 14, r: 1.2, m: 5, rl: 2.5, s: 36, knock: 150, ammo: 'shells', rainbow: 1, spd: 900, range: 360, w: 4 }],
  // ---------------- どうぐ ----------------
  ['grappler', 'グラップラー', 'utility', { d: 0, r: 1.5, s: 0, proj: 'grapple', spd: 1600, range: 700, stack: 10, w: 4 }],
  ['dashboots', 'ダッシュブーツ', 'utility', { d: 0, r: 2, s: 0, proj: 'dash', stack: 6, w: 4 }],
  ['portafort', 'インスタントとりで', 'utility', { d: 0, r: 1, s: 0, proj: 'deploy', dep: 'fort', stack: 2, w: 3, minR: 1 }],
  ['jumppad', 'ジャンプパッド', 'utility', { d: 0, r: 1, s: 0, proj: 'deploy', dep: 'pad', stack: 2, w: 3 }],
  ['barrier', 'シールドバリア', 'utility', { d: 0, r: 1, s: 0, proj: 'deploy', dep: 'barrier', stack: 3, w: 3 }],
];

const WEAPONS = {};
const WEAPON_LIST = [];
for (const [id, name, cat, o] of WEAPON_ROWS) {
  const c = CATS[cat];
  const w = {
    id, name, cat,
    d: o.d, p: o.p || 1, r: o.r, m: o.m || 0, rl: o.rl || 0, s: deg(o.s || 0),
    ammo: o.ammo !== undefined ? o.ammo : c.ammo,
    spd: o.spd || c.spd, range: o.range || c.range, slow: o.slow || c.slow,
    proj: o.proj || (cat === 'melee' || o.melee ? 'melee' : 'bullet'),
    sound: o.silent ? 'shotS' : (o.proj === 'beam' ? (o.chain ? 'zap' : 'laser') : c.sound),
    w: o.w, minR: o.minR || 0, col: o.col || null,
  };
  for (const k of ['burn', 'freeze', 'poison', 'stun', 'knock', 'pierce', 'wallP', 'bounce', 'homing', 'chain', 'split', 'charge', 'burst', 'spin', 'scope', 'silent', 'build', 'ex', 'fuse', 'sticky', 'guided', 'rainbow', 'hole', 'area', 'selfKnock', 'dep', 'stack', 'arc', 'lunge', 'thermal', 'wet'])
    if (o[k] !== undefined) w[k] = o[k];
  if (w.proj === 'melee') w.arc = deg(o.arc || 100);
  if (w.stack) w.ammo = null; // なげもの・どうぐは かずで もつ
  w.consumable = !!w.stack;
  WEAPONS[id] = w;
  WEAPON_LIST.push(w);
}

/* 1びょうあたりの つよさ（ずかんの ひょうじ用） */
function weaponDps(w, rar = 0) {
  const R = RARITY[rar];
  const dmg = w.d * R.dmg * w.p * (w.burst || 1);
  return Math.round(dmg * w.r);
}

/* かいふく アイテム */
const HEALS = {
  bandage:   { name: 'ばんそうこう',       hp: 15, max: 75,  t: 2.2, stack: 15, w: 10, col: '#f0d0a0', icon: 'bandage' },
  medkit:    { name: 'きゅうきゅうばこ',   hp: 100, max: 100, t: 6.0, stack: 3,  w: 5,  col: '#ff4a4a', icon: 'medkit' },
  smallsh:   { name: 'シールドドリンク(小)', sh: 25, maxSh: 50, t: 1.5, stack: 6, w: 9, col: '#4ab0ff', icon: 'smallsh' },
  bigsh:     { name: 'シールドドリンク(大)', sh: 50, maxSh: 100, t: 4.0, stack: 3, w: 6, col: '#2a7aff', icon: 'bigsh' },
  mixjuice:  { name: 'ミックスジュース',   hot: 75, t: 2.0, stack: 2, w: 3, col: '#c86aff', icon: 'mixjuice' },
  supersoda: { name: 'スーパーソーダ',     hp: 100, sh: 100, maxSh: 100, max: 100, t: 12, stack: 1, w: 1, col: '#ffd23a', icon: 'supersoda' },
};

/* -------------------------------- スキン --------------------------------
   体の パーツを くみあわせて 1体の キャラにする。
   head: かぶりもの / hair: かみがた / eyes: め / pat: ふくの もよう / back: せなか / fx: オーラ */
const PART_LISTS = {
  hair: ['none', 'short', 'spiky', 'long', 'bun', 'twin', 'mohawk', 'curly'],
  head: ['none', 'cap', 'beanie', 'helmet', 'cat', 'bunny', 'horns', 'crown', 'ninja', 'astro', 'pumpkin', 'robot', 'dino', 'bear', 'shark', 'frog', 'witch', 'knight', 'halo', 'headphones', 'flower', 'pirate', 'cowboy', 'propeller', 'kabuto', 'fox', 'chef', 'tiara'],
  eyes: ['dot', 'happy', 'angry', 'shades', 'visor', 'star', 'sleepy', 'big'],
  pat: ['plain', 'stripe', 'dots', 'star', 'bolt', 'zip', 'armor', 'belly', 'suit', 'heart', 'number', 'check'],
  back: ['none', 'cape', 'pack', 'angel', 'bat', 'butterfly', 'jetpack', 'dinotail', 'cattail', 'foxtail', 'shell', 'swordback', 'scarf'],
  fx: ['none', 'sparkle', 'flame', 'snow', 'rainbow', 'bubbles', 'hearts', 'bolt'],
};
const PART_NAMES = {
  hair: { none: 'なし', short: 'ショート', spiky: 'ツンツン', long: 'ロング', bun: 'おだんご', twin: 'ツイン', mohawk: 'モヒカン', curly: 'くるくる' },
  head: { none: 'なし', cap: 'キャップ', beanie: 'ニットぼう', helmet: 'ヘルメット', cat: 'ネコみみ', bunny: 'ウサみみ', horns: 'ツノ', crown: 'おうかん', ninja: 'ずきん', astro: 'うちゅうヘルメット', pumpkin: 'かぼちゃ', robot: 'ロボあたま', dino: 'きょうりゅうフード', bear: 'クマフード', shark: 'サメフード', frog: 'カエルフード', witch: 'まじょぼうし', knight: 'きしのかぶと', halo: 'てんしのわ', headphones: 'ヘッドホン', flower: 'おはな', pirate: 'かいぞくぼうし', cowboy: 'カウボーイ', propeller: 'プロペラぼうし', kabuto: 'かぶと', fox: 'キツネみみ', chef: 'コックぼうし', tiara: 'ティアラ' },
  eyes: { dot: 'てんてん', happy: 'にっこり', angry: 'キリッ', shades: 'サングラス', visor: 'バイザー', star: 'キラキラ', sleepy: 'ねむそう', big: 'まんまる' },
  pat: { plain: 'むじ', stripe: 'しましま', dots: 'みずたま', star: 'ほし', bolt: 'いなずま', zip: 'ジャケット', armor: 'よろい', belly: 'おなか', suit: 'スーツ', heart: 'ハート', number: 'ゼッケン', check: 'チェック' },
  back: { none: 'なし', cape: 'マント', pack: 'リュック', angel: 'てんしのはね', bat: 'コウモリのはね', butterfly: 'チョウのはね', jetpack: 'ジェットパック', dinotail: 'きょうりゅうのしっぽ', cattail: 'ネコのしっぽ', foxtail: 'キツネのしっぽ', shell: 'こうら', swordback: 'せなかのけん', scarf: 'マフラー' },
  fx: { none: 'なし', sparkle: 'キラキラ', flame: 'ほのお', snow: 'ゆき', rainbow: 'にじ', bubbles: 'あわ', hearts: 'ハート', bolt: 'でんき' },
};
const SKIN_TONES = ['#ffe0c4', '#f6c9a0', '#e0a878', '#b87a50', '#8a5a3a', '#5a3a28', '#c8e0ff', '#c8ffd0'];
const COLOR_SWATCH = ['#ff4a4a', '#ff8a2a', '#ffd23a', '#8ae04a', '#2ac870', '#2ad0d0', '#3a8aff', '#5a4aff', '#a64aff', '#ff5ac8', '#ffffff', '#c0c4cc', '#6a6e78', '#2a2c34', '#8a5a3a', '#f0d0a0'];

function S(id, name, rar, price, o) {
  return Object.assign({
    id, name, rar, price,
    tone: '#ffe0c4', hair: 'short', hairC: '#4a3020', head: 'none', headC: '#ff4a4a',
    eyes: 'dot', c1: '#3a8aff', c2: '#ffffff', pat: 'plain', legs: '#2a2c34', shoes: '#ffffff',
    back: 'none', backC: '#ff4a4a', fx: 'none',
  }, o);
}
const SKINS = [
  S('rookie', 'ルーキー', 0, 0, {}),
  S('rookie2', 'ルーキー・レッド', 0, 0, { c1: '#e84a4a', hair: 'long', hairC: '#2a1a10', tone: '#f6c9a0' }),
  S('scout', 'スカウト', 0, 0, { c1: '#5a8a3a', c2: '#3a5a2a', pat: 'zip', head: 'cap', headC: '#3a5a2a', tone: '#e0a878' }),
  S('sporty', 'スポーティ', 0, 0, { c1: '#ffd23a', c2: '#2a2c34', pat: 'number', hair: 'spiky', hairC: '#f0d060', legs: '#3a3e48' }),
  S('camper', 'キャンパー', 0, 0, { c1: '#ff8a2a', pat: 'check', c2: '#c85a1a', head: 'beanie', headC: '#2ad0d0', back: 'pack', backC: '#5a8a3a', tone: '#b87a50' }),
  S('diver', 'ダイバー', 0, 0, { c1: '#2a2c34', c2: '#2ad0d0', pat: 'stripe', head: 'helmet', headC: '#ffd23a', eyes: 'visor' }),
  S('catcaptain', 'ネコたいちょう', 1, 200, { head: 'cat', headC: '#ff9a4a', c1: '#ffffff', c2: '#ff9a4a', pat: 'belly', back: 'cattail', backC: '#ff9a4a', hair: 'none', eyes: 'happy' }),
  S('bunnypilot', 'ウサみみパイロット', 1, 200, { head: 'bunny', headC: '#ffffff', c1: '#ff5ac8', c2: '#ffffff', pat: 'zip', eyes: 'shades', back: 'scarf', backC: '#ffffff', hair: 'twin', hairC: '#ffd8a0' }),
  S('frogkid', 'カエルくん', 1, 200, { head: 'frog', headC: '#5ad04a', c1: '#5ad04a', c2: '#d8ff9a', pat: 'belly', hair: 'none', legs: '#3a8a2a', eyes: 'big' }),
  S('bearhug', 'クマさんパーカー', 1, 200, { head: 'bear', headC: '#8a5a3a', c1: '#8a5a3a', c2: '#f0d0a0', pat: 'belly', hair: 'none', legs: '#6a4028', eyes: 'happy' }),
  S('pirate', 'キャプテン・シオカゼ', 1, 250, { head: 'pirate', headC: '#2a2c34', c1: '#e84a4a', c2: '#ffffff', pat: 'stripe', back: 'cape', backC: '#2a2c34', hair: 'long', hairC: '#2a1a10', tone: '#e0a878' }),
  S('cowpoke', 'こうやの ガンマン', 1, 250, { head: 'cowboy', headC: '#a86a3a', c1: '#c85a1a', c2: '#f0d0a0', pat: 'zip', back: 'scarf', backC: '#e84a4a', tone: '#f6c9a0' }),
  S('chef', 'シェフ・モグモグ', 1, 200, { head: 'chef', headC: '#ffffff', c1: '#ffffff', c2: '#e84a4a', pat: 'zip', legs: '#2a2c34', hair: 'curly', hairC: '#8a5a3a' }),
  S('propeller', 'プロペラキッズ', 1, 200, { head: 'propeller', headC: '#ffd23a', c1: '#3a8aff', c2: '#ffd23a', pat: 'stripe', eyes: 'big', back: 'pack', backC: '#e84a4a' }),
  S('ninja', 'ニンジャ・カゲマル', 2, 400, { head: 'ninja', headC: '#2a2c44', c1: '#2a2c44', c2: '#e84a4a', pat: 'zip', legs: '#1a1c28', shoes: '#2a2c44', back: 'swordback', backC: '#c0c4cc', eyes: 'angry', hair: 'none' }),
  S('knight', 'しっこくの きし', 2, 450, { head: 'knight', headC: '#8a8ea0', c1: '#8a8ea0', c2: '#e84a4a', pat: 'armor', legs: '#5a5e6a', shoes: '#3a3e48', back: 'cape', backC: '#e84a4a', hair: 'none' }),
  S('witch', 'まじょっこ ルル', 2, 400, { head: 'witch', headC: '#5a3aa0', c1: '#5a3aa0', c2: '#ffd23a', pat: 'star', back: 'cape', backC: '#2a1a4a', hair: 'long', hairC: '#ff8ac8', fx: 'sparkle' }),
  S('shark', 'サメハンター', 2, 400, { head: 'shark', headC: '#5a8ac8', c1: '#5a8ac8', c2: '#ffffff', pat: 'belly', hair: 'none', legs: '#3a5a8a', eyes: 'angry' }),
  S('dinopaja', 'きょうりゅうパジャマ', 2, 400, { head: 'dino', headC: '#4ac870', c1: '#4ac870', c2: '#ffe08a', pat: 'belly', back: 'dinotail', backC: '#4ac870', hair: 'none', legs: '#3aa05a', eyes: 'happy' }),
  S('samurai', 'サムライ・ムサシ', 2, 450, { head: 'kabuto', headC: '#c83a3a', c1: '#c83a3a', c2: '#ffd23a', pat: 'armor', legs: '#2a2c34', back: 'swordback', backC: '#ffd23a', hair: 'none', eyes: 'angry' }),
  S('foxspirit', 'キツネの おまつり', 2, 400, { head: 'fox', headC: '#ff8a2a', c1: '#ffffff', c2: '#e84a4a', pat: 'stripe', back: 'foxtail', backC: '#ff8a2a', hair: 'long', hairC: '#ff8a2a', eyes: 'happy' }),
  S('turtle', 'カメせんにん', 2, 400, { head: 'none', c1: '#ffd23a', c2: '#2ac870', pat: 'belly', back: 'shell', backC: '#3a8a3a', hair: 'none', tone: '#8ae08a', eyes: 'sleepy' }),
  S('butterfly', 'おはなの ようせい', 2, 450, { head: 'flower', headC: '#ff5ac8', c1: '#ffb8e8', c2: '#ff5ac8', pat: 'heart', back: 'butterfly', backC: '#ff9ae8', hair: 'long', hairC: '#ffd23a', eyes: 'big', fx: 'hearts' }),
  S('astro', 'うちゅうひこうし', 3, 700, { head: 'astro', headC: '#ffffff', c1: '#ffffff', c2: '#ff8a2a', pat: 'zip', back: 'jetpack', backC: '#c0c4cc', legs: '#e0e4ec', shoes: '#c0c4cc', eyes: 'happy' }),
  S('robozero', 'ロボ・ゼロ', 3, 700, { head: 'robot', headC: '#c0c4cc', c1: '#8a9ab8', c2: '#2ad0d0', pat: 'armor', legs: '#6a7a98', shoes: '#3a3e48', back: 'jetpack', backC: '#6a7a98', hair: 'none', eyes: 'visor', fx: 'bolt' }),
  S('pumpkin', 'かぼちゃだいおう', 3, 700, { head: 'pumpkin', headC: '#ff8a2a', c1: '#5a3aa0', c2: '#ff8a2a', pat: 'stripe', back: 'cape', backC: '#2a1a4a', hair: 'none', fx: 'flame' }),
  S('angel', 'てんしの ミカ', 3, 750, { head: 'halo', headC: '#ffd23a', c1: '#ffffff', c2: '#ffd23a', pat: 'plain', back: 'angel', backC: '#ffffff', hair: 'long', hairC: '#ffe08a', eyes: 'happy', fx: 'sparkle', legs: '#f0f0f8' }),
  S('devil', 'こあくま デビ', 3, 750, { head: 'horns', headC: '#e84a4a', c1: '#2a1a2a', c2: '#e84a4a', pat: 'bolt', back: 'bat', backC: '#5a2a3a', hair: 'spiky', hairC: '#2a1a2a', eyes: 'angry', fx: 'flame' }),
  S('snowkid', 'ゆきんこ', 3, 650, { head: 'beanie', headC: '#3a8aff', c1: '#ffffff', c2: '#3a8aff', pat: 'dots', back: 'scarf', backC: '#e84a4a', tone: '#ffe8e0', hair: 'short', hairC: '#c8e8ff', fx: 'snow' }),
  S('djbeat', 'DJ ビート', 3, 650, { head: 'headphones', headC: '#ff5ac8', c1: '#2a2c34', c2: '#3affea', pat: 'bolt', eyes: 'shades', hair: 'mohawk', hairC: '#3affea', fx: 'rainbow' }),
  S('goldking', 'ゴールドキング', 4, 1200, { head: 'crown', headC: '#ffd23a', c1: '#ffd23a', c2: '#ffffff', pat: 'suit', back: 'cape', backC: '#c83a3a', legs: '#d8a820', shoes: '#ffd23a', hair: 'curly', hairC: '#f0d060', fx: 'sparkle', eyes: 'shades' }),
  S('dragonlord', 'ドラゴンロード', 4, 1200, { head: 'dino', headC: '#c83a3a', c1: '#c83a3a', c2: '#ffd23a', pat: 'armor', back: 'bat', backC: '#8a1a1a', hair: 'none', legs: '#8a1a1a', eyes: 'angry', fx: 'flame' }),
  S('galaxy', 'ギャラクシー', 4, 1200, { head: 'none', c1: '#2a1a5a', c2: '#ffffff', pat: 'star', back: 'cape', backC: '#5a3aa0', tone: '#c8e0ff', hair: 'long', hairC: '#a64aff', eyes: 'star', fx: 'sparkle', legs: '#1a1040', shoes: '#a64aff' }),
  S('thunder', 'いかずちの ゆうしゃ', 4, 1200, { head: 'helmet', headC: '#ffd23a', c1: '#3a4aff', c2: '#ffd23a', pat: 'bolt', back: 'cape', backC: '#ffd23a', eyes: 'visor', fx: 'bolt', legs: '#2a2a8a' }),
  S('princess', 'ほしの おひめさま', 4, 1100, { head: 'tiara', headC: '#ffd23a', c1: '#ff9ae8', c2: '#ffffff', pat: 'heart', back: 'angel', backC: '#ffe0f8', hair: 'long', hairC: '#ffe08a', eyes: 'star', fx: 'hearts', legs: '#ffb8e8' }),
  S('bubblemaster', 'あわあわ マスター', 4, 1000, { head: 'astro', headC: '#bdf4ff', c1: '#4ab0ff', c2: '#bdf4ff', pat: 'dots', back: 'jetpack', backC: '#2a7aff', eyes: 'big', fx: 'bubbles', hair: 'curly', hairC: '#ffffff' }),
];
const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

const GLIDERS = [
  { id: 'umbrella', name: 'かさ', price: 0, c1: '#ff4a4a', c2: '#ffffff' },
  { id: 'para', name: 'パラグライダー', price: 0, c1: '#3a8aff', c2: '#ffd23a' },
  { id: 'balloon', name: 'ふうせん', price: 150, c1: '#ff5ac8', c2: '#ffd23a' },
  { id: 'leaf', name: 'はっぱ', price: 150, c1: '#5ad04a', c2: '#3a8a2a' },
  { id: 'plane', name: 'かみひこうき', price: 250, c1: '#ffffff', c2: '#c0c4cc' },
  { id: 'dragonwing', name: 'ドラゴンのつばさ', price: 400, c1: '#c83a3a', c2: '#ffd23a' },
  { id: 'rocketboard', name: 'ロケットボード', price: 500, c1: '#8a9ab8', c2: '#ff8a2a' },
  { id: 'ufo', name: 'ちいさな UFO', price: 700, c1: '#c0c4cc', c2: '#3affea' },
];
const GLIDER_BY_ID = Object.fromEntries(GLIDERS.map((g) => [g.id, g]));

/* 場所の なまえ（オリジナル） */
const POI_NAMES = {
  town: ['にぎやかタウン', 'ひだまりの まち', 'ことりの まち', 'レンガどおり', 'すずかぜタウン', 'あおぞら しょうてんがい'],
  factory: ['さびさび こうじょう', 'ガラクタ ヤード', 'ネジまき こうば', 'でんきの はつでんしょ'],
  farm: ['もぐもぐ のうじょう', 'ひまわり ぼくじょう', 'にんじん ばたけ', 'こむぎの おか'],
  ruins: ['いにしえの いせき', 'わすれられた とりで', 'いしの おしろ', 'ねむる しんでん'],
  camp: ['もりの キャンプじょう', 'たきびの はらっぱ', 'きのこの もり'],
};

const BOT_NAMES = ['ぽんた', 'ミルク', 'ゆうき', 'ソラ', 'ハル', 'ぴよ', 'ケンタ', 'モモ', 'リク', 'ナナ', 'こてつ', 'ルナ', 'ゴロー', 'サクラ', 'カイ', 'つむぎ', 'ダイチ', 'ひなた', 'レオ', 'アオイ', 'タロウ', 'メイ', 'じんべえ', 'ココ', 'ヒロ', 'ユズ', 'ガク', 'ミオ', 'トラ', 'すず', 'ジン', 'ノア', 'ポチ', 'リン', 'たける', 'ふうか', 'ゲン', 'ミク', 'ハヤテ', 'くるみ', 'ショウ', 'あんず', 'テツ', 'ゆめ', 'マル', 'ことね', 'ライ', 'わかば', 'ジロウ', 'ひかり'];
