#!/usr/bin/env node
// Builds the static landing pages (SEO) from the app's own data (js/data.js, js/icons.js):
//   damage-calculator/  tech-tree/  market-planner/  units/   (+ sitemap.xml)
// Usage: node scripts/build-pages.js   (release.sh runs it before copying to dist/)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://polytopiaplanner.com';
const TODAY = new Date().toISOString().slice(0, 10);

// ---- load the app data (browser scripts) in a sandbox
const sandbox = { window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/data.js', 'js/icons.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const PP = sandbox.window.PP;
const U = PP.UNITS;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (k, px = 22) => '<span class="ic">' + PP.icons.svg(k, px, { stroke: 'rgba(0,0,0,.35)' }) + '</span>';
const techName = k => { const u = U[k]; if (!u.tech) return '–'; const std = PP.TECH[u.tech] ? PP.TECH[u.tech].name : u.tech; return u.techName ? u.techName + ' (' + std + ')' : std; };
const skills = k => Object.keys(PP.SKILL_NAMES).filter(s => U[k][s] && s !== 'carry').map(s => PP.SKILL_NAMES[s]).concat(U[k].noVet || U[k].carry ? ['Static'] : []);
const costTxt = k => { const u = U[k]; if (u.cost != null) return u.cost + ' ★'; if (u.up != null) return u.up ? '+' + u.up + ' ★ upgrade' : 'free (port)'; if (u.super) return 'super unit'; return u.note || 'spawned'; };

const PAGES = [
  { slug: 'damage-calculator', nav: 'Damage Calculator', tool: 'units' },
  { slug: 'tech-tree', nav: 'Tech Tree & Costs', tool: 'cost' },
  { slug: 'market-planner', nav: 'Market Calculator', tool: 'market' },
  { slug: 'units', nav: 'All Units', tool: 'units' },
];

function layout(p, o) {
  const url = SITE + '/' + p.slug + '/';
  const ld = [{
    '@context': 'https://schema.org', '@type': 'WebApplication', name: o.appName, url: url, applicationCategory: 'GameApplication',
    operatingSystem: 'Any (web browser)', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description: o.desc, image: SITE + '/og-image.png', inLanguage: 'en'
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Polytopia Planner', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: o.crumb, item: url }]
  }];
  if (o.faq && o.faq.length) ld.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: o.faq.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1].replace(/<[^>]+>/g, '') } }))
  });
  const nav = PAGES.map(x => `<a href="/${x.slug}/"${x.slug === p.slug ? ' class="on" aria-current="page"' : ''}>${esc(x.nav)}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1c2340">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Polytopia Planner">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
<link rel="stylesheet" href="/css/pages.css?v=3">${o.css ? `\n<link rel="preload" href="/fonts/jost-latin.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="${o.css}">` : ''}
<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld)}</script>
</head>
<body${o.bodyClass ? ` class="${o.bodyClass}"` : ''}>
<div class="top"><div class="in">
  <a class="brand" href="/"><img src="/icons/icon-192.png" alt="" width="28" height="28"><span>Polytopia Planner</span></a>
  <nav class="nav" aria-label="Pages">${nav}<a class="app" href="/?tool=${p.tool}">Open app</a></nav>
</div></div>
<main>
${o.body}
${o.faq && o.faq.length ? `<section id="faq"><h2>FAQ</h2>${o.faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${f[1]}</p></details>`).join('')}</section>` : ''}
<section><h2>More Polytopia tools</h2><ul class="chips">${PAGES.filter(x => x.slug !== p.slug).map(x => `<li><a href="/${x.slug}/">${esc(x.nav)}</a></li>`).join('')}<li><a href="/">Polytopia Planner app</a></li></ul></section>
</main>
<footer><div class="in">
  <nav aria-label="Footer">${PAGES.map(x => `<a href="/${x.slug}/">${esc(x.nav)}</a>`).join('')}<a href="/">App</a><a href="/privacy.html">Privacy</a><a href="https://github.com/Rel0/polytopia-planner">GitHub</a></nav>
  Free, unofficial fan tool – not affiliated with or endorsed by Midjiwan AB. “The Battle of Polytopia” is a trademark of Midjiwan AB.
  Unit data from the community wiki, last checked ${TODAY}.
</div></footer>
${o.scripts || ''}
</body>
</html>
`;
}

