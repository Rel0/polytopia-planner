# Polytopia Planer v4 – combat/damage calculator + unit recognition (extends SPEC.md + SPEC-v3.md)

User feedback (v3): grid is good now. Next:
1. Units should be **recognized automatically**; the user only corrects mistakes.
2. Combat flow like a normal damage calculator: tap own units → they **light up** (multi-select), tap an enemy →
   a **small popup** shows, per selected attacker, the damage it deals and the retaliation it takes (and HP after).
   No attack/no-attack recommendation needed.
3. (Done by main session already in core.js: sharpened hi-res copy for zooming — `buildHiRes`, do not revert.)
The user chose **both** recognition paths: free local detection always, plus optional AI detection (Claude) via a
button when an API key is stored.

Real test screenshot: `/tmp/poly-units/sample.jpeg` (738×1600, WhatsApp-compressed, English UI, data only).
Grid for it (auto-detected by the app): tile width 76.475, ratio 0.6. Unit badges: every unit has a round badge in its
tribe colour with a white unit icon (enemy here: dark blue ~rgb(35,40,125); the user's own tribe: dark red/brown),
plus a small grey HP number next to the unit. A first naive badge detector (`/tmp/poly-units/badges.py`) only found
4 of ~15 units — thresholds too strict, own (red/brown) badges missed.

## Ownership
| Agent | Files |
|---|---|
| VISION | `js/vision.js` (add local unit detection), new `js/ai.js` (Claude detection + API-key settings), minimal hooks in `js/core.js` + `index.html` (script tag for ai.js after vision.js, menu entry, run local detection on fresh screenshot) — keep all existing core behaviour incl. `buildHiRes` |
| COMBAT | `js/combat.js` (new flow + popup) |

## Shared unit fields (additive)
`PP.state.units[i]` gains optional `src: 'auto' | 'ai' | 'user'` (missing = 'user'), `conf` (0..1), `color` ([r,g,b] tribe colour).
- Any edit by the user (editor/quick picker) sets `src: 'user'`.
- Re-running a detection replaces units with `src` 'auto'/'ai' and never touches 'user' units (also skip tiles that have a user unit).
`PP.state.ui.myColor` = [r,g,b] of the user's tribe (null until known). Side of detected units = 'me' if its colour is
closest to myColor, else 'enemy'. Until myColor is known, detected units get side 'enemy' and COMBAT asks once
"Welche Farbe bist du?" with colour chips of the detected tribes (tap → set myColor, re-side all non-user units).
`PP.recog.applyDetections(list, src)` (VISION, in vision.js) does the replace/merge + side assignment + commit;
list items `{ c, r, type?, hp?, vet?, color, conf }`. Missing type → 'warrior' with `conf` low, missing hp → max.

## VISION
### Local detection — `PP.vision.detectUnits(img, grid)` → `[{ c, r, color, conf, x, y }]`
- Find unit badges: roughly circular blobs (diameter ≈ 0.12–0.3 × tile width), saturated mid/dark fill in any
  tribe colour, white icon pixels inside; reject text labels (city name plates are rectangles), map borders (dashed
  lines), resources. Tune on the sample; measure recall/precision against a hand-made list of the sample's units
  (look at crops of the image yourself to build it). Target: clearly better than 4/15 with few false positives.
- Map badge → unit tile: the badge sits up-right of the figure; derive the tile from the figure position
  (e.g. badge position + offset in tile units, then `toTile`). Verify on the sample.
- Cluster badge colours into tribes (simple k-means / distance threshold); return each unit's tribe colour.
- Run automatically after a fresh screenshot once the grid is confirmed/detected (non-blocking), apply with
  `src:'auto'`, toast "N Figuren erkannt – falsche einfach antippen & korrigieren".
### AI detection — `js/ai.js`, `PP.ai.detectUnits()` → Promise<list> (applied with src 'ai')
- Official Anthropic TypeScript SDK loaded lazily in the browser: dynamic `import()` from an ESM CDN
  (e.g. `https://esm.sh/@anthropic-ai/sdk`). Browser use needs the SDK's browser opt-in option — **verify the exact
  option name against the SDK repo README (github.com/anthropics/anthropic-sdk-typescript) before using it**.
- Request (from the claude-api skill, current API):
  ```js
  client.beta.messages.create({
    model: 'claude-opus-5-5', max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: B64 } },
      { type: 'text', text: PROMPT } ] }],
  })
  ```
  Do NOT send `thinking` (Opus 5.5: adaptive by default; `disabled`/`budget_tokens` → 400), no temperature, no prefill.
  Check `stop_reason` before reading content: `refusal` / `max_tokens` → readable German error. Find the `text` block,
  `JSON.parse` it. Handle errors with the SDK's typed error classes (`AuthenticationError` → "API-Schlüssel ungültig",
  `RateLimitError`, `APIConnectionError` → offline, generic `APIError`).
