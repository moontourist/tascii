#!/bin/sh
# Builds the zip to upload to the Chrome Web Store, with only the files the extension needs.
# Runs the tests first and stops if any fail. Usage: ./pack.sh
set -e
cd "$(dirname "$0")"
node tests/run.mjs > /dev/null || { node tests/run.mjs | grep FAIL; exit 1; }
version=$(node -p "require('./manifest.json').version")
out="tascii-v$version.zip"
rm -f "$out"
zip -q -X "$out" manifest.json background.js panel.html panel.css panel.js prefs.js \
  icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png
echo "$out"
