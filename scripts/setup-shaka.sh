#!/usr/bin/env bash
#
# Builds Amazon's Vega port of Shaka Player into src/vendor/ (not committed).
#
# Vega's W3C Media API plays adaptive streams through a JavaScript player such
# as Shaka, patched by Amazon to run outside a browser. Amazon distributes the
# patches and a few polyfills in its Vega Video Sample App; this script takes
# them from a pinned commit of that repo instead of copying them here, applies
# them to the official Shaka Player release and keeps only what the app needs.
#
# Needs git, curl, Python 3 and Java (Shaka's build uses Closure Compiler).
# Runs on `npm install`; pass --force to rebuild.

set -euo pipefail
cd "$(dirname "$0")/.."

SHAKA_VERSION=4.8.5
PORT=shaka-rel-v4.8.5-r1.2.tar.gz
PORT_SHA256=f5e475b8a3793e56b2f888936f05424f672658abeac6c55e3d0e7073e06a8b8e
SAMPLE_COMMIT=ef8e4da89b22ef7973d0d41beedfa2b42f7bb272
PORT_URL="https://raw.githubusercontent.com/AmazonAppDev/vega-video-sample/$SAMPLE_COMMIT/shaka-setup/$PORT"

OUT=src/vendor
STAMP="$OUT/.built-$SHAKA_VERSION-r1.2"
WORK=.shaka-build

if [[ -f "$STAMP" && "${1:-}" != "--force" ]]; then
  exit 0
fi

echo "Building Shaka Player $SHAKA_VERSION for Vega (first install only)…"
rm -rf "$WORK"
mkdir -p "$WORK"

curl -fsSL -o "$WORK/$PORT" "$PORT_URL"
echo "$PORT_SHA256  $WORK/$PORT" | shasum -a 256 -c - >/dev/null
tar -xzf "$WORK/$PORT" -C "$WORK"

git clone -q --depth 1 --branch "v$SHAKA_VERSION" \
  https://github.com/shaka-project/shaka-player.git "$WORK/shaka-player"
(
  cd "$WORK/shaka-player"
  git -c user.name=build -c user.email=build@localhost \
    am -q -3 ../shaka-rel/shaka-patch/*.patch
  # The UI build imports Google Fonts; the app doesn't use Shaka's UI
  sed -i.bak -e '/fonts\.googleapis\.com/d' ui/controls.less
  python3 build/all.py
)

rm -rf "$OUT"
mkdir -p "$OUT/polyfills" "$OUT/shaka"
cp "$WORK"/shaka-rel/src/polyfills/*.ts "$OUT/polyfills/"
cp "$WORK/shaka-player/dist/shaka-player.compiled.js" "$OUT/shaka/"
# The compiled build has no types; the app declares the parts it uses
printf '// eslint-disable-next-line @typescript-eslint/no-explicit-any\ndeclare const shaka: any;\nexport default shaka;\n' \
  >"$OUT/shaka/shaka-player.compiled.d.ts"
for f in "$OUT"/polyfills/*.ts; do
  printf '// @ts-nocheck\n' | cat - "$f" >"$f.tmp" && mv "$f.tmp" "$f"
done
node --check "$OUT/shaka/shaka-player.compiled.js"

rm -rf "$WORK"
touch "$STAMP"
echo "Shaka Player ready in $OUT/"
