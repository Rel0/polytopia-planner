# Polytopia Planer v2 – Shared Spec

Mobile-first web app (German UI) for planning turns in *The Battle of Polytopia*: the user loads a
screenshot, aligns a tile grid to it, marks units/cities on tiles, draws snapping arrows, plans attacks
(multi-attacker vs multi-target with a clear "attack or not" verdict) and plans what to build with their
stars (incl. city level-up rewards like +5 ★).

v1 (single file, for look & feel reference: dark theme, colors, bottom sheet, toolbar):
`old/index.v1.html`. Reuse its visual style (CSS variables, button styles) — the user liked it.

## Hard constraints
- Must work by double-clicking `index.html` (file://) → **classic `<script>` tags only, no ES modules,
  no build step, no external dependencies**. Everything shared via `window.PP` (each file starts with
  `window.PP = window.PP || {};`).
- Load order (fixed): `js/data.js`, `js/engine.js`, `js/core.js`, `js/combat.js`, `js/build.js`, `js/main.js`.
  `main.js` only calls `PP.app.init()` after all modes registered.
- Phone first (390×844), touch + mouse. Big touch targets. No horizontal overflow.
- German UI texts. Code comments short, English or German.

## Ownership (each agent writes ONLY its files)
| Agent | Files |
|---|---|
| ENGINE | `js/data.js`, `js/engine.js` (pure logic, no DOM) |
| CORE | `index.html`, `css/app.css`, `js/core.js`, `js/main.js` |
| COMBAT | `js/combat.js` |
| BUILD | `js/build.js` |

Test scaffolding/stubs go in `/tmp/<agent>-test/`, never in the project folder.

---------------------------------------------------------------------------------------------------
## Grid model (implemented in CORE as `PP.grid`)
Polytopia uses an isometric diamond grid. Tiles addressed by integer `(c, r)`.
Stored in `PP.state.grid = { ox, oy, ux, uy, vx, vy }` in **image pixel coordinates**:
tile center `(c,r)` = `(ox + c*ux + r*vx, oy + c*uy + r*vy)`.
- `PP.grid.center(c, r)` → `{x, y}` image coords
- `PP.grid.toTile(x, y)` → `{c, r}` nearest tile (invert the 2×2 basis, round)
- `PP.grid.dist(a, b)` → Chebyshev distance `max(|a.c-b.c|, |a.r-b.r|)` (Polytopia moves 8-directionally)
- `PP.grid.corners(c, r)` → 4 image points of the diamond (center ± (u±v)/2)
Defaults: blank board is 1200×1600 with `ox=600, oy=200, u=(60,36), v=(-60,36)`.
For a new screenshot, initial guess: tile width `w = imageWidth/7`, height `h = 0.6*w`,
`u=(w/2,h/2)`, `v=(-w/2,h/2)`, origin at image center; then the calibrate mode opens automatically.

## Shared state `PP.state` (CORE owns load/save; everyone may mutate then call `PP.app.commit()`)
```js
{
  version: 2,
  board: null | 'image' | 'blank',
  grid: { ox, oy, ux, uy, vx, vy },
  units:  [{ id, c, r, side: 'me'|'enemy', type, hp, vet: false, bonus: 1|1.5|4 }],  // type = key of PP.UNITS
  cities: [{ id, c, r, side: 'me'|'enemy', name: '', level: 1, pop: 0, capital: false, walls: false }],
  arrows: [{ c1, r1, c2, r2, color }],            // color: one of PP.ARROW_COLORS
  combat: { attackers: [unitId], targets: [unitId] },   // COMBAT
  build: {                                                // BUILD
    stars: 5, income: 2,
    owned: [techId], planned: [techId],
    unitCounts: { [unitType]: n },
    placements: [{ id, c, r, item }],             // item = PP.ITEMS id, placed on a tile
    rewards: { ['<cityId>:<level>']: rewardId },  // chosen level-up reward
  },
}
```
Persistence: CORE saves `PP.state` to localStorage key `polyplan.v2` (debounced) on every commit; the
screenshot blob goes to IndexedDB (`polyplan` db, store `kv`, key `img`). Missing fields are filled from defaults.

---------------------------------------------------------------------------------------------------
## ENGINE — `js/data.js`, `js/engine.js` (pure functions, unit-testable in node)
Data (values from the Polytopia community wiki; put a comment that they may differ per game version):
- `PP.UNITS[key] = { name, icon, hp, atk, def, mov, rng, cost, tech }` for
  warrior(10,2,2,mov1,rng1,2★), archer(10,2,1,1,2,3★,archery), defender(15,1,3,1,1,3★,strategy),
  rider(10,2,1,2,1,3★,riding), swordsman(15,3,3,1,1,5★,smithery), catapult(10,4,0,1,3,8★,mathematics),
  knight(10,3.5,1,3,1,8★,chivalry), mindbender(10,0,1,1,1,5★,philosophy), giant(40,5,4,1,1,cost null).
  German names + emoji icons like v1.
- `PP.TECHS` = array `{ id, name, tier, parent }` (same 25 techs/German names as v1), `PP.TECH` map.
- `PP.ITEMS` = tile buildings/actions `{ id, name, icon, cost, pop, tech, note? }` (same as v1 ACTIONS:
  fruit 2/+1, hunt 2/+1, fish 2/+1, farm 5/+2, mine 5/+2, lumber 3/+1, clear −1 (gives 1★), road 3,
  port 7, temple 10/+1, windmill 5, forge 5, sawmill 5, market 5, plant 5).
  Adjacency buildings: `adj: { item:'farm', pop:1 }` for windmill, `{ item:'mine', pop:2 }` forge,
  `{ item:'lumber', pop:1 }` sawmill → pop = per adjacent (Chebyshev 1) placement of that item.
- `PP.CITY_REWARDS` keyed by the level the city reaches:
  `2: workshop (+1 ★/Runde) | explorer`, `3: walls (Stadtmauer) | resources (+5 ★ sofort)`,
  `4: popgrowth (+3 👥) | border (Grenze erweitern)`, `5+: park (+1 ★/Runde) | giant (Riese)`.
  Each `{ id, name, icon, desc, effect: { stars?, income?, pop?, walls?, giant? } }`.
- `PP.ARROW_COLORS = ['#ffaa00', '#06d6a0', '#ef476f', '#4cc9f0']`.

Engine (`PP.engine`):
- `maxHp(u)` = base hp + 5 if `u.vet`.
- `attack(att, def, dist)` → `{ dmg, ret, defHp, attHp }` with the Polytopia formula:
  `aF = atk*hp/maxHp(att)`, `dF = def*hp/maxHp(def)*bonus`, `tot = aF+dF`,
  `dmg = round(aF/tot*atk*4.5)`, `ret = round(dF/tot*def*4.5)` only if defender survives and
  attacker is within defender's range at the attack distance. Attack distance = `min(dist, A.rng)`
  (unit moves until in range); `dist == null` → assume `A.rng`. atk 0 → no attack.
- `effectiveBonus(unit, cities)`: if a city is on the unit's tile: walls → 4, else 1.5; otherwise `unit.bonus`.
- `canReach(att, def, dist)`: `dist <= A.mov + A.rng` (ignores terrain) — out-of-reach attackers cannot be assigned.
- `planAttack(attackers, targets, distFn)` → best plan. Each attacker attacks at most once, may stay idle.
  Search over assignments attacker→target|idle; per target pick the best order of its group
  (precompute best result per (target, subset) via permutations; support up to 8 attackers × 4 targets,
  must run < 50 ms). Objective (lexicographic): killed value (unit cost, giant=15) ↑, own units lost ↓,
  own lost value ↓, retaliation damage taken ↓, damage dealt ↑, attackers used ↓.
  Returns:
  ```
  { groups: [{ targetId, order: [attackerId], steps: [{ attackerId, dmg, ret, targetHpAfter, attackerHpAfter, skipped }],
              targetHpAfter, killed }],
    idle: [attackerId], unreachable: [attackerId],
    summary: { kills, killedValue, losses, lostValue, dmgDealt, dmgTaken },
    verdict: { level: 'go'|'risky'|'weak'|'no', title, reason } }
  ```
  Verdict: kills>0 && losses==0 → go "Angreifen!"; kills>0 && killedValue>lostValue → risky
  "Lohnt sich – mit Verlusten"; kills==0 && losses==0 && dmgDealt>dmgTaken → weak "Nur schwächen";
  else no "Nicht angreifen". German reason sentence (e.g. "Du tötest 2 Einheiten ohne Verluste.").
- `techCost(tech, cityCount, owned)` = `tier*cityCount + 4`, with philosophy owned `ceil(base*2/3)`.
- `planEconomy(build, cities)` → full budget incl. city growth:
  - `cityCount` = number of own cities (min 1).
  - Lines: planned techs, unit purchases, placements (each placement's item cost).
  - Placement pop goes to the **nearest own city within Chebyshev distance 2** of the tile (ties → lower index);
    none → `unassigned`. Adjacency buildings count adjacent planned placements of the source item.
  - Level-up simulation per own city: while `pop >= level+1`: `pop -= level+1; level++`, record level-up;
    the chosen reward (`build.rewards['<cityId>:<level>']`) applies immediately: stars → reward stars
    (usable this turn), income → next-turn income, pop → added to that city (may cascade),
    walls → wall flag. Each level-up also gives +1 ★/Runde city income.
  - Returns `{ lines:[{icon,label,cost}], spent, rewardStars, available: stars+rewardStars,
    rest: available-spent, nextIncome, nextTurnStars: max(0,rest)+nextIncome,
    cities: [{ id, level, pop, newLevel, newPop, popGain, needed, levelUps:[{ level, options, chosen }] }],
    unassignedPop, warnings:[string] }`.
- `applyAttack(state, plan)` and `endTurn(state)` are NOT engine's job (UI agents mutate state).

Verify: write node tests in `/tmp/engine-test` (load files with `vm.runInThisContext` after
`globalThis.window = globalThis`): formula examples, retaliation by distance, optimizer correctness
vs brute force on random small cases, performance (8×4 < 50 ms), economy level-up cascade with
resources (+5) and popgrowth rewards.

---------------------------------------------------------------------------------------------------
## CORE — `index.html`, `css/app.css`, `js/core.js`, `js/main.js`
Layout: header (title + ⋯ menu button), full-height map stage (canvas), floating hint pill on top,
floating bottom toolbar, and a bottom panel (`#panel`, max ~45% height, scrollable) whose content is
rendered by the active mode. Bottom sheet (`#sheet`) for editors. Toast.
No tabs anymore — everything lives on the map screen.

Toolbar (mode buttons, in this order): `✋ Karte` (mode `map`), `➕ Setzen` (`place`), `↗️ Pfeil` (`arrow`),
`⚔️ Angriff` (`attack`, from COMBAT), `🏗️ Bauen` (`build`, from BUILD).
⋯ menu (sheet): Neuer Screenshot, Ohne Screenshot (leeres Feld), Raster ausrichten (`calibrate`),
Raster anzeigen an/aus, Einpassen, Alles löschen.

Empty state like v1 (screenshot pick / paste / drag-drop / blank). After loading a screenshot →
mode `calibrate`.

### Mode framework
`PP.modes.register(name, mode)` where mode may implement:
```
{ label, hint,                              // hint text shown in the pill
  onEnter(), onExit(),
  onTap(t)       // t = { c, r, sx, sy, unit, city }  (unit/city on that tile or null)
  onLongPress(t),
  onDrag(phase, t)  // optional: if defined, one-finger drag goes to the mode instead of panning
                    // phase 'start'|'move'|'end'; two-finger pinch/pan always works
  renderPanel(el),  // fill #panel (set innerHTML + attach listeners); called on every refresh
  decorate(obj, kind) → { ring?, label?, labelBg?, dim?, badge?, badgeBg? }   // kind 'unit'|'city'
  drawUnder(ctx, D), drawOver(ctx, D) }      // screen-space drawing hooks, D = PP.draw
```
`PP.modes.set(name)`, `PP.modes.current` (name). `PP.app.commit()` = save + redraw + renderPanel.
`PP.app.refresh()` = redraw + renderPanel (no save).

### Core-provided modes
- `map`: one-finger pan; tap on unit/city → open its editor; panel shows a short overview
  (counts) and quick tips.
- `place`: tap tile → if unit/city there open editor, else open "new" editor at that tile.
  Editor sheet: segmented **Einheit | Stadt**, side (Meine / Gegner).
  Unit: type grid, HP slider ± (max from `PP.engine.maxHp`), Veteran toggle, defense bonus
  (Kein / ×1,5 Wald/Berg / ×4 Mauer). City: name (optional), level stepper 1–8, population stepper
  (0..level), Hauptstadt toggle, Stadtmauer toggle. Buttons Löschen / Abbrechen / Speichern.
  Only one unit and one city per tile (unit may stand on a city tile).
- `arrow`: chess.com-like. Drag from tile to tile; while dragging highlight start & hovered tile
  diamonds and show the snapped preview arrow (tile center → tile center). Release on same tile = nothing.
  Tap on an existing arrow (or on its start tile) deletes it. Panel: color choice (PP.ARROW_COLORS),
  "Alle Pfeile löschen". Arrows drawn semi-transparent, thick, with head, like chess.com.
- `calibrate`: panel explains: "1) Tippe auf die Mitte eines Feldes 2) Tippe auf die Mitte des Feldes rechts
  daneben (gleiche Höhe)". Two taps (raw image positions, not snapped) define tile width & rotation.
  Then panel shows sliders: Feldgröße, Höhe/Breite-Verhältnis (0.45–0.8, default 0.6), and drag
  (one finger) moves the grid. Grid always visible in this mode. "Fertig" → mode `place`.
  Calibration keeps units/cities on their (c,r).

### Rendering (`PP.draw`, screen-space helpers, ctx already scaled for DPR)
`PP.draw.arrow(ctx, p, q, color, pad, width)`, `PP.draw.pill(ctx, x, y, text, bg)`,
`PP.draw.badge(ctx, x, y, text, bg)`, `PP.draw.diamond(ctx, c, r, fill, stroke)`,
`PP.draw.tileIcon(ctx, c, r, icon, label?)` (emoji centered on tile, optional small label),
`PP.board.tileToScreen(c, r)`, `PP.board.tileScreenSize()` → `{w, h}` of one tile in px,
`PP.board.redraw()`, `PP.board.fit()`.
Draw order: background (image or blank green), grid lines (if enabled or calibrate), `mode.drawUnder`,
arrows, cities, units, `mode.drawOver`.
Units: circle (blue `#3a86ff` me / red `#ef476f` enemy), emoji icon, HP pill below, ★ if veteran, small
🛡/🧱 if bonus. Cities: rounded square/house shape in side color, "Lv N" and pop pill "2/3".
Marker size scales with tile size but clamped to 14–24 px radius. Apply `decorate()` from the active mode.

### UI helpers
`PP.ui.toast(msg)`, `PP.ui.openSheet(html, onClick)` / `PP.ui.closeSheet()`, `PP.ui.confirm(msg)`
(may use window.confirm), `PP.ui.esc(str)`.
`PP.util.uid()`. `PP.find.unitAt(c,r)`, `PP.find.cityAt(c,r)`, `PP.find.unit(id)`, `PP.find.city(id)`.

---------------------------------------------------------------------------------------------------
## COMBAT — `js/combat.js` registers mode `attack`
- Panel at entry: big instruction "1. Tippe deine Angreifer (blau) · 2. Tippe die Ziele (rot)" and a button
  **"Alle meine Einheiten in Reichweite"** (selects every own unit that can reach any selected target,
  or if no target yet, all own units).
- Tap own unit → toggle attacker; tap enemy unit → toggle target. Tap empty tile → nothing.
- Uses `PP.engine.planAttack(attackers, targets, distFn)` with `distFn = (a,t) => PP.grid.dist(a,t)`
  and bonus from `PP.engine.effectiveBonus(target, cities)`; recompute on every refresh.
- Panel result: big verdict card (✅ / ⚠️ / 🟡 / ❌ with title + reason, colored), then per target:
  name, HP before → after, 💀 if killed, ordered list of attackers with dmg / retaliation / HP after.
  Idle attackers ("nicht nötig") and unreachable ("zu weit weg") listed. Buttons:
  "Angriff ausführen" (applies the plan to `PP.state.units`: update HPs, remove killed targets and dead
  attackers, clear selection, toast), "Auswahl leeren".
- Map drawing (`drawOver`/`decorate`): rings on selected units (white attackers, gold targets),
  numbered red arrows attacker→assigned target (order number badge), predicted HP pills "15 → 0",
  💀 on killed targets, grey dashed look / ⛔ badge for unreachable, dim unselected units.
- Leaving the mode keeps the selection in state (so it's there when coming back).

## BUILD — `js/build.js` registers mode `build`
- Panel top: sticky budget bar: big "übrig ★" (red if negative), Sterne-jetzt input with ±,
  Einkommen ±, line "Geplant X ★ · Belohnungen +Y ★ · nächste Runde Z ★", progress bar.
- Panel sections as segmented tabs: **Gebäude | Einheiten | Technik | Städte**.
  - Gebäude: grid of PP.ITEMS buttons (icon, name, cost, pop; locked if tech missing → dim with
    "braucht X"; red price if > rest). Tapping an item selects it as **brush**; then tapping map tiles places
    it (tap a placed item again → remove). Placed items drawn on tiles with icon (+ cost label).
    Hint pill reflects the brush ("Tippe Felder für 🌾 Farm (5 ★)").
  - Einheiten: steppers per purchasable unit (locked if tech missing).
  - Technik: tree chips by tier with cost per tier, segmented "Kaufen planen | Erforscht markieren"
    (same behavior as v1: plan only if parent owned/planned, cascade unplan).
  - Städte: every own city with level, pop progress bar (pop/needed) including planned pop gain, and
    for each planned level-up the reward choice chips from PP.CITY_REWARDS (e.g. "💰 Ressourcen +5 ★") →
    stored in `build.rewards`; reward stars appear in the budget immediately. If no own cities marked:
    explain how to add them (➕ Setzen → Stadt) and still allow everything else.
- Map overlay: placed items, city badges "Lv2 → 3 ⬆" for cities that level up, highlight the
  city territory (Chebyshev ≤ 2? keep subtle) of the city that receives pop for the hovered/last placement (optional).
- "Runde beenden" button: applies plan → `stars = nextTurnStars`, planned techs → owned, cities get
  new level/pop (and walls), placements & unit counts & rewards cleared, `income = nextIncome`. Confirm if rest < 0.
- Uses `PP.engine.planEconomy(PP.state.build, PP.state.cities)` and `PP.engine.techCost`.
