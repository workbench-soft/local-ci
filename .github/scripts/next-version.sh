#!/bin/sh
# Prints the next release version: the date in Sydney, then the number of the release on that day.
#   no tag today            -> 2026.10.25.1
#   v2026.10.25.2 exists    -> 2026.10.25.3
set -eu

day=$(TZ=Australia/Sydney date +%Y.%m.%d)
git tag --list "v$day.*" | awk -F. -v day="$day" '
  { if ($4 + 0 > last) last = $4 + 0 }
  END { print day "." last + 1 }'
