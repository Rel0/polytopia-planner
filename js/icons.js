// Polytopia Planer v13 – ICONS: own vector symbols in the style of the game's UI (no game assets).
// Units: bold white silhouettes like the round tribe badges in the game (helmeted club fighter = Warrior, horse head =
// Rider, bust = Giant …). Buildings / terrain / resources: small flat coloured symbols.
// PP.icons.draw(ctx, name, x, y, size, opts) – canvas, centred on (x, y), size = edge of the icon box in px
// PP.icons.svg(name, size, opts)             – inline SVG string
// opts: color (monochrome override for every part), stroke (outline / halo colour), strokeWidth (px, default
// ≈ size·0.06), alpha. PP.icons.has(name), PP.icons.names.
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  // ---------------------------------------------------------------- shape helpers (box −50…50, y down)
  function circ(cx, cy, r) { return 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0Z'; }
  function poly(pts) { var s = ''; for (var i = 0; i < pts.length; i += 2) s += (i ? 'L' : 'M') + pts[i] + ' ' + pts[i + 1]; return s + 'Z'; }
  // isometric diamond (tile) centred on cx, cy with half-width a
  function dia(cx, cy, a) { var b = a * 0.6; return poly([cx, cy - b, cx + a, cy, cx, cy + b, cx - a, cy]); }

  var W = '#ffffff';
  // part: d (path), f fill, s stroke colour, w stroke width (box units), ev even-odd fill, cap 'round'|'butt'
  var I = {};

  // ---------------------------------------------------------------- units (white silhouettes)
  // Warrior: blocky figure in a spiked helmet (visor slit cut out) raising a club, like the game's warrior
  I.warrior = [
    // helmet with a short spike on top
    { d: 'M-32 -8V-20C-32 -36 -20 -44 -8 -44C4 -44 16 -36 16 -20V-8Z' + poly([-14, -42, -8, -52, -2, -42]), f: W },
    // body block
    { d: 'M-34 44V8C-34 2 -30 -1 -24 -1H8C14 -1 18 2 18 8V44Z', f: W },
    // visor slit, gap between helmet and body, gap around the club
    { d: poly([-26, -22, 10, -22, 10, -15, -26, -15]), s: 'cut', w: 0.1, f: 'cut' },
    { d: 'M-40 -4.5H24', s: 'cut', w: 3.5, cap: 'butt' },
    { d: 'M8 22L36 -34', s: 'cut', w: 19, cap: 'round' },
    // club: thin handle, thick head
    { d: 'M8 22L36 -34', s: W, w: 8, cap: 'round' },
    { d: 'M24 -12L38 -40', s: W, w: 15, cap: 'round' }
  ];
  // Rider: horse head facing right (chess-knight like), as in the game's rider badge
  var HORSE = 'M-30 42L-26 4C-25 -12 -20 -24 -12 -32L-14 -46L-1 -36C10 -35 22 -28 30 -16L40 -2C42 2 40 7 35 8L22 10C17 10 13 8 10 4L4 -2C2 10 6 24 10 42Z';
  I.rider = [{ d: HORSE + circ(4, -20, 4.2), f: W, ev: 1 }];
  // Knight: armoured horse head with a lance
  I.knight = [
    { d: 'M-38 40L34 -36', s: W, w: 6, cap: 'round' },
    { d: poly([34, -36, 42, -46, 30, -40]), f: W, s: W, w: 4 },
    { d: 'M-24 42L-21 8C-20 -6 -16 -16 -9 -23L-11 -35L0 -27C9 -26 18 -20 24 -11L32 0C34 3 32 7 28 8L18 9C14 9 11 8 9 5L4 0C2 10 5 26 8 42Z' +
        poly([-18, -4, 6, -24, 9, -20, -15, 0]) + circ(1, -12, 3.4),
      f: W, ev: 1 }
  ];
  // Defender: heater shield with an inner rim line
  var SHIELD = 'M0 -42C12 -35 24 -32 36 -32C36 4 25 28 0 42C-25 28 -36 4 -36 -32C-24 -32 -12 -35 0 -42Z';
  var SHIELD_IN = 'M0 -33C9 -27 18 -25 28 -25C27 2 19 21 0 33C-19 21 -27 2 -28 -25C-18 -25 -9 -27 0 -33Z';
  var SHIELD_IN2 = 'M0 -29C8 -24 16 -22 24.5 -22C23.5 1 16.5 18 0 28.5C-16.5 18 -23.5 1 -24.5 -22C-16 -22 -8 -24 0 -29Z';
  I.defender = [{ d: SHIELD + SHIELD_IN + SHIELD_IN2, f: W, ev: 1 }];
  // Archer: bow with string and arrow, diagonal
  I.archer = [
    { d: 'M-30 -30C-2 -50 40 -28 34 8', s: W, w: 0, f: null, skip: 1 },
    { d: 'M-34 -14C-26 -42 2 -50 22 -38C34 -30 40 -10 30 10C24 22 14 30 0 34', s: W, w: 7.5, cap: 'round' },
    { d: 'M-34 -14L0 34', s: W, w: 2.6, cap: 'round' },
    { d: 'M-36 38L22 -20', s: W, w: 5, cap: 'round' },
    { d: poly([30, -28, 12, -22, 24, -10]), f: W, s: W, w: 3 },
    { d: poly([-36, 38, -40, 26, -32, 30]) + poly([-36, 38, -24, 42, -28, 34]), f: W, s: W, w: 2.5 }
  ];
  // Swordsman: sword, blade up-right
  I.swordsman = [
    { d: poly([-10, 4, 28, -34, 40, -40, 34, -28, -4, 10]), f: W, s: W, w: 3 },
    { d: 'M-22 -6L6 22', s: W, w: 8, cap: 'round' },
    { d: 'M-6 6L-26 26', s: W, w: 7.5, cap: 'round' },
    { d: circ(-31, 31, 7), f: W }
  ];
  // Catapult: throwing arm with bucket on a wheeled frame
  I.catapult = [
    { d: 'M-38 20H38', s: W, w: 8, cap: 'round' },
    { d: 'M-14 18L4 -6L20 18', s: W, w: 6, cap: 'round' },
    { d: 'M26 14L-22 -26', s: W, w: 6.5, cap: 'round' },
    { d: 'M-36 -30C-34 -18 -22 -14 -14 -20L-18 -26Z' + circ(-30, -36, 8), f: W, s: W, w: 3 },
    { d: circ(-24, 32, 9) + circ(24, 32, 9) + circ(-24, 32, 3) + circ(24, 32, 3), f: W, ev: 1 }
  ];
  // Mind Bender: brain with folds (healer / converter)
  I.mindbender = [
    { d: 'M-2 -36C-8 -42 -24 -42 -28 -32C-40 -32 -44 -18 -38 -10C-46 -2 -42 14 -32 16C-30 28 -16 32 -8 26C-6 30 -2 32 0 30L0 -34Z' +
        'M2 -36C8 -42 24 -42 28 -32C40 -32 44 -18 38 -10C46 -2 42 14 32 16C30 28 16 32 8 26C6 30 2 32 0 30Z',
      f: W, s: W, w: 2 },
    { d: 'M0 -38V32M-26 -22C-18 -22 -14 -16 -16 -8M-36 4C-26 0 -18 6 -18 14M26 -22C18 -22 14 -16 16 -8M36 4C26 0 18 6 18 14M-10 -26C-12 -18 -8 -14 -4 -14M10 -26C12 -18 8 -14 4 -14',
      s: 'cut', w: 3.4, cap: 'round' },
    { d: 'M-8 32L0 44L8 32Z', f: W }
  ];
  // Giant: big bust (head on broad shoulders), as on the in-game giant badge
  I.giant = [
    { d: 'M-15 -36C-15 -42 -10 -46 -4 -46H4C10 -46 15 -42 15 -36V-14C15 -8 10 -4 4 -4H-4C-10 -4 -15 -8 -15 -14Z' +
        'M-42 42V14C-42 4 -34 -2 -24 -2H-14C-8 4 8 4 14 -2H24C34 -2 42 4 42 14V42Z',
      f: W }
  ];

  // ---------------------------------------------------------------- buildings (flat colour)
  var BR = '#8a5a34', BRD = '#5e3b20', BRL = '#b98154', GR = '#5fc24a', GRD = '#3c8f2f', ST = '#9aa3b5', STD = '#6b7386', STL = '#c8cfdc',
    RED = '#d8463c', REDD = '#a52e28', CRM = '#f3ead8', SKY = '#58b8ef', SEA = '#2a6fc9', GOLD = '#ffcf3f', OR = '#ff8a2a';
  I.farm = [
    { d: dia(0, 6, 46), f: BRL },
    { d: dia(0, 6, 46) + dia(0, 6, 38), f: BR, ev: 1 },
    { d: 'M-24 -8L12 14M-10 -16L26 6M-36 2L-2 22', s: GR, w: 6, cap: 'round' },
    { d: 'M-17 -16L-13 -8M-3 -24L1 -16M-29 -6L-25 2', s: GRD, w: 4, cap: 'round' }
  ];
  I.mine = [
    { d: poly([-46, 36, -14, -28, 2, -12, 14, -36, 46, 36]), f: ST },
    { d: poly([14, -36, 46, 36, 14, 36, 2, -12]), f: STD },
    { d: poly([-14, -28, -8, -16, -18, -10, -24, -8]), f: STL },
    { d: 'M-16 36V12C-16 2 -8 -4 0 -4C8 -4 16 2 16 12V36Z', f: '#2b2420' },
    { d: 'M-20 36V10C-20 0 -10 -8 0 -8C10 -8 20 0 20 10V36', s: BR, w: 5 }
  ];
  I.lumber = [
    { d: poly([-38, -2, 0, -36, 38, -2]), f: BRD, s: BRD, w: 4 },
    { d: 'M-32 -2H32V38H-32Z', f: BR },
    { d: 'M-32 8H32M-32 18H32M-32 28H32', s: BRD, w: 2.5 },
    { d: 'M-8 38V16H8V38Z', f: '#3b2614' },
    { d: circ(26, 30, 9), f: '#d9a066', s: BRD, w: 3 }, { d: circ(26, 30, 3), f: BRD }
  ];
  I.windmill = [
    { d: poly([-16, 42, -10, -12, 10, -12, 16, 42]), f: CRM },
    { d: poly([-14, -10, 0, -26, 14, -10]), f: RED },
    { d: 'M-5 42V28C-5 24 5 24 5 28V42Z', f: BR },
    { d: 'M-38 -52L38 24M38 -52L-38 24', s: BRD, w: 4, cap: 'round' },
    { d: poly([-36, -50, -22, -36, -14, -44, -28, -58]) + poly([36, 22, 22, 8, 14, 16, 28, 30]) +
        poly([36, -50, 22, -36, 30, -28, 44, -42]) + poly([-36, 22, -22, 8, -30, 0, -44, 14]), f: '#e9dcc0', s: BRD, w: 2 },
    { d: circ(0, -14, 5), f: BRD }
  ];
  I.forge = [
    { d: 'M16 -40H30V0H16Z', f: STD },
    { d: circ(26, -46, 6) + circ(18, -50, 4), f: '#b9bfcc' },
    { d: poly([-40, -4, -4, -30, 34, -4, 34, 40, -40, 40]), f: ST },
    { d: poly([-40, -4, -4, -30, 34, -4]), f: STD, s: STD, w: 3 },
    { d: 'M-14 40V18C-14 8 10 8 10 18V40Z', f: '#3a1d10' },
    { d: 'M-10 40C-12 30 -4 24 -2 16C2 24 8 30 6 40Z', f: OR },
    { d: 'M-6 40C-6 34 -2 32 -2 26C1 32 3 35 2 40Z', f: GOLD }
  ];
  I.sawmill = [
    { d: poly([-42, -6, -12, -28, 18, -6]), f: BRD, s: BRD, w: 4 },
    { d: 'M-38 -6H14V38H-38Z', f: BR },
    { d: 'M-38 6H14M-38 18H14M-38 30H14', s: BRD, w: 2.5 },
    { d: (function () { var s = '', n = 12, R = 26, r = 20; for (var i = 0; i < n * 2; i++) { var a = Math.PI * i / n, rr = i % 2 ? r : R; s += (i ? 'L' : 'M') + (20 + Math.cos(a) * rr).toFixed(1) + ' ' + (14 + Math.sin(a) * rr).toFixed(1); } return s + 'Z'; })() + circ(20, 14, 5),
      f: STL, ev: 1, s: STD, w: 2 }
  ];
  // Market: grey stone tower under an orange roof on wooden posts, yellow flag, blue/white striped awning in front
  // and a golden doorway (look of the game's market since 2023)
  var AWN = '#3fb2e6', AWND = '#2a86c0', ROOF = '#e8672e', ROOFD = '#b8461f';
  I.market = [
    { d: 'M2 -30V-49', s: BRD, w: 3, cap: 'round' },
    { d: poly([3, -49, 18, -45, 3, -40]), f: GOLD },
    { d: 'M-22 -14V-4M24 -14V-4', s: BR, w: 6 },
    { d: 'M-24 -2H26V42H-24Z', f: ST },
    { d: 'M8 -2H26V42H8Z', f: STD },
    { d: 'M-16 4H-4V10H-16ZM12 10H22V15H12Z', f: STL },
    { d: poly([-36, -12, -14, -34, 18, -34, 40, -12]), f: ROOF, s: ROOF, w: 3 },
    { d: poly([18, -34, 40, -12, 22, -12]), f: ROOFD },
    { d: 'M-38 -14H42V-9H-38Z', f: ROOFD },
    { d: 'M-8 42V28C-8 22 4 22 4 28V42Z', f: GOLD },
    { d: poly([-46, 26, -34, 12, -2, 12, 2, 26]), f: W },
    { d: poly([-46, 26, -34, 12, -26, 12, -36, 26]) + poly([-26, 26, -18, 12, -10, 12, -16, 26]) + poly([-6, 26, -2, 12, -2, 12, 2, 26]), f: AWN },
    { d: poly([10, 26, 14, 12, 42, 12, 48, 26]), f: W },
    { d: poly([10, 26, 14, 12, 21, 12, 19, 26]) + poly([28, 26, 28, 12, 35, 12, 38, 26]), f: AWN },
    { d: 'M-46 26H2V30H-46ZM10 26H48V30H10Z', f: AWND },
    { d: 'M30 34H44V44H30Z', f: BR }, { d: circ(37, 32, 3.5) + circ(43, 33, 3), f: GOLD }
  ];
  I.city = [
    { d: 'M-42 10H-6V42H-42Z', f: CRM },
    { d: poly([-46, 12, -24, -10, -2, 12]), f: RED, s: RED, w: 3 },
    { d: 'M2 -10H40V42H2Z', f: CRM },
    { d: 'M2 -10C2 -34 40 -34 40 -10Z', f: REDD },
    { d: 'M19 -36H23V-44H19Z', f: GOLD },
    { d: 'M-30 26H-18V42H-30Z' + 'M15 22H27V42H15Z', f: BR },
    { d: 'M10 2H16V10H10ZM26 2H32V10H26Z', f: '#7a4a2a' }
  ];
  I.port = [
    { d: 'M-46 18C-36 12 -26 24 -16 18C-6 12 4 24 14 18C24 12 34 24 46 18V46H-46Z', f: SKY },
    { d: 'M-40 14H40V20H-40Z', f: BR },
    { d: 'M-34 20V40M-12 20V40M12 20V40M34 20V40', s: BRD, w: 4, cap: 'round' },
    { d: 'M-24 -18H10V14H-24Z', f: BRL },
    { d: poly([-30, -16, -7, -38, 16, -16]), f: RED, s: RED, w: 3 },
    { d: 'M-12 14V0H-2V14Z', f: BRD },
    { d: 'M26 14V-34', s: BRD, w: 3.5 },
    { d: poly([28, -32, 44, -24, 28, -16]), f: W }
  ];
  I.temple = [
    { d: poly([-44, -14, 0, -42, 44, -14]), f: CRM, s: CRM, w: 3 },
    { d: poly([-30, -18, 0, -36, 30, -18]), f: GOLD },
    { d: 'M-40 -14H40V-6H-40Z', f: '#e2d6bd' },
    { d: 'M-34 -6H-24V32H-34ZM-14 -6H-4V32H-14ZM4 -6H14V32H4ZM24 -6H34V32H24Z', f: CRM },
    { d: 'M-44 32H44V42H-44Z', f: '#cfc2a6' }
  ];
  I.road = [
    { d: 'M-40 42C-30 20 -4 18 0 0C4 -18 26 -24 34 -44', s: '#7a5530', w: 22, cap: 'round' },
    { d: 'M-40 42C-30 20 -4 18 0 0C4 -18 26 -24 34 -44', s: '#d9a35a', w: 14, cap: 'round' }
  ];

  // ---------------------------------------------------------------- terrain / resources
  function tree(x, y, s) {
    return [
      { d: poly([x, y - 34 * s, x + 14 * s, y + 6 * s, x - 14 * s, y + 6 * s]), f: '#46c43a' },
      { d: poly([x, y - 34 * s, x + 14 * s, y + 6 * s, x, y + 6 * s]), f: '#2f9a2c' },
      { d: 'M' + (x - 3 * s) + ' ' + (y + 6 * s) + 'h' + 6 * s + 'v' + 8 * s + 'h' + (-6 * s) + 'Z', f: BRD }
    ];
  }
  I.field = [
    { d: dia(0, 8, 48), f: '#7fd35a' },
    { d: poly([-48, 8, 0, 36.8, 48, 8, 48, 16, 0, 44.8, -48, 16]), f: '#4f9a37' },
    { d: 'M-18 -2l3 -8l3 8M8 6l3 -8l3 8M-4 18l3 -8l3 8M18 -10l3 -8l3 8', s: '#3f9a2c', w: 3, cap: 'round' }
  ];
  I.forest = [].concat(tree(-16, 2, 1.05), tree(18, 8, 0.95), tree(0, 22, 0.8));
  I.mountain = [
    { d: poly([-46, 38, -12, -22, 2, -6, 16, -40, 46, 38]), f: '#a9adb8' },
    { d: poly([16, -40, 46, 38, 18, 38, 8, -4]), f: '#7d8291' },
    { d: poly([-12, -22, 2, -6, -4, -2, -12, -10, -20, -8]), f: W },
    { d: poly([16, -40, 28, -10, 18, -16, 10, -8, 6, -14]), f: W }
  ];
  I.water = [
    { d: dia(0, 6, 48), f: '#5cc6f2' },
    { d: 'M-24 2C-18 -4 -12 -4 -6 2S6 8 12 2S22 -4 26 0', s: '#c9f0ff', w: 4, cap: 'round' },
    { d: 'M-10 18C-6 14 -2 14 2 18S10 22 14 18', s: '#c9f0ff', w: 3.5, cap: 'round' }
  ];
  I.ocean = [
    { d: dia(0, 6, 48), f: '#2b6fd0' },
    { d: 'M-24 2C-18 -4 -12 -4 -6 2S6 8 12 2S22 -4 26 0', s: '#7fb6ff', w: 4, cap: 'round' },
    { d: 'M-10 18C-6 14 -2 14 2 18S10 22 14 18', s: '#7fb6ff', w: 3.5, cap: 'round' }
  ];
  // Crop: a golden wheat sheaf (three ears on stalks, tied with a band) – reads as "grain for a Farm"
  function wheatEar(cx, cy) {
    var d = circ(cx, cy - 6, 3.4);
    for (var i = 0; i < 4; i++) d += circ(cx - 3.8, cy + i * 6.5, 3.8) + circ(cx + 3.8, cy + i * 6.5 + 3, 3.8);
    return d;
  }
  I.crop = [
    { d: 'M0 40L-17 -10M0 40L0 -18M0 40L17 -10', s: '#b9821c', w: 4, cap: 'round' },
    { d: 'M-2 30C-12 24 -24 26 -30 34C-20 35 -10 34 -2 33ZM2 30C12 24 24 26 30 34C20 35 10 34 2 33Z', f: '#46b53a' },
    { d: wheatEar(0, -30) + wheatEar(-19, -22) + wheatEar(19, -22), f: '#ffc928' },
    { d: circ(-1.5, -37, 1.6) + circ(-20.5, -29, 1.6) + circ(17.5, -29, 1.6), f: '#fff1b0' },
    { d: 'M-11 16H11V24H-11Z', f: '#8a4f20' }
  ];
  // Metal: grey ore stones
  I.metal = [
    { d: poly([-42, 34, -34, 4, -14, -6, -2, 10, -6, 34]), f: '#8d94a3' },
    { d: poly([-34, 4, -14, -6, -20, 14]), f: '#c3c9d4' },
    { d: poly([-10, 34, 0, -14, 22, -30, 42, -8, 40, 34]), f: '#707888' },
    { d: poly([0, -14, 22, -30, 18, -4, 4, 4]), f: '#b0b7c4' },
    { d: poly([26, -18, 34, -10, 28, -4]) + poly([-26, 18, -20, 24, -28, 26]), f: '#e9eef6' }
  ];
  // Fruit: berry cluster (pink/purple bush fruit)
  I.fruit = [
    { d: 'M2 -30C10 -44 26 -44 34 -38C26 -30 14 -28 2 -30Z', f: '#46b53a' },
    { d: 'M0 -34V-22', s: BRD, w: 4, cap: 'round' },
    { d: circ(-14, -12, 12) + circ(10, -12, 12) + circ(-24, 10, 12) + circ(0, 8, 12) + circ(24, 8, 12) + circ(-12, 28, 12) + circ(12, 28, 12), f: '#c04ab5' },
    { d: circ(-18, -16, 4) + circ(6, -16, 4) + circ(-28, 6, 4) + circ(-4, 4, 4) + circ(20, 4, 4) + circ(-16, 24, 4) + circ(8, 24, 4), f: '#ee8fe0' }
  ];
  // Animal: deer (brown, with antlers)
  I.animal = [
    { d: 'M-30 -4C-30 -14 -20 -16 -8 -14H18L22 -26C24 -32 34 -32 38 -26L44 -20C46 -16 42 -12 38 -14L32 -12L30 4C30 10 26 12 24 14L26 42H18L14 18H-10L-16 42H-24L-22 14C-28 10 -30 6 -30 -4Z', f: '#a8662e' },
    { d: 'M-30 -4C-30 -14 -20 -16 -8 -14H8C4 -6 -6 4 -22 12C-28 10 -30 6 -30 -4Z', f: '#8a4f20' },
    { d: 'M26 -28C22 -36 22 -44 26 -48M26 -40L18 -46M32 -28C34 -38 40 -42 44 -46M37 -37L44 -36', s: '#6b3d1b', w: 3.5, cap: 'round' },
    { d: circ(-14, -6, 3) + circ(0, -4, 3) + circ(-20, 4, 2.6) + circ(8, 4, 2.6), f: '#f5e3c5' },
    { d: circ(34, -22, 2.4), f: '#2a1608' }
  ];
  I.fish = [
    { d: 'M-24 0C-12 -18 14 -20 30 0C14 20 -12 18 -24 0Z', f: '#8fd3ff' },
    { d: poly([-22, 0, -44, -16, -38, 0, -44, 16]), f: '#5fb3ec' },
    { d: 'M-24 0C-12 -18 14 -20 30 0C14 0 -10 2 -24 0Z', f: '#bfe7ff' },
    { d: 'M2 -16C6 -8 6 8 2 16', s: '#5fb3ec', w: 3, cap: 'round' },
    { d: circ(18, -3, 3.4), f: '#123456' }
  ];

  // drop helper-only parts
  Object.keys(I).forEach(function (k) { I[k] = I[k].filter(function (p) { return !p.skip; }); });
  var UNIT = { warrior: 1, archer: 1, defender: 1, rider: 1, swordsman: 1, catapult: 1, knight: 1, mindbender: 1, giant: 1 };

  // ---------------------------------------------------------------- canvas
  var p2d = {};
  function path(d) { if (!p2d[d] && typeof Path2D !== 'undefined') p2d[d] = new Path2D(d); return p2d[d]; }
  function isCut(p) { return p.s === 'cut' || p.f === 'cut'; }
  var HAS_CUT = {};
  Object.keys(I).forEach(function (k) { HAS_CUT[k] = I[k].some(isCut); });
  // paint the icon body (no halo) in box units on ctx; cut parts knock out what's below (destination-out)
  function paint(ctx, parts, col, minW) {
    parts.forEach(function (p) {
      var P = path(p.d); if (!P) return;
      var cut = isCut(p);
      ctx.globalCompositeOperation = cut ? 'destination-out' : 'source-over';
      if (p.f) { ctx.fillStyle = cut ? '#000' : (col || p.f); ctx.fill(P, p.ev ? 'evenodd' : 'nonzero'); }
      if (p.s && !(p.f && cut && p.w < 0.5)) {
        ctx.lineCap = p.cap || 'butt';
        ctx.lineWidth = Math.max(p.w || 1, cut ? 0 : minW);
        ctx.strokeStyle = cut ? '#000' : (col || p.s);
        ctx.stroke(P);
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }
  // icons with knock-outs are rendered on a cached offscreen layer at device resolution
  var layers = {}, layerN = 0;
  function layer(name, px, col, minW) {
    var key = name + '|' + px + '|' + (col || '');
    if (layers[key]) return layers[key];
    if (typeof document === 'undefined') return null;
    if (++layerN > 400) { layers = {}; layerN = 1; }
    var c = document.createElement('canvas'), m = Math.ceil(px * 0.1) + 2, n = px + 2 * m;
    c.width = c.height = n;
    var x = c.getContext('2d');
    x.translate(n / 2, n / 2); x.scale(px / 100, px / 100); x.lineJoin = 'round';
    paint(x, I[name], col, minW);
    return (layers[key] = { c: c, m: m, n: n });
  }
  function draw(ctx, name, x, y, size, opts) {
    var parts = I[name]; if (!parts || !ctx || !(size > 0)) return false;
    opts = opts || {};
    var k = size / 100, col = opts.color, halo = opts.stroke, hw = opts.strokeWidth != null ? opts.strokeWidth : Math.max(1, size * 0.06);
    var minW = 0.9 / k; // keep strokes ≥ 0.9 px so tiny icons stay crisp
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    if (halo) {
      ctx.save(); ctx.scale(k, k);
      ctx.strokeStyle = halo; ctx.lineCap = 'round';
      parts.forEach(function (p) {
        var P = path(p.d); if (!P || isCut(p)) return;
        ctx.lineWidth = (p.s ? Math.max(p.w || 0, minW) : 0) + 2 * hw / k;
        ctx.stroke(P);
      });
      ctx.restore();
    }
    var L = null;
    if (HAS_CUT[name]) {
      var t = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0 }, dpr = Math.hypot(t.a, t.b) || 1;
      L = layer(name, Math.max(4, Math.round(size * dpr)), col, minW);
      if (L) { var s = size / (L.n - 2 * L.m); ctx.drawImage(L.c, -L.n / 2 * s, -L.n / 2 * s, L.n * s, L.n * s); }
    }
    if (!L) { ctx.scale(k, k); paint(ctx, parts.filter(function (p) { return !isCut(p); }), col, minW); }
    ctx.restore();
    return true;
  }

  // ---------------------------------------------------------------- SVG
  var uidN = 0;
  function svg(name, size, opts) {
    var parts = I[name]; if (!parts) return '';
    opts = opts || {}; size = size || 24;
    var col = opts.color, halo = opts.stroke, k = size / 100, hw = (opts.strokeWidth != null ? opts.strokeWidth : Math.max(1, size * 0.06)) / k;
    var minW = 0.9 / k, out = '', hasCut = HAS_CUT[name], mid = hasCut ? 'ppim' + (++uidN) + Math.random().toString(36).slice(2, 6) : '';
    if (halo) parts.forEach(function (p) {
      if (isCut(p)) return;
      out += '<path d="' + p.d + '" fill="none" stroke="' + halo + '" stroke-linejoin="round" stroke-linecap="round" stroke-width="' + ((p.s ? Math.max(p.w || 0, minW) : 0) + 2 * hw).toFixed(2) + '"/>';
    });
    // like the canvas (destination-out), a cut only removes what was painted before it: parts after the last cut
    // are drawn on top, outside the mask
    var body = '', top = '', lastCut = -1;
    parts.forEach(function (p, i) { if (isCut(p)) lastCut = i; });
    parts.forEach(function (p, i) {
      if (isCut(p)) return;
      var e = '<path d="' + p.d + '"' + (p.ev ? ' fill-rule="evenodd"' : '') + ' fill="' + (p.f ? (col || p.f) : 'none') + '"' +
        (p.s ? ' stroke="' + (col || p.s) + '" stroke-width="' + Math.max(p.w || 1, minW).toFixed(2) + '" stroke-linejoin="round" stroke-linecap="' + (p.cap || 'butt') + '"' : '') + '/>';
      if (i > lastCut && lastCut >= 0) top += e; else body += e;
    });
    if (hasCut) {
      var m = '<mask id="' + mid + '" maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120"><rect x="-60" y="-60" width="120" height="120" fill="#fff"/>';
      parts.forEach(function (p) {
        if (!isCut(p)) return;
        m += '<path d="' + p.d + '"' + (p.ev ? ' fill-rule="evenodd"' : '') + ' fill="' + (p.f ? '#000' : 'none') + '"' +
          (p.s && !(p.f && p.w < 0.5) ? ' stroke="#000" stroke-width="' + (p.w || 1) + '" stroke-linecap="' + (p.cap || 'butt') + '" stroke-linejoin="round"' : '') + '/>';
      });
      out = '<defs>' + m + '</mask></defs>' + out + '<g mask="url(#' + mid + ')">' + body + '</g>' + top;
    } else out += body;
    return '<svg class="pp-ic" width="' + size + '" height="' + size + '" viewBox="-50 -50 100 100" aria-hidden="true"' +
      (opts.alpha != null ? ' opacity="' + opts.alpha + '"' : '') + '>' + out + '</svg>';
  }

  PP.icons = {
    draw: draw,
    svg: svg,
    has: function (name) { return Object.prototype.hasOwnProperty.call(I, name); },
    isUnit: function (name) { return !!UNIT[name]; },
    names: Object.keys(I),
    _defs: I
  };
})(window.PP);
