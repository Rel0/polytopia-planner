#!/bin/sh
# Builds a clean copy of the app (only the files the website needs) into ./dist
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist
cp -R index.html privacy.html manifest.webmanifest robots.txt sitemap.xml .htaccess og-image.png css js icons vendor dist/
echo "dist/ ready: $(du -sh dist | cut -f1)"
