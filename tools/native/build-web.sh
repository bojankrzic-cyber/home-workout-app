#!/bin/sh
# The native apps ship the same files GitHub Pages serves (see .github/workflows/pages.yml) – one codebase.
set -e
cd "$(dirname "$0")/../.."
rm -rf www && mkdir -p www/data
cp -r index.html manifest.webmanifest css js icons img audio lang www/
cp -r data/labels www/data/
rm -f www/sw.js   # no service worker inside the native shell – the app files are bundled
echo "www/ ready ($(du -sh www | cut -f1))"
