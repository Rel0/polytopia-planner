// Polytopia Planer v2 – game data.
// Values from the Polytopia community wiki; they may differ per game version.
window.PP = window.PP || {};

(function (PP) {
  'use strict';

  // hp, atk, def, mov (move range), rng (attack range), cost (★ to train), tech (required tech id).
  // Values from the Polytopia wiki (polytopia.fandom.com, Nov 2026, after "Path of the Ocean").
  // Optional fields:
  //   ico   – PP.icons symbol to draw (default: the unit key)
  //   carry – naval unit whose HP comes from the unit it carries (hp = null)
  //   up    – ★ to upgrade a Raft into this ship (shown instead of a training cost)
  //   val   – value for the attack optimizer when the unit can't be trained (super units, Daggers …)
  //   train: false – not trained in a city (spawned, grown, upgraded or enchanted)
  //   techName – the tribe's own name for the tech (tech = the standard tech in the same tree slot)
  //   skills: fort (city defense bonus), stiff (no retaliation), surprise (no retaliation when it attacks),
  //           explode (half damage to all adjacent enemies, the unit dies; boomOpt = optional instead of a normal attack),
  //           splash, poison, persist, double, freeze, convert, stomp, tentacles … (see PP.SKILL_INFO), noVet (can't become a veteran)
  function u(name, emoji, hp, atk, def, mov, rng, cost, tech, more) {
    var o = { name: name, icon: emoji, hp: hp, atk: atk, def: def, mov: mov, rng: rng, cost: cost, tech: tech };
    if (more) Object.keys(more).forEach(function (k) { o[k] = more[k]; });
    (o.skills || []).forEach(function (k) { o[k] = true; });
    return o;
  }
  var SUPER = { train: false, val: 15, super: true };
  function S(skills, more) { var o = { skills: skills }; if (more) Object.keys(more).forEach(function (k) { o[k] = more[k]; }); return o; }
  function sup(skills, more) { return S(skills.concat(['noVet']), Object.assign({}, SUPER, more || {})); }

  PP.UNITS = {
    // ---- standard units (all regular tribes)
    warrior:    u('Warrior',     '⚔️', 10, 2,   2, 1, 1, 2, null,          S(['fort'])),
    archer:     u('Archer',      '🏹', 10, 2,   1, 1, 2, 3, 'archery',     S(['fort'])),
    defender:   u('Defender',    '🛡️', 15, 1,   3, 1, 1, 3, 'strategy',    S(['fort'])),
    rider:      u('Rider',       '🐎', 10, 2,   1, 2, 1, 3, 'riding',      S(['fort'])),
    swordsman:  u('Swordsman',   '🗡️', 15, 3,   3, 1, 1, 5, 'smithery'),
    catapult:   u('Catapult',    '🪨', 10, 4,   0, 1, 3, 8, 'mathematics', S(['stiff'])),
    knight:     u('Knight',      '🏇', 10, 3.5, 1, 3, 1, 8, 'chivalry',    S(['fort', 'persist'])),
    mindbender: u('Mind Bender', '🔮', 10, 0,   1, 1, 1, 5, 'philosophy',  S(['stiff', 'convert', 'heal'])),
    cloak:      u('Cloak',       '🥷', 5,  2, 0.5, 2, 1, 8, 'diplomacy',   S(['stiff', 'noVet'])),
    dagger:     u('Dagger',      '🔪', 10, 2,   2, 1, 1, null, null,       S(['surprise', 'noVet'], { train: false, val: 2 })),
    giant:      u('Giant',       '🗿', 40, 5,   4, 1, 1, null, null,       sup([])),
    // ---- ships (a land unit that moves into a port becomes a Raft; HP = the carried unit's)
    raft:       u('Raft',        '🛶', null, 0, 1, 2, 0, null, 'fishing',  S(['stiff'], { carry: true, train: false, up: 0 })),
    scout:      u('Scout',       '⛵', null, 2, 1, 3, 2, null, 'sailing',  S([], { carry: true, train: false, up: 5 })),
    rammer:     u('Rammer',      '🚤', null, 3, 3, 3, 1, null, 'ramming',  S([], { carry: true, train: false, up: 5, techName: 'Aquaculture' })),
    bomber:     u('Bomber',      '💣', null, 3, 2, 2, 3, null, 'navigation', S(['stiff', 'splash'], { carry: true, train: false, up: 15 })),
    juggernaut: u('Juggernaut',  '🚢', 40, 4,   4, 2, 1, null, null,       S(['stiff', 'stomp', 'noVet'], { train: false, val: 15, ico: 'juggernaut' })),
    pirate:     u('Pirate',      '🏴‍☠️', 10, 2, 2, 2, 1, null, null,       S(['surprise', 'noVet'], { train: false, val: 2 })),
    dinghy:     u('Dinghy',      '🛶', 5,  2, 0.5, 2, 1, null, null,       S(['stiff', 'noVet'], { train: false, val: 8 })),

    // ---- Aquarion (all land units are amphibious "mermaid" versions)
    mermaid:         u('Mermaid',          '🧜', 10, 2, 2, 1, 1, 2, null,         S(['fort'])),
    mermaidArcher:   u('Mermaid Archer',   '🏹', 10, 2, 1, 1, 2, 3, 'archery',    S(['fort'])),
    mermaidDefender: u('Mermaid Defender', '🛡️', 15, 1, 3, 1, 1, 3, 'strategy',   S(['fort'])),
    amphibian:       u('Amphibian',        '🐸', 10, 2, 1, 2, 1, 3, 'riding',     S(['fort'])),
    swordsmaid:      u('Swordsmaid',       '🗡️', 15, 3, 3, 1, 1, 5, 'smithery',   S([])),
    puffer:          u('Puffer',           '🐡', 10, 4, 0, 2, 3, 8, 'mathematics', S(['stiff'])),
    tridention:      u('Tridention',       '🔱', 10, 2.5, 1, 2, 2, 8, 'chivalry', S(['fort', 'persist'], { techName: 'Spearing' })),
    siren:           u('Siren',            '🔮', 10, 0, 1, 1, 1, 5, 'philosophy', S(['stiff', 'convert', 'heal'])),
    scuba:           u('Scuba',            '🥷', 5,  0, 0.5, 2, 1, 8, 'diplomacy', S(['stiff', 'noVet'])),
    mermaidDagger:   u('Mermaid Dagger',   '🔪', 10, 2, 2, 1, 1, null, null,      S(['surprise', 'noVet'], { train: false, val: 2 })),
    shark:           u('Shark',            '🦈', 10, 3.5, 2, 3, 1, 8, 'sailing',  S(['surprise'], { techName: 'Marine Life' })),
    jelly:           u('Jelly',            '🪼', 20, 2, 2, 2, 1, 8, 'navigation', S(['stiff', 'tentacles', 'noVet'])),
    crab:            u('Crab',             '🦀', 40, 4, 4, 2, 1, null, null,      sup([])),

    // ---- ∑∫ỹriȱŋ (standard units + Polytaur; the Dragon replaces the Giant)
    polytaur:   u('Polytaur',    '🐂', 15, 3, 1, 1, 1, null, 'hunting',   S(['fort', 'noVet'], { train: false, val: 3, techName: 'Forest Magic', note: 'enchant an animal for 3 ★' })),
    dragonEgg:  u('Dragon Egg',  '🥚', 10, 0, 2, 1, 1, null, null,        sup(['fort', 'stiff'], { ico: 'egg' })),
    babyDragon: u('Baby Dragon', '🐉', 15, 3, 3, 2, 1, null, null,        sup([], { ico: 'dragon' })),
    fireDragon: u('Fire Dragon', '🐲', 20, 4, 3, 3, 2, null, null,        sup(['splash'], { ico: 'dragon' })),

    // ---- Polaris
    iceArcher:   u('Ice Archer',   '🏹', 10, 1, 1, 1, 2, 3, 'archery',     S(['fort', 'stiff', 'freeze'], { ico: 'archer' })),
    mooni:       u('Mooni',        '❄️', 10, 0, 1, 1, 1, 5, 'fishing',     S(['stiff', 'autoFreeze', 'noVet'], { techName: 'Frostwork' })),
    battleSled:  u('Battle Sled',  '🛷', 15, 3, 2, 2, 1, 5, 'sailing',     S([], { techName: 'Sledding' })),
    iceFortress: u('Ice Fortress', '🏯', 20, 4, 3, 1, 2, 15, 'navigation', S(['noVet'], { techName: 'Polar Warfare' })),
    gaami:       u('Gaami',        '☃️', 30, 4, 3, 1, 1, null, null,       sup(['autoFreeze'])),

    // ---- Cymanti
    hexapod:      u('Hexapod',       '🪲', 5,  3, 1, 2, 1, 3, 'riding',       S([])),
    kiton:        u('Kiton',         '🐞', 15, 1, 3, 1, 1, 3, 'strategy',     S(['poisonDef'])),
    phychi:       u('Phychi',        '🦟', 5,  0.7, 2, 2, 2, 3, 'archery',    S(['surprise', 'double', 'poison'])),
    mantis:       u('Mantis',        '🦗', 15, 3, 3, 1, 1, 5, 'smithery',     S([])),
    exida:        u('Exida',         '🪨', 10, 3, 1, 2, 3, 8, 'mathematics',  S(['splash', 'poison'])),
    doomux:       u('Doomux',        '🐜', 20, 3.5, 2, 3, 1, 10, 'chivalry',  S(['explode', 'boomOpt', 'noVet'], { techName: 'Shock Tactics' })),
    shaman:       u('Shaman',        '🔮', 10, 1, 1, 1, 1, 5, 'meditation',   S(['convert', 'swarm', 'noVet'], { techName: 'Rituals' })),
    moth:         u('Moth',          '🦋', 10, 2, 0.1, 2, 1, 5, 'diplomacy',  S(['stiff', 'poison', 'noVet'], { techName: 'Synergy' })),
    larva:        u('Larva',         '🐛', 10, 2, 2, 1, 1, null, null,        S(['surprise', 'noVet'], { train: false, val: 2 })),
    insectEgg:    u('Insect Egg',    '🥚', 10, 2, 3, 0, 0, null, null,        S(['stiff', 'explode', 'noVet'], { train: false, val: 2, ico: 'egg' })),
    raychi:       u('Raychi',        '🐟', 10, 3, 2, 3, 1, 5, 'sailing',      S([], { techName: 'Pescetism' })),
    boomchi:      u('Boomchi',       '💥', 10, 3, 3, 2, 0, 5, 'ramming',      S(['stiff', 'explode'], { techName: 'Inflation' })),
    livingIsland: u('Living Island', '🏝️', 20, 4, 4, 2, 1, 20, 'navigation', S(['stomp', 'poison', 'noVet'], { techName: 'Oceanology' })),
    centipede:    u('Centipede',     '🐛', 20, 4, 3, 2, 1, null, null,        sup([])),
    segment:      u('Segment',       '🟤', 10, 2, 2, 1, 1, null, null,        sup(['stiff', 'explode'], { val: 2, ico: 'centipede' })),
  };

  // Value used by the attack optimizer when a unit has no purchase price.
  PP.GIANT_VALUE = 15;

  // Tribes: the four special tribes have their own unit sets, every other tribe uses the standard set.
  // Order = palette order (land, special, ships, super units).
  var STD_LAND = ['warrior', 'archer', 'defender', 'rider', 'swordsman', 'catapult', 'knight', 'mindbender', 'cloak', 'dagger'];
  var STD_SEA = ['raft', 'scout', 'rammer', 'bomber', 'pirate', 'dinghy'];
  PP.TRIBES = [
    { id: 'standard', name: 'Standard', dot: '#9aa5c8', units: STD_LAND.concat(STD_SEA, ['juggernaut', 'giant']),
      title: 'Xin-xi, Imperius, Bardur, Oumaji, Kickoo, Hoodrick, Luxidoor, Vengir, Zebasi, Ai-Mo, Quetzali, Yădakk' },
    { id: 'aquarion', name: 'Aquarion', dot: '#e8a99c', units: ['mermaid', 'mermaidArcher', 'mermaidDefender', 'amphibian', 'swordsmaid', 'puffer', 'tridention',
      'siren', 'scuba', 'mermaidDagger', 'shark', 'jelly', 'crab'] },
    { id: 'elyrion', name: '∑∫ỹriȱŋ', dot: '#c060c8', units: STD_LAND.concat(['polytaur'], STD_SEA, ['dragonEgg', 'babyDragon', 'fireDragon']) },
    { id: 'polaris', name: 'Polaris', dot: '#d8ecf8', units: ['warrior', 'iceArcher', 'defender', 'rider', 'swordsman', 'catapult', 'knight', 'mindbender',
      'cloak', 'dagger', 'mooni', 'battleSled', 'iceFortress', 'gaami'] },
    { id: 'cymanti', name: 'Cymanti', dot: '#b8d040', units: ['warrior', 'phychi', 'kiton', 'hexapod', 'mantis', 'exida', 'doomux', 'shaman', 'moth',
      'larva', 'insectEgg', 'raychi', 'boomchi', 'livingIsland', 'centipede', 'segment'] },
  ];
  PP.TRIBE = {};
  PP.TRIBES.forEach(function (t) { PP.TRIBE[t.id] = t; });
  // unit keys of a tribe (unknown id → standard)
  PP.tribeUnits = function (id) { return (PP.TRIBE[id] || PP.TRIBE.standard).units.filter(function (k) { return PP.UNITS[k]; }); };
  // tribe chosen for a side in the Units tool (state.ui.units.tribe)
  PP.sideTribe = function (side) {
    var p = PP.state && PP.state.ui && PP.state.ui.units, t = p && p.tribe && p.tribe[side === 'enemy' ? 'enemy' : 'me'];
    return PP.TRIBE[t] ? t : 'standard';
  };
  // units the player can train in a city (own tribe)
  PP.myTrainable = function () { return PP.tribeUnits(PP.sideTribe('me')).filter(PP.trainable); };
  // can be trained in a city (shows up in the star planner)
  PP.trainable = function (k) { var x = PP.UNITS[k]; return !!x && x.cost != null && x.train !== false; };
  // land units a ship can carry (its HP comes from them; Cloak/Dagger become Dinghy/Pirate instead)
  PP.carriable = function (k) { var x = PP.UNITS[k]; return !!x && !x.carry && x.hp != null && !x.super && !/^(juggernaut|pirate|dinghy|insectEgg|cloak|dagger)$/.test(k); };
  // skill labels for the unit info line
  PP.SKILL_NAMES = { fort: 'Fortify', stiff: 'Stiff', surprise: 'Surprise', explode: 'Explode', splash: 'Splash', poison: 'Poison',
    poisonDef: 'Poisons attackers', persist: 'Persist', double: 'Double attack', freeze: 'Freeze', autoFreeze: 'Auto freeze', convert: 'Convert',
    heal: 'Heal', swarm: 'Swarm', stomp: 'Stomp', tentacles: 'Tentacles', carry: 'Carry' };
  // what each skill does in the damage calculator (tooltips / info line)
  PP.SKILL_INFO = {
    stiff: 'never strikes back', surprise: 'its attacks get no retaliation', splash: 'also hits the enemies next to the target (half damage)',
    explode: 'explodes: half damage to all adjacent enemies + poison, the unit dies', poison: 'poisons what it hits (defense bonus halved)',
    poisonDef: 'poisons units that attack it', persist: 'may attack again after a kill', double: 'attacks twice',
    freeze: 'no damage – freezes the target (it can\'t strike back)', convert: 'converts the target to your side', fort: 'gets the city defense bonus',
    stomp: 'when it moves next to enemies they take half damage', tentacles: 'enemies moving next to it take half damage first'
  };

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
    { id: 'port',     name: 'Port',           icon: '⚓', cost: 7,  pop: 1, tech: 'fishing',      terrain: ['water'] }, // Path of the Ocean: Fishing, +1 pop
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
