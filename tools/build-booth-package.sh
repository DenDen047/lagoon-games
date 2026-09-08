#!/usr/bin/env bash
# BOOTH で売るための配布 ZIP を作る。
#
#   ./tools/build-booth-package.sh war-zone 1.0
#
# 動作確認だけしたいときは --draft を付ける。クレジット未記入でも通るが、
# その ZIP は売り物にしないこと。
#
# 出来上がりは dist/WARZONE_2D_v1.0.zip。
# ZIP は Python の zipfile で作る。macOS の zip コマンドと違い、
# 日本語のファイル名に UTF-8 フラグが必ず立ち、Windows でも文字化けしない。
set -euo pipefail

DRAFT=0
for a in "$@"; do [ "$a" = "--draft" ] && DRAFT=1; done
set -- $(printf '%s\n' "$@" | grep -v '^--draft$' || true)

SLUG="${1:-war-zone}"
VERSION="${2:-1.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/games/$SLUG"
DOCS="$ROOT/tools/booth/$SLUG"
NAME="WARZONE_2D_v$VERSION"
OUT="$ROOT/dist/$NAME"

[ -d "$SRC" ]  || { echo "ゲームが見つかりません: $SRC" >&2; exit 1; }
[ -d "$DOCS" ] || { echo "同梱文書が見つかりません: $DOCS" >&2; exit 1; }

# クレジットが未記入のまま売り物を作らないための歯止め。
if grep -q "を記入》" "$DOCS/クレジット.txt"; then
  echo "!! クレジット.txt に未記入の項目 (《…を記入》) が残っています。" >&2
  echo "   BGM の曲名・作者・配布元・ライセンスを埋めてください。" >&2
  [ "$DRAFT" -eq 1 ] || exit 1
  echo "   --draft 指定のため続行します。この ZIP は販売に使わないでください。" >&2
fi

rm -rf "$OUT"
mkdir -p "$OUT"

# ゲーム本体。docs/ の開発メモは入れない。
cp "$SRC/game.js" "$SRC/style.css" "$OUT/"
cp "$SRC/index.html" "$OUT/ゲームを始める.html"
cp -R "$SRC/audio" "$SRC/vendor" "$OUT/"

# 同梱文書とおまけ。txt は Windows のメモ帳で開かれる前提で、
# BOM 付き UTF-8 + CRLF に直してから入れる。
for f in "$DOCS"/*.txt; do
  python3 -c 'import io,sys; d=io.open(sys.argv[1],encoding="utf-8").read().replace("\r\n","\n").replace("\n","\r\n"); io.open(sys.argv[2],"w",encoding="utf-8-sig",newline="").write(d)' \
    "$f" "$OUT/$(basename "$f")"
done
cp "$SRC/docs/kids-online-communication-guide.html" \
   "$OUT/おまけ_ゲームの通信ってどうなっているの.html"

python3 - "$ROOT/dist" "$NAME" <<'PY'
import os, sys, zipfile
dist, name = sys.argv[1], sys.argv[2]
root = os.path.join(dist, name)
path = os.path.join(dist, name + ".zip")
with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d != "__MACOSX")
        for f in sorted(files):
            if f == ".DS_Store":
                continue
            full = os.path.join(base, f)
            z.write(full, os.path.join(name, os.path.relpath(full, root)))
print(f"{path}  ({os.path.getsize(path) / 1e6:.1f} MB)")
PY
