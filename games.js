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
    slug: 'ore-to-armada', genre: 'sandbox', players: '1P', date: '2026-09-22',
    ja: {
      title: 'ORE TO ARMADA ― 鉱石から大艦隊へ',
      desc: '中古の採掘艇から始める宇宙サンドボックス。小惑星を掘って稼ぎ、船をブロックで組み上げ、艦隊を率いて銀河の中心を目指す。パソコン向け。',
    },
    en: {
      title: 'Ore to Armada',
      desc: 'A top-down space sandbox. Mine asteroids, build your ship block by block, hire a crew and lead a fleet toward the galactic core. Keyboard and mouse.',
    },
  },
  {
    slug: 'dead-drive', genre: 'action', players: '1P', date: '2026-09-22',
    ja: {
      title: 'DEAD DRIVE ― 改造車で生きのびろ',
      desc: 'ゾンビの街を自作の改造車で走るローグライク。昼は食料や仲間を集めに出撃し、夜は基地を守りぬいて10日目の救助を待つ。スマホにも対応。',
    },
    en: {
      title: 'Dead Drive',
      desc: 'A top-down zombie roguelike in a car you build part by part. Scavenge and rescue survivors by day, defend your base by night, and last ten nights. Plays on phones.',
    },
  },
  {
    slug: 'cellhouse', genre: 'sandbox', players: '1P', date: '2026-09-22',
    ja: {
      title: 'CELLHOUSE ― 塀の中をつくる',
      desc: '草地に刑務所を建てて運営する経営シミュレーション。房や食堂を作り、囚人の不満を抑えてケンカや脱走や暴動を防ぎながら黒字を保つ。スマホにも対応。',
    },
    en: {
      title: 'Cellhouse',
      desc: 'A top-down prison management sim. Build cells and canteens, keep prisoners\' needs met, and head off fights, escapes and riots while staying in the black. Plays on phones.',
    },
  },
  {
    slug: 'kaiju-clash', genre: 'fighting', players: '1–2P', date: '2026-09-08',
    ja: {
      title: 'KAIJU CLASH ― 街を壊す怪獣たち',
      desc: '街のまんなかで怪獣どうしが殴りあう対戦格闘。8体から選べて、技はボタン1つで出る。ビルは殴っても踏んでも崩れる。スマホにも対応。',
    },
    en: {
      title: 'Kaiju Clash',
      desc: 'A side-view fighting game where eight giant monsters trash a city while trading blows. One-button moves, buildings that crumble, and two players on one keyboard. Plays on phones.',
    },
  },
  {
    slug: 'sunset-shift', genre: 'action', players: '1P', date: '2026-09-08',
    ja: {
      title: 'SUNSET SHIFT ― 定時後のヒーロー',
      desc: '昼は会社で伝票をさばき、定時後は街でヒーローになる見下ろしアクション。能力のちがう3人を使い分け、屋上も使って事件を解決する。',
    },
    en: {
      title: 'Sunset Shift',
      desc: 'A top-down action game about office workers who turn hero after six. Sort invoices by day, then fight crime across the streets and rooftops as one of three heroes.',
    },
  },
  {
    slug: 'beast-cradle', genre: 'rpg', players: '1P', date: '2026-09-08',
    ja: {
      title: 'BEAST CRADLE ― 育ての闘技場',
      desc: 'けものを育てて闘技場で戦わせる育成バトル。稽古のたびに一週が過ぎて皆が歳をとるので、誰を鍛えるかが悩みどころ。スマホにも対応。',
    },
    en: {
      title: 'Beast Cradle',
      desc: 'A monster-raising battler where every training session costs a week and everyone ages. Raise a team, fight turn-based arena bouts and climb the ranks. Plays on phones.',
    },
  },
  {
    slug: 'phantom-duel', genre: 'fighting', players: '1P', date: '2026-09-08',
    ja: {
      title: 'PHANTOM DUEL ― 自分だけの幻影',
      desc: '猫の街で幻影どうしが戦う見下ろしバトル。全6章のストーリーで17匹の挑戦者を倒していく。相棒は10体から選べて、自分で作ることもできる。',
    },
    en: {
      title: 'Phantom Duel',
      desc: 'A top-down duel game in a city of cats, fought through phantom partners. A six-chapter story, ten ready-made phantoms, and a builder for your own.',
    },
  },
  {
    slug: 'moko-god', genre: 'rpg', players: '1P', date: '2026-09-08',
    ja: {
      title: 'MOKO GOD ― 影の城とモコの剣',
      desc: 'CASTAWAY PLANET のモコが剣をとる見下ろしアクションRPG。剣と魔法で魔物を倒し、三つの印をそろえて影の城の主クロモコに挑む。スマホにも対応。',
    },
    en: {
      title: 'Moko God',
      desc: 'A top-down action RPG in which a Moko from Castaway Planet takes up a sword. Fight with blade and magic, collect three seals and storm Kuromoko\'s castle. Plays on phones.',
    },
  },
  {
    slug: 'party-maker', genre: 'party', players: '2–5P', date: '2026-09-01',
    ja: {
      title: 'PARTY MAKER ― みんなでつくる大会',
      desc: '1台の画面を順番に回して遊ぶ2〜5人のパーティーゲーム。おえかきクイズなど6種のミニゲームで、その日の番組表を自分たちで組む。',
    },
    en: {
      title: 'Party Maker',
      desc: 'A pass-the-screen party game for 2–5 players. Build your own running order from six minigames, headlined by draw-and-guess.',
    },
  },
  {
    slug: 'castaway-planet', genre: 'sandbox', players: '1P', date: '2026-09-01',
    ja: {
      title: 'CASTAWAY PLANET ― 墜ちた星の暮らし',
      desc: '宇宙船が墜ちた星で暮らしながら船を直す見下ろしサンドボックス。畑を耕し、鉱石を掘り、乗り込み式のロボットで作業して4つの惑星を渡る。',
    },
    en: {
      title: 'Castaway Planet',
      desc: 'A top-down survival sandbox on the planet you crash-landed on. Farm, mine, pilot a robot you built yourself, and repair the ship to reach four planets.',
    },
  },
  {
    slug: 'walled-wolves', genre: 'puzzle', players: '1P', date: '2026-08-25',
    ja: {
      title: 'WALLED WOLVES ― 壁の中の人狼',
      desc: '閉ざされた中世の街を歩き回る人狼ゲーム。昼は村の仕事をこなし、夜は眠る・隠れる・占う・守る、あるいは狼になって押し入る。',
    },
    en: {
      title: 'Walled Wolves',
      desc: 'A walk-around werewolf game in a sealed medieval town. Do chores by day, then hide, scry, guard or turn into a wolf at night.',
    },
  },
  {
    slug: 'noclip', genre: 'horror', players: '1P', date: '2026-08-25',
    ja: {
      title: 'NOCLIP ― 壁抜けの館',
      desc: 'ツルハシ一本でバックルームズと洋館を掘り進むサバイバルホラー。壁も扉も壊せるが、その音が実体たちを呼び寄せる。',
    },
    en: {
      title: 'NOCLIP',
      desc: 'A top-down survival horror where your pickaxe breaks walls and doors through the backrooms and a manor, and every swing draws the entities closer.',
    },
  },
  {
    slug: 'mech-raiders', genre: 'shooter', players: '1–2P', date: '2026-08-25',
    ja: {
      title: 'MECH RAIDERS ― 鋼鉄機兵',
      desc: 'セクターに降下して敵機を狩る見下ろしロボット戦。母艦で18機から機体を選び、武装を整えて出撃する。',
    },
    en: {
      title: 'Mech Raiders',
      desc: 'A top-down mech shooter. Pick from eighteen frames aboard your carrier, gear up, and hunt enemy machines sector by sector.',
    },
  },
  {
    slug: 'hollow-toys-fp', genre: 'horror', players: '1P', date: '2026-08-18',
    ja: {
      title: 'HOLLOW TOYS 一人称視点 ― 閉店したピザ店の夜',
      desc: 'HOLLOW TOYS を一人称で作り直したサバイバルホラー。閉店したピザ店を懐中電灯ひとつで歩き、動き出したアニマトロニクスから逃げる。',
    },
    en: {
      title: 'Hollow Toys: First Person',
      desc: 'The same pizzeria as Hollow Toys, rebuilt in first person with a raycast renderer — you see only what the flashlight beam reaches.',
    },
  },
  {
    slug: 'parkour-blade', genre: 'action', players: '1P', date: '2026-08-18',
    ja: {
      title: 'PARKOUR BLADE ― 刃の回廊',
      desc: '高さを使う見下ろしパルクール。低い刃は跳び越え、垂れた刃はスライディングでくぐり、谷は壁キックで渡る。全6ステージ。',
    },
    en: {
      title: 'Parkour Blade',
      desc: 'A top-down parkour runner with real height. Jump the low blades, slide under the hanging ones and wall-kick across gaps in six timed stages.',
    },
  },
  {
    slug: 'steel-serpent', genre: 'action', players: '1P', date: '2026-08-18',
    ja: {
      title: 'STEEL SERPENT ― 鋼の蛇',
      desc: '弾をローリングでかわしてラッシュを溜め、ナイフ一本で踏み込む横スクロールのステルスアクション。武器7種、3ステージ、ボス4体。',
    },
    en: {
      title: 'Steel Serpent',
      desc: 'A side-scrolling stealth action game. Roll through a bullet to charge RUSH, then close in with just a knife. Seven weapons, three stages, four bosses.',
    },
  },
  {
    slug: 'forge-and-crown', genre: 'rpg', players: '1P', date: '2026-08-17',
    ja: {
      title: 'FORGE & CROWN ― 鍛冶と王冠',
      desc: '西洋ファンタジーの国づくりRPG。城をタイル単位で設計し、領地を月ごとに運営し、4×4のマスにポリオミノを詰めて鎧を鍛え、自分でも戦場に立つ。',
    },
    en: {
      title: 'Forge & Crown',
      desc: 'A western-fantasy strategy RPG. Design your castle, run your province, forge armour as a block puzzle, and fight on the field yourself.',
    },
  },
  {
    slug: 'hollow-toys', genre: 'horror', players: '1P', date: '2026-08-17',
    ja: {
      title: 'HOLLOW TOYS ― 閉店したピザ店の夜',
      desc: '懐中電灯ひとつで閉店したピザ店に忍び込む2Dサバイバルホラー。7人から選び、動き出したアニマトロニクスから逃げて3フロアを踏破する。',
    },
    en: {
      title: 'Hollow Toys',
      desc: 'A top-down survival horror in a shuttered pizzeria lit only by your flashlight. Seven characters, three floors and a final boss.',
    },
  },
  {
    slug: 'gacha-strikers', genre: 'sports', players: '1P', date: '2026-08-17',
    ja: {
      title: 'GACHA STRIKERS ― ガチャストライカーズ',
      desc: 'ガチャでチームを作るアーケードサッカー。ステージに勝つとチケットがもらえ、属性を持つ36人の選手から引いて編成を組み、12ステージのキャンペーンを進める。',
    },
    en: {
      title: 'Gacha Strikers',
      desc: 'Arcade soccer with a gacha roster — win stages for tickets, pull from 36 players with elemental affinities and cut-in specials, and build your formation across a 12-stage campaign.',
    },
  },
  {
    slug: 'war-zone-pixel', genre: 'shooter', players: '1P / オンライン', players_en: '1P / Online', date: '2026-07-30',
    ja: {
      title: 'WARZONE: CHRONOFRONT ― 時蝕戦線',
      desc: '1947年の時の裂け目を4つの軍が奪い合うドット絵の見下ろしシューター。4職・4ステージ、戦車と永続強化つき。1人でも、ルームコードでオンラインでも遊べる。',
    },
    en: {
      title: 'Warzone: Chronofront',
      desc: 'A pixel-art top-down shooter where four armies fight over a 1947 time fracture — four classes, four stages, tanks and permanent upgrades. Solo or online via a room code.',
    },
  },
  {
    slug: 'mythic-realm', genre: 'rpg', players: '1P / オンライン', players_en: '1P / Online', date: '2026-07-28',
    ja: {
      title: 'MYTHIC REALM 2D ― 神話の魔境',
      desc: '9つの職業から選ぶ剣と魔法の見下ろしアクションRPG。章ごとの戦いか、12の土地が続く広い世界で魔王を目指す。オンラインでも遊べる。',
    },
    en: {
      title: 'Mythic Realm 2D',
      desc: 'A top-down sword-and-sorcery action RPG with nine classes. Play the chapter battles or roam a twelve-land open world to the demon lord. Solo or online.',
    },
  },
  {
    slug: 'war-zone', genre: 'shooter', players: '1P / オンライン', players_en: '1P / Online', date: '2026-06-23',
    ja: {
      title: 'WARZONE 2D ― 戦場',
      desc: '見下ろし型の戦争シューター。基地で装備を整え、徴兵ガチャで仲間を集めて戦場へ。自分でステージも作れて、オンラインでも遊べる。',
    },
    en: {
      title: 'Warzone 2D',
      desc: 'A top-down war shooter. Gear up at a walkable base, recruit characters from a gacha, build your own stages, and fight solo or online.',
    },
  },
  {
    slug: 'street-fighter', genre: 'fighting', players: '1–2P', date: '2026-06-23',
    ja: {
      title: 'ストリート・ファイト',
      desc: 'ボタン1つで必殺技が出る2D対戦格闘。ガード・投げ・必殺ゲージつきで、CPU戦と同じキーボードでの2人対戦を選べる。',
    },
    en: {
      title: 'Street Fight',
      desc: 'A 2D fighter with one-button specials, guards, throws and a super meter — vs CPU (3 difficulties) or 2-player local.',
    },
  },
  {
    slug: 'smash-browser-mobile', genre: 'fighting', players: '1P', date: '2026-06-23',
    ja: {
      title: 'Mini Smash (スマホ版)',
      desc: 'Mini Smash のタッチ操作版。スマホやタブレットでも同じ12キャラから選んで、CPU と1対1で戦える。',
    },
    en: {
      title: 'Mini Smash (Mobile)',
      desc: 'A touch-friendly version of Mini Smash — fight a CPU on a phone or tablet.',
    },
  },
  {
    slug: 'machigurashi', genre: 'sandbox', players: '1P', date: '2026-06-16',
    ja: {
      title: 'まちぐらし ― Lagoon Life',
      desc: '自動生成の町で暮らす見下ろし型の生活シミュレーション。カフェで働き、買い物をして、空き地に家を建てる。',
    },
    en: {
      title: 'Machigurashi (Lagoon Life)',
      desc: 'A top-down life sim where you live, work, shop, and join events through the seasons of a procedurally generated town.',
    },
  },
  {
    slug: 'ragdoll-rumble', genre: 'action', players: '1P', date: '2026-06-16',
    ja: {
      title: 'ラグドール・ランブル',
      desc: 'ふらふら揺れるラグドール人形で、押し寄せる敵をぶっ飛ばす物理アクション。武器を拾いながらウェーブを勝ち抜く。',
    },
    en: {
      title: 'Ragdoll Rumble',
      desc: 'A physics brawler where you fight through waves as a wobbly active-ragdoll fighter.',
    },
  },
  {
    slug: 'cat-wars', genre: 'rpg', players: '1P', date: '2026-05-12',
    ja: {
      title: 'にゃんこウォーズ',
      desc: 'お金を貯めてにゃんこを召喚し、敵陣の城を落とすレーン型タワーディフェンス。10種のユニットをコストと役割で使い分ける。',
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
      desc: 'ブロックを掘って集めて積み上げる2Dサンドボックス。地形は自動生成で、草・土・石・木を採ってワークベンチまで作れる。',
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
      desc: '2人同時プレイの横スクロールアクション。コインとハテナブロックを取りながら、ふたりでゴール旗を目指す。',
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
      desc: '1つのキーボードを2人で分けあって戦う2D対戦アクション。12キャラそれぞれに必殺技があり、相手を場外へ吹っ飛ばした数で勝敗が決まる。',
    },
    en: {
      title: 'Mini Smash Bros',
      desc: 'A 2D fighting game for two players on one keyboard.',
    },
  },
];
