# CUBE SAGA の MOD の つくりかた

MOD は、ゲームに あたらしい ブロックや しかけを ふやす プログラム (JavaScript) です。MOD は ワールドごとに オン・オフ できます。

## MOD を いれる

1. タイトルの「MOD (ゲームを ふやす)」→「.js ファイルを えらぶ」で、つくった ファイルを えらぶ。
2. 「ワールドを えらぶ」で ワールドの「MOD」ボタンを おして、チェックを いれる (あたらしい ワールドなら、つくる ときに チェックできる)。
3. ワールドに はいると MOD が うごく。クリエイティブなら もちものの「MOD」タブに でてくる。

**ちゅうい**: MOD は プログラムなので、ブラウザの なかで なんでも できてしまいます。じぶんや せんせいが つくった、しんじられる ファイルだけ いれてください。

## いちばん かんたんな MOD

みぎクリックすると いろが かわる ブロックです。このまま `irokawari.js` という なまえで ほぞんすれば うごきます。

```js
CS.mod({
  id: 'irokawari',                 // えいすうじ。ほかの MOD と かぶらない なまえ
  name: 'いろがわり ブロック',
  desc: 'さわると いろが かわる ブロック',
  version: '1.0',
  setup(api) {
    const COLORS = [[230, 70, 70], [70, 150, 240], [80, 200, 100], [250, 210, 60]];
    // 16×16 の テクスチャを 1まいずつ かく (x, y は 0〜15)
    const tiles = COLORS.map((c, i) => api.tile('iro' + i, (x, y) =>
      (x === 0 || y === 0 || x === 15 || y === 15) ? [40, 40, 40] : c));
    api.block('iro', {
      name: 'いろがわり ブロック',
      tex: tiles[0],               // もちものの アイコンにも つかう
      render: 'model', opaque: true,
      model(m, w, x, y, z) {       // かたち: 0〜16 の はこを ならべる
        const s = api.state(w, x, y, z);
        m.box(0, 0, 0, 16, 16, 16, tiles[s ? s.c : 0]);
      },
      onUse(w, x, y, z) {          // みぎクリック
        const s = api.state(w, x, y, z) || { c: 0 };
        s.c = (s.c + 1) % COLORS.length;
        api.setState(w, x, y, z, s); // じょうたいは セーブされる
        api.redraw(w, x, y, z);
        api.sfx('pop');
        return true;
      },
    });
    api.recipe('iro', 4, [['woolWhite', 1], ['flowerRed', 1]]); // どこでも つくれる
  },
});
```

## api の おもな どうぐ

| どうぐ | すること |
|---|---|
| `api.tile(なまえ, (x, y, rand) => [r, g, b, a?])` | テクスチャを 1まい かく。`null` を かえすと すきま |
| `api.block(なまえ, せってい)` | ブロックを ふやす (下の ひょう) |
| `api.item(なまえ, { name, icon: (x, y) => いろ, stack, sell, onUseBlock })` | アイテムを ふやす |
| `api.recipe(できるもの, かず, [[ざいりょう, かず], …], 'table')` | レシピ。'table' / 'furnace' / なし (どこでも) |
| `api.shop('shop', なまえ, かず, ねだん)` | どうぐやで うる |
| `api.state(w, x, y, z)` / `api.setState(w, x, y, z, s)` | ブロックの じょうたい (むき・オンオフ など)。JSON に できる ものだけ |
| `api.schedule(w, x, y, z, tick)` | あとで その ブロックの `onTick` を よぶ (1びょう = 20 tick) |
| `api.onTick(fn)` / `api.onFrame(fn)` / `api.onDraw(fn)` | まい tick / まいフレーム / うごく ぶひんを かく |
| `api.facing(player, うえした も?)` | プレイヤーが みている むき (0〜5) |
| `api.help(html)` | 「あそびかた」に せつめいを たす |

なまえは じぶんの MOD の なかで さがして、なければ もとの ゲームの なまえ (`ironIngot`, `planks` など) を つかいます。

## ブロックの せってい

- `name`, `tex` (タイル / `{ top, side, bottom }`), `hard` (かたさ), `tool` ('pick' など), `solid`, `opaque`, `light` (0〜15), `drop`
- `render`: `'cube'` (ふつう) / `'model'` (`model(m, w, x, y, z)` で はこを ならべる。`m.box(x0, y0, z0, x1, y1, z1, tex, { tf, glow })`) / `'custom'` (`onDraw` で じぶんで かく)
- よばれる とき: `onPlace` (おいた), `onUse` (みぎクリック), `onBreak` (こわした), `onAdd` / `onRemove` (あらわれた・きえた), `onNeighbor` (となりが かわった), `onTick` (`api.schedule` の あと)

## ばんごうと セーブ

MOD の ブロックは 128〜255 番、アイテムは 1024 番から つかいます。ばんごうは ワールドの セーブに `MODの名前:ブロックの名前` で きろくされるので、よみなおしても かわりません。MOD を オフに すると、その ブロックは こわせない「？」ブロックに なり、データは のこります。オンに もどすと もとどおりです。

ゲームに はじめから ついてくる MOD は `mods/<id>.js` に おいて、`mods/list.js` に なまえを たします。`mods/machines.js` (きかい MOD) が おおきな れいです。
