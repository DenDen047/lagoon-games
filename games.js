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
      desc: '街のまんなかで怪獣どうしが殴りあう横視点の対戦格闘。使えるのは8体で、背びれから熱線を吐く黒い恐竜ガイオン、首が三つあって空を飛ぶ金色の竜トライガ、瓦礫を投げて殴りあう大猿ゴリガ、鱗粉を撒く蛾リンネ、人間が作った対怪獣ロボのゼロガ、甲羅に籠って回転突進する亀ガメルド、触腕の長いオクトガ、溶岩の巨人ヴォルガがいる。技はすべてボタン1つで出る。弱攻撃・強攻撃・必殺技・ガードに加え、ダメージを与えても受けても溜まる怒りが満ちると超必殺が撃てる。ビルは背景ではなく壊れる物で、殴っても、ふっとばされた体がぶつかっても、歩いて踏んでも倒れる。舞台はネオンの臨海区、夕暮れの大鉄橋、燃えるコンビナート、朝焼けの空港、桜の散る城下町、雷雨の電波塔の6つ。ひとりで挑むアーケードは6連戦で、最後に強化された三首竜が待っている。キーボード1つを分けあえばふたりでも遊べる。スマホにも対応。',
    },
    en: {
      title: 'Kaiju Clash',
      desc: 'A side-view fighting game in which two giant monsters wreck a city while beating on each other. Eight of them: Gaion, a black saurian whose dorsal fins light up before he breathes a heat ray; Triga, a gold three-headed dragon that flies and fires gravity beams from every neck; Goriga, a great ape who throws rubble and hits harder than anyone; Rinne, a moth who hovers and leaves drifting scales that slow you down; Zeroga, the armoured machine humans built to fight monsters, with shoulder missiles and an arm drill; Gameld, a turtle who tucks into his shell and rolls; Octoga, eight long arms that reach further than any fist; and Volga, a lava golem who raises pillars of fire. Every move is a single button ― light, heavy, special and guard ― and a rage gauge that fills whether you deal or take damage unlocks a super. Buildings are not scenery: they fall when you hit them, when a knocked-back body slams into them, and when you simply walk through them. Six stages, a six-fight arcade ladder ending with a burnt-white version of the three-headed dragon, and two-player matches on one keyboard. Plays on phones.',
    },
  },
  {
    slug: 'sunset-shift', genre: 'action', players: '1P', date: '2026-09-08',
    ja: {
      title: 'SUNSET SHIFT ― 定時後のヒーロー',
      desc: '昼はトウワ物流 第三営業部で伝票をさばき、日が落ちたら街に出る見下ろし2Dアクション。9時から18時はベルトで流れてくる伝票を、その日のルールどおりに 承認・差戻し・上長へ 振り分ける。18時に上がったら格子状の街を走り、ひったくりや武装集団や暴走した重機兵のところへ向かう。動かせるのは三人。生まれつき体の中に重核を持つ天羽迅は二段ジャンプで低い屋根に跳び乗り、止まっている車をつかんで投げられる。超常の力がない灰崎玲は、見た機械を頭の中で部品図に開く癖だけを武器に、レールガンやドローンやEMPを設計ラボで自分で選んで作り、推力で屋上まで上がる。研究所から流れた遺伝子を浴びた三雲ナギは能力を選べず、由来の生きものも、移動も、攻撃も、体質も、副作用も、ニューゲームのたびに抽選で決まり、事件を解決するたびに勝手に変異する。建物には高さがあって屋上に立てるので、上から回りこめる。太陽は時刻どおりに動き、影は朝は西へ、正午は足元に短く、夕方は東へ長く伸びる。夜は街灯とヘッドライトが別の影を落とす。治安が0になると街は取り壊され、社内評価が0になるとクビになる。',
    },
    en: {
      title: 'Sunset Shift',
      desc: 'A top-down action game about three office workers who are also the neighbourhood\u2019s only heroes. From 9 to 6 you sort invoices on a conveyor by the day\u2019s rule \u2014 approve, send back, or escalate \u2014 and the moment you clock off you run out into a city laid out on a grid. Three characters. Amou was born with a gravity core in his chest: a double jump that puts him on low rooftops, and the strength to pick up a stopped car and throw it. Haizaki has no powers at all, only the habit of taking any machine apart in his head, so you choose which modules he builds \u2014 railgun, drones, EMP, reactive armour \u2014 and his thrusters carry him to any roof. Mikumo caught a spliced gene and gets no say in anything: her source creature, her movement, her attack, her passive and her side effect are all rolled at new game, and mutate again on their own as she clears incidents. Buildings have height and you can stand on them, so there is always a way around from above. The sun runs on the clock: shadows fall west in the morning, shrink to nothing at noon, and stretch east at dusk, and at night the streetlamps and headlights cast their own.',
    },
  },
  {
    slug: 'beast-cradle', genre: 'rpg', players: '1P', date: '2026-09-08',
    ja: {
      title: 'BEAST CRADLE ― 育ての闘技場',
      desc: '一匹のけものを引きとり、育てて闘技場に上げる育成バトル。牧舎には育てる場所が4つある。餌場では何を食べさせるかで伸びる能力が変わり、疲れとごきげんが戻るかわりに太る。走路はすばやさ、打ち場はちから、技場はわざを伸ばし、打ち場と技場では新しいわざをひらめく。一回の稽古で一週が過ぎ、そのあいだ牧舎の全員が歳をとるので、誰に週をつかうかが悩みどころになる。能力ごとに★1〜5の才能と限界値があり、限界に近づくほど伸びは鈍る。仕上がった子は最大5匹つれて闘技場へ。すばやさ順に一体ずつ動くターン制で、剛・迅・妙の三すくみ、気合が100たまると出せる必殺わざ、毒やしびれ、打ち場の組手で結んだ絆がある。E級から順に相手2組を倒すと3連戦の昇格戦にたどり着き、勝てば次の級へ。老いた子を引退させると形見が残り、次に引きとる子へ才能とわざを継げる。セーブは自動、スマホにも対応。',
    },
    en: {
      title: 'Beast Cradle',
      desc: 'A monster-raising battler where every training session costs a week and every creature in the barn ages while it passes, so the real question is always who gets that week. Four grounds: the feed yard (what you serve decides which stat grows, and it puts weight on), the running track for speed, the striking ground for power, and the technique hall for skill — the last two are also where new moves come to your creature. Each stat has a one-to-five-star talent that sets both how fast it grows and how far it can go. Take up to five raised beasts into the arena and fight turn by turn in speed order, with a three-way type triangle, a spirit gauge that unlocks a finisher at full, poison and paralysis, and the bond built by sparring two of your own together. Clear two stables in a rank to reach its three-fight promotion gauntlet. Retire an ageing champion and its keepsake passes talent and a move to the next one you take in. Saves automatically; plays on phones.',
    },
  },
  {
    slug: 'phantom-duel', genre: 'fighting', players: '1P', date: '2026-09-08',
    ja: {
      title: 'PHANTOM DUEL ― 自分だけの幻影',
      desc: '猫の街を舞台にした、幻影どうしの見下ろし型バトル。路地でくらすキジトラのニャ太郎が、ゴミ捨て場の奥で光る矢に前足を引っかかれ、翌朝うしろに幻影スタープラチニャが立っていた。同じころ街じゅうの猫が幻影に目覚め、縄張り争いは殴り合いに変わっていた。矢の出どころをたどって、路地から屋根、時計塔、そして床も空もない虚空まで17匹の挑戦者を倒していく全6章のものがたり。真上から見た画面に出てくるのは幻影だけで、使い手の猫は物陰から見ている。相棒は10体。拳の重いムートくんは2発殴ると少し溜めが入り、猫のニャワールドは能力を使うと相手も弾もその場で止まる。自分で作ることもでき、かぶりもの・め・かた・まえ足・せなか・しっぽ・もようを選び、パンチ・連打・射撃・自動・束縛・再生・時間・火炎・斬撃の9つの型から戦いかたを決め、破壊力からスピードまで5項目の能力表に点を配る。レベルは拠点のメニューで自分の手で上げ、10まで育てると型ごとの覚醒を覚える。遊びかたは3つ。話を追うストーリーモード、相手も場所も自由に選べるフリー対戦、的とDPS表示のある練習場。闘技場は16か所ある。',
    },
    en: {
      title: 'Phantom Duel',
      desc: 'A story-driven top-down duel game set in a city of cats. Nyataro, a stray tabby living behind the station, catches his paw on a glowing arrowhead in a pile of boxes, and by morning something is standing behind him: Star Platinya. Cats all over the city are waking up to phantoms of their own, and turf wars have turned into fistfights between them. Follow the arrows through six chapters — the alley, the rooftops, the clock tower, and finally a void with no floor and no sky — beating seventeen challengers on the way. Only the phantom is ever on the field; the cat behind it watches from cover. Ten partners are available, including Moot, who throws two heavy punches and then has to wind up again, and Nya-World, whose ability stops the opponent and every bullet where they are. You can also build your own: pick headgear, eyes, shoulders, forepaws, back, tail and markings, choose from nine fighting types, and spend points across five stats. Levels are raised by hand from the base menu, and reaching 10 unlocks that type\'s awakening. Three ways to play: story mode down the ladder of seventeen, free battle against any challenger in any of the sixteen arenas, and a training range with targets and a live DPS readout.',
    },
  },
  {
    slug: 'moko-god', genre: 'rpg', players: '1P', date: '2026-09-08',
    ja: {
      title: 'MOKO GOD ― 影の城とモコの剣',
      desc: 'CASTAWAY PLANET に出てくるモコが剣をとる、見下ろし型のアクションRPG。星のはしに黒い城が建った日から野に魔物がわくようになり、城の主クロモコは自らを神と名のってモコたちの夢に影をおくっている。世界は村を中心にした五つの帯でできていて、草の地から深い森、灼けた砂、凍る峰、灰の地へと外へ出るほど魔物が強くなる。マウスの向きに剣をふり、ファイア・ヒール・サンダー・アイスの矢・まもりの光・聖なる爆発の6つの魔法をレベルで覚え、シフトでころがって攻撃をよける。倒した魔物が落とすお金で鍛冶屋の武器と防具、道具屋のやくそうを買い、宿屋で朝まで眠る。森の主・砂の王・氷の女王を倒して三つの印をそろえると城の門がひらき、四つの型を使い分けるクロモコとの決着になる。地形は毎回ちがい、セーブは自動。スマホとタブレットにも対応。',
    },
    en: {
      title: 'Moko God',
      desc: 'A top-down action RPG in which one of the Moko from Castaway Planet picks up a sword. Since the black castle rose at the edge of the world, monsters have been spawning in the fields, and its master Kuromoko calls himself a god while sending shadows into the Mokos\' dreams. The world is five bands around your home village — grassland, deep forest, burnt sand, frozen peaks, ash — and the further out you walk the stronger the monsters get. You swing where the mouse points, learn six spells as you level (fire, heal, thunder, ice darts, ward, holy nova), and roll with Shift to dodge through attacks. Coins from kills buy weapons and armour at the smith, herbs at the item shop, and a night\'s sleep at the inn. Beat the Forest Lord, the Sand King and the Ice Queen for their three seals, and the castle gate opens onto a four-pattern fight with Kuromoko. The land is generated fresh each run; saves automatically; plays on phones and tablets.',
    },
  },
  {
    slug: 'party-maker', genre: 'party', players: '2–5P', date: '2026-09-01',
    ja: {
      title: 'PARTY MAKER ― みんなでつくる大会',
      desc: '1台の画面を順番に回して遊ぶ、2〜5人のターン制パーティーゲーム。キャラクターを動かす場面はひとつもない。まず誰か1人が「今日はどのミニゲームを何回やるか」という番組表を組み、出題者と得点2倍ラウンドを決めてから始める。ミニゲームは6種。看板はおえかきクイズで、描いた人が正解の言葉を決め、その言葉を打てた人の勝ち。ほかに自作の4択クイズ、3ヒントクイズ、かずあて、れんそう、伝言おえかきがある。秘密を打つ前には必ず「○○さんだけが見る画面です」の一枚がはさまる。',
    },
    en: {
      title: 'Party Maker',
      desc: 'A pass-the-screen party game for 2–5 players in which nobody ever controls a character. One player first builds the running order — which of the six minigames get played, in what order, who hosts each one, and which round is worth double — and everyone then takes turns down that programme. The headline game is draw-and-guess: whoever drew also decides the answer, and the first player to type it wins the round. Alongside it are a build-your-own multiple choice quiz, a three-hint quiz, a hidden-number hunt, a word association round, and a drawing telephone. A for-your-eyes-only card comes up before every secret is typed.',
    },
  },
  {
    slug: 'castaway-planet', genre: 'sandbox', players: '1P', date: '2026-09-01',
    ja: {
      title: 'CASTAWAY PLANET ― 墜ちた星の暮らし',
      desc: '宇宙船が墜ちた星で暮らしながら、船を直して次の星へ渡っていく見下ろし2Dのサンドボックス。畑を耕して種を蒔き、鉱脈を掘り、作業台や製錬炉を好きな場所に建てる。組み立てたロボットは自分で乗り込んで動かすもので、左右の手にドリル・散水・播種・収穫アームを付け替えると3×3をまとめて作業できる。機体の色は4か所とも自由に変えられる。一つ目で口の大きな四足獣ガルパは、餌をあげるとなつき、背に乗って走れる。惑星は4つ、それぞれ植物も鉱石も宇宙人も違う。',
    },
    en: {
      title: 'Castaway Planet',
      desc: 'A top-down survival sandbox about crashing on an alien world and slowly building your way off it — till and sow fields, dig ore veins, and drop workbenches and smelters wherever you like. The robot you build is not a helper that works on its own: you climb in and pilot it, swapping the arms on its left and right hands (drill, sprinkler, seeder, harvester) to work a whole 3×3 at once, and repainting all four of its colours. Feed the one-eyed, big-mouthed quadruped and it will carry you. Four planets, each with its own plants, ores and neighbours.',
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
      desc: 'セクターに降下して敵機を自分で探して潰す見下ろし型のロボット戦。拠点は艦内を歩ける母艦アークライトで、発進口・整備ハンガー・補給廠・研究室・訓練場・自室・指令室をたずねて出撃の支度をする。機体は92HPの俊足機から340HPの重装機まで18機、砲を機体が自分で狙って撃つ四足機もいる。前面と背面の装着武装、随伴ドローン、自分で塗れる外装、撃破した敵から吸い出す能力データでの作成。武器とコアのガチャ、セクター末のボス、セーブスロット3枠、装甲別の的とDPS表示つきの練習場。1人でも、同じキーボードで2人でも遊べる。',
    },
    en: {
      title: 'Mech Raiders',
      desc: 'A top-down mech shooter where you are dropped into a sector and have to hunt the enemy machines down. Between sorties you walk the decks of the carrier Arc-Light, stepping into the launch bay, hangar, supply depot, lab, training range, your own quarters and the command room. Eighteen frames from a 92-HP sprinter to a tread-footed 340-HP titan, including four-legged machines that aim and fire their one gun themselves; bolt-on front and back weapons, an escort drone, skins you can repaint yourself, and ability data drained from the wrecks to build new parts in the lab. A gacha for weapons and cores, a boss at the end of every sector, three save slots, a training range with one target per armour type and a live DPS readout, and solo or two players on one keyboard.',
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
      desc: '見下ろし型の戦争シューター。敵を倒すとレベルが上がり、歩き回れる基地でショップ・アタッチメント工房・防具鍛冶・17人のキャラクターを集める徴兵ガチャを使って次の戦場に備える。1人でも、ルームコードでオンラインでも遊べる。',
    },
    en: {
      title: 'Warzone 2D',
      desc: 'A top-down war shooter where kills level you up and a walkable base outfits you between battles — shop, attachment workbench, armour forge and a recruit gacha spanning seventeen characters. Solo or online via a room code.',
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
