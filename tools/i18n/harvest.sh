#!/bin/sh
# Full string harvest: every UI suite runs once in English with the collect hook (copies with the locale
# forced to en-GB), plus the static scan. New keys are appended to tools/i18n/source.json and written to
# tools/i18n/new-keys.json for translation.   sh tools/i18n/harvest.sh
set -e
cd "$(dirname "$0")/../.."
OUT=$(mktemp -d); export I18N_OUT=$OUT/runtime.txt; : > $I18N_OUT
for t in tools/*.cjs; do
  b=$(basename $t .cjs); c=tools/_en_$b.cjs
  sed -e "s/locale: '[a-z][a-z]-[A-Z][A-Z]'/locale: 'en-GB'/g" -e "s/?lang=[a-z][a-z]/?lang=en/g" -e "s/fs\.lang', '[a-z][a-z]'/fs.lang', 'en'/g" $t > $c
  NODE_PATH=$(npm root -g) timeout 300 node -r ./tools/i18n/collect-hook.cjs $c $OUT >/dev/null 2>&1 || true
  rm -f $c
done
NODE_PATH=$(npm root -g) node tools/i18n/static.cjs > $OUT/static.txt
python3 tools/i18n/delta.py $OUT/runtime.txt $OUT/static.txt
