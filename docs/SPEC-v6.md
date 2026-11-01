# Polytopia Planer v6 – new app structure (replaces the v5 "Welt/Prüfen/Spielen" UI)

The user rejected v5 (own 2D world, verify, play). New structure in the user's words (German, summarised):
1. Upload a screenshot. **The screenshot is always visible** (no rebuilt world).
2. **Left side: tool selection. Right side: a panel pops open** for the chosen tool.
3. **Figuren (units) + damage calculator:** pick unit types (Warrior, Rider, …) in the right panel and place them as
   **small 2D coins with a symbol** on tiles. Then tap own coin(s) and tap one or more enemy coins → the damage calculator
   shows how the damage is distributed (like a normal damage calculator).
4. **Kosten (cost calculator):** in the right panel choose things and see what they cost and whether I can afford it.
   Respect what's possible on the tile (terrain: forest/field/…). Also **train units**.
5. **Zeichnen:** very fine, good-looking **arrows**, plus **crosses (X) and rings (O)**, chosen in the panel and placed
   on tiles.
6. **Markt-Rechner:** select a part of the map and find the best place for a market (markets earn different amounts).

Backup of v5 is in `old/v5/` (reference code: `old/v5/js/combat.js` popup + table, `old/v5/js/build.js` tile-centric
cost flow, `old/v5/js/core.js` arrow drawing). The current `js/` still contains v5 files; v6 agents write NEW files
and the SHELL agent rewires index.html. Obsolete files (world.js, verify.js, play.js, rules.js, combat.js, build.js)
will be deleted by the main session at integration — do not depend on them at runtime.

Real test screenshot: `/tmp/poly-v6/sample.jpeg` (738×1600, English UI). Auto grid: tile width 76.475, ratio 0.6.
OCR reads stars 1, income +17. The user's tribe is brown; enemy dark blue.

## Hard constraints (unchanged)
Classic scripts on `window.PP`, works via file://, no build step, German UI, phone first (390×844) but also good on
desktop/tablet, no horizontal overflow, big touch targets.

## Reused, keep working (SHELL owns these files)
`js/data.js`, `js/engine.js` (combat formula `PP.engine.attack/maxHp/effectiveBonus`, `techCost`, `planEconomy`),
`js/vision.js` (auto grid `detectGrid`, `readHeader` OCR, `classifyTile` terrain suggestion, `detectUnits` badges),
`js/ai.js` (optional), `js/core.js` (board canvas, gestures, grid, calibrate confirm flow, buildHiRes sharp zoom,
`PP.modes` framework, `PP.draw`, `PP.ui.*`, `PP.find`, `PP.board.*` incl. `tileToScreen`, `centerOn`, `sampleTile`,
`image`).

## Load order (SHELL edits index.html)
`data, engine, vision, ai, core, units, cost, draw, market, main`.

