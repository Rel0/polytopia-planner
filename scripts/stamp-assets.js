#!/usr/bin/env node
// Cache busting for the release build: the server sends JS/CSS with "max-age=1 year", so browsers only fetch a
// new version when the URL changes. Rewrites every `src="…?v=…"` / `href="…?v=…"` in the HTML files of the given
// directory to `?v=<first 10 hex chars of the file's MD5>` – a file gets a new URL exactly when its content changes.
// Usage: node scripts/stamp-assets.js dist
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const root = path.resolve(process.argv[2] || 'dist');
const htmlFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') walk(p); } else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
})(root);

const hashes = new Map();
function hashOf(file) {
  if (!hashes.has(file)) hashes.set(file, crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 10));
  return hashes.get(file);
}

let changed = 0, missing = 0;
for (const html of htmlFiles) {
  const src = fs.readFileSync(html, 'utf8');
  const out = src.replace(/((?:src|href)=")([^"?#]+)\?v=[^"]*"/g, (m, pre, url) => {
    if (/^[a-z]+:\/\//i.test(url)) return m; // external URL
    const file = url.startsWith('/') ? path.join(root, url) : path.join(path.dirname(html), url);
    if (!fs.existsSync(file)) { missing++; console.warn('stamp-assets: missing ' + url + ' (in ' + path.relative(root, html) + ')'); return m; }
    changed++;
    return pre + url + '?v=' + hashOf(file) + '"';
  });
  if (out !== src) fs.writeFileSync(html, out);
}
// JS files may reference other files as '<path>?v=STAMP' (e.g. the Market worker) → same content hash
(function walkJs(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') walkJs(p); continue; }
    if (!e.name.endsWith('.js')) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (src.indexOf('?v=STAMP') < 0) continue;
    const out = src.replace(/(['"])([\w./-]+)\?v=STAMP\1/g, (m, q, url) => {
      const file = path.join(root, url);
      if (!fs.existsSync(file)) { missing++; console.warn('stamp-assets: missing ' + url + ' (in ' + path.relative(root, p) + ')'); return m; }
      changed++;
      return q + url + '?v=' + hashOf(file) + q;
    });
    fs.writeFileSync(p, out);
  }
})(root);
console.log('stamp-assets: ' + changed + ' references in ' + htmlFiles.length + ' HTML files' + (missing ? ', ' + missing + ' missing' : ''));
if (missing) process.exit(1);