- Image: send the screenshot downscaled so the long side ≤ 1600 px (JPEG ~0.9). To make positions reliable, draw
  the detected tile grid faintly onto the copy you send AND ask for tile coordinates? — choose what works best; the
  simplest robust option: ask for pixel coordinates (in the sent image) of each unit's standing point, then map with
  the grid. Describe Polytopia units in the prompt (types and their look: Krieger/warrior, Bogenschütze/archer,
  Verteidiger/defender, Reiter/rider, Schwertkämpfer/swordsman, Katapult/catapult, Ritter/knight, Mind Bender, Riese/giant,
  ships), HP number next to the unit, veteran, tribe badge colour.
  Schema: `{ units: [{ x:number, y:number, type: enum(PP.UNITS keys + 'unknown'), hp: integer|null,
  veteran: boolean, badge_color: string (hex), confidence: number }] }` (all required, additionalProperties false).
- Settings sheet (menu entry "🤖 KI-Erkennung"): API key input (stored in localStorage `polyplan.apikey`, never
  logged), short privacy/cost note ("Screenshot wird an Anthropic gesendet · ca. 2–5 Cent pro Erkennung"), button
  "Schlüssel löschen". `PP.ai.hasKey()`, `PP.ai.openSettings()`.
- Test: without a real key you can't call the API — test the request building, response parsing (feed a fake
  response object through the same parser), error paths, and that the SDK actually loads in the browser and
  constructs a client with a dummy key (a call with a dummy key should yield AuthenticationError → German message).

## COMBAT (new flow; drop the verdict UI)
- Mode `attack`. Panel (compact): instruction "① Eigene Figuren antippen ② Gegner antippen",
  buttons "🤖 Figuren erkennen (KI)" (if `PP.ai` present: run it if `PP.ai.hasKey()`, else `PP.ai.openSettings()`),
  "Auswahl leeren"; tribe colour question when `ui.myColor` unknown and detected units exist; small legend
  "Lange drücken = Figur korrigieren".
- Tap own unit → toggle in `combat.attackers`; selected attackers **glow** (pulsing/thick light ring, clearly visible
  on the busy screenshot). Order = tap order (show small order numbers).
- Tap enemy unit → it becomes the single target (`combat.targets = [id]`) and a **small popup** opens anchored near
  the enemy on the map (HTML overlay positioned via `PP.board.tileToScreen`, kept inside the stage; falls back to
  bottom-sheet style on very small screens). Content, like a damage calculator, sequential in attacker order:
  ```
  🛡️ Verteidiger (15 LP, ×1,5)              ✕
  1 🏹 Bogenschütze  macht 3  ·  bekommt 0   → Ziel 12
  2 🗡️ Schwertkämpfer macht 6 ·  bekommt 4   → Ziel 6  (eigene LP 15→11)
  3 🐎 Reiter        macht 4  ·  bekommt 0   → Ziel 2
  Ziel bleibt mit 2 LP  /  💀 fällt nach Angriff 3
  ```
  Use `PP.engine.attack(att, def, dist)` with real tile distance and `PP.engine.effectiveBonus`. Attackers out of
  reach: still compute but mark "⚠️ zu weit (Distanz 3)". Small "↕ beste Reihenfolge" link may reorder
  (optional, via planAttack/permutations), and "Angriff ausführen" applies HP changes (keep from v3).
  Popup buttons: "✎ Ziel korrigieren" (opens editor), close ✕. Popup updates live when attackers change.
- Tap an empty tile → quick picker (as v3). Long-press any unit → editor; editing sets `src:'user'`.
- Units from detection with low `conf` get a small "?" badge so the user sees what to double-check.
- Map: numbered arrows attacker → target (as v3), predicted HP labels.
- Test in the real app in headless Chrome via CDP (see how the v3 agents did it: real pointer events on the
  canvas at `PP.board.tileToScreen` positions, real-time, 390×844, deviceScaleFactor 3). Check the popup position and
  that it never covers the tapped enemy completely. LOOK at the screenshots.