function hero(h1, lead, tool, ctaText, extra) {
  return `<div class="hero"><h1>${h1}</h1><p class="lead">${lead}</p>
<div class="ctas"><a class="cta" href="/?tool=${tool}">${ctaText} →</a>${extra || ''}</div>
<p class="note">Free · no sign-up · works on phone, tablet and desktop · your screenshots stay on your device</p></div>`;
}

// low-poly horizon for the damage calculator's sky: grey / white mountains and green hills (drawn here, no game art)
function horizon() {
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, r1 = v => Math.round(v * 10) / 10;
  let s = '';
  for (let i = -1; i < 9; i++) {
    const x = i * 75 + rnd() * 30, w = 90 + rnd() * 60, h = 45 + rnd() * 40, b = 110;
    s += `<path d="M${r1(x)} ${b}L${r1(x + w / 2)} ${r1(b - h)}L${r1(x + w / 2)} ${b}Z" fill="#c9ced6"/><path d="M${r1(x + w / 2)} ${r1(b - h)}L${r1(x + w)} ${b}L${r1(x + w / 2)} ${b}Z" fill="#aab1bb"/>`;
    s += `<path d="M${r1(x + w / 2)} ${r1(b - h)}L${r1(x + w / 2 - w * .12)} ${r1(b - h * .72)}L${r1(x + w / 2)} ${r1(b - h * .78)}L${r1(x + w / 2 + w * .12)} ${r1(b - h * .72)}Z" fill="#f4f6f8"/>`;
  }
  const g = ['#7bd54a', '#68c43f', '#8fe05a', '#5fb53a'];
  for (let i = -1; i < 8; i++) { const x = i * 90 + rnd() * 40, w = 140 + rnd() * 60, h = 18 + rnd() * 20; s += `<path d="M${r1(x)} 110L${r1(x + w * .45)} ${r1(110 - h)}L${r1(x + w)} 110Z" fill="${g[i & 3]}"/>`; }
  return `<svg viewBox="0 0 600 110" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`;
}

