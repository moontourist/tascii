#!/bin/sh
# Builds tascii-list.com into site/dist.
# Cloudflare Pages: build command "sh site/build.sh", output directory "site/dist".
# The demo is the real extension panel, with shim.js standing in for chrome.storage.
set -eu
cd "$(dirname "$0")/.."
rm -rf site/dist
cp -R site/public site/dist
cp -R icons site/dist/icons
cp panel.css panel.js prefs.js site/dist/demo/
cp prefs.js site/dist/  # the site follows the demo's theme
sed 's#<script src="panel.js"></script>#<script src="shim.js"></script><script src="panel.js"></script>#' panel.html > site/dist/demo/index.html
grep -q 'src="shim.js"' site/dist/demo/index.html || { echo "build: couldn't add shim.js to the demo page" >&2; exit 1; }
echo "built site/dist"
