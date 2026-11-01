# Polytopia Planer v3 – change spec (extends SPEC.md, which stays valid unless changed here)

User feedback on v2 with a real screenshot (`/tmp/poly-measure/sample.jpeg`, 738×1600, English game UI):
1. Grid doesn't fit (tilted) even with 0°. → **automatic grid detection**, fixed geometry.
2. In attack mode the user can't select figures → they tap figures on the screenshot that were never
   marked. → **tap anything on the map, unmarked tiles open a quick unit picker**.
3. Build mode should be **tile-centric**: tap a tile (e.g. forest) → only the options for that terrain;
   after planning "Wald roden" the field options appear.
4. **Read stars from the screenshot** ("Stars (+17)" header → income 17, "★ 1" → stars 1).

## Measured facts (from the real screenshot)
- Polytopia's camera is fixed: diamond tiles with **height/width = 0.600 exactly, rotation 0**
  (map edges measured at slopes −0.598 / +0.601). Only tile width `w` and offset vary (zoom/pan).
- Prototype detection (Python, `/tmp/poly-measure/auto.py`, overlay check `/tmp/poly-measure/ov.png`) finds
  `w = 76.5 px`, a grid vertex at `(-20.3, 5.8)` for the sample and aligns with borders/coasts visually.
  Algorithm: grayscale → central-difference gradients; for each of the two line families
  (slopes +0.6 and −0.6) keep pixels whose gradient is nearly perpendicular to that family
  (|cos| > 0.92, magnitude > 20), weight = projected gradient; coordinate `s = y ∓ 0.6·x`;
  for candidate `w` (20…250 step 0.25, `h = 0.6w`) score = Σ_families |Z(h)| − |Z(2h)| with
  `Z(h) = Σ wgt·e^{2πi s/h} / Σ wgt`. Best w = argmax. Line offsets `b = angle(Z(h))/(2π)·h` per family,
  vertex = intersection, tile center = vertex + (0, h/2). Score on sample ≈ 0.22.

## Ownership (each agent writes ONLY its files)
| Agent | Files |
|---|---|
| CORE | `index.html`, `css/app.css`, `js/core.js`, `js/main.js`, new `js/vision.js` (grid detection + OCR + tile sampling) |
| COMBAT | `js/combat.js` |
| BUILD | `js/build.js`, `js/data.js` (items/terrain data only), `js/engine.js` only if strictly needed for new items (keep API) |

Load order becomes: `data.js, engine.js, vision.js, core.js, combat.js, build.js, main.js`.

---------------------------------------------------------------------------------------------------
## CORE
### Grid
- Geometry fixed: ratio 0.6, rotation 0. `PP.grid.setParams(w, ratio, theta, ac, ar)` stays for compat, but UI
  only exposes size + offset. Remove the ratio slider and rotation note from the main calibrate UI
  (an "Erweitert" disclosure with the ratio slider is OK).
- `PP.vision.detectGrid(imageEl)` → `{ w, cx, cy, score }` (cx,cy = some tile center in image px) or null.
  Port the algorithm above to JS; downscale large images (long side ≤ 900 px) for speed (< 400 ms on phone-ish
  hardware; measure in headless Chrome), scale results back. Run it automatically on every fresh screenshot.
  If score ≥ threshold (pick from sample + a sanity check like a tile width between 2.5% and 35% of image width)
  → apply and enter calibrate in a **confirm step**: panel "Raster automatisch erkannt ✓ – passt es?" with buttons
  **Passt ✓** (→ mode `map`, or `place` if nothing marked) and **Anpassen** (→ fine-tune).
  Otherwise fall back to the manual flow.
- Manual/fine-tune: one-finger drag moves the grid, size − / slider / +, tap a tile = put its center there.
  The manual 2-tap flow stays as fallback but now only determines w = |horizontal distance| (rotation ignored,
  ratio fixed).
- Keep tile coordinates of already-placed objects when re-detecting (anchor at the screen center like now).