// ======================================================================== battle calculator
function battlePage(p) {
  const KIND = [['None', '×1'], ['Forest (Archery)', '×1.5'], ['Mountain (Climbing)', '×1.5'], ['Water / ocean (Aquatism)', '×1.5'], ['City (units with Fortify)', '×1.5'], ['City Wall (units with Fortify)', '×4']];
  const skillRows = [
    ['Splash', 'Bomber, Fire Dragon', 'Every enemy next to the target takes half of the damage it would take from a normal hit – not rounded, so a unit can end up with x.5 HP.'],
    ['Splash + Poison', 'Exida', 'The target is hit and poisoned, the enemies next to it are poisoned (no damage).'],
    ['Explode', 'Boomchi, Doomux, Segment, Insect Egg', 'Half damage (not rounded) to every adjacent enemy, poisons them – the exploding unit dies.'],
    ['Poison', 'Phychi, Exida, Moth, Living Island; Kiton poisons its attackers', 'A poisoned unit’s defense bonus is halved (×1 → 0.5, ×1.5 → 0.7, wall ×4 → 2) – later attacks deal more damage.'],
    ['Freeze', 'Ice Archer', 'No damage, but the target is frozen and can’t strike back.'],
    ['Convert', 'Mind Bender, Siren, Shaman', 'The target switches sides (the Shaman deals damage first).'],
    ['Double attack', 'Phychi', 'Attacks twice per turn.'],
    ['Stiff', 'Catapult, Mind Bender, Bomber, Jelly, Puffer …', 'Never strikes back.'],
    ['Surprise', 'Dagger, Pirate, Shark, Phychi, Larva', 'Its attacks never get retaliation.'],
    ['Tentacles', 'Jelly', 'Melee units that move next to it are hit first.'],
    ['Stomp', 'Juggernaut, Living Island', 'Damages adjacent enemies when it moves.'],
    ['Persist', 'Knight, Tridention', 'May attack again after a kill.'],
  ];
  const faq = [
    ['How is damage calculated in Polytopia?', 'attackForce = attack × HP / max HP; defenseForce = defense × HP / max HP × defense bonus. Damage = round(attackForce / (attackForce + defenseForce) × attack × 4.5). If the defender survives and the attacker is within its range, it strikes back with round(defenseForce / total × defense × 4.5).'],
    ['How does splash damage work in Polytopia?', 'Units with Splash (Bomber, Fire Dragon) also hit every enemy next to the target. Each of them takes half the damage a normal hit would deal to it, without rounding – an odd damage leaves the unit at x.5 HP. The Exida’s splash only poisons the neighbours.'],
    ['How much damage does an explosion do?', 'Exploding units (Boomchi, Doomux, Segment, Insect Egg) deal half of their normal damage to every adjacent enemy and poison them. The exploding unit dies.'],
    ['What does poison do in Polytopia?', 'Poison halves the defense bonus of the unit (×1 becomes 0.5, ×1.5 becomes 0.7, a city wall ×4 becomes 2), so it takes more damage. It also prevents healing until the unit recovers.'],
    ['Does a unit in a forest always get a defense bonus?', 'No. The ×1.5 bonus on Forest needs Archery, on Mountain Climbing and on Water / ocean Aquatism – for the tribe of the defending unit. Without that tech the unit fights with ×1. In the calculator above, tap the defender and tick or untick “Has Archery” (or Climbing / Aquatism) to compare both results.'],
    ['Which units get the city defense bonus?', 'Only units with the Fortify skill (e.g. Warrior, Archer, Defender, Rider, Knight). A Giant, Swordsman or Catapult gets no bonus in a city, but still gets terrain bonuses.'],
    ['Does the calculator work for all tribes?', 'Yes – all 55 current units, including ships and the special tribes Aquarion, ∑∫ỹriȱŋ, Polaris and Cymanti. Pick the tribe in the menu above the unit list.'],
    ['How does the calculator find the best attack order?', 'Every attacker attacks once. The calculator tries how to split your units over the enemies and in which order they attack – splash first if it weakens the neighbours, the next unit on another enemy if a target is already dead. “Sort by” sets what counts most: most kills, most damage, no own losses or fewest attacks. “Custom” uses only the attacks you choose, in your order.'],
  ];
  const body = `<div class="sky"><h1><span>Polytopia</span>Damage Calculator</h1>
<p>Any number of attackers and defenders – splash, terrain, tech and the best attack order.</p>${horizon()}</div>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol></defs></svg>
<section id="calculator" aria-label="Damage calculator"><div id="calc" class="calc"><noscript>Please turn on JavaScript to use the calculator.</noscript></div></section>
` + `
<section><h2>On your own screenshot</h2><ol class="steps">
<li><b>Add a screenshot</b><span>Take a screenshot in Polytopia and open it – the tiles, units and cities are detected automatically.</span></li>
<li><b>Place units</b><span>Pick your tribe and the enemy’s, then tap tiles to place units. Set HP, veteran, poisoned or frozen.</span></li>
<li><b>Battle</b><span>Tap your attackers in order, then the target: damage, retaliation, splash and kills appear instantly.</span></li>
</ol></section>
<section id="formula"><h2>Polytopia damage formula</h2>
<p>The calculator uses the community-verified combat formula from the Polytopia wiki:</p>
<pre>attackForce  = attack  × attackerHP / attackerMaxHP
defenseForce = defense × defenderHP / defenderMaxHP × defenseBonus
total        = attackForce + defenseForce
damage       = round(attackForce  / total × attack  × 4.5)
retaliation  = round(defenseForce / total × defense × 4.5)   (only if the defender survives and is in range)</pre>
<p>A veteran has +5 max HP. Ships (Raft, Scout, Rammer, Bomber) use the HP of the unit they carry.</p>
<h3>Defense bonus</h3>
<div class="tw"><table><thead><tr><th>Where the defender stands</th><th class="n">Bonus</th></tr></thead><tbody>
${KIND.map(k => `<tr><td>${esc(k[0])}</td><td class="n">${k[1]}</td></tr>`).join('')}
</tbody></table></div></section>
<section><h2>Unit skills in battle</h2><p>The calculator also handles the special abilities that change a fight:</p>
<div class="tw"><table><thead><tr><th>Skill</th><th>Units</th><th>Effect</th></tr></thead><tbody>
${skillRows.map(r => `<tr><td><b>${esc(r[0])}</b></td><td class="sk">${esc(r[1])}</td><td class="sk">${esc(r[2])}</td></tr>`).join('')}
</tbody></table></div></section>`;
  return layout(p, {
    title: 'Polytopia Damage Calculator – Terrain, Tech & Screenshot (all units)',
    desc: 'Free Polytopia damage calculator: put any number of attackers and defenders on a small battlefield and get the best attack order – damage, retaliation, splash, terrain and the tech for the defense bonus, for all units.',
    appName: 'Polytopia Damage Calculator', crumb: 'Damage Calculator', body, faq, bodyClass: 'sun', css: '/css/dmg.css?v=1',
    scripts: '<script src="/js/data.js?v=1"></script>\n<script src="/js/engine.js?v=1"></script>\n<script src="/js/dmgpage.js?v=1"></script>'
  });
}

