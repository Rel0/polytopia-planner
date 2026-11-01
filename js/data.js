// Polytopia Planer v2 – game data.
// Values from the Polytopia community wiki; they may differ per game version.
window.PP = window.PP || {};

(function (PP) {
  'use strict';

  // hp, atk, def, mov (move range), rng (attack range), cost (★), tech (required tech id)
  PP.UNITS = {
    warrior:    { name: 'Warrior',        icon: '⚔️', hp: 10, atk: 2,   def: 2, mov: 1, rng: 1, cost: 2,    tech: null },
    archer:     { name: 'Archer',   icon: '🏹', hp: 10, atk: 2,   def: 1, mov: 1, rng: 2, cost: 3,    tech: 'archery' },
    defender:   { name: 'Defender',    icon: '🛡️', hp: 15, atk: 1,   def: 3, mov: 1, rng: 1, cost: 3,    tech: 'strategy' },
    rider:      { name: 'Rider',         icon: '🐎', hp: 10, atk: 2,   def: 1, mov: 2, rng: 1, cost: 3,    tech: 'riding' },
    swordsman:  { name: 'Swordsman', icon: '🗡️', hp: 15, atk: 3,   def: 3, mov: 1, rng: 1, cost: 5,    tech: 'smithery' },
    catapult:   { name: 'Catapult',       icon: '🪨', hp: 10, atk: 4,   def: 0, mov: 1, rng: 3, cost: 8,    tech: 'mathematics' },
    knight:     { name: 'Knight',         icon: '🏇', hp: 10, atk: 3.5, def: 1, mov: 3, rng: 1, cost: 8,    tech: 'chivalry' },
    mindbender: { name: 'Mind Bender',    icon: '🔮', hp: 10, atk: 0,   def: 1, mov: 1, rng: 1, cost: 5,    tech: 'philosophy' },
    giant:      { name: 'Giant',          icon: '🗿', hp: 40, atk: 5,   def: 4, mov: 1, rng: 1, cost: null, tech: null },
  };

  // Value used by the attack optimizer when a unit has no purchase price.
  PP.GIANT_VALUE = 15;

  PP.TECHS = [
    { id: 'climbing',     name: 'Climbing',        tier: 1, parent: null },
    { id: 'fishing',      name: 'Fishing',         tier: 1, parent: null },
    { id: 'hunting',      name: 'Hunting',           tier: 1, parent: null },
    { id: 'organization', name: 'Organization',    tier: 1, parent: null },
    { id: 'riding',       name: 'Riding',          tier: 1, parent: null },
    { id: 'mining',       name: 'Mining',         tier: 2, parent: 'climbing' },
    { id: 'meditation',   name: 'Meditation',      tier: 2, parent: 'climbing' },
    { id: 'sailing',      name: 'Sailing',          tier: 2, parent: 'fishing' },
    { id: 'ramming',      name: 'Ramming',          tier: 2, parent: 'fishing' },
    { id: 'archery',      name: 'Archery',   tier: 2, parent: 'hunting' },
    { id: 'forestry',     name: 'Forestry', tier: 2, parent: 'hunting' },
    { id: 'farming',      name: 'Farming',        tier: 2, parent: 'organization' },
    { id: 'strategy',     name: 'Strategy',       tier: 2, parent: 'organization' },
    { id: 'roads',        name: 'Roads',         tier: 2, parent: 'riding' },
    { id: 'freespirit',   name: 'Free Spirit',       tier: 2, parent: 'riding' },
    { id: 'smithery',     name: 'Smithery',   tier: 3, parent: 'mining' },
    { id: 'philosophy',   name: 'Philosophy',     tier: 3, parent: 'meditation' },
    { id: 'navigation',   name: 'Navigation',      tier: 3, parent: 'sailing' },
    { id: 'aquatism',     name: 'Aquatism',      tier: 3, parent: 'ramming' },
    { id: 'spiritualism', name: 'Spiritualism',   tier: 3, parent: 'archery' },
    { id: 'mathematics',  name: 'Mathematics',      tier: 3, parent: 'forestry' },
    { id: 'construction', name: 'Construction',        tier: 3, parent: 'farming' },
    { id: 'diplomacy',    name: 'Diplomacy',      tier: 3, parent: 'strategy' },
    { id: 'trade',        name: 'Trade',          tier: 3, parent: 'roads' },
    { id: 'chivalry',     name: 'Chivalry',  tier: 3, parent: 'freespirit' },
  ];
  PP.TECH = {};
  PP.TECHS.forEach(function (t) { PP.TECH[t.id] = t; });

  // Terrain types (BUILD tile sheet). color = small map dot.
  PP.TERRAINS = [
    { id: 'field',    name: 'Field',        icon: '🟩', color: '#9bd35a' },
    { id: 'forest',   name: 'Forest',        icon: '🌲', color: '#2f9e44' },
    { id: 'mountain', name: 'Mountain',        icon: '⛰️', color: '#adb5bd' },
    { id: 'water',    name: 'Water', icon: '🌊', color: '#4cc9f0' },
    { id: 'ocean',    name: 'Ocean',       icon: '🌊', color: '#1d4ed8' },
    { id: 'cloud',    name: 'Cloud', icon: '☁️', color: '#e9ecef' },
  ];
  PP.TERRAIN = {};
  PP.TERRAINS.forEach(function (t) { PP.TERRAIN[t.id] = t; });

  // Resources on a tile (terrain = where they occur).
  PP.RESOURCES = [
    { id: 'fruit',  name: 'Fruit',  icon: '🍒', terrain: 'field' },
    { id: 'crop',   name: 'Crop', icon: '🌾', terrain: 'field' },
    { id: 'animal', name: 'Animal',     icon: '🦌', terrain: 'forest' },
    { id: 'ore',    name: 'Metal',      icon: '💎', terrain: 'mountain' },
    { id: 'fish',   name: 'Fish',    icon: '🐟', terrain: 'water' },
  ];
  PP.RESOURCE = {};
  PP.RESOURCES.forEach(function (r) { PP.RESOURCE[r.id] = r; });

  // Tile buildings / actions. cost in ★ (negative = gives stars), pop = population for the city.
  // adj: pop per adjacent (Chebyshev 1) planned placement of `adj.item`.
  // terrain: where it can be placed; needs: resource required on the tile;
  // turnsInto: terrain after the action (+ gives: resource that appears).
  // Uncertain (differs between game versions): burn tech (construction vs. chivalry), port/market pop,
  // temple pop (temples grow over turns, only the initial +1 is counted), road on forest.
  PP.ITEMS = [
    // field
    { id: 'fruit',    name: 'Harvest Fruit',  icon: '🍒', cost: 2,  pop: 1, tech: 'organization', terrain: ['field'], needs: 'fruit' },
    { id: 'farm',     name: 'Farm',            icon: '🌾', cost: 5,  pop: 2, tech: 'farming',      terrain: ['field'], needs: 'crop' },
    { id: 'road',     name: 'Road',          icon: '🛤️', cost: 3,  pop: 0, tech: 'roads',        terrain: ['field', 'forest'] },
    { id: 'temple',   name: 'Temple',          icon: '⛩️', cost: 20, pop: 1, tech: 'freespirit',   terrain: ['field'] },
    { id: 'windmill', name: 'Windmill',       icon: '🌬️', cost: 5,  pop: 0, tech: 'construction', terrain: ['field'], note: '+1 👥 per adjacent Farm', adj: { item: 'farm', pop: 1 } },
    { id: 'forge',    name: 'Forge',        icon: '🔨', cost: 5,  pop: 0, tech: 'smithery',     terrain: ['field'], note: '+2 👥 per adjacent Mine', adj: { item: 'mine', pop: 2 } },
    { id: 'sawmill',  name: 'Sawmill',        icon: '🪚', cost: 5,  pop: 0, tech: 'mathematics',  terrain: ['field'], note: '+1 👥 per adjacent Lumber Hut', adj: { item: 'lumber', pop: 1 } },
    { id: 'market',   name: 'Market',           icon: '🏪', cost: 5,  pop: 0, tech: 'trade',        terrain: ['field'], note: 'more ★ per turn' },
    { id: 'plant',    name: 'Grow Forest',   icon: '🌲', cost: 5,  pop: 0, tech: 'spiritualism', terrain: ['field'], turnsInto: 'forest', note: 'becomes Forest' },
    // forest
    { id: 'hunt',     name: 'Hunt',      icon: '🦌', cost: 2,  pop: 1, tech: 'hunting',      terrain: ['forest'], needs: 'animal' },
    { id: 'lumber',   name: 'Lumber Hut', icon: '🪵', cost: 3,  pop: 1, tech: 'forestry',     terrain: ['forest'] },
    { id: 'clear',    name: 'Clear Forest',      icon: '🪓', cost: -1, pop: 0, tech: 'forestry',     terrain: ['forest'], turnsInto: 'field', note: 'gives 1 ★, becomes Field' },
    { id: 'burn',     name: 'Burn Forest',  icon: '🔥', cost: 5,  pop: 0, tech: 'construction', terrain: ['forest'], turnsInto: 'field', gives: 'crop', note: 'becomes Field with Crop' },
    { id: 'foresttemple', name: 'Forest Temple',  icon: '🛕', cost: 15, pop: 1, tech: 'spiritualism', terrain: ['forest'] },
    // mountain
    { id: 'mine',     name: 'Mine',            icon: '⛏️', cost: 5,  pop: 2, tech: 'mining',       terrain: ['mountain'], needs: 'ore' },
    { id: 'mountaintemple', name: 'Mountain Temple', icon: '🏔️', cost: 20, pop: 1, tech: 'meditation', terrain: ['mountain'] },
    // water
    { id: 'fish',     name: 'Fish',    icon: '🐟', cost: 2,  pop: 1, tech: 'fishing',      terrain: ['water'], needs: 'fish' },
    { id: 'port',     name: 'Port',           icon: '⚓', cost: 7,  pop: 0, tech: 'sailing',      terrain: ['water'] },
    { id: 'watertemple', name: 'Water Temple', icon: '🔱', cost: 20, pop: 1, tech: 'aquatism',     terrain: ['water', 'ocean'] },
  ];
  PP.ITEM = {};
  PP.ITEMS.forEach(function (it) { PP.ITEM[it.id] = it; });

  // City level-up rewards, keyed by the level the city reaches. 5+ repeats for every higher level.
  var R = {
    workshop:  { id: 'workshop',  name: 'Workshop',          icon: '⚒️', desc: '+1 ★ per turn',            effect: { income: 1 } },
    explorer:  { id: 'explorer',  name: 'Explorer',          icon: '🧭', desc: 'Reveals the surroundings',     effect: {} },
    walls:     { id: 'walls',     name: 'City Wall',         icon: '🧱', desc: 'Defense ×4 in the city', effect: { walls: true } },
    resources: { id: 'resources', name: 'Resources',         icon: '💰', desc: '+5 ★ instantly',                effect: { stars: 5 } },
    popgrowth: { id: 'popgrowth', name: 'Population Growth',        icon: '👥', desc: '+3 👥 population',          effect: { pop: 3 } },
    border:    { id: 'border',    name: 'Border Growth',   icon: '🗺️', desc: 'City border grows',    effect: {} },
    park:      { id: 'park',      name: 'Park',               icon: '🌳', desc: '+1 ★ per turn',            effect: { income: 1 } },
    giant:     { id: 'giant',     name: 'Super Unit',         icon: '🗿', desc: 'A Giant appears',        effect: { giant: true } },
  };
  PP.REWARD = R;
  PP.CITY_REWARDS = {
    2: [R.workshop, R.explorer],
    3: [R.walls, R.resources],
    4: [R.popgrowth, R.border],
    5: [R.park, R.giant],
  };
  // convenience: levels 6..12 reuse the 5+ options
  for (var lv = 6; lv <= 12; lv++) PP.CITY_REWARDS[lv] = PP.CITY_REWARDS[5];

  PP.ARROW_COLORS = ['#ffaa00', '#06d6a0', '#ef476f', '#4cc9f0'];
})(window.PP);