### Stars OCR
- `PP.vision.readHeader(imageEl)` → Promise `{ stars, income, turn } | null`. Use Tesseract.js v5 from jsdelivr
  (`https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js`), loaded lazily only when needed,
  language `eng`. Crop the header (top ~20% of the image, full width), upscale ×2, grayscale/invert as helpful.
  Parse English and German labels: `Stars (+17)` / `Sterne (+17)` → income; the number below the Stars label
  (use word bounding boxes: number whose x-center is closest to the label's x-center, below it) → stars;
  `Turn`/`Runde` → turn. Must not throw; offline → null.
- On every fresh screenshot: run it in the background; on success set `PP.state.build.stars` / `.income`,
  commit, toast "★ 1 · +17 pro Runde aus dem Screenshot übernommen". Expected for the sample: stars 1, income 17, turn 10.

### Tile sampling (used by BUILD for terrain suggestions)
- `PP.board.sampleTile(c, r)` → `{ pixels: [[r,g,b], ...] }` sampled from the original image inside the tile diamond
  (e.g. ~60 points on the upper 2/3 of the diamond), or null on blank boards. Use an offscreen canvas cached per image.

### Quick unit picker (shared, used by COMBAT)
- `PP.ui.quickUnit({ c, r, side }, onDone)` opens a compact sheet: side toggle (🔵 Meine / 🔴 Gegner, preset
  `side`), a big grid of unit types — **one tap on a type creates the unit with full HP on that tile, closes the
  sheet and calls `onDone(unit)`**. Small optional row before tapping: HP stepper + Veteran toggle (default full HP).
  Remembers last side/type in `PP.state.ui`.

---------------------------------------------------------------------------------------------------
## COMBAT
- Tap on a tile with **no unit** → `PP.ui.quickUnit({c,r, side: guess}, u => select it)`; side guess: if no attacker
  selected yet → 'me', otherwise → 'enemy' once at least one attacker exists (user picks attackers first,
  then targets). Newly created own unit becomes an attacker, enemy becomes a target.
- Tap on a tile with a city but no unit → also quick picker (units stand on cities).
- Make sure tapping existing units reliably toggles selection (hit-test by tile **and** by marker radius;
  verify in the real app in headless Chrome with real core.js — not with stubs).
- Long-press on a unit → core editor (HP etc.).
- Panel when nothing selected: short 1-2-3 explanation + note "Unmarkierte Figuren einfach antippen".

---------------------------------------------------------------------------------------------------
## BUILD (tile-centric)
### Data (`js/data.js`)
- `PP.TERRAINS`: field 🟩 Feld, forest 🌲 Wald, mountain ⛰️ Berg, water 🌊 Flachwasser, ocean 🌊 Ozean, cloud ☁️ Unerforscht.
- `PP.RESOURCES`: fruit 🍒 (field), crop 🌾 Getreide (field), animal 🦌 Wild (forest), ore 💎 Erz (mountain), fish 🐟 (water).
- `PP.ITEMS` entries get `terrain: [..]`, optional `needs: resourceId`, optional `turnsInto: terrainId`
  (+ `gives: resourceId`). Values from the community wiki, mark uncertain ones in a comment:
  - field: Früchte ernten (needs fruit, 2★, +1, organization), Farm (needs crop, 5★, +2, farming),
    Straße (3★, roads), Tempel (10★, +1, freespirit), Windmühle (5★, construction, adj farm +1),
    Schmiede (5★, smithery, adj mine +2), Sägewerk (5★, mathematics, adj lumber +1), Markt (5★, trade),
    Wald pflanzen (5★, spiritualism, turnsInto forest)
  - forest: Tier jagen (needs animal, 2★, +1, hunting), Holzfällerhütte (3★, +1, forestry),
    Wald roden (−1★ i.e. +1★, forestry, turnsInto field), Wald abbrennen (5★, construction, turnsInto field, gives crop),
    Straße (3★, roads), Waldtempel (15★, +1, spiritualism)
  - mountain: Mine (needs ore, 5★, +2, mining), Bergtempel (20★, +1, meditation)
  - water: Fisch fangen (needs fish, 2★, +1, fishing), Hafen (7★, sailing), Wassertempel (20★, +1, aquatism)
  Keep existing ids where they exist so the engine (planEconomy, adjacency) keeps working.
### State
- `PP.state.tiles = { '<c>,<r>': { terrain, res: [resourceIds] } }` — user-confirmed terrain per tile
  (BUILD owns it; CORE must keep unknown state fields when loading/saving and clear `tiles` on "Alles löschen"
  and on a new screenshot).
### Flow
- In mode `build`, tap a tile → bottom sheet for that tile:
  - Header: terrain chip (suggested via `PP.board.sampleTile` color heuristic, or stored terrain) + "ändern" →
    terrain chips; resource toggles relevant to the terrain ("🦌 Wild vorhanden?").
    Remember the choice in `state.tiles`.
  - Mini budget line ("übrig 6 ★ · nächste Runde 23 ★").
  - "Geplant auf diesem Feld": list with ✕ to remove.
  - Options for the **effective terrain** (after planned `turnsInto`, plus `gives`): tap = add placement
    (sheet stays open and re-renders, so after "Wald roden" the field options show). Locked (tech missing):
    dim + "braucht X" but still addable (as v2). Items whose resource is missing: hidden, but shown in a
    collapsed "Weitere (braucht Ressource)" row that also lets the user tick the resource.
  - Tap own city tile → open the Städte tab in the panel (as v2).
- Panel keeps the budget bar and tabs **Geplant | Einheiten | Technik | Städte** (Geplant = list of all
  placements grouped by tile, tap → opens that tile's sheet). Remove the brush UI.
- Map overlay: planned items as icons on tiles (as v2); tiles with confirmed terrain may show a tiny terrain dot.
- Color heuristic for the terrain suggestion (simple, documented, tune on the sample): cloud = mostly
  very bright low-saturation; water/ocean = blue dominant (ocean darker/more saturated); forest = many
  dark-green pixels; mountain = many grey/white pixels; else field.
