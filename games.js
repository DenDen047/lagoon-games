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
];

const GAMES = [
  {
    slug: 'moko-god', genre: 'sandbox', players: '1P', date: '2026-09-01',
    ja: {
      title: 'MOKO GOD ― 雲の上の神さま',
      desc: 'CASTAWAY PLANET に出てくるモコたちの神さまになって、ひとつの星の一生を見まもる箱庭ゲーム。始まりはモコの親が子どもに読み聞かせる絵本で、古い本の挿し絵のなかで「まっしろで天使の輪をつけたモコ」が語られる。目がさめると、あなたはその神さま。星に名前をつけ、雲の上の島を歩き、天窓から地上をのぞき、祭壇で奇跡をえらぶ。海に土をもりあげ、森を生やし、ぴょんたやくも羊を生み、街をひらいて、はじまりの時代から星の時代までモコの暮らしが移り変わっていくのを眺める。降りの門から地上へ降りれば、自分の足でモコたちのあいだを歩いて話しかけられる。雲のはしには黒い城があり、信仰がたまると橋がかかって、こわい夢をくばるクロモコと向かいあうことになる。セーブは自動、スマホとタブレットにも対応。',
    },
    en: {
      title: 'Moko God',
      desc: 'A god game about the Moko from Castaway Planet, in which you are the white, haloed one they tell stories about. It opens as a bedtime picture book — a Moko parent reading to two children, the plates drawn like woodcuts in an old volume — and when the book closes you wake up on the clouds as the god in it. Name the planet, walk the cloud islands, watch the world through the sky window, and spend faith at the altar: raise land out of the sea, grow forests, put animals on the ground, found towns, send rain and sun, or throw down lightning if you would rather be feared. Towns grow through six ages, from grass nests to lit spires, and you can take the descent gate down and walk among the Mokos yourself. At the far edge of the clouds a black castle waits for the day your faith is strong enough to bridge it. Saves automatically; plays on phones and tablets.',
    },
  },
  {
    slug: 'walled-wolves', genre: 'puzzle', players: '1P', date: '2026-08-25',
    ja: {
      title: 'WALLED WOLVES ― 壁の中の人狼',
      desc: '閉ざされた中世の街を歩き回る人狼ゲーム。カードを引いて役職を決め、昼は村の仕事をこなし、夜は家に帰って眠る・隠れる・占う・守る、あるいは狼になって押し入る。住人は5〜16人で、それぞれ描き分けられている。',
    },
    en: {
      title: 'Walled Wolves',
      desc: 'A walk-around social deduction game in a sealed medieval town — draw a card for your role, do the village chores by day, then go home at night to sleep, hide, scry, guard, or turn into a wolf and break in. 5–16 residents, each drawn differently.',
    },
  },
  {
    slug: 'noclip', genre: 'horror', players: '1P', date: '2026-08-25',
    ja: {
      title: 'NOCLIP ― 壁抜けの館',
      desc: 'ツルハシ一本でバックルームズと洋館を掘り進む見下ろし型サバイバルホラー。ひび割れた壁も宝箱もロック扉も壊せるが、その音が実体たちを呼ぶ。6ステージ、7種のスキンと専用ツルハシ、口笛で敵を釣れるエモート機能つき。',
    },
    en: {
      title: 'NOCLIP',
      desc: 'A top-down survival horror where a pickaxe is the only way forward — break cracked walls, chests and locked doors across the backrooms and a fog-bound manor, but every swing tells the entities where you are. Six stages, seven skins that each carry their own pickaxe, and a whistle emote that lures monsters down the wrong corridor.',
    },
  },
  {
    slug: 'mech-raiders', genre: 'shooter', players: '1–2P', date: '2026-08-25',
    ja: {
      title: 'MECH RAIDERS ― 鋼鉄機兵',
      desc: 'セクターに降下して敵機を自分で探して潰す見下ろし型のロボット戦。92HPの俊足機から340HPの重装機まで10機、それぞれに必殺技がある。武器とコアのガチャ、セクター末のボス、セーブスロット3枠、装甲別の的とDPS表示つきの練習場。1人でも、同じキーボードで2人でも遊べる。',
    },
    en: {
      title: 'Mech Raiders',
      desc: 'A top-down mech shooter where you are dropped into a sector and have to hunt the enemy machines down — ten frames from a 92-HP sprinter to a tread-footed 340-HP titan, each with its own ultimate, plus a gacha for weapons and cores and a boss at the end of every sector. Three save slots, a training range with one target per armour type and a live DPS readout, and solo or two players on one keyboard.',
    },
  },
  {
    slug: 'hollow-toys-fp', genre: 'horror', players: '1P', date: '2026-08-18',
    ja: {
      title: 'HOLLOW TOYS 一人称視点 ― 閉店したピザ店の夜',
      desc: '懐中電灯ひとつで閉店したファミリーピザ店に忍び込む一人称サバイバルホラー。レイキャストで描かれた店内を自分の目で歩き、光の届く範囲だけを頼りに進む。正気度とバッテリーを管理しながら、動き出したアニマトロニクスから逃げ、7人のキャラクターで3フロアと最終ボスを踏破する。',
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
      desc: '高さが本当の軸になっている見下ろし型のパルクールアクション。低い刃は跳び越え、垂れた刃はスライディングでくぐり、床の抜けた谷は壁キックで渡る。タイム計測つきの6ステージに、隠しボルトとタイムランクがある。',
    },
    en: {
      title: 'Parkour Blade',
      desc: 'A top-down parkour runner where height is a real axis — jump the low blades, slide under the hanging ones, and wall-kick across floorless gaps. Six timed stages with hidden bolts and time ranks.',
    },
  },
  {
    slug: 'steel-serpent', genre: 'action', players: '1P', date: '2026-08-18',
    ja: {
      title: 'STEEL SERPENT ― 鋼の蛇',
      desc: '「弾をローリングでかわした瞬間にラッシュが溜まり、ナイフ一本で踏み込む」という一手に絞った横スクロールのステルスアクション。武器7種、3ステージ、ボス4体。',
    },
    en: {
      title: 'Steel Serpent',
      desc: 'A side-scrolling stealth action game built on one exchange — roll through a bullet for a perfect dodge, then spend the RUSH stock to close in with the dagger alone. Seven weapons, three stages, four bosses.',
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
      desc: 'A western-fantasy grand strategy RPG: lay out your castle tile by tile, run the province month by month, forge armour by fitting polyomino pieces into a 4×4 grid, then take the field yourself in real-time combat.',
    },
  },
  {
    slug: 'hollow-toys', genre: 'horror', players: '1P', date: '2026-08-17',
    ja: {
      title: 'HOLLOW TOYS ― 閉店したピザ店の夜',
      desc: '懐中電灯ひとつで閉店したファミリーピザ店に忍び込む2Dサバイバルホラー。壁で遮られる光、正気度、バッテリー管理。動き出したアニマトロニクスから逃げ、7人のキャラクターから選んで3フロアを踏破する。',
    },
    en: {
      title: 'Hollow Toys',
      desc: 'A top-down survival horror in a shuttered pizzeria, lit only by a raycast flashlight the walls cut off. Seven characters across three chapters and a final boss — two of them wear animatronic suits and scare enemies away instead of fighting.',
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
      desc: '9つの職業から選ぶ見下ろし型の剣と魔法のアクションRPG。章ごとの戦いを順に攻略してもいいし、12の土地がひと続きになった世界を歩き回って、魔王の玉座を開く2つの紋章を探してもいい。CPU仲間と1人でも、ルームコードでオンラインでも遊べる。',
    },
    en: {
      title: 'Mythic Realm 2D',
      desc: 'A top-down sword-and-sorcery action RPG with nine classes: clear the chapter battles, or roam a twelve-land open world for the two emblems that unseal the demon lord’s throne. Solo with CPU allies or online via a room code.',
    },
  },
  {
    slug: 'war-zone', genre: 'shooter', players: '1P / オンライン', players_en: '1P / Online', date: '2026-06-23',
    ja: {
      title: 'WARZONE 2D ― 戦場',
      desc: '見下ろし型の戦争シューター。敵を倒すとレベルが上がり、歩き回れる基地でショップ・アタッチメント工房・防具鍛冶・13人の兵士ガチャを使って次の戦場に備える。1人でも、ルームコードでオンラインでも遊べる。',
    },
    en: {
      title: 'Warzone 2D',
      desc: 'A top-down war shooter where kills level you up and a walkable base outfits you between battles — shop, attachment workbench, armour forge and a thirteen-soldier recruit gacha. Solo or online via a room code.',
    },
  },
  {
    slug: 'street-fighter', genre: 'fighting', players: '1–2P', date: '2026-06-23',
    ja: {
      title: 'ストリート・ファイト',
      desc: 'ボタン1つで波動拳や昇龍拳が出せる2D対戦格闘。コマンド入力はいらない。ガード・投げ・必殺ゲージつきで、CPU戦（難易度3段階）と同じキーボードでの2人対戦を選べる。',
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
      desc: '自動生成された町で暮らす見下ろし型の生活シミュレーション。カフェで働き、コンビニで買い物し、空き地に家を建て、12日ごとのイベントに顔を出す。町の外はどこまでも歩ける。',
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
      desc: 'ふらふら揺れるラグドール人形を操って、次々と押し寄せる敵をぶっ飛ばす物理アクション。落ちている武器を拾って持ち替えながらウェーブを勝ち抜き、一定間隔でボスが現れる。',
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