// ======================================================================== tech tree + costs
function techPage(p) {
  const N = [1, 2, 3, 4, 5, 6, 8, 10];
  const tc = (tier, n, phil) => { const b = tier * n + 4; return phil ? Math.ceil(b * 2 / 3) : b; };
  const train = PP.tribeUnits('standard').filter(PP.trainable);
  const items = PP.ITEMS;
  // what a tech unlocks: standard units (incl. ships), buildings / actions, defense bonus
  const BONUS = { archery: 'Forest defense', climbing: 'Mountain defense', aquatism: 'Water defense' };
  const unlocks = id => {
    const l = [];
    PP.tribeUnits('standard').filter(k => U[k].tech === id).forEach(k => l.push(icon(k, 18) + esc(U[k].name)));
    items.filter(it => it.tech === id).forEach(it => l.push(esc(it.name)));
    if (BONUS[id]) l.push(esc(BONUS[id]));
    return l;
  };
  const kids = id => PP.TECHS.filter(t => t.parent === id);
  const node = t => `<div class="tt t${t.tier}"><b>${esc(t.name)}<small>tier ${t.tier}</small></b>${unlocks(t.id).length ? `<span>${unlocks(t.id).join('<br>')}</span>` : ''}</div>`;
  const tree = PP.TECHS.filter(t => !t.parent).map(r => `<div class="tb"><div class="tr">${node(r)}</div><div class="tk">${kids(r.id).map(c => `<div class="tc">${node(c)}${kids(c.id).map(node).join('')}</div>`).join('')}</div></div>`).join('');
  const faq = [
    ['What does the Polytopia tech tree look like?', 'There are five tier 1 techs – Climbing, Fishing, Hunting, Organization and Riding. Each one leads to two tier 2 techs, and each tier 2 tech to one tier 3 tech: 25 technologies in total.'],
    ['How much does a technology cost in Polytopia?', 'Tech cost = tier × number of cities + 4 stars. Tier 1 techs (e.g. Riding, Fishing) are cheapest, tier 3 techs (e.g. Chivalry, Mathematics) the most expensive.'],
    ['Why do techs get more expensive?', 'Every city you own increases the price of every tech by its tier: with 5 cities a tier 3 tech costs 3 × 5 + 4 = 19 stars instead of 7.'],
    ['Does Philosophy make techs cheaper?', 'Yes – after Philosophy (Literacy) all techs cost about one third less. The star planner applies it automatically when you mark Philosophy as researched.'],
    ['Do special tribes have a different tech tree?', 'Aquarion, ∑∫ỹriȱŋ, Polaris and Cymanti replace some techs with their own (e.g. Polaris Frostwork instead of Fishing). They sit in the same place in the tree and cost the same.'],
  ];
  const body = hero('Polytopia Tech Tree &amp; Tech Costs', 'All 25 technologies with what they unlock, the cost of every tech for your number of cities – and a free star planner for your next turn.',
    'cost', 'Open the Star &amp; Tech Planner') + `
<section id="tree"><h2>Polytopia tech tree</h2><p class="muted">Five branches, from tier 1 (left / top) to tier 3. Under each tech: the units, buildings and bonuses it unlocks.</p>
<div class="ttree">${tree}</div></section>
<section id="costs"><h2>Tech cost formula</h2>
<pre>tech cost = tier × number of cities + 4      (after Philosophy: about −33 %)</pre>
<div class="tw"><table><thead><tr><th>Cities</th>${N.map(n => `<th class="n">${n}</th>`).join('')}</tr></thead><tbody>
${[1, 2, 3].map(t => `<tr><td><b>Tier ${t}</b></td>${N.map(n => `<td class="n">${tc(t, n)} ★</td>`).join('')}</tr>`).join('')}
${[1, 2, 3].map(t => `<tr><td class="muted">Tier ${t} + Philosophy</td>${N.map(n => `<td class="n muted">${tc(t, n, 1)} ★</td>`).join('')}</tr>`).join('')}
</tbody></table></div></section>
<section><h2>Unit costs</h2>
<div class="tw"><table><thead><tr><th>Unit</th><th class="n">Cost</th><th>Needs</th></tr></thead><tbody>
${train.map(k => `<tr><td class="u">${icon(k)}${esc(U[k].name)}</td><td class="n">${U[k].cost} ★</td><td>${esc(techName(k))}</td></tr>`).join('')}
</tbody></table></div><p class="muted">Special tribes have their own units – see <a href="/units/">all units and costs</a>.</p></section>
<section><h2>Building &amp; action costs</h2>
<div class="tw"><table><thead><tr><th>Building / action</th><th class="n">Cost</th><th class="n">Population</th><th>Needs</th></tr></thead><tbody>
${items.map(it => `<tr><td>${esc(it.name)}</td><td class="n">${it.cost < 0 ? '+' + (-it.cost) + ' ★' : it.cost + ' ★'}</td><td class="n">${it.pop ? '+' + it.pop : it.adj ? 'see note' : '–'}</td><td class="sk">${esc((PP.TECH[it.tech] || {}).name || '')}${it.note ? ' · ' + esc(it.note) : ''}</td></tr>`).join('')}
</tbody></table></div></section>`;
  return layout(p, {
    title: 'Polytopia Tech Tree & Tech Costs – All 25 Techs, Unlocks & Star Planner',
    desc: 'The complete Polytopia tech tree: all 25 technologies, what they unlock and how much each tech costs for your number of cities. Plus a free star planner.',
    appName: 'Polytopia Tech Tree & Star Planner', crumb: 'Tech Tree & Costs', body, faq
  });
}

