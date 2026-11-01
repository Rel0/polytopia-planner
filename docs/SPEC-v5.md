# Polytopia Planer v5 – "Welt": rebuild the screenshot as an own 2D world, verify it, play in it
(extends SPEC.md, SPEC-v3.md, SPEC-v4.md — read those first; they stay valid unless changed here)

User request (German, verbatim essentials): "baue es in 2D. Wichtig sind: die Richtigkeit der Felder/Figuren und dass
es extrem einfach ist, das sicherzustellen + direkt eingebaut der Damage Calculator. Wenn ich z. B. ein Pferd neben
einen Gegner ziehe und dort schlage, sollte es möglich sein, den Damage zu sehen und das Pferd dann wieder weg zu
bewegen. Es sollte dennoch einen Modus zum Pfeile zeichnen geben."

Real test screenshot: `/tmp/poly-v5/sample.jpeg` (738×1600, data only). Auto grid: tile width 76.475, ratio 0.6.
Local unit detection finds all 17 units there (12 enemy blue, 5 own brown). Own (user) tribe = brown.

## Key architecture decision
The world is drawn **in the same image coordinate system / grid** as the screenshot (tile (c,r) center =
`PP.grid.center(c,r)`, diamond = `PP.grid.corners(c,r)`). The screenshot layer is just replaced (or blended) by a
rendered world layer. Therefore all existing infrastructure keeps working unchanged on the world: gestures, zoom,
arrows mode, unit/city markers, editor, quick picker, build mode, calibrate. 2D isometric diamonds, same 0.6 ratio
as the game, so the world looks like the screenshot's layout.

## State (additive)
`PP.state.tiles['c,r']` (exists from v3 BUILD: `{terrain, res}`) is extended and becomes the world map:
```
{ terrain: 'field'|'forest'|'mountain'|'water'|'ocean'|'cloud',
  res: [resourceId], bld: itemId|null,          // existing building on the tile (farm, mine, lumber, ...)
  road: false, owner: [r,g,b]|null,             // territory owner colour (optional, from borders)
  conf: 0..1, src: 'auto'|'ai'|'user' }          // 'user' = confirmed/edited, never overwritten by detection
```
Only tiles that are part of the map exist (space/background outside the map → no entry).
`PP.state.world = { built: bool, view: 'world'|'image'|'blend', blend: 0..1, freeMove: false,
  turn: n, moved: {unitId: {moved:bool, attacked:bool}}, history: [...] }` (history may live in memory only).
Units/cities as before (+ v4 `src/conf/color`). Cities gain optional `color`, `conf`, `src`.

## Ownership
| Agent | Files |
|---|---|
| WORLD | `index.html`, `css/app.css`, `js/core.js` (hooks/toolbar/view toggle only), `js/vision.js` (tile + city detection), new `js/world.js` (build + render) |
| VERIFY | new `js/verify.js` (mode `verify`) |
| PLAY | new `js/rules.js` (movement/attack rules), new `js/play.js` (mode `play`), `js/combat.js` (expose/reuse the damage popup) |

Script order (WORLD edits index.html): `data, engine, vision, ai, core, world, combat, build, verify, rules, play, main`.
VERIFY and PLAY must register their modes at load time; WORLD's toolbar must cope with missing modes (toast).

---------------------------------------------------------------------------------------------------
## WORLD
### Building the world — `PP.world.build({ keepUser: true })`
After the grid is confirmed (and on menu "🗺️ Welt neu erkennen"):
- For every tile whose diamond lies (mostly) inside the image: classify via sampled pixels → terrain or
  'outside' (black space / UI). Reuse/port the tuned heuristic from `js/build.js` (`guessTerrain`, 98/98 on the
  sample; also exposed as `PP.build.guessTerrain`). Put the shared classifier in `PP.vision.classifyTile(pixels)`
  returning `{ terrain|'outside', conf }`. Exclude the header/UI areas (top score bar, bottom buttons).
- Cities: detect city name plates (rounded rectangles in tribe colour with white text, below the city) →
  city on the tile above the plate; colour = plate colour; `level` unknown → 1 with low conf. Tune on the sample
  (it has ~10 cities: Urkan, Anurk, Merark, Kaezaz, Kiai (own, brown plates) and Piico, Sumpi, Rote, Mores, Malusres,
  Ipma (enemy, blue plates)). Report recall.
- Units: existing `PP.vision.detectUnits` + `PP.recog.applyDetections`.
- Optional (nice to have, low priority): roads, territory owner from border colours, resources via simple colour
  blobs (fruit = pink/purple clusters, crops = field rows). Mark everything uncertain with low `conf`.
- Never overwrite `src:'user'` tiles/units/cities. Commit + toast "Welt erkannt: N Felder, M Städte, K Figuren".

### Rendering — background provider
Add to core a background hook: `PP.board.setBackground(fn)` / the board draws, in image coordinates (inside the
existing translate/scale), either the screenshot, the world, or both blended per `world.view` / `world.blend`.
World style (own simple vector art, no game assets): flat diamond fill per terrain with subtle edge lines;
forest = 2–3 dark-green triangle trees; mountain = grey peak with white cap; water light blue, ocean darker blue
with tiny waves; cloud = pale grey with soft pattern; field = light green (tint by owner colour if known).
Resources/buildings: small emoji (🍒🌾🦌💎🐟 / 🏠🪵⛏️ …) on the tile. Cities: house icon block, level number,
name label, owner colour. Territory borders in owner colour (if known). Draw with `PP.grid.corners` per tile;
cache to an offscreen canvas and redraw only when tiles change (must stay smooth while panning on a phone).
Unit markers stay as core draws them; use `unit.color` (tribe colour) for the marker ring when present.