## Tool framework = the existing `PP.modes` API (no new API to learn)
Each tool is a mode: `PP.modes.register(id, { label, icon, hint, onEnter, onExit, onTap(t), onLongPress(t),
onDrag(phase,t), wantsDrag(t), renderPanel(el), decorate(obj, kind), drawUnder(ctx,D), drawOver(ctx,D) })`.
`renderPanel(el)` now renders into the **right drawer** instead of the bottom panel. Tool ids: `units`, `cost`, `draw`,
`market` (+ core's `calibrate`). `PP.app.commit()` / `refresh()` as before.
New: `PP.drawer.open()`, `PP.drawer.close()`, `PP.drawer.isOpen()`; the drawer opens when a tool is chosen.

## Shared state (additive; SHELL provides defaults, keeps unknown fields, clears on new screenshot / "Alles löschen")
```
units:  [{ id, c, r, side:'me'|'enemy', type, hp, vet, bonus, color? }]      // the coins (UNITS)
tiles:  { 'c,r': { terrain, res:[...], bld:itemId|null, src } }            // tile annotations (COST + MARKET share)
build:  { stars, income, owned:[], planned:[], unitCounts:{}, placements:[{id,c,r,item}], rewards:{} }  // COST
marks:  [{ id, kind:'arrow'|'cross'|'ring', c1, r1, c2?, r2?, color, size }]                         // DRAW
market: { region: { c1, r1, c2, r2 } | null, includePlanned: true }                                   // MARKET
combat: { attackers:[ids], targets:[ids] }                                                            // UNITS
```
Old v5 fields (world, arrows) may be dropped on load.

---------------------------------------------------------------------------------------------------
## SHELL — `index.html`, `css/app.css`, `js/core.js`, `js/main.js` (+ may touch vision.js/ai.js only if needed)
- Layout: slim header (title, ⋯ menu). Body = map stage (screenshot always visible, grid hidden except during
  calibrate) with a **left tool rail** (vertical, ~64 px wide on phone: icon + small label: 🪖 Figuren, 💰 Kosten,
  ✏️ Zeichnen, 🏪 Markt; menu ⋯ at the bottom) and a **right drawer** for the active tool.
  Phone: drawer overlays the right part of the map, width ≈ min(78vw, 380px), slides in, has a grab tab to collapse
  to a thin edge (map stays usable; taps on visible map work while open). Tablet/desktop (≥ 900 px): drawer docks
  beside the map (no overlay). Tapping the active tool again collapses the drawer.
- Remove v5 UI: world view/toggle, verify, play, bottom toolbar, old modes from the UI (map/place/attack/build/arrow
  modes may stay registered internally but must not appear). The bottom panel is gone; `renderPanel` targets the drawer.
- Flow: empty state (pick / paste / drop screenshot) → auto grid → short confirm ("Raster passt? ✓ / Anpassen") →
  tool `units` opens. OCR stars/income in background (as v3) into `build.stars/income`.
- Menu: Neuer Screenshot, Raster anpassen, Alles löschen, (KI-Erkennung settings from ai.js if present).
- Keep `PP.board.centerOn`, `setView`, `sampleTile`, `image`, buildHiRes, pinch/pan, long-press.
- Marker drawing: core may keep drawing units, but UNITS will draw the coins itself → add a core flag/hook so a tool
  can take over unit drawing (e.g. `PP.board.drawUnits = false` or `decorate` returning `{ hidden:true }`), and
  remove city markers from the default drawing (no city markers in v6 unless a tool draws them).
- Test: layout at 390×844 and 1280×800 (headless Chrome via CDP, real touch), drawer open/collapse, taps on the
  map with drawer open, no overflow. LOOK at screenshots.

## UNITS — new `js/units.js` (mode `units`)
- Drawer: side toggle (🔵 Meine / 🔴 Gegner), **unit palette** (Warrior/Krieger, Archer, Defender, Rider, Swordsman,
  Catapult, Knight, Mind Bender, Giant; German names + small coin preview). Selected palette type = "brush".
- Map: tap empty tile with a brush → place coin (full HP). **Coins:** small flat 2D coins with a clean vector symbol
  (draw simple glyphs with Path2D: sword, bow, shield, horse head, crossed swords/longsword, catapult, knight helmet,
  eye/brain, giant fist — not emoji), metallic rim, side colour (own blue / enemy red, or tribe colour), HP chip.
  Size scales with tile (~45% tile width), crisp at any zoom.
- Tap own coin → toggle selected attacker (glows, order number). Tap enemy coin → toggle target (multiple targets
  allowed; one is "active", shown in the calculator; others listed as tabs/chips to switch).
  With a brush active, taps on coins still select (placing only on empty tiles). "✕ Pinsel" to drop the brush.
- Long-press coin → small editor (type, side, HP ±, veteran, defence bonus none/×1.5/×4, delete).
- **Damage calculator in the drawer** (like v4 popup table, see `old/v5/js/combat.js`): for the active target, in
  attacker order: attacker, damage dealt, retaliation received, target HP after, own HP after, 💀; result line.
  Inline HP steppers for target and attackers (HP matters). Optional "↕ beste Reihenfolge". "Ausführen" applies
  HP changes (optional). Use `PP.engine.attack(att, def, dist)` with real tile distance (`PP.grid.dist`).
  On the map: thin numbered arrows attacker→active target, predicted HP on the target coin.
- Optional secondary button "Figuren automatisch vorschlagen" using `PP.vision.detectUnits` + colour question
  (as v4) — clearly secondary.

## COST — new `js/cost.js` (mode `cost`)
- Drawer top: compact budget bar (★ now — from OCR, editable; income; planned; rest, red if negative; next turn).
- Tabs: **Felder | Figuren | Technik | Plan**.
  - Felder: tap a tile on the map → drawer shows that tile: terrain chip (suggested via `PP.vision.classifyTile` /
    `PP.board.sampleTile`, one tap to change, stored in `tiles`), resource toggles, existing building, and the options
    possible on that terrain (from `PP.ITEMS` terrain/needs/turnsInto rules in data.js; v5 build.js tile flow is the
    reference). Tap option = plan it (cost added); planned "Wald roden" changes effective terrain → field options.
    Planned items appear as small icons on the tile.
  - Figuren: train units — steppers per unit type with cost, tech lock hint.
  - Technik: tech tree chips (plan/owned), cost via `PP.engine.techCost`.
  - Plan: list of everything planned with costs, remove buttons, "Runde beenden" (optional).
- Uses `PP.engine.planEconomy` for totals if convenient (city level-up rewards optional, not required).

## DRAW — new `js/draw.js` (mode `draw`)
- Drawer: shape picker **Pfeil / Kreuz / Ring**, colour swatches (5–6 nice colours), size S/M/L, "Rückgängig",
  "Alle löschen", eraser toggle.
- Pfeil: drag from tile to tile (snapped centers, chess.com-like), live preview, start/end tile highlight.
  Kreuz/Ring: tap a tile. Tapping an existing mark with the eraser (or tapping the same shape on the same tile)
  removes it.
- Rendering must look **fine and elegant** ("filigran, gut aussehend"): thin anti-aliased strokes scaled to tile
  size, rounded caps, slim tapered arrow head, subtle dark outline/shadow for contrast on the busy screenshot,
  semi-transparent fill; ring = clean circle inscribed in the tile diamond (ellipse with 0.6 ratio fits the iso
  look); cross = two rounded strokes. Marks must stay crisp when zooming.

## MARKET — new `js/market.js` (mode `market`)
Polytopia rule (community wiki, mark as "bitte prüfen" in the UI): a **Markt** (tech Trade) is built on a field
tile; it earns ★ per turn = sum of the **levels** of adjacent (8-neighbourhood) **Windmühle, Schmiede, Sägewerk**,
capped at **8** per market. Level of a Windmühle = number of adjacent Farms; Schmiede = adjacent Mines; Sägewerk =
adjacent Holzfällerhütten.
- Step 1 "Bereich wählen": drag on the map from one tile to another → region = all tiles with c in [c1..c2],
  r in [r1..r2] (shows as a diamond on screen); region outline + dim outside.
- Step 2 "Gebäude markieren": palette Farm, Mine, Hütte, Windmühle, Schmiede, Sägewerk, Markt (existing), Leer;
  tap tiles in the region to set `tiles[k].bld`; terrain auto-suggested (forest/mountain/water are not market
  candidates). Toggle "geplante Gebäude (Kosten) einbeziehen" uses `build.placements` too.
- Step 3 result: for every candidate tile (field, no building) in the region compute market income; show a heatmap
  of numbers on the tiles, highlight the best 3 with medals, list them in the drawer with the breakdown
  ("+3 Windmühle (Lv3) +2 Schmiede (Lv2) = 5 ★/Runde").
- "Optimieren" (bonus): also suggest placing new Windmühle/Schmiede/Sägewerk on free field tiles next to the market
  spot to maximise income (greedy per neighbour), with total build cost.
- Pure computation in `PP.market.evaluate(tiles, region, opts)` (node-testable).

## Testing (everyone)
Headless Chrome via CDP (Node 22 global WebSocket; launch Chrome with `--remote-debugging-port`, 
`Emulation.setDeviceMetricsOverride` 390×844 DPR3, touch emulation), load the sample with
`PP.app.loadImageBlob(blob)`, real touch events on the canvas at `PP.board.tileToScreen` positions. LOOK at the
screenshots. Temporary test files in `/tmp/<agent>-v6-test/` only. Report briefly with what you verified.
Until SHELL's new index.html exists, test with your own harness page that loads the needed scripts.
