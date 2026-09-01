# Lagoon Games

ブラウザだけで遊べる自作ゲーム集です。インストールも会員登録もいりません。

**▶ [一覧ページを開く](https://denden047.github.io/lagoon-games/)**

すべて素の HTML + Canvas + JavaScript で書かれていて、ビルド工程も外部ライブラリもありません。セーブデータは各端末のブラウザ (localStorage) にだけ残り、サーバーには送られません。

## ローカルで動かす

`file://` から開くとブラウザのセキュリティ制限に引っかかるので、簡易サーバーを立てて開きます。

```bash
python3 -m http.server 8801
open http://127.0.0.1:8801/
```

## ゲームを1本足す

1. `games/<slug>/` にゲームを置く（入口は `index.html`）。
2. `games.js` の `GAMES` に1件足す。日本語と英語のタイトル・紹介文、ジャンル、プレイ人数、公開日を書く。
3. `./tools/capture-thumbs.sh <slug>` でサムネイルを作る。`assets/thumbs/<slug>.jpg` に出る。
4. 出来た画像を目で見て確認する。タイトル画面ではなく設定フォームが写ることがある。

一覧ページはこの `games.js` だけを読んで組み立てるので、他に直す場所はありません。

## 公開

`master` ブランチのルートを GitHub Pages がそのまま配信します。push すれば数分で反映されます。
