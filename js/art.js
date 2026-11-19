// Polytopia Planner – ART (Lagoon Glass look): own low-poly illustrations, drawn here as SVG (no game assets).
// Tiles: a small isometric tile with what is on it (terrain, resource, building). Units: a bust with its gear, drawn
// in neutral colours so it reads on the blue (own) or coral (enemy) token.
// PP.art.svg(name, px) → inline SVG string or '' · PP.art.has(name) · PP.art.img(name) → Image (for canvas, null until loaded)
window.PP = window.PP || {};
(function (PP) {
  'use strict';
  // polygon from a flat list of numbers
  function pg(list, f, extra) { var s = ''; for (var i = 0; i < list.length; i += 2) s += (i ? ' L' : 'M') + list[i] + ' ' + list[i + 1]; return '<path d="' + s + 'Z" fill="' + f + '"' + (extra || '') + '/>'; }
  function el(cx, cy, rx, ry, f, extra) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function ci(cx, cy, r, f, extra) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function ln(d, c, w) { return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + (w || 1.5) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }

  // ---------------------------------------------------------------- the tile (isometric, with a little thickness)
  // top: [light half, dark half], sides: [left, right]
  var TOP = { grass: ['#9be26a', '#82cf55', '#62ad3c', '#4f9531'], dirt: ['#e0b878', '#cfa261', '#a97c42', '#8e6533'], water: ['#6fd3f5', '#4cc0ec', '#2f98c8', '#2582b0'],
    rock: ['#c3ccd4', '#aab5bf', '#87939e', '#74808b'], snow: ['#f2f7fb', '#dde8f1', '#b9c8d6', '#a4b5c5'], dark: ['#2a3550', '#1f2840', '#161d30', '#10162a'],
    sand: ['#f6df9a', '#ecd07f', '#cfae5c', '#b8964a'] };
  function tile(kind) {
    var c = TOP[kind] || TOP.grass;
    return pg([6, 40, 32, 27, 32, 53], c[0]) + pg([32, 27, 58, 40, 32, 53], c[1]) +
      pg([6, 40, 32, 53, 32, 59, 6, 46], c[2]) + pg([32, 53, 58, 40, 58, 46, 32, 59], c[3]);
  }
  // low-poly conifer at (x, y = foot), height h
  function tree(x, y, h, s) {
    s = s || 1; var w = 7 * s;
    return pg([x - 1, y, x + 1, y, x + 1, y - 3 * s, x - 1, y - 3 * s], '#7a4a26') +
      pg([x - w, y - 3 * s, x, y - h, x, y - 3 * s], '#3fb35e') + pg([x, y - h, x + w, y - 3 * s, x, y - 3 * s], '#2a8b45') +
      pg([x - w * 0.75, y - h * 0.45, x, y - h * 1.05, x, y - h * 0.45], '#52c56f') + pg([x, y - h * 1.05, x + w * 0.75, y - h * 0.45, x, y - h * 0.45], '#339d50');
  }
  function peak(x, y, w, h, snow) {
    var s = pg([x - w, y, x, y - h, x + w * 0.15, y], '#b6c1cb') + pg([x, y - h, x + w, y, x + w * 0.15, y], '#8692a0');
    if (snow) s += pg([x - w * 0.32, y - h * 0.68, x, y - h, x + w * 0.05, y - h * 0.6, x - w * 0.12, y - h * 0.72], '#ffffff') + pg([x, y - h, x + w * 0.32, y - h * 0.68, x + w * 0.05, y - h * 0.6], '#e3ebf2');
    return s;
  }
  // a small house: front face, side face, roof
  function house(x, y, w, h, wall, wall2, roof, roof2) {
    var d = w * 0.55;
    return pg([x - w, y, x, y + d * 0.5, x, y + d * 0.5 - h, x - w, y - h], wall) + pg([x, y + d * 0.5, x + d, y, x + d, y - h, x, y + d * 0.5 - h], wall2) +
      pg([x - w - 1.5, y - h, x - w * 0.35, y - h - w * 0.75, x + d * 0.4, y - h - d * 0.5, x, y + d * 0.5 - h], roof) +
      pg([x - w * 0.35, y - h - w * 0.75, x + d + 1.5, y - h, x, y + d * 0.5 - h, x + d * 0.4, y - h - d * 0.5], roof2);
  }

  var A = {};
  // ---------------- terrain & resources
  A.field = tile('grass') + ci(22, 41, 1.2, '#b8ef8e') + ci(40, 44, 1, '#b8ef8e') + ci(33, 35, 1, '#6cc046');
  A.forest = tile('grass') + tree(20, 44, 20) + tree(42, 42, 22) + tree(31, 49, 17, 0.9);
  A.mountain = tile('grass') + peak(30, 46, 20, 34, true) + peak(44, 47, 11, 18, false);
  A.water = tile('water') + ln('M14 40q4 -3 8 0t8 0', '#c8f1ff', 1.6) + ln('M30 46q4 -3 8 0t8 0', '#c8f1ff', 1.6) + ln('M32 34q3 -2 6 0', '#a9e8ff', 1.4);
  A.crop = tile('grass') + [[18, 44], [26, 48], [24, 38], [32, 42], [40, 46], [32, 35], [40, 39], [46, 43]].map(function (p) {
    return ln('M' + p[0] + ' ' + p[1] + 'v-8', '#c99a2e', 1.3) + el(p[0] - 1.3, p[1] - 7, 1.4, 2.4, '#f4c94e') + el(p[0] + 1.3, p[1] - 8, 1.4, 2.4, '#e9b636');
  }).join('');
  A.fruit = tile('grass') + pg([20, 44, 24, 30, 32, 26, 42, 30, 46, 44, 33, 48], '#3a9b4e') + pg([20, 44, 24, 30, 32, 26, 31, 46], '#4bb560') +
    [[26, 36], [33, 32], [38, 38], [29, 42], [40, 31], [35, 43], [24, 30]].map(function (p) { return ci(p[0], p[1], 2.4, '#b23ad6') + ci(p[0] - 0.7, p[1] - 0.8, 0.8, '#e3a3f5'); }).join('');
  A.ore = A.metal = tile('grass') + peak(30, 46, 20, 30, false) + pg([24, 40, 27, 33, 31, 37, 29, 43], '#7fe3f5') + pg([27, 33, 31, 37, 33, 34], '#c5f6ff') +
    pg([34, 42, 37, 36, 40, 40, 38, 44], '#5ccde8') + pg([37, 36, 40, 40, 41, 37], '#b0efff');
  // cloud: an unexplored tile (grey-blue) with a fluffy low-poly cloud floating above it
  A.cloud = tile('rock') + el(32, 44, 16, 5, 'rgba(40,60,80,.25)') + el(22, 30, 9, 7, '#e9f0f6') + el(42, 30, 10, 7, '#dfe8f0') + el(32, 25, 11, 10, '#ffffff') + el(26, 31, 13, 6, '#f6f9fc') + el(39, 32, 11, 5, '#e3ebf2');
  A.space = tile('dark') + ci(20, 40, 1, '#fff') + ci(36, 34, 1.3, '#fff') + ci(44, 42, 0.9, '#cfe') + ci(30, 46, 0.8, '#fff') + pg([38, 39, 39, 41, 41, 42, 39, 43, 38, 45, 37, 43, 35, 42, 37, 41], '#ffe27a');
  A.monument = tile('grass') + pg([27, 46, 37, 46, 34, 14, 30, 14], '#f2c14e') + pg([32, 46, 37, 46, 34, 14, 32, 14], '#d9a32c') + pg([30, 14, 34, 14, 32, 9], '#ffe08a') + pg([24, 48, 40, 48, 38, 45, 26, 45], '#b9a07a');
  A.enemy = tile('grass') + ln('M28 48V16', '#5b3a22', 2.2) + pg([29, 17, 47, 21, 29, 29], '#ef4f5f') + pg([29, 17, 47, 21, 38, 22], '#ff7a86');
  A.unit = tile('grass') + el(32, 45, 9, 4, 'rgba(0,0,0,.18)') + pg([25, 45, 27, 32, 37, 32, 39, 45], '#3b6fe0') + pg([32, 32, 37, 32, 39, 45, 32, 45], '#2b58bd') + ci(32, 26, 6.5, '#f2c9a0') + pg([25.5, 25, 32, 17, 38.5, 25, 32, 23], '#c9d2db');
  A.city = tile('grass') + house(22, 44, 8, 9, '#f4ead8', '#d9c9ae', '#e2574c', '#b8423a') + house(38, 40, 9, 12, '#fff6e6', '#e2d2b6', '#ef6a56', '#c44b3f') + house(31, 50, 6, 6, '#f4ead8', '#d9c9ae', '#e2574c', '#b8423a');
  A.port = A.water + house(32, 40, 7, 7, '#f4ead8', '#d9c9ae', '#3a7bd5', '#2c5fae');
  // ---------------- buildings
  A.lumber = tile('grass') + tree(46, 40, 16, 0.75) + house(28, 44, 10, 10, '#b77a41', '#8f5a2c', '#7a4524', '#5c321a') +
    pg([22, 44, 24, 44, 24, 36, 22, 36], '#5c321a') + [[38, 50], [43, 50], [40.5, 46.5]].map(function (p) { return ci(p[0], p[1], 2.6, '#c98d52') + ci(p[0], p[1], 1.2, '#e8be86'); }).join('');
  A.sawmill = tile('grass') + house(26, 46, 10, 10, '#b77a41', '#8f5a2c', '#7a4524', '#5c321a') +
    ci(43, 34, 9, '#cfd8e0') + ci(43, 34, 9, 'none', ' stroke="#8f9aa6" stroke-width="2.4" stroke-dasharray="2 1.6"') + ci(43, 34, 3, '#7c8792') + pg([41, 34, 45, 34, 45, 48, 41, 48], '#6b4a2b');
  // farm: tilled rows along the tile edge (stripes between the upper-left and the lower-right edge), a few sprouts
  A.farm = tile('dirt') + [0, 1, 2, 3, 4].map(function (i) {
    var t0 = i / 5, t1 = (i + 1) / 5, P = function (t) { return [6 + 26 * t, 40 - 13 * t]; }, Q = function (t) { return [32 + 26 * t, 53 - 13 * t]; };
    return pg(P(t0).concat(P(t1), Q(t1), Q(t0)), i % 2 ? '#c98f45' : '#e9c25a');
  }).join('') + [[16, 38], [23, 42], [30, 45], [24, 34], [31, 38], [38, 41], [33, 31], [40, 35]].map(function (p) { return ln('M' + p[0] + ' ' + p[1] + 'v-4', '#4f9531', 1.3) + el(p[0] - 1, p[1] - 4, 1.4, 1, '#6cc046'); }).join('');
  // windmill: tower + red cap, four short sails (cross, slightly turned)
  function sail(ang) { return '<g transform="rotate(' + ang + ' 32 21)">' + pg([31.2, 21, 32.8, 21, 32.8, 6, 31.2, 6], '#7a4a26') + pg([33, 7, 38, 7, 38, 18, 33, 18], '#fff8ea') + pg([35.5, 7, 38, 7, 38, 18, 35.5, 18], '#ecdcbc') + '</g>'; }
  A.windmill = tile('grass') + pg([24, 49, 40, 49, 37, 22, 27, 22], '#f4efe6') + pg([32, 49, 40, 49, 37, 22, 32, 22], '#d9d0c1') + pg([25, 23, 39, 23, 32, 13], '#e2574c') + pg([32, 13, 39, 23, 32, 23], '#b8423a') +
    pg([29, 49, 35, 49, 35, 42, 29, 42], '#7a4a26') + ci(32, 33, 1.8, '#9fd7f0') + sail(15) + sail(105) + sail(195) + sail(285) + ci(32, 21, 2.2, '#5c321a');
  A.mine = tile('grass') + pg([10, 46, 22, 24, 36, 18, 50, 30, 56, 44, 32, 52], '#a9b4be') + pg([10, 46, 22, 24, 36, 18, 33, 52], '#bfc8d0') + pg([36, 18, 50, 30, 56, 44, 33, 52], '#8b97a3') +
    '<path d="M24 50V40a8 8 0 0 1 16 0v10Z" fill="#2b2f36"/>' + ln('M22 50V39q10-9 20 0v11', '#8a5a2e', 2.6) + ln('M21 39h22', '#a66c38', 2.4) +
    pg([40, 34, 43, 30, 46, 33, 43, 37], '#7fe3f5');
  A.forge = tile('grass') + house(30, 46, 12, 12, '#9aa4ae', '#76818c', '#5d6670', '#47505a') + pg([36, 30, 42, 30, 42, 12, 36, 12], '#76818c') + pg([36, 12, 42, 12, 42, 30, 39, 30], '#5d6670') +
    el(39, 10, 4, 2.4, '#c7ced6', ' opacity=".7"') + el(42, 6, 3, 2, '#dfe4ea', ' opacity=".5"') +
    '<path d="M21 46v-6a4 4 0 0 1 8 0v6Z" fill="#2b2f36"/>' + el(25, 44, 3, 3.4, '#ff9a2e') + el(25, 45, 1.8, 2.2, '#ffd166');
  A.market = tile('grass') + pg([14, 46, 32, 55, 32, 38, 14, 30], '#f4ead8') + pg([32, 55, 50, 46, 50, 30, 32, 38], '#dccdb1') +
    [0, 1, 2, 3].map(function (i) { return pg([12 + i * 5, 29 + i * 2.5, 17 + i * 5, 31.5 + i * 2.5, 19 + i * 5, 24.5 + i * 2.5, 14 + i * 5, 22 + i * 2.5], i % 2 ? '#ffffff' : '#0fa3a3'); }).join('') +
    [0, 1, 2, 3].map(function (i) { return pg([32 + i * 4.5, 36.5 - i * 2.2, 36.5 + i * 4.5, 34.3 - i * 2.2, 38 + i * 4.5, 27 - i * 2.2, 33.5 + i * 4.5, 29.2 - i * 2.2], i % 2 ? '#e9f6f6' : '#0b8585'); }).join('') +
    pg([14, 22, 34, 13, 52, 21, 32, 31], '#5fe0d4') + pg([20, 42, 30, 47, 30, 41, 20, 36], '#c98d52') + ci(24, 38, 2, '#f2a516') + ci(27.5, 40, 1.8, '#ef4f5f') + ci(41, 39, 2, '#9be26a');
  A.temple = tile('grass') + pg([18, 46, 46, 46, 44, 26, 20, 26], '#f4ead8') + pg([32, 46, 46, 46, 44, 26, 32, 26], '#dccdb1') + pg([16, 26, 48, 26, 32, 14], '#f2c14e') + pg([32, 14, 48, 26, 32, 26], '#d9a32c') +
    [22, 28, 36, 42].map(function (x) { return pg([x - 1.2, 44, x + 1.2, 44, x + 1.2, 28, x - 1.2, 28], '#c9b998'); }).join('');
  A.road = tile('grass') + pg([6, 40, 12, 37, 58, 40, 52, 43], '#d8c39b');

  // ---------------------------------------------------------------- units: bust on a transparent box
  var SK = '#f2c9a0', SK2 = '#dba67c', MET = '#d7dee5', MET2 = '#a9b5c1', WOOD = '#9a6a3c', WOOD2 = '#7a4f28';
  function body(col, col2) { return pg([14, 64, 18, 44, 32, 40, 46, 44, 50, 64], col) + pg([32, 40, 46, 44, 50, 64, 32, 64], col2); }
  function face(y) { y = y || 30; return el(32, y, 9, 10, SK) + pg([32, y - 10, 41, y - 2, 41, y + 3, 32, y + 10], SK2, ' opacity=".55"') + ci(28.5, y + 1, 1.1, '#3b2a20') + ci(35.5, y + 1, 1.1, '#3b2a20'); }
  var U = {};
  U.warrior = body('#a86f3c', '#8a5a2e') + face(31) + pg([22, 28, 23, 19, 32, 15, 41, 19, 42, 28, 38, 24, 26, 24], MET) + pg([32, 15, 41, 19, 42, 28, 38, 24, 32, 23], MET2) +
    pg([30, 15, 32, 10, 34, 15], MET2) + ln('M47 58L56 22', WOOD2, 4) + el(56.5, 20, 4.2, 5.5, WOOD);
  U.archer = body('#3f8f4e', '#2f7240') + face(31) + pg([20, 34, 22, 20, 32, 13, 42, 20, 44, 34, 40, 25, 24, 25], '#4ea85e') + pg([32, 13, 42, 20, 44, 34, 40, 25, 32, 22], '#357d44') +
    '<path d="M50 14q12 22 0 44" fill="none" stroke="' + WOOD + '" stroke-width="3" stroke-linecap="round"/>' + ln('M50 14V58', '#f4ead8', 1) + ln('M38 36L58 36', '#5c321a', 1.6) + pg([58, 34, 62, 36, 58, 38], MET2);
  U.defender = body('#6f7d8c', '#5a6674') + face(30) + pg([22, 27, 23, 18, 32, 14, 41, 18, 42, 27], MET) + pg([32, 14, 41, 18, 42, 27, 32, 26], MET2) +
    el(42, 50, 15, 14, '#3f6fc5') + el(42, 50, 15, 14, 'none', ' stroke="#e8c45a" stroke-width="2.4"') + pg([42, 38, 50, 50, 42, 62, 34, 50], '#e8c45a', ' opacity=".9"') + ci(42, 50, 2.6, MET);
  U.swordsman = body('#7d4bb0', '#653a92') + face(31) + pg([22, 28, 23, 18, 32, 14, 41, 18, 42, 28, 38, 24, 26, 24], MET) + pg([32, 14, 41, 18, 42, 28, 38, 24, 32, 23], MET2) +
    '<path d="M33 14q-4-8 4-12q-2 6 2 9" fill="#e2574c"/>' + pg([48, 58, 51, 58, 51, 18, 49.5, 13, 48, 18], '#e6ecf1') + pg([49.5, 13, 51, 18, 51, 58, 49.5, 58], MET2) + pg([44, 52, 55, 52, 55, 55, 44, 55], '#e8c45a');
  U.rider = pg([20, 64, 22, 44, 30, 30, 36, 22, 46, 26, 52, 36, 46, 38, 40, 34, 38, 46, 44, 64], '#b07a46') + pg([36, 22, 46, 26, 52, 36, 46, 38, 40, 34], '#93623a') +
    pg([30, 30, 36, 22, 33, 14, 28, 22, 24, 32, 22, 44], '#5c3a22') + ci(43, 28, 1.4, '#20140c') + pg([36, 22, 37, 15, 40, 21], '#93623a') + ln('M44 37L38 40', '#3b2a20', 1.4);
  U.knight = U.rider.replace('#b07a46', '#9aa6b3').replace('#93623a', '#7d8a97').replace('#93623a', '#7d8a97') + pg([30, 30, 36, 22, 46, 26, 40, 30], '#c9d2db') + ln('M14 62L58 6', WOOD2, 3) + pg([56, 4, 62, 2, 60, 8], MET);
  U.catapult = pg([8, 58, 56, 58, 56, 52, 8, 52], WOOD2) + pg([12, 52, 18, 52, 30, 30, 26, 28], WOOD) + pg([44, 52, 50, 52, 38, 30, 34, 32], WOOD) + ci(14, 58, 5, '#5c3a22') + ci(50, 58, 5, '#5c3a22') + ci(14, 58, 2, '#c98d52') + ci(50, 58, 2, '#c98d52') +
    ln('M30 32L50 10', '#b07a46', 3.4) + el(51, 9, 6, 3.2, '#5c3a22') + ci(51, 5, 4.2, '#9aa4ae') + ci(50, 4, 1.4, '#c9d2db');
  U.mindbender = body('#5b3fa8', '#48318a') + face(32) + pg([19, 40, 21, 20, 32, 11, 43, 20, 45, 40, 40, 27, 24, 27], '#6d4fc4') + pg([32, 11, 43, 20, 45, 40, 40, 27, 32, 23], '#56399f') +
    ln('M50 62V20', WOOD, 2.6) + ci(50, 16, 6, '#a78bfa', ' opacity=".55"') + ci(50, 16, 3.6, '#e9ddff');
  U.giant = pg([6, 64, 10, 42, 32, 36, 54, 42, 58, 64], '#8a6a4c') + pg([32, 36, 54, 42, 58, 64, 32, 64], '#735739') + el(32, 26, 14, 15, SK) + pg([32, 11, 46, 22, 46, 30, 32, 41], SK2, ' opacity=".55"') +
    pg([20, 20, 30, 18, 30, 21, 20, 23], '#5c3a22') + pg([34, 18, 44, 20, 44, 23, 34, 21], '#5c3a22') + ci(26, 25, 1.6, '#3b2a20') + ci(38, 25, 1.6, '#3b2a20') + pg([22, 32, 42, 32, 40, 42, 32, 46, 24, 42], '#7a5134');
  U.cloak = body('#2c3444', '#212837') + pg([18, 44, 20, 20, 32, 10, 44, 20, 46, 44, 40, 26, 24, 26], '#3a4458') + pg([32, 10, 44, 20, 46, 44, 40, 26, 32, 22], '#2c3444') + el(32, 31, 7, 8, '#141a26') + ci(29.5, 31, 1.2, '#ffd166') + ci(34.5, 31, 1.2, '#ffd166');
  U.dagger = body('#7b2d35', '#62232a') + face(31) + pg([21, 27, 23, 20, 32, 17, 41, 20, 43, 27, 32, 24], '#e2574c') + pg([41, 21, 50, 19, 47, 25], '#e2574c') +
    pg([14, 56, 26, 40, 28, 42, 16, 58], MET) + pg([50, 56, 38, 40, 36, 42, 48, 58], MET) + ci(26, 41, 2, '#e8c45a') + ci(38, 41, 2, '#e8c45a');
  function boat(extra, hull, hull2) { return pg([6, 46, 58, 46, 50, 58, 14, 58], hull || '#9a6a3c') + pg([32, 46, 58, 46, 50, 58, 32, 58], hull2 || '#7a4f28') + ln('M10 50H54', 'rgba(0,0,0,.18)', 1.2) + (extra || '') + ln('M4 61q6-3 12 0t12 0t12 0t12 0t12 0', '#c8f1ff', 1.6); }
  U.raft = pg([8, 50, 56, 50, 54, 58, 10, 58], '#b07a46') + [12, 20, 28, 36, 44].map(function (x) { return ln('M' + x + ' 50.5V57.5', '#7a4f28', 1.2); }).join('') + ln('M4 61q6-3 12 0t12 0t12 0t12 0t12 0', '#c8f1ff', 1.6) + ln('M32 50V20', WOOD2, 2) + pg([33, 22, 33, 44, 50, 44], '#f4ead8');
  U.scout = boat(ln('M32 46V8', WOOD2, 2.2) + pg([33, 10, 33, 40, 54, 40], '#f4ead8') + pg([31, 12, 31, 40, 14, 40], '#e6dcc6'));
  U.rammer = boat(pg([56, 46, 63, 50, 56, 52], MET2) + ln('M30 46V16', WOOD2, 2.2) + pg([31, 18, 31, 40, 48, 40], '#e2574c'));
  U.bomber = boat(pg([24, 46, 24, 34, 40, 34, 40, 46], '#5d6670') + pg([38, 37, 56, 31, 57, 35, 39, 41], '#3b434d') + ci(56, 33, 2.2, '#2b2f36'));
  U.juggernaut = boat(pg([16, 46, 18, 30, 46, 30, 48, 46], '#5d6670') + pg([22, 30, 24, 18, 40, 18, 42, 30], '#76818c') + ci(26, 24, 2, '#2b2f36') + ci(38, 24, 2, '#2b2f36'), '#4a525c', '#3b434d');
  U.polytaur = pg([16, 64, 18, 44, 32, 38, 46, 44, 48, 64], '#8a5a2e') + el(32, 30, 11, 11, '#a86f3c') + pg([21, 24, 12, 14, 18, 26], '#f4ead8') + pg([43, 24, 52, 14, 46, 26], '#f4ead8') + el(32, 36, 6, 4, '#c98d52') + ci(28, 28, 1.4, '#20140c') + ci(36, 28, 1.4, '#20140c');
  // ---------------- boats & sea people
  U.pirate = body('#2c3444', '#212837') + face(32) + pg([18, 24, 46, 24, 42, 18, 32, 12, 22, 18], '#1d222c') + ci(32, 18, 2.2, '#f4ead8') + pg([26, 30, 31, 30, 31, 33, 26, 33], '#111') + ln('M24 29L36 27', '#111', 1) + pg([14, 64, 18, 52, 46, 52, 50, 64], '#e2574c', ' opacity=".9"') + ln('M50 58L58 40', MET2, 2.6) + pg([56, 36, 60, 38, 58, 44], MET);
  U.dinghy = pg([12, 48, 52, 48, 46, 58, 18, 58], '#c98d52') + pg([32, 48, 52, 48, 46, 58, 32, 58], '#a86f3c') + ln('M16 51H48', 'rgba(0,0,0,.18)', 1.2) + ln('M20 46L8 38M44 46L56 38', WOOD2, 2.2) + el(8, 37, 3, 1.6, WOOD) + el(56, 37, 3, 1.6, WOOD) + ln('M4 61q6-3 12 0t12 0t12 0t12 0t12 0', '#c8f1ff', 1.6);
  function tail(col, col2) { return '<path d="M20 64q-2-14 12-20q14 6 12 20Z" fill="' + col + '"/><path d="M32 44q14 6 12 20H32Z" fill="' + col2 + '"/>' + pg([44, 52, 58, 44, 54, 56, 60, 62], col) + pg([44, 52, 54, 56, 60, 62, 48, 60], col2); }
  function mer(top, hair, extra) { return tail('#2fb6a8', '#1f9488') + pg([22, 50, 24, 40, 40, 40, 42, 50], top) + face(30) + '<path d="M22 32q-2-14 10-16q12 2 10 16q-3-8-10-9q-7 1-10 9Z" fill="' + hair + '"/>' + pg([20, 32, 24, 30, 24, 46, 19, 44], hair) + pg([44, 32, 40, 30, 40, 46, 45, 44], hair) + (extra || ''); }
  U.mermaid = mer('#f2a9b8', '#e2574c');
  U.mermaidArcher = mer('#f2a9b8', '#e2574c', '<path d="M50 14q12 20 0 40" fill="none" stroke="' + WOOD + '" stroke-width="3" stroke-linecap="round"/>' + ln('M50 14V54', '#f4ead8', 1) + ln('M38 34L58 34', '#5c321a', 1.6));
  U.mermaidDefender = mer('#9fd0e8', '#7a4f28', el(44, 48, 12, 12, '#3f6fc5') + el(44, 48, 12, 12, 'none', ' stroke="#e8c45a" stroke-width="2.2"') + ci(44, 48, 2.4, MET));
  U.swordsmaid = mer('#c9b4f0', '#5c321a', pg([48, 56, 51, 56, 51, 16, 49.5, 11, 48, 16], '#e6ecf1') + pg([44, 50, 55, 50, 55, 53, 44, 53], '#e8c45a'));
  U.mermaidDagger = mer('#e2574c', '#2c3444', pg([46, 56, 40, 38, 42, 37, 49, 55], MET) + ci(40.5, 38, 1.8, '#e8c45a'));
  U.siren = mer('#f4ead8', '#f2c14e', '<path d="M44 26q10-2 12 8q-8-2-12 2Z" fill="#f4c3d0"/>' + ln('M50 18q4 -2 6 0M53 14q4-2 6 0', '#a78bfa', 1.4));
  U.amphibian = body('#3f8f4e', '#2f7240') + el(32, 30, 12, 10, '#6cc046') + pg([32, 20, 44, 30, 32, 40], '#4f9531', ' opacity=".5"') + ci(25, 21, 5, '#6cc046') + ci(39, 21, 5, '#6cc046') + ci(25, 21, 2.2, '#20140c') + ci(39, 21, 2.2, '#20140c') + ln('M25 33q7 4 14 0', '#2f7240', 1.6);
  U.scuba = body('#2c3444', '#212837') + ci(32, 28, 13, '#d7dee5') + ci(32, 28, 9, '#7fd3f0') + pg([25, 24, 31, 20, 33, 22, 27, 27], 'rgba(255,255,255,.55)') + ci(32, 28, 13, 'none', ' stroke="#a9b5c1" stroke-width="2.2"') + pg([44, 30, 52, 26, 52, 34], '#e8c45a');
  U.tridention = mer('#9fd0e8', '#0b8585', ln('M52 62V10', '#e8c45a', 2.4) + ln('M46 16V8M58 16V8M46 16H58', '#e8c45a', 2.4));
  U.puffer = el(32, 36, 20, 17, '#f2c14e') + pg([32, 19, 52, 36, 32, 53], '#d9a32c', ' opacity=".6"') + [[16, 26], [14, 38], [18, 48], [28, 54], [40, 54], [48, 48], [26, 18], [38, 18], [48, 24]].map(function (p) { return pg([p[0] - 2, p[1], p[0], p[1] - 4 + (p[1] > 36 ? 8 : 0), p[0] + 2, p[1]], '#a8781c'); }).join('') + ci(25, 32, 3.6, '#fff') + ci(26, 32, 2, '#20140c') + el(18, 38, 3, 2, '#e2574c') + pg([52, 36, 60, 28, 60, 44], '#e9b636');
  U.shark = '<path d="M6 46q20-18 46-6q-6 8-20 10q-16 1-26-4Z" fill="#7d8fa1"/><path d="M6 46q22 6 46-6q-8 10-24 11q-14 0-22-5Z" fill="#c9d4de"/>' + pg([26, 34, 34, 14, 40, 38], '#6a7c8e') + pg([50, 40, 60, 30, 58, 46], '#6a7c8e') + ci(16, 42, 1.6, '#111') + ln('M10 47l3-2 3 2 3-2 3 2', '#fff', 1.1) + ln('M4 61q6-3 12 0t12 0t12 0t12 0t12 0', '#c8f1ff', 1.6);
  U.jelly = '<path d="M14 34q0-20 18-20t18 20q-6-3-9 0q-4-3-9 0q-5-3-9 0q-4-3-9 0Z" fill="#c6a4f2"/>' + '<path d="M32 14q18 0 18 20q-3-2-6-1q-2-11-12-19Z" fill="#a983e0"/>' + [18, 25, 32, 39, 46].map(function (x, i) { return ln('M' + x + ' 34q' + (i % 2 ? 4 : -4) + ' 10 0 22', '#c6a4f2', 2.2); }).join('') + ci(26, 24, 2, '#fff', ' opacity=".7"');
  U.crab = el(32, 40, 16, 10, '#e2574c') + pg([32, 30, 48, 40, 32, 50], '#c44b3f', ' opacity=".6"') + [0, 1, 2].map(function (i) { return ln('M' + (20 - i * 2) + ' ' + (44 + i * 3) + 'l-8 4M' + (44 + i * 2) + ' ' + (44 + i * 3) + 'l8 4', '#c44b3f', 2.2); }).join('') +
    ln('M20 36L10 24M44 36L54 24', '#e2574c', 3) + '<path d="M4 20q6-10 12-2l-4 4q-2-4-6-2Z" fill="#e2574c"/><path d="M60 20q-6-10-12-2l4 4q2-4 6-2Z" fill="#e2574c"/>' + ln('M27 31V24M37 31V24', '#c44b3f', 1.6) + ci(27, 23, 2.2, '#111') + ci(37, 23, 2.2, '#111');
  // ---------------- dragons (Elyrion)
  U.dragonEgg = el(32, 38, 15, 20, '#9fd36a') + '<path d="M32 18a15 20 0 0 1 15 20a15 20 0 0 1-15 20Z" fill="#7fb64f"/>' + [[26, 30, 3.4], [37, 26, 2.6], [30, 44, 2.8], [40, 42, 3.2], [24, 46, 2]].map(function (p) { return ci(p[0], p[1], p[2], '#e8c45a'); }).join('') + pg([22, 22, 26, 26, 22, 30], '#fff', ' opacity=".4"');
  function dragonHead(col, col2, big) {
    var k = big ? 1 : 0.85;
    return '<g transform="translate(32 34) scale(' + k + ') translate(-32 -34)">' + pg([10, 60, 16, 40, 30, 30, 44, 26, 58, 34, 56, 42, 44, 42, 34, 46, 30, 60], col) + pg([30, 30, 44, 26, 58, 34, 56, 42, 44, 42, 34, 46], col2) +
      pg([28, 30, 22, 12, 34, 28], col2) + pg([36, 27, 36, 10, 42, 26], col) + ci(42, 32, 2.2, '#ffd166') + ci(42.6, 32, 1, '#20140c') + ln('M50 40l3 2M46 41l2 2', '#fff', 1.2) + '</g>';
  }
  U.babyDragon = dragonHead('#7fc6e8', '#5fa9cc', false);
  U.fireDragon = dragonHead('#e2574c', '#b8423a', true) + '<path d="M58 38q6-4 4-10q4 6 0 12q4 0 2 6q-4-4-8-4Z" fill="#ffb020"/><path d="M58 39q3-2 3-6q2 4 0 7Z" fill="#ffe08a"/>';
  // ---------------- Polaris (ice)
  U.iceArcher = body('#4f8fc9', '#3a74a8') + face(31) + pg([20, 34, 22, 20, 32, 13, 42, 20, 44, 34, 40, 25, 24, 25], '#cfe8fa') + pg([32, 13, 42, 20, 44, 34, 40, 25, 32, 22], '#a9d2ef') +
    '<path d="M50 14q12 22 0 44" fill="none" stroke="#7fd3f0" stroke-width="3" stroke-linecap="round"/>' + ln('M50 14V58', '#fff', 1) + ln('M38 36L58 36', '#2f6fa0', 1.6) + pg([58, 33, 63, 36, 58, 39], '#bff0ff');
  U.mooni = el(32, 40, 18, 18, '#eef5fb') + pg([32, 22, 50, 40, 32, 58], '#d3e3f0') + ci(26, 36, 3.4, '#20304a') + ci(38, 36, 3.4, '#20304a') + ci(27, 35, 1.2, '#fff') + ci(39, 35, 1.2, '#fff') + '<path d="M28 45q4 3 8 0" fill="none" stroke="#20304a" stroke-width="1.6" stroke-linecap="round"/>' + pg([22, 24, 26, 14, 30, 23], '#d3e3f0') + pg([42, 24, 38, 14, 34, 23], '#d3e3f0');
  U.battleSled = pg([8, 40, 52, 40, 48, 50, 12, 50], '#4f8fc9') + pg([32, 40, 52, 40, 48, 50, 32, 50], '#3a74a8') + ln('M6 56H54q6 0 6-6', '#c9d2db', 2.6) + ln('M16 50V56M44 50V56', '#a9b5c1', 2) + pg([20, 40, 22, 26, 34, 26, 36, 40], '#d7dee5') + ci(28, 22, 5, SK) + pg([22, 21, 28, 14, 34, 21], '#cfe8fa') + ln('M40 34L56 22', '#a9b5c1', 2.4);
  U.iceFortress = pg([12, 60, 14, 24, 50, 24, 52, 60], '#bfe3f5') + pg([32, 24, 50, 24, 52, 60, 32, 60], '#94cbe6') + [14, 23, 32, 41].map(function (x) { return pg([x, 24, x + 4.5, 24, x + 4.5, 18, x, 18], '#d8f0fb'); }).join('') + pg([26, 60, 26, 46, 38, 46, 38, 60], '#5a8fb0') + pg([22, 22, 32, 6, 42, 22], '#e9f7fd') + pg([32, 6, 42, 22, 32, 22], '#c3e6f6');
  U.gaami = pg([6, 64, 10, 42, 32, 36, 54, 42, 58, 64], '#7fb7de') + pg([32, 36, 54, 42, 58, 64, 32, 64], '#5f9ccb') + el(32, 26, 14, 15, '#cfe8fa') + pg([32, 11, 46, 22, 46, 30, 32, 41], '#a9d2ef', ' opacity=".7"') +
    pg([18, 14, 22, 4, 26, 13], '#e9f7fd') + pg([46, 14, 42, 4, 38, 13], '#e9f7fd') + ci(26, 25, 2, '#20304a') + ci(38, 25, 2, '#20304a') + pg([24, 34, 40, 34, 36, 38, 28, 38], '#5f9ccb');
  // ---------------- Cymanti (insects)
  function bug(col, col2, extra, legs) {
    return (legs === false ? '' : [0, 1, 2].map(function (i) { var y = 40 + i * 6; return ln('M22 ' + y + 'l-10 ' + (i * 3 - 3) + 'M42 ' + y + 'l10 ' + (i * 3 - 3), '#3b2a20', 1.8); }).join('')) +
      el(32, 46, 13, 15, col) + '<path d="M32 31a13 15 0 0 1 0 30Z" fill="' + col2 + '"/>' + ln('M32 32V60', 'rgba(0,0,0,.25)', 1.2) + el(32, 26, 8, 7, '#3b2a20') + ci(28.5, 25, 1.8, '#ffd166') + ci(35.5, 25, 1.8, '#ffd166') +
      ln('M28 20Q24 10 18 10M36 20Q40 10 46 10', '#3b2a20', 1.6) + (extra || '');
  }
  U.hexapod = bug('#8bb83a', '#6f9a26');
  U.kiton = bug('#e2574c', '#c44b3f', [[27, 42], [37, 40], [26, 52], [38, 53], [32, 47]].map(function (p) { return ci(p[0], p[1], 2.4, '#1d1a16'); }).join(''));
  U.phychi = bug('#5fb0d6', '#4a93b8', '<path d="M20 40q-14-12-12 4q6 4 12 0Z" fill="rgba(255,255,255,.75)"/><path d="M44 40q14-12 12 4q-6 4-12 0Z" fill="rgba(255,255,255,.75)"/>' + ln('M32 33V22', '#3b2a20', 1), false);
  U.mantis = pg([24, 64, 26, 40, 38, 40, 40, 64], '#6cc046') + pg([32, 40, 38, 40, 40, 64, 32, 64], '#4f9531') + pg([22, 26, 32, 18, 42, 26, 32, 36], '#7fd35a') + pg([32, 18, 42, 26, 32, 36], '#5fae3d') + ci(24, 25, 3.2, '#c9e265') + ci(40, 25, 3.2, '#c9e265') +
    ln('M26 42L12 34L16 24M38 42L52 34L48 24', '#5fae3d', 3) + ln('M28 18Q22 8 16 6M36 18Q42 8 48 6', '#4f9531', 1.4);
  U.exida = bug('#a98c6a', '#8a6f50', ci(32, 12, 6, '#8e99a5') + ci(30, 10, 2, '#c3ccd4'));
  U.doomux = bug('#5d4a7a', '#47385f', ci(32, 46, 6, '#ff9a2e', ' opacity=".9"') + ci(32, 46, 3, '#ffd166') + ln('M32 14V6', '#3b2a20', 1.4) + pg([30, 6, 34, 6, 32, 2], '#ff9a2e'));
  U.shaman = bug('#8b5cf6', '#6d45cf', ln('M50 62V22', WOOD, 2.6) + ci(50, 18, 5, '#c9e265', ' opacity=".7"') + ci(50, 18, 2.6, '#f0ffd0'));
  U.moth = '<path d="M32 36Q8 10 6 30q2 14 26 10Z" fill="#c9b08a"/><path d="M32 36Q56 10 58 30q-2 14-26 10Z" fill="#b39672"/><path d="M32 40Q12 46 16 58q10 2 16-12Z" fill="#b39672"/><path d="M32 40Q52 46 48 58q-10 2-16-12Z" fill="#9c7f5c"/>' +
    ci(18, 28, 4, '#7a5a3c') + ci(46, 28, 4, '#6a4c30') + el(32, 40, 3.6, 13, '#5c4430') + ln('M30 28Q26 18 20 16M34 28Q38 18 44 16', '#5c4430', 1.4);
  U.larva = [0, 1, 2, 3].map(function (i) { return el(16 + i * 9, 46 - i * 3, 8, 7, i % 2 ? '#f2e2b5' : '#e9d29a'); }).join('') + el(46, 34, 8, 7, '#f2e2b5') + ci(48, 32, 1.6, '#3b2a20') + ln('M51 37q2 2 0 4', '#3b2a20', 1.2);
  U.insectEgg = [[24, 44, 9], [40, 44, 9], [32, 32, 9], [32, 52, 7]].map(function (p) { return el(p[0], p[1], p[2] * 0.8, p[2], '#f4ead8') + '<path d="M' + p[0] + ' ' + (p[1] - p[2]) + 'a' + p[2] * 0.8 + ' ' + p[2] + ' 0 0 1 0 ' + 2 * p[2] + 'Z" fill="#dccdb1"/>'; }).join('');
  U.raychi = '<path d="M32 22Q50 26 60 44Q44 42 32 52Q20 42 4 44Q14 26 32 22Z" fill="#5f7fb8"/><path d="M32 22Q50 26 60 44Q44 42 32 52Z" fill="#4a68a0"/>' + ln('M32 52Q34 58 28 62', '#4a68a0', 2) + ci(27, 32, 1.6, '#fff') + ci(37, 32, 1.6, '#fff') + ln('M4 61q6-3 12 0t12 0t12 0t12 0t12 0', '#c8f1ff', 1.6);
  U.boomchi = ci(32, 38, 17, '#e8574c') + '<path d="M32 21a17 17 0 0 1 0 34Z" fill="#c44b3f"/>' + [[24, 30], [38, 28], [30, 44], [42, 42]].map(function (p) { return ci(p[0], p[1], 2.6, '#ffd166'); }).join('') + ln('M32 21V12', '#5c321a', 2) + pg([29, 12, 35, 12, 32, 6], '#ff9a2e') + ci(32, 7, 2, '#ffe08a');
  U.livingIsland = '<path d="M6 46q26-20 52 0Z" fill="#7fd35a"/><path d="M32 33q16 1 26 13H32Z" fill="#5fae3d"/>' + tree(22, 38, 14, 0.7) + tree(40, 36, 16, 0.75) + ci(26, 44, 2.4, '#fff') + ci(38, 44, 2.4, '#fff') + ci(26, 44, 1.2, '#20140c') + ci(38, 44, 1.2, '#20140c') +
    pg([6, 46, 58, 46, 52, 54, 12, 54], '#c9a36a') + ln('M4 60q6-3 12 0t12 0t12 0t12 0t12 0', '#c8f1ff', 1.6);
  U.centipede = [0, 1, 2, 3].map(function (i) { var x = 14 + i * 9, y = 50 - i * 4; return ln('M' + x + ' ' + (y + 4) + 'l-3 8M' + x + ' ' + (y + 4) + 'l3 8', '#3b2a20', 1.6) + el(x, y, 7, 6, i % 2 ? '#c26a3a' : '#d9814a'); }).join('') +
    el(46, 30, 9, 8, '#c26a3a') + ci(43, 28, 1.8, '#ffd166') + ci(50, 28, 1.8, '#ffd166') + ln('M42 24Q38 14 32 12M50 24Q54 14 60 12', '#3b2a20', 1.4) + ln('M44 37l-2 4M48 37l2 4', '#3b2a20', 1.6);
  U.segment = el(32, 40, 16, 13, '#d9814a') + '<path d="M32 27a16 13 0 0 1 0 26Z" fill="#c26a3a"/>' + ln('M18 50l-4 10M24 52l-2 10M40 52l2 10M46 50l4 10', '#3b2a20', 1.8) + ln('M20 36q12-6 24 0', 'rgba(0,0,0,.2)', 1.4);
  var ALIAS = { boat: 'scout', ship: 'scout', battleship: 'rammer', navalon: 'juggernaut' };

  var CACHE = {}, IMG = {};
  function src(name) {
    if (A[name]) return { box: '0 0 64 64', g: A[name] };
    var u = U[name] || U[ALIAS[name]]; if (u) return { box: '0 0 64 64', g: u };
    return null;
  }
  PP.art = {
    has: function (name) { return !!src(name); },
    isUnit: function (name) { return !!(U[name] || U[ALIAS[name]]); },
    svg: function (name, px) {
      var s = src(name); if (!s) return '';
      return '<svg width="' + px + '" height="' + px + '" viewBox="' + s.box + '" aria-hidden="true" class="art">' + s.g + '</svg>';
    },
    // an Image for canvas drawing (decoded once; null until ready – the caller redraws later)
    img: function (name) {
      if (IMG[name]) return IMG[name].complete ? IMG[name] : null;
      var s = src(name); if (!s) return null;
      var im = new Image();
      im.onload = function () { if (PP.board && PP.board.redraw) PP.board.redraw(); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="' + s.box + '">' + s.g + '</svg>');
      IMG[name] = im; return null;
    },
    names: Object.keys(A).concat(Object.keys(U)),
  };
})(window.PP);
