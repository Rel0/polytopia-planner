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

  // ---------------------------------------------------------------- v27: ships + special tribe units (white silhouettes)
  // boat hull (bottom half of the box)
  var HULL = 'M-46 8H46C43 22 34 33 22 36H-22C-34 33 -43 22 -46 8Z';
  var HULL_S = 'M-38 14H38C35 26 28 34 18 36H-18C-28 34 -35 26 -38 14Z';
  // Raft: three logs with a small mast and flag
  I.raft = [
    { d: 'M-38 14H38M-38 25H38M-34 36H34', s: W, w: 9, cap: 'round' },
    { d: 'M-6 8V-42', s: W, w: 5, cap: 'round' },
    { d: poly([-4, -42, 30, -30, -4, -16]), f: W }
  ];
  // Scout: hull with mast and two sails
  I.scout = [
    { d: HULL, f: W },
    { d: 'M0 4V-46', s: W, w: 4.5, cap: 'round' },
    { d: poly([5, -42, 5, 0, 38, 0]) + poly([-5, -32, -5, 0, -30, 0]), f: W }
  ];
  // Rammer: low hull with a long ram spike and a cabin
  I.rammer = [
    { d: 'M-46 0H26L48 8L28 14C26 26 18 33 8 36H-24C-36 33 -44 18 -46 0Z', f: W },
    { d: 'M-30 -4V-24C-30 -28 -27 -30 -24 -30H2C5 -30 8 -28 8 -24V-4Z', f: W },
    { d: poly([-22, -22, -8, -22, -8, -14, -22, -14]), f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Bomber: hull with a mortar firing a ball
  I.bomber = [
    { d: HULL, f: W },
    { d: 'M-18 2L4 -26', s: W, w: 17, cap: 'butt' },
    { d: 'M-30 4C-30 -8 -18 -14 -6 -10L4 2Z', f: W },
    { d: circ(26, -36, 9), f: W }
  ];
  // Juggernaut: big hull carrying a crenellated tower
  I.juggernaut = [
    { d: HULL, f: W },
    { d: 'M-26 4V-34H-16V-26H-6V-34H6V-26H16V-34H26V4Z', f: W },
    { d: 'M-6 4V-8C-6 -12 -3 -14 0 -14C3 -14 6 -12 6 -8V4Z', f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Dagger: short blade with guard and grip
  var DAGGER = [
    { d: 'M-8 -10H24L46 0L24 10H-8Z', f: W },
    { d: 'M-8 -20V20', s: W, w: 8, cap: 'round' },
    { d: 'M-12 0H-36', s: W, w: 10, cap: 'round' },
    { d: circ(-42, 0, 6), f: W },
    { d: 'M0 0H30', s: 'cut', w: 2.5, cap: 'round' }
  ];
  I.dagger = DAGGER;
  // Pirate: dagger above a small hull
  I.pirate = [
    { d: HULL_S, f: W },
    { d: poly([-2, -2, 22, -34, 30, -40, 26, -30, 6, 4]), f: W, s: W, w: 3 },
    { d: 'M-10 -8L8 10', s: W, w: 6, cap: 'round' },
    { d: 'M0 2L-14 16', s: W, w: 6.5, cap: 'round' }
  ];
  // Cloak: hooded figure with a dark face opening
  var HOOD = 'M0 -44C20 -44 32 -28 32 -6L38 42H-38L-32 -6C-32 -28 -20 -44 0 -44Z';
  I.cloak = [
    { d: HOOD, f: W },
    { d: 'M0 -30C10 -30 16 -20 16 -10C16 2 8 8 0 8C-8 8 -16 2 -16 -10C-16 -20 -10 -30 0 -30Z', f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Dinghy: small hull carrying a hood
  I.dinghy = [
    { d: HULL_S, f: W },
    { d: 'M0 -44C13 -44 21 -34 21 -20L24 10H-24L-21 -20C-21 -34 -13 -44 0 -44Z', f: W },
    { d: 'M0 -35C7 -35 11 -28 11 -21C11 -13 6 -9 0 -9C-6 -9 -11 -13 -11 -21C-11 -28 -7 -35 0 -35Z', f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Shark: dorsal fin above a wave
  I.shark = [
    { d: 'M-34 16C-14 12 0 -16 2 -44C18 -28 32 -6 36 16Z', f: W },
    { d: 'M-46 30C-38 22 -31 22 -23 30S-8 38 0 30S15 22 23 30S38 38 46 30', s: W, w: 7, cap: 'round' }
  ];
  // Jelly: dome with wavy tentacles
  I.jelly = [
    { d: 'M-36 2C-36 -26 -20 -40 0 -40C20 -40 36 -26 36 2C30 6 24 2 18 6C12 2 6 6 0 2C-6 6 -12 2 -18 6C-24 2 -30 6 -36 2Z', f: W },
    { d: 'M-22 12C-28 22 -16 30 -22 42M-7 12C-13 22 -1 30 -7 42M8 12C2 22 14 30 8 42M23 12C17 22 29 30 23 42', s: W, w: 4.5, cap: 'round' }
  ];
  // Puffer: spiky round fish with tail and eye
  I.puffer = [
    { d: circ(-4, 0, 28) + poly([-4, -44, 4, -28, -12, -28]) + poly([-4, 44, 4, 28, -12, 28]) + poly([-46, 0, -30, -8, -30, 8]) +
        poly([-34, -32, -18, -24, -26, -16]) + poly([-34, 32, -18, 24, -26, 16]) + poly([26, -32, 10, -24, 18, -16]) + poly([26, 32, 10, 24, 18, 16]) +
        poly([22, 0, 46, -16, 40, 0, 46, 16]), f: W },
    { d: circ(8, -8, 5), f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Tridention: trident
  I.tridention = [
    { d: 'M0 -18V44', s: W, w: 7, cap: 'round' },
    { d: 'M-26 -40V-24C-26 -14 -16 -10 0 -10C16 -10 26 -14 26 -24V-40', s: W, w: 7, cap: 'round' },
    { d: 'M0 -46V-10', s: W, w: 7, cap: 'round' },
    { d: poly([-26, -48, -32, -36, -20, -36]) + poly([26, -48, 32, -36, 20, -36]) + poly([0, -52, -6, -40, 6, -40]), f: W, s: W, w: 3 }
  ];
  // Crab: body with two claws and legs
  I.crab = [
    { d: 'M-30 6C-30 -8 -16 -14 0 -14C16 -14 30 -8 30 6C30 18 16 24 0 24C-16 24 -30 18 -30 6Z', f: W },
    { d: 'M-26 16L-42 30M-30 6L-46 14M26 16L42 30M30 6L46 14M-20 -8L-30 -24M20 -8L30 -24', s: W, w: 5, cap: 'round' },
    { d: 'M-30 -24C-44 -24 -46 -44 -32 -46L-30 -36L-22 -42C-18 -32 -22 -24 -30 -24Z' + 'M30 -24C44 -24 46 -44 32 -46L30 -36L22 -42C18 -32 22 -24 30 -24Z', f: W },
    { d: circ(-8, 0, 3.5) + circ(8, 0, 3.5), f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Polytaur: bull head with horns
  I.polytaur = [
    { d: 'M-20 -20C-20 -26 -14 -30 0 -30C14 -30 20 -26 20 -20L18 14C18 30 10 40 0 40C-10 40 -18 30 -18 14Z', f: W },
    { d: 'M-20 -18C-36 -18 -44 -30 -42 -44M20 -18C36 -18 44 -30 42 -44M-20 -10L-34 -2M20 -10L34 -2', s: W, w: 7, cap: 'round' },
    { d: circ(-9, -10, 3.6) + circ(9, -10, 3.6) + circ(-6, 26, 3.2) + circ(6, 26, 3.2), f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Egg (Dragon Egg, Insect Egg): egg with a zigzag crack
  I.egg = [
    { d: 'M0 -44C20 -44 34 -10 34 12C34 32 18 44 0 44C-18 44 -34 32 -34 12C-34 -10 -20 -44 0 -44Z', f: W },
    { d: 'M-30 4L-16 -6L-6 6L6 -6L16 6L30 -4', s: 'cut', w: 4.5, cap: 'round' }
  ];
  // Dragon: head in profile with horn, open jaw and a wing
  I.dragon = [
    { d: 'M-44 44C-40 20 -30 4 -14 -6C-16 -20 -10 -34 4 -40L2 -50L14 -40C26 -38 36 -30 44 -22L46 -12L28 -12L42 0L24 2C14 4 8 12 6 22L4 44Z', f: W },
    { d: circ(14, -26, 4), f: 'cut', s: 'cut', w: 0.1 },
    { d: 'M-36 34C-28 18 -18 10 -8 8', s: 'cut', w: 3.5, cap: 'round' }
  ];
  // Mooni: six-armed snowflake
  I.mooni = [
    { d: 'M0 -44V44M-38 -22L38 22M-38 22L38 -22', s: W, w: 6.5, cap: 'round' },
    { d: 'M-10 -36L0 -26L10 -36M-10 36L0 26L10 36M-36 -8L-22 -12L-26 -26M36 8L22 12L26 26M-36 8L-22 12L-26 26M36 -8L22 -12L26 -26', s: W, w: 5, cap: 'round' },
    { d: circ(0, 0, 9), f: W }
  ];
  // Battle Sled: sled with curved runner and a backrest with a spear
  I.battleSled = [
    { d: 'M-46 30H28C42 30 46 18 38 10', s: W, w: 6, cap: 'round' },
    { d: 'M-30 30V16M0 30V16M24 30V16', s: W, w: 5, cap: 'round' },
    { d: 'M-40 18V-2C-40 -6 -37 -8 -34 -8H-26V4H34V18Z', f: W },
    { d: 'M-20 0L26 -46', s: W, w: 5, cap: 'round' },
    { d: poly([26, -46, 16, -42, 22, -36]), f: W, s: W, w: 3 }
  ];
  // Ice Fortress: tower with battlements and a door
  I.iceFortress = [
    { d: 'M-30 44V-30H-18V-20H-6V-30H6V-20H18V-30H30V44Z' + poly([-36, -30, -24, -44, -12, -30]) + poly([12, -30, 24, -44, 36, -30]), f: W },
    { d: 'M-10 44V24C-10 18 -6 14 0 14C6 14 10 18 10 24V44Z' + poly([-20, -8, -10, -8, -10, 2, -20, 2]) + poly([10, -8, 20, -8, 20, 2, 10, 2]), f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Hexapod (also Doomux): beetle seen from above
  I.hexapod = [
    { d: 'M0 -16C16 -16 24 -2 24 14C24 32 12 44 0 44C-12 44 -24 32 -24 14C-24 -2 -16 -16 0 -16Z' + circ(0, -26, 11), f: W },
    { d: 'M-22 -2L-40 -14M-24 14L-44 14M-22 30L-40 42M22 -2L40 -14M24 14L44 14M22 30L40 42M-6 -34L-14 -48M6 -34L14 -48', s: W, w: 5, cap: 'round' },
    { d: 'M0 -14V42', s: 'cut', w: 3.5, cap: 'butt' }
  ];
  // Moth (also Phychi): two pairs of wings, body, antennae
  I.moth = [
    { d: 'M-4 -10C-16 -38 -40 -42 -44 -26C-46 -10 -28 0 -4 0Z' + 'M4 -10C16 -38 40 -42 44 -26C46 -10 28 0 4 0Z' +
        'M-4 4C-22 6 -36 18 -30 34C-24 42 -10 30 -4 16Z' + 'M4 4C22 6 36 18 30 34C24 42 10 30 4 16Z', f: W },
    { d: 'M0 -18V30', s: W, w: 7, cap: 'round' },
    { d: 'M-2 -20C-6 -32 -12 -38 -20 -42M2 -20C6 -32 12 -38 20 -42', s: W, w: 3.5, cap: 'round' }
  ];
  // Raychi: manta ray with tail
  I.raychi = [
    { d: 'M0 -30C20 -30 38 -12 48 4C30 2 16 8 0 26C-16 8 -30 2 -48 4C-38 -12 -20 -30 0 -30Z', f: W },
    { d: 'M0 24C2 32 8 40 18 46', s: W, w: 4, cap: 'round' },
    { d: circ(-10, -12, 3.2) + circ(10, -12, 3.2), f: 'cut', s: 'cut', w: 0.1 }
  ];
  // Boomchi: round bomb with a burning fuse
  I.boomchi = [
    { d: circ(-6, 10, 30), f: W },
    { d: 'M10 -16L18 -26', s: W, w: 10, cap: 'butt' },
    { d: 'M18 -26C22 -34 28 -36 34 -34', s: W, w: 4, cap: 'round' },
    { d: 'M36 -44V-38M44 -36H38M42 -44L38 -40M30 -42L33 -39', s: W, w: 3.5, cap: 'round' },
    { d: 'M-22 2C-20 -6 -14 -10 -8 -12', s: 'cut', w: 4, cap: 'round' }
  ];
  // Living Island: shell-island with a palm tree
  I.livingIsland = [
    { d: 'M-46 30C-42 6 -24 -4 0 -4C24 -4 42 6 46 30Z', f: W },
    { d: 'M-46 38H46', s: W, w: 5, cap: 'round' },
    { d: 'M-24 22L-12 8M0 24V6M24 22L12 8', s: 'cut', w: 3.5, cap: 'round' },
    { d: 'M6 -4C6 -20 2 -30 -4 -36', s: W, w: 5, cap: 'round' },
    { d: 'M-4 -36C-16 -46 -30 -42 -36 -30C-24 -36 -14 -36 -4 -36Z' + 'M-4 -36C6 -48 22 -48 30 -38C18 -40 8 -40 -4 -36Z' + 'M-4 -36C-8 -28 -16 -22 -26 -20C-20 -30 -12 -36 -4 -36Z' + 'M-4 -36C6 -32 14 -24 16 -14C8 -24 0 -30 -4 -36Z', f: W }
  ];
  // Centipede (also Segment): chain of body segments with legs and antennae
  I.centipede = [
    { d: circ(26, -26, 11) + circ(8, -8, 12) + circ(-12, 10, 12) + circ(-30, 28, 10), f: W },
    { d: 'M30 -36L36 -48M36 -24L48 -26M0 -20L-6 -30M20 0L28 8M-20 -2L-28 -10M0 20L6 30M-40 18L-46 10M-20 38L-14 46', s: W, w: 4, cap: 'round' }
  ];

  // ---------------------------------------------------------------- v28: own symbols for the special-tribe units
  // (silhouettes modelled on the in-game unit figures; drawn by us, no game assets)
  // Mermaid figure: head + torso merging into a fish tail with a fluke (lower left); the weapon goes upper right
  var MER_BODY = 'M-30 -16C-30 -20 -27 -22 -23 -22H-7C-3 -22 0 -20 0 -16L1 2C2 14 8 24 20 28L32 20L30 34L44 44L22 44C4 42 -12 32 -20 18C-27 6 -30 -4 -30 -16Z' + circ(-15, -31, 10);
  var MER = { d: MER_BODY, f: W };
  // Mermaid (Warrior): fish-tailed fighter with a club
  I.mermaid = [MER,
    { d: 'M6 -2L28 -36', s: 'cut', w: 16, cap: 'round' },
    { d: 'M6 -2L28 -36', s: W, w: 7, cap: 'round' },
    { d: 'M20 -22L32 -42', s: W, w: 13, cap: 'round' }];
  // Mermaid Archer: fish tail + bow
  I.mermaidArcher = [MER,
    { d: 'M10 -46C34 -40 44 -14 34 8', s: W, w: 6, cap: 'round' },
    { d: 'M10 -46L34 8', s: W, w: 2.2, cap: 'round' },
    { d: 'M4 -4L40 -34', s: W, w: 4, cap: 'round' },
    { d: poly([46, -40, 32, -36, 40, -26]), f: W, s: W, w: 2.5 }];
  // Mermaid Defender: fish tail + round-topped shield
  I.mermaidDefender = [MER,
    { d: 'M24 -44C32 -39 38 -38 46 -38C46 -14 40 0 24 8C8 0 2 -14 2 -38C10 -38 16 -39 24 -44Z', s: 'cut', w: 7 },
    { d: 'M24 -44C32 -39 38 -38 46 -38C46 -14 40 0 24 8C8 0 2 -14 2 -38C10 -38 16 -39 24 -44Z', f: W },
    { d: 'M24 -36V0', s: 'cut', w: 3, cap: 'round' }];
  // Amphibian (Rider): a frog mount seen from the front
  I.amphibian = [
    { d: 'M-40 30C-44 6 -30 -12 -18 -16C-24 -22 -24 -36 -14 -40C-6 -42 -2 -36 0 -30C2 -36 6 -42 14 -40C24 -36 24 -22 18 -16C30 -12 44 6 40 30C30 40 -30 40 -40 30Z', f: W },
    { d: 'M-48 40C-44 30 -36 28 -30 32M48 40C44 30 36 28 30 32', s: W, w: 6, cap: 'round' },
    { d: circ(-12, -30, 4.5) + circ(12, -30, 4.5), f: 'cut', s: 'cut', w: 0.1 },
    { d: 'M-22 4C-12 12 12 12 22 4', s: 'cut', w: 3.5, cap: 'round' }];
  // Swordsmaid (Swordsman): fish tail + long sword
  I.swordsmaid = [MER,
    { d: poly([6, -6, 36, -42, 46, -48, 42, -36, 12, 0]), f: W, s: W, w: 2.5 },
    { d: 'M-2 -16L18 8', s: W, w: 6, cap: 'round' }];
  // Siren (Mind Bender): fish tail + staff with an orb
  I.siren = [MER,
    { d: 'M26 44V-26', s: W, w: 5.5, cap: 'round' },
    { d: circ(26, -36, 11), f: W },
    { d: circ(26, -36, 5), f: 'cut', s: 'cut', w: 0.1 }];
  // Scuba (Cloak): fish tail with a diving mask and snorkel instead of a head
  I.scuba = [
    { d: 'M-30 -16C-30 -20 -27 -22 -23 -22H-7C-3 -22 0 -20 0 -16L1 2C2 14 8 24 20 28L32 20L30 34L44 44L22 44C4 42 -12 32 -20 18C-27 6 -30 -4 -30 -16Z', f: W },
    { d: 'M-34 -44H8C12 -44 14 -42 14 -38V-30C14 -26 12 -24 8 -24H-34C-38 -24 -40 -26 -40 -30V-38C-40 -42 -38 -44 -34 -44Z', f: W },
    { d: circ(-24, -34, 6) + circ(-2, -34, 6), f: 'cut', s: 'cut', w: 0.1 },
    { d: 'M18 -34H26V-50', s: W, w: 5, cap: 'round' }];
  // Mermaid Dagger (Dagger): fish tail + short knife
  I.mermaidDagger = [MER,
    { d: poly([8, -14, 40, -34, 26, -10]), f: W, s: W, w: 2.5 },
    { d: 'M4 -18L12 -2', s: W, w: 7, cap: 'round' }];

  // Kiton (Defender): round armoured beetle with spikes on its shell, seen from above
  I.kiton = [
    { d: circ(0, 8, 30) + circ(0, -28, 10) + poly([-30, -12, -40, -30, -18, -22]) + poly([30, -12, 40, -30, 18, -22]) +
        poly([-30, 28, -46, 30, -34, 14]) + poly([30, 28, 46, 30, 34, 14]) + poly([0, 38, -8, 48, 8, 48]), f: W },
    { d: 'M-34 0L-46 -6M34 0L46 -6M-26 34L-36 44M26 34L36 44', s: W, w: 4.5, cap: 'round' },
    { d: 'M-22 -4C-10 6 10 6 22 -4M-22 18C-10 28 10 28 22 18', s: 'cut', w: 4, cap: 'round' }];
  // Mantis (Swordsman): praying mantis in profile with raised forelegs
  I.mantis = [
    { d: 'M-44 30C-40 18 -26 10 -10 8C-4 8 -2 14 -6 18C-18 28 -32 34 -44 30Z', f: W },
    { d: 'M-8 12L10 -22', s: W, w: 6.5, cap: 'round' },
    { d: poly([4, -32, 22, -44, 26, -24]) , f: W, s: W, w: 4 },
    { d: 'M8 -14L28 -6L22 -26M14 -8L30 4L36 -16', s: W, w: 4.5, cap: 'round' },
    { d: 'M-10 14L-22 40M-2 14L4 40M-18 16L-36 40', s: W, w: 3.5, cap: 'round' },
    { d: 'M16 -42L10 -50M22 -42L30 -48', s: W, w: 2.5, cap: 'round' }];
  // Exida (Catapult): scorpion-like crawler with a long curved neck and a round head
  I.exida = [
    { d: 'M-26 24C-26 12 -12 6 4 6C20 6 30 14 30 24C30 34 18 38 2 38C-14 38 -26 34 -26 24Z', f: W },
    { d: 'M-12 10C-30 -4 -30 -24 -10 -32C2 -36 8 -38 10 -44', s: W, w: 8, cap: 'round' },
    { d: circ(12, -42, 9), f: W },
    { d: circ(14, -42, 3.5), f: 'cut', s: 'cut', w: 0.1 },
    { d: 'M-20 30L-42 44M-20 18L-46 16M24 30L44 44M24 18L46 14', s: W, w: 4, cap: 'round' }];
  // Gaami (Giant): tall cloaked ice giant with antlers
  I.gaami = [
    { d: 'M-8 -30H8L28 44H-28Z' + circ(0, -30, 10), f: W },
    { d: 'M-6 -38L-18 -50M-12 -44L-26 -44M-16 -48L-22 -54M6 -38L18 -50M12 -44L26 -44M16 -48L22 -54', s: W, w: 4, cap: 'round' },
    { d: 'M0 -18V44', s: 'cut', w: 3, cap: 'butt' }];
  // Shaman (Mind Bender): robed figure with a curled horn helmet and a skull staff
  I.shaman = [
    { d: 'M-2 -24H18L32 44H-16Z' + circ(8, -30, 11), f: W },
    { d: 'M14 -38C24 -46 34 -36 26 -28C22 -24 18 -28 20 -32', s: W, w: 5, cap: 'round' },
    { d: 'M-24 44L-30 -22', s: W, w: 5, cap: 'round' },
    { d: circ(-31, -32, 10) + poly([-38, -26, -24, -26, -26, -18, -36, -18]), f: W },
    { d: circ(-35, -33, 2.8) + circ(-27, -33, 2.8), f: 'cut', s: 'cut', w: 0.1 }];
  // Doomux (Knight): big armoured pill bug in profile, segmented shell and pincers
  I.doomux = [
    { d: 'M-46 26C-46 -6 -24 -26 4 -26C28 -26 42 -10 42 12V26Z', f: W },
    { d: 'M36 14L50 4L44 18M36 22L50 30L40 30', s: W, w: 4, cap: 'round' },
    { d: 'M-30 -14C-24 0 -24 14 -28 26M-12 -24C-6 -6 -6 10 -10 26M8 -26C14 -8 14 10 10 26', s: 'cut', w: 3.5, cap: 'round' },
    { d: circ(28, 6, 4.5), f: 'cut', s: 'cut', w: 0.1 },
    { d: 'M-40 26L-44 40M-20 26L-22 40M0 26L2 40M20 26L24 40', s: W, w: 4, cap: 'round' }];
  // Larva (Dagger): segmented grub with a round head
  I.larva = [
    { d: circ(-32, 10, 11) + circ(-14, 6, 13) + circ(6, 4, 14) + circ(28, -2, 14), f: W },
    { d: 'M-23 -2V20M-4 -8V18M17 -10V16', s: 'cut', w: 3, cap: 'round' },
    { d: circ(32, -4, 3.5), f: 'cut', s: 'cut', w: 0.1 },
    { d: 'M-30 20L-32 30M-12 18L-12 28M8 18L8 28', s: W, w: 4, cap: 'round' }];
  // Phychi (Archer): dragonfly – long thin body, two pairs of narrow wings
  I.phychi = [
    { d: 'M-40 40L18 -18', s: W, w: 7, cap: 'round' },
    { d: circ(24, -24, 10), f: W },
    { d: 'M8 -10C-4 -30 -24 -44 -36 -40C-40 -34 -24 -18 4 -6Z' + 'M10 -6C30 -2 46 12 44 24C38 28 22 16 6 -2Z' +
        'M-2 2C-18 -10 -40 -16 -46 -8C-44 0 -26 6 -4 6Z' + 'M2 4C10 18 12 38 4 46C-4 44 -4 26 -2 6Z', f: W },
    { d: circ(27, -27, 3.2), f: 'cut', s: 'cut', w: 0.1 }];

  // Swordsman: long broadsword with a wide crossguard (the Dagger is a short knife – see below)
  I.swordsman = [
    { d: poly([-12, 10, 30, -34, 44, -46, 38, -30, -2, 16]), f: W, s: W, w: 3 },
    { d: 'M-24 -4L6 26', s: W, w: 8, cap: 'round' },
    { d: 'M-8 12L-28 32', s: W, w: 7, cap: 'round' },
    { d: circ(-33, 37, 7), f: W }
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
  // every unit in PP.UNITS gets a symbol: its own, or the one named by its `ico` (e.g. Mermaid Archer → archer)
  if (PP.UNITS) Object.keys(PP.UNITS).forEach(function (k) {
    var src = PP.UNITS[k].ico || k;
    if (!I[k] && I[src]) I[k] = I[src];
    if (I[k]) UNIT[k] = 1;
  });
  ['raft', 'scout', 'rammer', 'bomber', 'juggernaut', 'dagger', 'pirate', 'cloak', 'dinghy', 'shark', 'jelly', 'puffer', 'tridention', 'crab',
    'polytaur', 'egg', 'dragon', 'mooni', 'battleSled', 'iceFortress', 'hexapod', 'moth', 'raychi', 'boomchi', 'livingIsland', 'centipede'].forEach(function (k) { UNIT[k] = 1; });

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