// ======================================================================== market planner
function marketPage(p) {
  const faq = [
    ['How do markets work in Polytopia?', 'A Market earns stars every turn: one per level of each Windmill, Forge and Sawmill next to it (the 8 surrounding tiles), up to 8 stars per turn.'],
    ['What is the market range in Polytopia?', 'The Market only counts the workshops on the 8 tiles directly around it. A Windmill, Forge or Sawmill two tiles away adds nothing.'],
    ['How do I get a level 8 market?', 'Surround the Market with high-level workshops: Windmills next to many Farms, Forges next to many Mines, Sawmills next to many Lumber Huts. The Market Planner tries every layout in your territory and shows the best one.'],
    ['What does the Market Planner need?', 'Load a screenshot, tap your cities, paint what is on each tile (field, forest, mountain, crops, metal …) and press Plan. It finds the layout with the most stars per turn and the lowest cost.'],
  ];
  const body = hero('Polytopia Market Calculator &amp; Planner', 'Find the Market layout with the most stars per turn: the planner tries every position for Market, Windmill, Forge and Sawmill in your territory – including clearing, burning or growing forest.',
    'market', 'Open the Market Calculator') + `
<section><h2>How markets work</h2>
<div class="grid2">
<div class="card"><b>Market</b><span>Earns ★ per turn = the levels of the Windmills, Forges and Sawmills on the 8 tiles around it – max. 8 ★ per turn.</span></div>
<div class="card"><b>Windmill · Forge · Sawmill</b><span>Level = number of adjacent Farms, Mines or Lumber Huts. One of each per city, built on empty land.</span></div>
<div class="card"><b>Farm · Mine · Lumber Hut</b><span>Farms need crops, Mines need metal on a mountain, Lumber Huts need a forest.</span></div>
<div class="card"><b>Terrain changes</b><span>Clear Forest (+1 ★), Burn Forest (field with crop) and Grow Forest can create better layouts – the planner can use them.</span></div>
</div></section>
<section><h2>How to use the Market Planner</h2><ol class="steps">
<li><b>Cities</b><span>Load a screenshot and tap your cities – their territory is marked automatically.</span></li>
<li><b>What’s here</b><span>Paint fields, forests, mountains, crops, metal and existing buildings.</span></li>
<li><b>Plan</b><span>The calculator shows the best layout, its stars per turn, the cost and the steps to build it.</span></li>
</ol></section>`;
  return layout(p, {
    title: 'Polytopia Market Calculator & Planner – Best Market Layout',
    desc: 'Free Polytopia market calculator: finds the Market, Windmill, Forge and Sawmill layout with the most stars per turn in your territory. Plus: how markets work.',
    appName: 'Polytopia Market Calculator', crumb: 'Market Calculator', body, faq
  });
}