### Toolbar / header (core.js)
Toolbar modes: `🔍 Prüfen` (verify), `🎮 Spielen` (play), `↗️ Pfeil` (arrow), `🏗️ Bauen` (build). Keep the old
`map`, `place`, `attack` modes registered (reachable via menu "Weitere Werkzeuge"), not on the toolbar.
Header: view toggle button cycling 🗺️ Welt / 🖼️ Bild / ◐ Überblendet. Default view after building: world.
After a fresh screenshot: grid confirm (v3) → `PP.world.build()` → mode `verify`.

---------------------------------------------------------------------------------------------------
## VERIFY — mode `verify` (the "extremely easy correctness" part)
- Panel top: summary "210 Felder · 11 Städte · 17 Figuren — 9 unsicher", big button **"Unsichere durchgehen ▶"**,
  blend slider (Welt ⟷ Bild) that sets `world.view='blend'` + `world.blend` live, "🤖 KI-Erkennung" (PP.ai) button,
  "Fertig → Spielen".
- Tap any tile → **inspector sheet**: left: zoomed crop of the original screenshot around that tile (≈ 2×2 tiles
  context, tile outlined), right: what the world has. Big chips to fix in one tap: terrain, resources, building,
  road; city (none/own/enemy, level, name); unit (none / type grid / side / HP ± / veteran). Changes set
  `src:'user'`, `conf:1`, commit, and the world redraws. Use `PP.ui.openSheet`. Crop: `PP.board.image` + grid.
- **Review queue**: all items with `conf < 0.6` (tiles, cities, units), sorted top-left → bottom-right. One item at a
  time: map pans/zooms to it, it pulses, compact card shows crop + recognised value + **"✓ Stimmt"** (sets
  conf 1, src user, next) / **"Ändern"** (opens inspector) / "Überspringen". Progress "3 / 9". Done → toast + suggest Spielen.
- Units detected locally have unknown type (warrior default, conf 0.4) → they are in the queue; the card for a unit
  shows the unit type grid directly (one tap = set type + confirm + next). Same for city level (1–6 chips).
- Must work on phone 390×844; keep the map visible above the card.

---------------------------------------------------------------------------------------------------
## PLAY — `js/rules.js` + mode `play` (+ combat.js)
### Rules (`PP.rules`, pure, testable in node)
- `reachable(unit, state)` → Map 'c,r' → { cost, path } for this turn. Polytopia-like, simplified:
  8-directional steps cost 1 movement point (`UNITS[t].mov`); entering forest ends the move (unless road→road);
  mountain needs tech 'climbing' (in `build.owned`, or assume known if `build.owned` is empty — make a setting)
  and ends the move; road→road step costs 0.5; water/ocean/cloud/outside impassable for land units; tiles with
  any unit blocked; **zone of control**: entering a tile adjacent to an enemy unit ends the move.
- `attackable(unit, state)` → enemy units with `dist ≤ rng` from the unit's (current or hypothetical) tile.
- Skills (add to data via rules.js, don't edit data.js): dash (attack after moving): warrior, archer, rider,
  swordsman, knight, defender?; catapult/mindbender cannot attack after moving; escape (rider: may move after
  attacking); persist (knight: may attack again after a kill). Melee attacker moves into the tile of a killed enemy.
- Uses `PP.engine.attack` + `effectiveBonus` for damage.

### Mode `play`
- Tap own unit → selected: reachable tiles highlighted (soft fill), attackable enemies get a **damage preview
  badge** directly on the map ("−6 · ↩4", 💀 if it would die) computed from the unit's *current* tile.
- Tap highlighted tile → move (short slide animation), update previews from the new tile.
- Tap enemy in range → **damage popup** (reuse the v4 combat popup: export it from combat.js as
  `PP.combat.popup.show({ attackers:[ids], targetId, onAttack, onClose })` or similar) with dmg dealt / retaliation /
  HP after; button **"⚔️ Angreifen"** executes (HP updates, death removal, melee moves in). Multi-attacker: optional
  "＋ weitere Angreifer" (tap own units to add) → sequential like v4.
- **Undo is central**: big "↶ Rückgängig" button (each action = snapshot of units/cities/tiles/world.moved),
  "↺ Zurück zum Ausgangszustand" (state right after verify). Undo after attacking restores HP and position —
  exactly the "Pferd wieder wegziehen" flow.
- "Freies Ziehen" toggle: ignore movement rules and once-per-turn limits (any tile, any number of moves).
- Moved/attacked units are dimmed slightly; "Runde beenden" resets `world.moved`, increments turn
  (stars via `PP.engine.planEconomy` / build state is optional here).
- Enemy units can also be moved/attack when the user taps "Gegner-Zug" toggle (play both sides) — optional.
- Panel: compact status ("🐎 Reiter · 2 Bewegung · kann angreifen"), buttons Rückgängig / Freies Ziehen /
  Runde beenden, hint text.

## Testing (all agents)
Real headless Chrome via DevTools protocol (CDP; Node 22 has global WebSocket): open the app at 390×844 DPR 3,
load `/tmp/poly-v5/sample.jpeg` via `PP.app.loadImageBlob(blob)`, real pointer events on the canvas, LOOK at
screenshots. Work in `/tmp/<agent>-v5-test/` (temporary test files are allowed there despite the user's folder rule;
delete nothing in the project). Report briefly with numbers.
