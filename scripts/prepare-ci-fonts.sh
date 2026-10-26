#!/usr/bin/env bash
# CI-only CJK font for readable screenshots. The playable build uses system fonts.
set -euo pipefail

font_dir="${XDG_DATA_HOME:-$HOME/.local/share}/fonts/flight-chess-ci"
font_file="$font_dir/NotoSansCJKtc-Regular.otf"
font_source="https://raw.githubusercontent.com/notofonts/noto-cjk/523d033d6cb47f4a80c58a35753646f5c3608a78"
font_sha="dce08bd4fd91aa8aa76ed8fea4b694c2dfb8550f67871e326843212ddbeb88b4"
mkdir -p "$font_dir"
curl --fail --silent --show-error --location --retry 2 --max-time 60 \
  "$font_source/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf" --output "$font_file"
printf '%s  %s\n' "$font_sha" "$font_file" | sha256sum --check --status
curl --fail --silent --show-error --location --retry 2 --max-time 60 \
  "$font_source/LICENSE" --output "$font_dir/LICENSE"
fc-cache --force "$font_dir"
matched_font="$(fc-match -f '%{file}' 'Noto Sans CJK TC:lang=zh-tw')"
if [[ "$matched_font" != "$font_file" ]]; then
  printf 'Expected CI CJK font %s, got %s\n' "$font_file" "$matched_font" >&2
  exit 1
fi
fc-match -f 'CI CJK font: %{family} (%{file})\n' 'Noto Sans CJK TC:lang=zh-tw'