// ======================================================================== units
function unitsPage(p) {
  const NAMES = { standard: 'Standard tribes', aquarion: 'Aquarion units', elyrion: '∑∫ỹriȱŋ (Elyrion) units', polaris: 'Polaris units', cymanti: 'Cymanti units' };
  const shown = new Set();
  const groups = PP.TRIBES.map(t => {
    let list = PP.tribeUnits(t.id);
    if (t.id !== 'standard') list = list.filter(k => !PP.tribeUnits('standard').includes(k));
    let sea = [];
    if (t.id === 'standard') { sea = list.filter(k => U[k].carry || /^(juggernaut|pirate|dinghy)$/.test(k)); list = list.filter(k => !sea.includes(k)); }
    list.forEach(k => shown.add(k));
    return { t, list, sea };
  });
  const table = list => `<div class="tw"><table><thead><tr><th>Unit</th><th class="n">Cost</th><th class="n">HP</th><th class="n">Atk</th><th class="n">Def</th><th class="n">Move</th><th class="n">Range</th><th>Skills</th><th>Tech</th></tr></thead><tbody>
${list.map(k => { const u = U[k]; return `<tr><td class="u">${icon(k)}${esc(u.name)}</td><td class="n">${esc(costTxt(k))}</td><td class="n">${u.hp == null ? 'carried' : u.hp}</td><td class="n">${u.atk}</td><td class="n">${u.def}</td><td class="n">${u.mov}</td><td class="n">${u.rng}</td><td class="sk">${esc(skills(k).join(', ') || '–')}</td><td>${esc(techName(k))}</td></tr>`; }).join('')}
</tbody></table></div>`;
  const count = Object.keys(U).length;
  const faq = [
    ['How many units are there in Polytopia?', `The planner knows all ${count} current unit types: the standard land units, ships (Raft, Scout, Rammer, Bomber, Juggernaut, Pirate, Dinghy), super units and the special units of Aquarion, ∑∫ỹriȱŋ, Polaris and Cymanti.`],
    ['Which tribes have different units?', 'Only the four special tribes: Aquarion (amphibious mermaid units, Shark, Puffer, Jelly, Crab), ∑∫ỹriȱŋ (Polytaur and the Dragon), Polaris (Ice Archer, Mooni, Battle Sled, Ice Fortress, Gaami) and Cymanti (Hexapod, Phychi, Kiton, Doomux, Centipede …). All other tribes share the standard units.'],
    ['How do ships get their HP?', 'Raft, Scout, Rammer and Bomber have the HP of the unit they carry – a Swordsman on a Bomber has 15 HP (20 as a veteran).'],
    ['What does Static mean?', 'Static units can’t become veterans – ships, super units, Daggers, Pirates and other units that aren’t trained in a city.'],
  ];
  const body = hero(`All Polytopia Units – Stats &amp; Skills`, `Cost, HP, attack, defense, movement, range and skills of all ${count} units – standard tribes, ships, Aquarion, ∑∫ỹriȱŋ, Polaris and Cymanti. Try any matchup in the damage calculator.`,
    'units', 'Try them in the Damage Calculator') + `
<ul class="chips" style="margin-top:22px">${groups.map(g => `<li><a href="#${g.t.id}">${esc(NAMES[g.t.id])}</a></li>`).join('')}<li><a href="#ships">Ships</a></li></ul>
${groups.map(g => `<section id="${g.t.id}"><h2>${esc(NAMES[g.t.id])}</h2>${g.t.id === 'standard' ? `<p class="muted">${esc(g.t.title)}</p>` : `<p class="muted">Plus the standard units it shares: ${PP.tribeUnits(g.t.id).filter(k => PP.tribeUnits('standard').includes(k)).map(k => U[k].name).join(', ') || 'none – all Aquarion units are their own (amphibious) versions'}.</p>`}
${table(g.list)}</section>${g.sea.length ? `<section id="ships"><h2>Ships (naval units)</h2><p class="muted">A land unit that moves into a port becomes a Raft; upgrade it to Scout, Rammer or Bomber. Giants become a Juggernaut, Daggers a Pirate, Cloaks a Dinghy.</p>${table(g.sea)}</section>` : ''}`).join('\n')}`;
  return layout(p, {
    title: `Polytopia Units – All ${count} Units, Stats & Skills (Cymanti, Polaris, Aquarion)`,
    desc: `Complete Polytopia unit list: cost, HP, attack, defense, movement, range and skills of all ${count} units incl. ships and the Aquarion, ∑∫ỹriȱŋ, Polaris and Cymanti special units.`,
    appName: 'Polytopia Units & Battle Calculator', crumb: 'All Units', body, faq
  });
}

// ======================================================================== write
const BUILD = { 'damage-calculator': battlePage, 'tech-tree': techPage, 'market-planner': marketPage, units: unitsPage };
for (const p of PAGES) {
  const dir = path.join(ROOT, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), BUILD[p.slug](p));
}
const urls = [['/', '1.0']].concat(PAGES.map(p => ['/' + p.slug + '/', '0.9']), [['/privacy.html', '0.2']]);
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${SITE}${u[0]}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${u[1]}</priority>
  </url>`).join('\n')}
</urlset>
`);
console.log('pages built:', PAGES.map(p => '/' + p.slug + '/').join(' '));
