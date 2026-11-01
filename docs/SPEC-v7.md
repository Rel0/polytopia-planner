# Polytopia Planner v7 – unit tool rework + defense bonus detection + better grid
(extends SPEC-v6.md; UI language is English, see GLOSSARY-en.md)

User feedback (translated):
1. The coins are too big and cluttered → make them smaller.
2. Editing a coin needs a long press (e.g. to delete) → too cumbersome.
3. Split the Units tool into **two modes**: one where I only **place** units, one where I go into **battle**.
   Placing must be very fast, incl. adjusting **HP**, **veteran** yes/no and **defense bonus**.
4. **Detect the defense bonus automatically** where possible.
5. The **automatic grid** must get better.

Test screenshots (data only): `/tmp/grid2/s1.jpg` (738×1600, tile width ≈ 76.5) and `/tmp/grid2/s2.jpg`
(946×2048, current detector: w ≈ 108.3). Both: English UI, user's tribe brown, enemy dark blue.

## UNITS agent — `js/units.js` only
### Coins
- Smaller: radius ≈ 0.28–0.30 × tile width (was ~0.45), clamp so they stay readable (min ~7 px radius, max ~30).
  HP chip smaller and tucked to the lower right; veteran ★ and shield badge as tiny marks. Must not hide the
  figure in the screenshot more than necessary; check at fit zoom and zoomed in on both screenshots.
### Two modes (segmented control at the top of the panel): **✏️ Place** | **⚔️ Battle**
- **Place** (default when no units exist):
  - Side toggle (Mine/Enemy) + unit palette as now. Tap empty tile → place coin (full HP, auto defense bonus) and
    **select it** so it can be edited immediately; next tap on another empty tile places the next one.
  - Tap an existing coin → select it (no long press). Panel shows a **compact quick editor** for the selected coin:
    big HP stepper (−/+, plus quick chips e.g. "Full", and maybe 1-tap values), **Veteran** toggle,
    **Defense bonus** segmented: `Auto (Forest ×1.5)` | `None` | `×1.5` | `×4`, side switch, change type (tap a
    palette type while a coin is selected → changes its type? or a small type row — choose the clearer UX),
    **🗑 Delete** (one tap). Tap the selected coin again or empty space → deselect.
  - Optional tiny "eraser" toggle: tap coins to delete them one after another.
- **Battle**: tap own coins → attackers (glow + order), tap enemy coins → targets, damage calculator as now.
  Tapping empty tiles does nothing (hint). No placing in battle mode. HP/bonus steppers stay available in the calculator.
- Long press may still open the editor, but nothing must require it.
### Automatic defense bonus (`unit.bonusMode: 'auto' | 'manual'`, `unit.bonus` = effective value)
- Polytopia: defending unit gets ×1.5 in a **city** tile, on **Forest** (needs Archery), **Mountain** (needs
  Climbing), **Water/Ocean** for naval (Aquatism) — and ×4 behind a **City Wall**. Tech requirements: assume known
  (note in UI: "Auto assumes Archery/Climbing"), user can override.
- Terrain under the unit: sample the screenshot **around** the unit, not under it (the figure covers the tile
  center) — e.g. points in the outer ring of the tile diamond (`PP.board.image`, `PP.grid.corners/center`) — then
  `PP.vision.classifyTile(pixels)`. Cache per tile/image.
- Cities: `PP.vision.detectCities(img, grid, tribes)` (exists in vision.js; tribes from `PP.recog.tribes()` or the
  coin colours / default brown+blue) once per image+grid, cached. Unit on a city tile → ×1.5 (walls unknown → user
  can pick ×4).
- Show the reason in the editor ("Auto: Forest ×1.5", "Auto: City ×1.5", "Auto: none") and a small shield on the
  coin when bonus > 1. Recompute auto bonuses when the grid changes or a unit moves.
- Test: on s1/s2 place units on forest, mountain, city and field tiles (look at the screenshot) and check the result.

## GRID agent — `js/vision.js` (detectGrid only + helpers) and `js/core.js` (calibrate mode only)
- Detection quality: test the current `PP.vision.detectGrid` on s1 and s2 and on rescaled/cropped variants
  (×0.6, ×1.6, top/bottom crops, a crop that cuts off map edges, PNG at original phone resolution ≈1179×2556
  upscaled from s2). Make it more accurate and robust: e.g. a refinement pass (fine search of w ±2% in 0.05 px
  steps and of both line offsets maximizing edge alignment), use the map outline/space boundary if visible,
  guard against half/double-period errors, and report a confidence. Verify visually with overlays (draw the grid
  on the image and LOOK at zoomed crops: lines must lie on territory borders/fences, coasts, field edges).
- Adjust UX (calibrate fine-tune step): **two-finger pinch scales the grid** around the pinch center, one finger
  moves it (instead of only slider/±); a "Reset to auto" button; keep ±/slider as fine control. Keep the confirm
  card ("Looks good / Adjust").
- Don't change other modes or tools.

## Both
Headless Chrome via CDP (Node 22 has global WebSocket), 390×844 DPR 2–3 with touch, load images via
`PP.app.loadImageBlob(blob)`, real touch events on the canvas. LOOK at screenshots. Temp files only in
`/tmp/<agent>-v7/`. Report briefly with numbers.
