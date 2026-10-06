/* ゲーム一覧のデータ。ゲームを1本足すときは、ここに1件足して
   assets/thumbs/<slug>.jpg を置く（tools/capture-thumbs.sh で作れる）。 */
const GENRES = [
  { id: 'action',   ja: 'アクション',       en: 'Action' },
  { id: 'fighting', ja: '対戦格闘',         en: 'Fighting' },
  { id: 'shooter',  ja: 'シューター',       en: 'Shooter' },
  { id: 'horror',   ja: 'ホラー',           en: 'Horror' },
  { id: 'rpg',      ja: 'RPG・戦略',        en: 'RPG & Strategy' },
  { id: 'sandbox',  ja: 'サンドボックス・生活', en: 'Sandbox & Life' },
  { id: 'sports',   ja: 'スポーツ',         en: 'Sports' },
  { id: 'puzzle',   ja: '推理',             en: 'Deduction' },
  { id: 'party',    ja: 'パーティー',       en: 'Party' },
];

const GAMES = [
  {
    slug: 'star-flick', genre: 'action', players: '1–2P', date: '2026-10-06',
    ja: {
      title: 'STAR FLICK ― 宇宙船で消しピン',
      desc: '宇宙船をはじいてぶつけ、相手を宇宙へ落とす消しピン。ガチャで集めたパーツで船を改造できる。スマホ対応。',
    },
    en: {
      title: 'Star Flick',
      desc: 'Flick your spaceship to knock rivals into space, and upgrade it with parts from a gacha. Plays on phones.',
    },
  },
  {
    slug: 'neko-mart', genre: 'sandbox', players: '1P', date: '2026-10-06',
    ja: {
      title: 'NEKO MART ― ねこのお店やさん',
      desc: '猫の町でお店をひらく経営ゲーム。商品を仕入れて棚にならべ、動物のお客さんに売る。スマホ対応。',
    },
    en: {
      title: 'Neko Mart',
      desc: 'Run a little shop in a town of cats: stock the shelves and sell to animal customers. Plays on phones.',
    },
  },
  {
    slug: 'ore-to-armada', genre: 'sandbox', players: '1P', date: '2026-09-22',
    ja: {
      title: 'ORE TO ARMADA ― 鉱石から大艦隊へ',
      desc: '小惑星を掘って稼ぎ、船をブロックで組んで艦隊を率いる宇宙サンドボックス。パソコン向け。',
    },
    en: {
      title: 'Ore to Armada',
      desc: 'A space sandbox: mine asteroids, build your ship block by block and lead a fleet. Keyboard and mouse.',
    },
  },
  {
    slug: 'dead-drive', genre: 'action', players: '1P', date: '2026-09-22',
    ja: {
      title: 'DEAD DRIVE ― 改造車で生きのびろ',
      desc: '改造車でゾンビの街を走るローグライク。昼は物資を集め、夜は基地を守って10日間を生きのびる。スマホ対応。',
    },
    en: {
      title: 'Dead Drive',
      desc: 'A zombie roguelike in a car you build: scavenge by day, defend your base by night, survive ten nights. Plays on phones.',
    },
  },
  {
    slug: 'cellhouse', genre: 'sandbox', players: '1P', date: '2026-09-22',
    ja: {
      title: 'CELLHOUSE ― 塀の中をつくる',
      desc: '刑務所を建てて運営する経営シミュレーション。囚人の不満を抑えて暴動や脱走を防ぐ。スマホ対応。',
    },
    en: {
      title: 'Cellhouse',
      desc: 'Build and run a prison, keeping inmates content enough to head off riots and escapes. Plays on phones.',
    },
  },
  {
    slug: 'kaiju-clash', genre: 'fighting', players: '1–2P', date: '2026-09-08',
    ja: {
      title: 'KAIJU CLASH ― 街を壊す怪獣たち',
      desc: '街のまんなかで怪獣どうしが殴りあう対戦格闘。8体から選べて、ビルは殴ると崩れる。スマホ対応。',
    },
    en: {
      title: 'Kaiju Clash',
      desc: 'Eight giant monsters brawl through a city that crumbles around them, with one-button moves. Plays on phones.',
    },
  },
  {
    slug: 'sunset-shift', genre: 'action', players: '1P', date: '2026-09-08',
    ja: {
      title: 'SUNSET SHIFT ― 定時後のヒーロー',
      desc: '昼は会社員、定時後は街のヒーローになる見下ろしアクション。3人を使い分けて事件を解決する。',
    },
    en: {
      title: 'Sunset Shift',
      desc: 'Office workers by day, heroes after six: fight crime across streets and rooftops as one of three heroes.',
    },
  },
  {
    slug: 'beast-cradle', genre: 'rpg', players: '1P', date: '2026-09-08',
    ja: {
      title: 'BEAST CRADLE ― 育ての闘技場',
      desc: 'けものを育てて闘技場で戦わせる育成バトル。稽古のたびに一週が過ぎ、皆が歳をとる。スマホ対応。',
    },
    en: {
      title: 'Beast Cradle',
      desc: 'Raise monsters for the arena, where every training session costs a week and everyone ages. Plays on phones.',
    },
  },
  {
    slug: 'phantom-duel', genre: 'fighting', players: '1P', date: '2026-09-08',
    ja: {
      title: 'PHANTOM DUEL ― 自分だけの幻影',
      desc: '猫の街で幻影どうしを戦わせる見下ろしバトル。全6章のストーリーで、相棒は自分でも作れる。',
    },
    en: {
      title: 'Phantom Duel',
      desc: 'Duel with phantom partners through a six-chapter story in a city of cats, or build a phantom of your own.',
    },
  },
  {
    slug: 'moko-god', genre: 'rpg', players: '1P', date: '2026-09-08',
    ja: {
      title: 'MOKO GOD ― 影の城とモコの剣',
      desc: 'CASTAWAY PLANET のモコが剣をとる見下ろしアクションRPG。剣と魔法で影の城を目指す。スマホ対応。',
    },
    en: {
      title: 'Moko God',
      desc: 'A top-down action RPG where a Moko from Castaway Planet takes up a sword and storms a shadow castle. Plays on phones.',
    },
  },
  {
    slug: 'party-maker', genre: 'party', players: '2–5P', date: '2026-09-01',
    ja: {
      title: 'PARTY MAKER ― みんなでつくる大会',
      desc: '1台の画面を回して遊ぶ2〜5人のパーティーゲーム。おえかきクイズなど6種のミニゲーム入り。',
    },
    en: {
      title: 'Party Maker',
      desc: 'A pass-the-screen party game for 2–5 players with six minigames, including draw-and-guess.',
    },
  },
  {
    slug: 'castaway-planet', genre: 'sandbox', players: '1P', date: '2026-09-01',
    ja: {
      title: 'CASTAWAY PLANET ― 墜ちた星の暮らし',
      desc: '墜ちた星で畑を耕し鉱石を掘り、宇宙船を直して星々を渡る見下ろしサンドボックス。',
    },
    en: {
      title: 'Castaway Planet',
      desc: 'Crash-land on a planet, then farm, mine and repair your ship to travel across four worlds.',
    },
  },
  {
    slug: 'walled-wolves', genre: 'puzzle', players: '1P', date: '2026-08-25',
    ja: {
      title: 'WALLED WOLVES ― 壁の中の人狼',
      desc: '閉ざされた中世の街を歩き回る人狼ゲーム。昼は仕事をこなし、夜は隠れるか狼になって襲う。',
    },
    en: {
      title: 'Walled Wolves',
      desc: 'A walk-around werewolf game in a sealed medieval town: chores by day, hide or hunt by night.',
    },
  },
  {
    slug: 'noclip', genre: 'horror', players: '1P', date: '2026-08-25',
    ja: {
      title: 'NOCLIP ― 壁抜けの館',
      desc: 'ツルハシで壁を壊して進むサバイバルホラー。掘る音が実体たちを呼び寄せる。',
    },
    en: {
      title: 'NOCLIP',
      desc: 'A survival horror where your pickaxe breaks through walls, and every swing draws the entities closer.',
    },
  },
  {
    slug: 'mech-raiders', genre: 'shooter', players: '1–2P', date: '2026-08-25',
    ja: {
      title: 'MECH RAIDERS ― 鋼鉄機兵',
      desc: '18機から機体を選んで出撃し、敵機を狩る見下ろしロボット戦。',
    },
    en: {
      title: 'Mech Raiders',
      desc: 'A top-down mech shooter: pick from eighteen frames and hunt enemy machines sector by sector.',
    },
  },
  {
    slug: 'hollow-toys-fp', genre: 'horror', players: '1P', date: '2026-08-18',
    ja: {
      title: 'HOLLOW TOYS 一人称視点 ― 閉店したピザ店の夜',
      desc: 'HOLLOW TOYS の一人称版。懐中電灯の明かりだけを頼りに、閉店したピザ店から逃げる。',
    },
    en: {
      title: 'Hollow Toys: First Person',
      desc: 'Hollow Toys in first person: escape the pizzeria seeing only what your flashlight reaches.',
    },
  },
  {
    slug: 'parkour-blade', genre: 'action', players: '1P', date: '2026-08-18',
    ja: {
      title: 'PARKOUR BLADE ― 刃の回廊',
      desc: '刃を跳び越え、くぐり、壁キックで谷を渡る見下ろしパルクール。全6ステージ。',
    },
    en: {
      title: 'Parkour Blade',
      desc: 'A top-down parkour runner: jump, slide and wall-kick past blades across six timed stages.',
    },
  },
  {
    slug: 'steel-serpent', genre: 'action', players: '1P', date: '2026-08-18',
    ja: {
      title: 'STEEL SERPENT ― 鋼の蛇',
      desc: '弾をローリングでかわし、ナイフ一本で踏み込む横スクロールのステルスアクション。',
    },
    en: {
      title: 'Steel Serpent',
      desc: 'A side-scrolling stealth action game: roll through bullets and close in with just a knife.',
    },
  },
  {
    slug: 'forge-and-crown', genre: 'rpg', players: '1P', date: '2026-08-17',
    ja: {
      title: 'FORGE & CROWN ― 鍛冶と王冠',
      desc: '城を設計し、領地を運営し、パズルで鎧を鍛えて自らも戦う国づくりRPG。',
    },
    en: {
      title: 'Forge & Crown',
      desc: 'A fantasy strategy RPG: design your castle, run your province, forge armour as a puzzle and fight on the field.',
    },
  },
  {
    slug: 'hollow-toys', genre: 'horror', players: '1P', date: '2026-08-17',
    ja: {
      title: 'HOLLOW TOYS ― 閉店したピザ店の夜',
      desc: '懐中電灯ひとつで閉店したピザ店を探り、動き出したアニマトロニクスから逃げるホラー。',
    },
    en: {
      title: 'Hollow Toys',
      desc: 'A top-down survival horror: sneak through a shuttered pizzeria by flashlight and escape the animatronics.',
    },
  },
  {
    slug: 'gacha-strikers', genre: 'sports', players: '1P', date: '2026-08-17',
    ja: {
      title: 'GACHA STRIKERS ― ガチャストライカーズ',
      desc: 'ガチャで選手を集めてチームを作るアーケードサッカー。全12ステージ。',
    },
    en: {
      title: 'Gacha Strikers',
      desc: 'Arcade soccer with a gacha roster: pull players, build your formation and clear twelve stages.',
    },
  },
  {
    slug: 'war-zone-pixel', genre: 'shooter', players: '1P / オンライン', players_en: '1P / Online', date: '2026-07-30',
    ja: {
      title: 'WARZONE: CHRONOFRONT ― 時蝕戦線',
      desc: '時の裂け目を4つの軍が奪い合う、ドット絵の見下ろしシューター。',
    },
    en: {
      title: 'Warzone: Chronofront',
      desc: 'A pixel-art top-down shooter where four armies fight over a time fracture.',
    },
  },
  {
    slug: 'mythic-realm', genre: 'rpg', players: '1P / オンライン', players_en: '1P / Online', date: '2026-07-28',
    ja: {
      title: 'MYTHIC REALM 2D ― 神話の魔境',
      desc: '9つの職業から選べる、剣と魔法の見下ろしアクションRPG。',
    },
    en: {
      title: 'Mythic Realm 2D',
      desc: 'A top-down sword-and-sorcery action RPG with nine classes.',
    },
  },
  {
    slug: 'war-zone', genre: 'shooter', players: '1P / オンライン', players_en: '1P / Online', date: '2026-06-23',
    ja: {
      title: 'WARZONE 2D ― 戦場',
      desc: '基地で装備を整え、ガチャで仲間を集めて戦う見下ろし戦争シューター。',
    },
    en: {
      title: 'Warzone 2D',
      desc: 'A top-down war shooter: gear up at base, recruit allies from a gacha and head into battle.',
    },
  },
  {
    slug: 'street-fighter', genre: 'fighting', players: '1–2P', date: '2026-06-23',
    ja: {
      title: 'ストリート・ファイト',
      desc: 'ボタン1つで必殺技が出る2D対戦格闘。CPU戦と2人対戦を選べる。',
    },
    en: {
      title: 'Street Fight',
      desc: 'A 2D fighter with one-button specials, vs CPU or two players on one keyboard.',
    },
  },
  {
    slug: 'smash-browser-mobile', genre: 'fighting', players: '1P', date: '2026-06-23',
    ja: {
      title: 'Mini Smash (スマホ版)',
      desc: 'Mini Smash のスマホ・タブレット版。タッチ操作で CPU と戦う。',
    },
    en: {
      title: 'Mini Smash (Mobile)',
      desc: 'Mini Smash for phones and tablets: fight a CPU with touch controls.',
    },
  },
  {
    slug: 'machigurashi', genre: 'sandbox', players: '1P', date: '2026-06-16',
    ja: {
      title: 'まちぐらし ― Lagoon Life',
      desc: '自動生成の町で働き、買い物をし、家を建てて暮らす生活シミュレーション。',
    },
    en: {
      title: 'Machigurashi (Lagoon Life)',
      desc: 'A top-down life sim: work, shop and build a home in a procedurally generated town.',
    },
  },
  {
    slug: 'ragdoll-rumble', genre: 'action', players: '1P', date: '2026-06-16',
    ja: {
      title: 'ラグドール・ランブル',
      desc: 'ふらふら揺れるラグドール人形で、押し寄せる敵を勝ち抜く物理アクション。',
    },
    en: {
      title: 'Ragdoll Rumble',
      desc: 'A physics brawler where you fight through waves as a wobbly ragdoll.',
    },
  },
  {
    slug: 'cat-wars', genre: 'rpg', players: '1P', date: '2026-05-12',
    ja: {
      title: 'にゃんこウォーズ',
      desc: 'にゃんこを召喚して敵の城を落とすレーン型タワーディフェンス。',
    },
    en: {
      title: 'Nyanko Wars',
      desc: 'A lane-based tower defense where you summon units to crush the enemy base.',
    },
  },
  {
    slug: 'terraria-like', genre: 'sandbox', players: '1P', date: '2026-05-12',
    ja: {
      title: 'Mini Terraria',
      desc: 'ブロックを掘って集めて積み上げる2Dサンドボックス。',
    },
    en: {
      title: 'Mini Terraria',
      desc: 'A 2D sandbox where you dig, gather, and build blocks.',
    },
  },
  {
    slug: 'mario-coop', genre: 'action', players: '2P', date: '2026-05-12',
    ja: {
      title: 'ふたりでマリオっぽい冒険',
      desc: 'ふたり同時に遊ぶ横スクロールアクション。協力してゴールを目指す。',
    },
    en: {
      title: 'Two-Player Mario-like Adventure',
      desc: 'A 2-player co-op platformer inspired by classic Mario.',
    },
  },
  {
    slug: 'smash-browser', genre: 'fighting', players: '2P', date: '2026-05-05',
    ja: {
      title: 'Mini Smash',
      desc: '1つのキーボードを2人で分けあう2D対戦アクション。相手を場外へ吹っ飛ばす。',
    },
    en: {
      title: 'Mini Smash Bros',
      desc: 'A 2D fighting game for two players on one keyboard.',
    },
  },
];
