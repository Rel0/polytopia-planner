#!/bin/sh
# Builds a clean copy of the app (only the files the website needs) into ./dist
set -e
cd "$(dirname "$0")"
node scripts/build-pages.js
rm -rf dist && mkdir -p dist
cp -R index.html privacy.html manifest.webmanifest robots.txt sitemap.xml .htaccess og-image.png css js icons vendor \
  damage-calculator tech-tree market-planner units dist/
# cache busting: ?v=<content hash> on every JS/CSS reference (the server caches them for a year)
node scripts/stamp-assets.js dist
echo "dist/ ready: $(du -sh dist | cut -f1)"
