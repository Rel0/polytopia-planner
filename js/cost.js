// Polytopia Planer v15 – COST tool (mode 'cost'): budget, tile-centric planning through a radial ring menu around
// the tapped tile (like the game), unit training in cities, tech tree, plan list. Planned items are drawn as small
// icons on the tiles. v14: no city-upgrade economics any more – next turn = stars left + income.
// v15: every ring button is labelled (name + cost); the ring closes after a pick.
// v16: no auto detection any more – a simple two-layer ring: "Home" layer (terrain: Empty / Forest / Mountain /
// Water / My city + Close in the centre) and "Actions" layer (every action the terrain allows, centre = ⌂ Home).
// The chosen terrain is stored in PP.state.tiles (internal id stays 'field' for Empty), own cities in PP.state.cities.
// Resources are implied by the planned action (Harvest Fruit ⇒ the tile has Fruit).
// v17: "Crop" is its own Home choice (stored as terrain 'field' + res ['crop']); only Crop tiles offer the Farm,
// buildings that need a free tile (Windmill, Market, …) are not offered / are flagged there.
window.PP = window.PP || {};

(function (PP) {
  'use strict';

  // ---------- extra data (kept here, data.js stays untouched) ----------
  // Real buildings occupy a tile (one per tile). Everything else is an action (harvest, terrain change) or a road.
  var BUILDINGS = ['farm', 'temple', 'windmill', 'forge', 'sawmill', 'market', 'lumber', 'foresttemple', 'mine',
    'mountaintemple', 'port', 'watertemple'];
  var HARVEST = ['fruit', 'hunt', 'fish']; // consume the resource
  var TABS = [['tile', '🗺️', 'Tile'], ['units', '🪖', 'Units'], ['tech', '🔬', 'Tech'], ['plan', '📋', 'Plan']];
  // item → PP.icons symbol (game-style vector icon); items without one use their emoji
  var ITEM_ICON = { fruit: 'fruit', farm: 'farm', road: 'road', temple: 'temple', windmill: 'windmill', forge: 'forge',
    sawmill: 'sawmill', market: 'market', plant: 'forest', hunt: 'animal', lumber: 'lumber', foresttemple: 'temple',
    mine: 'mine', mountaintemple: 'temple', fish: 'fish', port: 'port', watertemple: 'temple' };
  var HOME_TER = ['field', 'crop', 'fruit', 'forest', 'mountain', 'water'];  // Home layer (+ My city); 'crop'/'fruit' = field + that resource
  var HOME_RES = { crop: 'Crop', fruit: 'Fruit' };  // Home choices that are an Empty tile with a resource
  var EXPLICIT_RES = ['crop', 'fruit'];  // chosen on the Home layer (Crop also by Burn Forest); the ring offers Farm / Harvest Fruit only there
  var NO_RING = ['cloud'];                                   // nothing to build → only the ⌂ Home button
  // user-visible names (data.js stays untouched): 'field' is shown as "Empty" (not the field you build on),
  // Fruit / Crop get names that can't be confused
  var TER_NAME = { field: 'Empty' };
  var RES_NAME = { fruit: 'Fruit (harvest)', crop: 'Crop (for Farm)' };
  var NOTE = { clear: 'gives 1 ★, becomes Empty', burn: 'becomes Empty with Crop (for Farm)', farm: 'needs Crop (for Farm)',
    fruit: 'needs Fruit (harvest)', hunt: 'needs Animal', mine: 'needs Metal', fish: 'needs Fish' };
  var RING_NAME = {};  // v17: Farm is only offered on Crop tiles, no hint needed
  // Rules (Polytopia, Path of the Ocean patch 2.8.5+): Port comes with Fishing (+1 pop, 7 ★); buildings that don't
  // use a resource need a free tile (no resource on it) – harvest first. A tile holds one building.
  (function fixRules() {
    var port = PP.ITEM && PP.ITEM.port;
    if (port) { port.tech = 'fishing'; port.pop = 1; }
  })();
  function needsFreeTile(it) { return (isBuilding(it.id) && !it.needs) || it.id === 'plant'; }

  // ---------- styles (.cs-* panel, .csr-* ring) ----------
  var CSS = [
    '.cs{font-size:13px;min-width:0}',
    '.cs *{box-sizing:border-box}',
    '.cs button{min-width:0;font:inherit;color:inherit;cursor:pointer}',
    '.cs-bar{position:sticky;top:0;z-index:3;background:var(--panel,#1c2340);box-shadow:0 -14px 0 var(--panel,#1c2340);border-bottom:1px solid var(--line,#33406e);padding:8px 10px 6px;margin-bottom:8px}',
    '.cs-bar.cmp{position:static;box-shadow:none;margin-top:8px!important}',
    '.cs-top{display:flex;align-items:stretch;gap:6px}',
    '.cs-rest{flex:none;text-align:center;background:var(--panel2,#252e52);border-radius:10px;padding:3px 6px;min-width:64px;display:flex;flex-direction:column;justify-content:center}',
    '.cs-rest b{display:block;font-size:22px;line-height:1.05;color:var(--gold,#ffd166)}',
    '.cs-rest b.neg{color:var(--enemy,#ef476f)}',
    '.cs-rest span{font-size:10px;color:var(--muted,#9aa5c8)}',
    '.cs-in{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
    '.cs-bar.cmp .cs-in{flex-direction:row;gap:10px}.cs-bar.cmp .cs-st{flex:1}',
    '.cs-st{display:flex;align-items:center;gap:3px;font-size:11px;color:var(--muted,#9aa5c8)}',
    '.cs-st .lb{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cs-st button{flex:none;width:32px;height:32px;border:0;border-radius:8px;background:var(--panel2,#252e52);font-size:17px;font-weight:700;padding:0}',
    '.cs-st input{flex:none;width:40px;height:32px;text-align:center;background:var(--bg,#12172b);border:1px solid var(--line,#33406e);border-radius:8px;font-weight:700;padding:0;-moz-appearance:textfield}',
    '.cs-st input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
    '.cs-st b{min-width:20px;text-align:center;color:var(--text,#e8ecf8);font-size:13px}',
    '.cs-line{font-size:11.5px;color:var(--muted,#9aa5c8);margin:6px 0 4px;line-height:1.35}',
    '.cs-line b{color:var(--text,#e8ecf8)}.cs-line b.neg{color:var(--enemy,#ef476f)}',
    '.cs-prog{height:5px;background:var(--panel2,#252e52);border-radius:5px;overflow:hidden}',
    '.cs-bar.cmp .cs-prog{margin-top:6px}',
    '.cs-prog i{display:block;height:100%;background:var(--gold,#ffd166)}.cs-prog i.over{background:var(--enemy,#ef476f)}',
    '.cs-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;background:var(--panel2,#252e52);border-radius:10px;padding:3px;margin-top:7px}',
    '.cs-tabs button{border:0;background:none;color:var(--muted,#9aa5c8);font-size:11px;font-weight:600;padding:4px 0 3px;border-radius:8px;display:flex;flex-direction:column;align-items:center;line-height:1.15;min-height:40px;justify-content:center;position:relative}',
    '.cs-tabs button i{font-style:normal;font-size:15px}',
    '.cs-tabs button.on{background:var(--panel,#1c2340);color:var(--text,#e8ecf8)}',
    '.cs-tabs button em{position:absolute;top:1px;right:3px;font-style:normal;background:var(--gold,#ffd166);color:#222;border-radius:8px;font-size:9.5px;font-weight:800;padding:0 4px;line-height:14px}',
    // phone peek row
    '.cs-peek{display:flex;align-items:center;gap:8px;min-height:46px;min-width:0}',
    '.cs-peek .lf{flex:none;display:flex;align-items:baseline;gap:4px;background:var(--panel2,#252e52);border-radius:10px;padding:5px 9px;height:44px;align-items:center}',
    '.cs-peek .lf b{font-size:21px;color:var(--gold,#ffd166);line-height:1}.cs-peek .lf b.neg{color:var(--enemy,#ef476f)}',
    '.cs-peek .lf span{font-size:11px;color:var(--muted,#9aa5c8);white-space:nowrap}',
    '.cs-peek .md{flex:1;min-width:0;font-size:12px;line-height:1.3;color:var(--muted,#9aa5c8)}',
    '.cs-peek .md b{color:var(--text,#e8ecf8);white-space:nowrap}.cs-peek .md b.neg{color:var(--enemy,#ef476f)}',
    '.cs-peek .md span{white-space:nowrap}',
    '.cs-peek .pl{flex:none;height:44px;min-width:64px;border:0;border-radius:11px;background:var(--gold,#ffd166);color:#222!important;font-weight:800;font-size:13px;padding:0 10px;position:relative}',
    '.cs-peek .pl.on{background:var(--panel2,#252e52);color:var(--text,#e8ecf8)!important}',
    '.cs-peek .pl em{position:absolute;top:-6px;right:-4px;font-style:normal;background:var(--enemy,#ef476f);color:#fff;border-radius:9px;font-size:10px;padding:0 5px;line-height:17px}',
    '.cs-body{padding:0 2px}',
    '.cs-h{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#9aa5c8);margin:12px 0 5px;display:flex;justify-content:space-between;gap:6px}',
    '.cs-h:first-child{margin-top:2px}',
    '.cs-note{color:var(--muted,#9aa5c8);font-size:11.5px;margin:6px 0;line-height:1.4}',
    '.cs-warn{color:var(--gold,#ffd166);font-size:11.5px;margin:5px 0;line-height:1.35}',
    '.cs-warn.bad{color:var(--enemy,#ef476f)}',
    '.cs-empty{background:var(--panel2,#252e52);border-radius:12px;padding:14px 12px;text-align:center;font-size:13px;line-height:1.45;margin:6px 0}',
    '.cs-empty big{display:block;font-size:30px;margin-bottom:4px}',
    // tile head
    '.cs-tile{display:flex;align-items:center;gap:8px;margin:2px 0 6px}',
    '.cs-tile b{flex:1;min-width:0;font-size:15px;line-height:1.2}',
    '.cs-tile b small{display:block;font-size:11px;font-weight:500;color:var(--muted,#9aa5c8)}',
    '.cs-tile b small.q{color:var(--gold,#ffd166)}',
    '.cs-x{flex:none;width:34px;height:34px;border:0;border-radius:9px;background:var(--panel2,#252e52);font-size:14px}',
    '.cs-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:6px 0}',
    '.cs-lbl{font-size:11px;color:var(--muted,#9aa5c8)}',
    '.cs-chip{border:1px solid var(--line,#33406e);background:var(--panel2,#252e52);border-radius:999px;padding:6px 10px;font-size:12px;min-height:36px;line-height:1.1}',
    '.cs-chip.on{background:rgba(6,214,160,.18);border-color:var(--ok,#06d6a0);color:var(--ok,#06d6a0);font-weight:700}',
    '.cs-chip.ghost{background:none;color:var(--muted,#9aa5c8)}',
    '.cs-chip.sm{min-height:32px;padding:4px 9px}',
    // planned steps on the tile
    '.cs-pl{display:flex;align-items:center;gap:7px;background:var(--panel2,#252e52);border-radius:10px;padding:3px 3px 3px 9px;margin:4px 0}',
    '.cs-pl .ic{font-size:18px;flex:none}.cs-pl .nm{flex:1;min-width:0;line-height:1.2;font-size:12.5px}',
    '.cs-pl .nm small{display:block;color:var(--muted,#9aa5c8);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cs-pl .nm small.bad{color:var(--enemy,#ef476f)}',
    '.cs-pl .pr{color:var(--gold,#ffd166);font-weight:700;flex:none;font-size:12.5px}',
    '.cs-pl button{flex:none;width:36px;height:36px;border:0;border-radius:8px;background:var(--panel,#1c2340);font-size:14px}',
    '.cs-to{font-size:12px;color:var(--ok,#06d6a0);margin:5px 2px}',
    // units
    '.cs-u{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:0 7px;background:var(--panel2,#252e52);border-radius:10px;padding:5px 4px 4px 8px;margin:5px 0;border:1px solid transparent}',
    '.cs-u .ic{grid-row:1/3}.cs-u .nm{grid-column:2/4}.cs-u .cs-st{grid-row:2;grid-column:3}.cs-u .sub{grid-row:2;grid-column:2}',
    '.cs-u.active{border-color:var(--gold,#ffd166)}.cs-u.locked .ic,.cs-u.locked .nm{opacity:.6}',
    '.cs-u .ic{font-size:20px;flex:none;display:flex}',
    '.cs-u .nm{min-width:0;line-height:1.2;font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cs-u .sub{min-width:0;line-height:1.25;font-size:10.5px;color:var(--muted,#9aa5c8)}',
    '.cs-u .sub small{color:var(--gold,#ffd166);font-weight:700;font-size:11px}.cs-u.cant .sub small{color:var(--enemy,#ef476f)}',
    '.cs-u .sub i{display:block;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-u.locked .sub i{color:var(--gold,#ffd166)}',
    '.cs-u .cs-st{gap:2px}.cs-u .cs-st b{min-width:20px;font-size:15px}',
    '.cs-u .cs-st button{width:34px;height:38px}',
    // techs
    '.cs-seg{display:grid;grid-template-columns:1fr 1fr;gap:3px;background:var(--panel2,#252e52);border-radius:10px;padding:3px;margin-bottom:4px}',
    '.cs-seg button{border:0;background:none;color:var(--muted,#9aa5c8);font-size:11.5px;font-weight:600;padding:8px 2px;border-radius:8px}',
    '.cs-seg button.on{background:var(--panel,#1c2340);color:var(--text,#e8ecf8)}',
    '.cs-seg button.on.me{background:#2c62c9;color:#fff}.cs-seg button.on.enemy{background:#c62f47;color:#fff}',
    '.cs-chips{display:flex;flex-wrap:wrap;gap:5px}',
    '.cs-tc{border:1px solid var(--line,#33406e);background:var(--panel2,#252e52);border-radius:999px;padding:7px 10px;font-size:12px;min-height:36px}',
    '.cs-tc.owned{background:rgba(6,214,160,.18);border-color:var(--ok,#06d6a0);color:var(--ok,#06d6a0)}',
    '.cs-tc.planned{background:rgba(255,209,102,.2);border-color:var(--gold,#ffd166);color:var(--gold,#ffd166);font-weight:700}',
    '.cs-tc.locked{opacity:.35}.cs-tc.cant{color:var(--enemy,#ef476f)}',
    // plan list
    '.cs-pr{display:flex;align-items:center;gap:7px;background:var(--panel2,#252e52);border-radius:10px;padding:3px 3px 3px 9px;margin:4px 0;width:100%;text-align:left;border:0}',
    '.cs-pr .ic{flex:none;font-size:17px;display:flex}',
    '.cs-pr .nm{flex:1;min-width:0;line-height:1.2;font-size:12.5px}',
    '.cs-pr .nm small{display:block;color:var(--muted,#9aa5c8);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cs-pr .nm small.bad{color:var(--enemy,#ef476f)}',
    '.cs-pr .pr{flex:none;color:var(--gold,#ffd166);font-weight:700;font-size:12.5px}',
    '.cs-pr .go,.cs-pr .rm{flex:none;width:36px;height:36px;border:0;border-radius:8px;background:var(--panel,#1c2340);font-size:14px}',
    '.cs-sum{display:flex;justify-content:space-between;font-size:12.5px;padding:7px 4px;border-top:1px solid var(--line,#33406e);margin-top:6px}',
    '.cs-sum b.neg{color:var(--enemy,#ef476f)}',
    '.cs-end{width:100%;border:0;border-radius:11px;padding:12px;font-weight:800;background:var(--gold,#ffd166);color:#222!important;font-size:14px;margin-top:8px}',
    '.cs-end.neg{background:var(--enemy,#ef476f);color:#fff!important}',
    '.cs-sm{white-space:nowrap;flex:none;border:1px solid var(--line,#33406e);background:none;border-radius:9px;padding:8px 10px;font-size:12px;min-height:36px}',
    '.cs-foot{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:8px}',
    '.cs-name{flex:1;min-width:0;height:36px;background:var(--bg,#12172b);border:1px solid var(--line,#33406e);border-radius:9px;padding:0 8px;color:inherit;font:inherit}',
    '.cs-fc{background:var(--panel2,#252e52);border-radius:10px;padding:8px 10px;margin-top:8px;font-size:12.5px;line-height:1.4}',
    '.cs-fc b:last-of-type{color:var(--gold,#ffd166)}',
    // ---- ring menu around the tapped tile (HTML overlay on the map)
    '.csr{position:absolute;left:0;top:0;width:0;height:0;z-index:4;pointer-events:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.csr-b{position:absolute;left:0;top:0;width:var(--b,44px);height:var(--b,44px);margin:0;padding:0;border:0;background:none;pointer-events:auto;transform:translate(-50%,-50%);touch-action:manipulation;cursor:pointer;color:#fff;font:inherit;-webkit-tap-highlight-color:transparent;transition:left .14s ease,top .14s ease}',
    '.csr-c{position:absolute;inset:0;border-radius:50%;background:rgba(14,18,36,.86);box-shadow:0 0 0 2px rgba(255,255,255,.6),0 3px 10px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-size:21px;line-height:1}',
    '.csr-c svg{display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}',
    // label pill under each button: name (may wrap to 2 lines) + cost
    '.csr-p{position:absolute;left:50%;top:100%;transform:translate(-50%,-30%);background:rgba(8,10,22,.9);color:#e8ecf8;font-weight:700;font-size:10.5px;line-height:12px;padding:2px 5px 2px;border-radius:7px;width:max-content;max-width:78px;text-align:center;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.55);letter-spacing:-.1px}',
    '.csr-p b{display:block;font-weight:700;white-space:normal}',
    '.csr-p i{display:block;font-style:normal;color:#ffd166;font-weight:800;font-size:10.5px;white-space:nowrap}',
    '.csr-b.cant .csr-p i{color:#ff7a95}',
    '.csr-b.lock .csr-p i{color:#c9b98a}',
    '.csr-b:active .csr-c{transform:scale(.9)}',
    '.csr-b.on .csr-c{background:rgba(92,70,10,.92);box-shadow:0 0 0 3px #ffd166,0 0 12px rgba(255,209,102,.65)}',
    '.csr-b.on .csr-p{background:#ffd166;color:#222}.csr-b.on .csr-p i{color:#5a3d00}',
    '.csr-b.on .csr-p i::before{content:"✓ planned · "}',
    '.csr-b.bad .csr-c{box-shadow:0 0 0 3px #ef476f}',
    '.csr-b.lock .csr-c>*{opacity:.62}.csr-b.lock .csr-c{background:rgba(14,18,36,.74)}',
    '.csr-b.me .csr-c{box-shadow:0 0 0 3px #3a86ff,0 3px 10px rgba(0,0,0,.55)}.csr-b.en .csr-c{box-shadow:0 0 0 3px #ef476f,0 3px 10px rgba(0,0,0,.55)}',
    '.csr-b.me.cur .csr-c,.csr-b.en.cur .csr-c{background:rgba(76,201,240,.35)}',
    '.csr-b.miss .csr-c{box-shadow:0 3px 10px rgba(0,0,0,.55);border:2px dashed rgba(255,255,255,.7)}',
    '.csr-b.dim .csr-c{opacity:.45}',
    '.csr-b.cur .csr-c{box-shadow:0 0 0 3px #4cc9f0,0 0 10px rgba(76,201,240,.6)}',
    '.csr-l,.csr-k{position:absolute;font-style:normal;pointer-events:none;line-height:1}',
    '.csr-l{right:-5px;top:-6px;font-size:13px;filter:drop-shadow(0 1px 1px #000)}',
    '.csr-k{right:-5px;top:-6px;width:18px;height:18px;border-radius:50%;background:#ffd166;color:#222;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.6)}',
    '.csr-r{position:absolute;right:-6px;bottom:-4px;font-size:12px;font-style:normal;pointer-events:none;filter:drop-shadow(0 1px 1px #000)}',
    // centre: ⌂ Home / ✕ Close button (looks like a button: solid fill, cyan rim, caption inside)
    '.csr-b.mid .csr-c{background:#1b6f8c;box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(76,201,240,.55),0 3px 10px rgba(0,0,0,.6);flex-direction:column;gap:0}',
    '.csr-b.mid .csr-c .fx{font-size:19px;line-height:17px;font-weight:900}',
    '.csr-b.mid .csr-c small{font-size:9px;font-weight:800;letter-spacing:.3px;line-height:10px;text-transform:uppercase}',
    '.csr-b.mid .csr-p{color:#bfefff;max-width:110px}',
    '.csr-b.mid.back .csr-c{background:rgba(28,35,64,.95)}',
    '.csr-b.opt .csr-c{border:2px dashed rgba(255,255,255,.75);background:rgba(14,18,36,.8)}',
    '.csr-b.more .csr-c{font-size:20px;font-weight:900;color:#e8ecf8}',
    '.csr.anim .csr-b{animation:csrPop .24s cubic-bezier(.2,.9,.3,1.2) both;animation-delay:calc(var(--i,0) * 12ms)}',
    '@keyframes csrPop{from{transform:translate(calc(-50% + var(--dx,0px)),calc(-50% + var(--dy,0px))) scale(.25);opacity:0}}',
  ].join('\n');
  (function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('cs-style')) return;
    var s = document.createElement('style');
    s.id = 'cs-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  })();

  // ---------- local UI state ----------
  var tab = 'tile';         // tile | units | tech | plan
  var techMode = 'plan';    // plan | owned
  var sel = null;           // selected tile { c, r } = tile with the open ring
  var ring = null;          // { sub: null | 'home', page: n } while the ring is open
  var showBld = false;      // "existing building" chooser open (panel)
  var panelEl = null, scrollTop0 = false;

  // ---------- helpers ----------
  function esc(s) {
    if (PP.ui && PP.ui.esc) return PP.ui.esc(String(s));
    return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; });
  }
  function toast(m, ms) { if (PP.ui && PP.ui.toast) PP.ui.toast(m, ms); }
  function items() { return PP.ITEMS || []; }
  function item(id) { return (PP.ITEM && PP.ITEM[id]) || items().filter(function (i) { return i.id === id; })[0] || null; }
  function TER(id) { return PP.TERRAIN && PP.TERRAIN[id]; }
  function RES(id) { return PP.RESOURCE && PP.RESOURCE[id]; }
  function terName(id) { return TER_NAME[id] || (TER(id) || {}).name || id; }
  // terrain + resources → Home choice id ('crop' for a field with Crop)
  function homeId(T, res) {
    if (T !== 'field') return T;
    for (var k in HOME_RES) if ((res || []).indexOf(k) >= 0) return k;
    return T;
  }
  function tileName(T, res) { var h = homeId(T, res); return HOME_RES[h] || terName(T); }
  function tileIcon(T, res) { var h = homeId(T, res); return HOME_RES[h] ? ((RES(h) || {}).icon || '🌾') : (TER(T) || {}).icon || '?'; }
  function resName(id) { return RES_NAME[id] || (RES(id) || {}).name || id; }
  function itemNote(it) { return it && (NOTE[it.id] !== undefined ? NOTE[it.id] : it.note); }
  function techName(id) { return (PP.TECH && PP.TECH[id] && PP.TECH[id].name) || id; }
  function star(n) { return (n < 0 ? '+' + (-n) : String(n)) + ' ★'; }
  function isBuilding(id) { return BUILDINGS.indexOf(id) >= 0; }
  function uid() { return PP.util && PP.util.uid ? PP.util.uid() : Math.random().toString(36).slice(2, 10); }
  function tkey(c, r) { return c + ',' + r; }
  function S() { return PP.state || (PP.state = {}); }
  function commit() { if (PP.app && PP.app.commit) PP.app.commit(); }
  function refresh() { if (PP.app && PP.app.refresh) PP.app.refresh(); }
  function isSheet() { return !!(PP.drawer && PP.drawer.isSheet && PP.drawer.isSheet()); }
  function coarse() { return isSheet() || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches); }
  function hasIcon(n) { return !!(n && PP.icons && PP.icons.has && PP.icons.has(n)); }
  // icon html: game-style vector symbol if there is one, else the emoji
  function iconHtml(name, emoji, px) {
    return hasIcon(name) ? PP.icons.svg(name, px, { stroke: 'rgba(0,0,0,.45)' }) : '<span>' + (emoji || '?') + '</span>';
  }
  function itemIcon(it, px) { return iconHtml(ITEM_ICON[it.id], it.icon, px); }

  function B() {
    var s = S(), b = s.build = s.build || {};
    if (typeof b.stars !== 'number' || !isFinite(b.stars)) b.stars = 5;
    if (typeof b.income !== 'number' || !isFinite(b.income)) b.income = 2;
    if (!Array.isArray(b.owned)) b.owned = [];
    if (!Array.isArray(b.planned)) b.planned = [];
    if (!b.unitCounts || typeof b.unitCounts !== 'object') b.unitCounts = {};
    if (!Array.isArray(b.placements)) b.placements = [];
    if (!b.cityUnits || typeof b.cityUnits !== 'object') b.cityUnits = {}; // cityId → { type: n } (part of unitCounts)
    if (!Array.isArray(b.noCity)) b.noCity = [];                           // tiles the user marked "not a city"
    return b;
  }

  // ---------- cities (PP.state.cities, shared with MARKET / engine) ----------
  function cities() { var s = S(); if (!Array.isArray(s.cities)) s.cities = []; return s.cities; }
  function cityAt(c, r) {
    if (B().noCity.indexOf(tkey(c, r)) >= 0) return null;
    return cities().filter(function (x) { return x && x.c === c && x.r === r; })[0] || null;
  }
  function cityById(id) { return cities().filter(function (x) { return x && x.id === id; })[0] || null; }
  function cityLabel(ci) { return ci ? (ci.name ? ci.name : 'City ' + ci.c + ',' + ci.r) : 'City'; }
  // v16: no city detection in Costs – cities are marked by hand (Home layer → My city) or come from other tools
  function syncCities() { /* kept for callers; nothing is detected any more */ }
  function touchCity(ci) { if (ci.src === 'auto') ci.src = 'user'; }
  function cityUnitSum(type) {
    var cu = B().cityUnits, n = 0;
    Object.keys(cu).forEach(function (id) { n += +(cu[id] || {})[type] || 0; });
    return n;
  }
  function dropCityUnits(id) {
    var m = B().cityUnits[id] || {};
    Object.keys(m).forEach(function (k) { addUnit(k, -(+m[k] || 0), id); });
    delete B().cityUnits[id];
  }
  function addUnit(type, d, cityId) {
    var b = B(), u = PP.UNITS && PP.UNITS[type];
    if (!u) return;
    if (cityId) {
      var m = b.cityUnits[cityId] = b.cityUnits[cityId] || {};
      var v = Math.max(0, (+m[type] || 0) + d), dd = v - (+m[type] || 0);
      if (v) m[type] = v; else delete m[type];
      if (!Object.keys(m).length) delete b.cityUnits[cityId];
      var t = Math.max(0, (+b.unitCounts[type] || 0) + dd);
      if (t) b.unitCounts[type] = t; else delete b.unitCounts[type];
    } else {
      var n = Math.max(0, (+b.unitCounts[type] || 0) + d);
      if (n) b.unitCounts[type] = n; else delete b.unitCounts[type];
      // fewer than tagged → drop city tags (last city first)
      var ids = Object.keys(b.cityUnits);
      while (cityUnitSum(type) > n && ids.length) {
        var id = ids.pop(), mm = b.cityUnits[id];
        if (mm && mm[type]) { mm[type]--; if (!mm[type]) delete mm[type]; if (!Object.keys(mm).length) delete b.cityUnits[id]; ids.push(id); }
      }
    }
  }
  function tiles() {
    var s = S();
    if (!s.tiles || typeof s.tiles !== 'object' || Array.isArray(s.tiles)) s.tiles = {};
    return s.tiles;
  }
  // number of own cities (tech cost): detected own cities or the editable count in the tech tab
  function cityCount() {
    var own = (S().cities || []).filter(function (c) { return c && c.side === 'me'; }).length;
    return Math.max(1, own, +B().cityCount || 1);
  }
  function hasTech(id) { var b = B(); return !id || b.owned.indexOf(id) >= 0 || b.planned.indexOf(id) >= 0; }
  function techAvail(t) { return !t.parent || hasTech(t.parent); }
  function techCost(t) {
    if (PP.engine && PP.engine.techCost) return PP.engine.techCost(t, cityCount(), B().owned);
    return (t.tier || 1) * cityCount() + 4;
  }

  // ---------- tile annotation (manual only) ----------
  // stored terrain (user / market). Tiles stored as 'auto' by older versions (detection) count as unknown.
  function storedTerrain(c, r) {
    var t = tiles()[tkey(c, r)];
    return t && TER(t.terrain) && t.src !== 'auto' ? t : null;
  }
  function baseTile(c, r) {
    var t = storedTerrain(c, r);
    if (t) return { terrain: t.terrain, res: Array.isArray(t.res) ? t.res.slice() : [], bld: t.bld || null, stored: true, src: t.src || 'user' };
    return { terrain: 'field', res: [], bld: null, stored: false, src: 'none' };
  }
  // write terrain/res/bld while keeping other fields (MARKET shares `tiles`)
  function storeTile(c, r, patch) {
    var T = tiles(), k = tkey(c, r), cur = T[k] || {}, bt = baseTile(c, r);
    var o = Object.assign({}, cur, { terrain: bt.terrain, res: bt.res, bld: bt.bld, src: cur.src || bt.src }, patch || {});
    o.res = (o.res || []).filter(function (x, i, a) { return RES(x) && a.indexOf(x) === i; });
    if (o.bld === undefined) o.bld = null;
    T[k] = o;
    return o;
  }
  function placementsAt(c, r) { return B().placements.filter(function (p) { return p.c === c && p.r === r; }); }

  // Walk the tile's planned actions in order: terrain changes, consumed resources, occupation.
  // → { base, terrain, res, occupied (item id | 'existing'), steps: [{ p, it, ok, why }] }
  function tileFlow(c, r) {
    var base = baseTile(c, r), T = base.terrain, res = base.res.slice(), steps = [];
    var occ = base.bld ? base.bld : null, road = false, pls = placementsAt(c, r);
    // nothing is detected: a planned resource action (Harvest Fruit, Farm, Hunt, Mine, Fish) implies that the base
    // tile has that resource
    pls.forEach(function (p) {
      var it = item(p.item), R = it && it.needs && RES(it.needs);
      // (also Farm → Crop: farms planned before the Crop button existed must not be flagged)
      if (R && R.terrain === T && res.indexOf(it.needs) < 0) res.push(it.needs);
    });
    var resNow = function () { return res.filter(function (id) { var R = RES(id); return R && R.terrain === T; }); };
    pls.forEach(function (p) {
      var it = item(p.item), why = '';
      if (!it) why = 'unknown';
      else if (it.terrain && it.terrain.indexOf(T) < 0) why = 'not possible on ' + terName(T);
      else if (it.needs && resNow().indexOf(it.needs) < 0) why = 'needs ' + resName(it.needs);
      else if (occ && (isBuilding(it.id) || it.turnsInto)) why = 'tile has a building (' + ((item(occ) || {}).name || occ) + ')';
      else if (needsFreeTile(it) && resNow().indexOf('crop') >= 0) why = 'Crop tile – only Farm or Road';
      else if (needsFreeTile(it) && resNow().length) why = 'tile has ' + resNow().map(resName).join(', ') + ' – use it first';
      else if (it.id === 'road' && road) why = 'duplicate';
      steps.push({ p: p, it: it, ok: !why, why: why });
      if (why || !it) return;
      // Destroy (planned by the Market tool) frees the tile for the next building
      if (it.id === 'destroy') { occ = null; return; }
      if (it.id === 'road') road = true;
      if (HARVEST.indexOf(it.id) >= 0 && it.needs) res = res.filter(function (x) { return x !== it.needs; });
      if (isBuilding(it.id)) occ = it.id;
      if (it.turnsInto) {
        T = it.turnsInto;
        res = res.filter(function (x) { var R = RES(x); return R && R.terrain === T; });
        if (it.gives && res.indexOf(it.gives) < 0) res.push(it.gives);
      }
    });
    return { base: base, terrain: T, res: resNow(), occupied: occ, road: road, steps: steps };
  }

  // ---------- economy: stars now − planned = left; next turn = left + income ----------
  function eco() {
    var b = B(), lines = [], warn = [], spent = 0;
    b.planned.forEach(function (id) {
      var t = PP.TECH && PP.TECH[id];
      if (!t || b.owned.indexOf(id) >= 0) return;
      var cost = techCost(t);
      lines.push({ kind: 'tech', id: id, icon: '🔬', label: t.name, cost: cost });
      spent += cost;
    });
    Object.keys(b.unitCounts).forEach(function (k) {
      var n = +b.unitCounts[k] || 0, u = PP.UNITS && PP.UNITS[k];
      if (n <= 0 || !u || u.cost == null) return;
      lines.push({ kind: 'unit', id: k, icon: u.icon, label: (n > 1 ? n + '× ' : '') + u.name, cost: u.cost * n, n: n });
      spent += u.cost * n;
      if (u.tech && !hasTech(u.tech)) warn.push(u.name + ' needs ' + techName(u.tech));
    });
    var seen = {}, bad = 0, nTiles = 0, badList = [];
    b.placements.forEach(function (p) {
      var it = item(p.item);
      if (!it) return;
      spent += it.cost;
      if (it.tech && !hasTech(it.tech) && !seen['t' + it.tech]) { seen['t' + it.tech] = 1; warn.push(it.name + ' needs ' + techName(it.tech)); }
      var k = tkey(p.c, p.r);
      if (!seen[k]) {
        seen[k] = 1; nTiles++;
        tileFlow(p.c, p.r).steps.forEach(function (s) {
          if (s.ok) return;
          bad++;
          if (badList.length < 3) badList.push(((s.it && s.it.name) || p.item) + ' on tile ' + p.c + ',' + p.r + ': ' + s.why);
        });
      }
    });
    if (bad) warn.push(bad + ' tile action' + (bad > 1 ? 's don\'t' : ' doesn\'t') + ' fit the terrain – ' + badList.join(' · ') + (bad > badList.length ? ' …' : ''));
    Object.keys(b.cityUnits).forEach(function (id) {
      var m = b.cityUnits[id], ci = cityById(id), n = 0;
      Object.keys(m || {}).forEach(function (k) { n += +m[k] || 0; });
      if (ci && n > 1) warn.push(cityLabel(ci) + ': ' + n + ' units – a city trains one per turn');
    });
    var rest = b.stars - spent;
    if (rest < 0) warn.unshift('Short by ' + (-rest) + ' ★');
    return { lines: lines, spent: spent, rest: rest, stars: b.stars, income: b.income, nTiles: nTiles,
      nextTurn: Math.max(0, rest) + b.income, warnings: warn };
  }

  // ---------- actions ----------
  function select(c, r) {
    var same = sel && sel.c === c && sel.r === r;
    sel = { c: c, r: r };
    if (!same) { showBld = false; scrollTop0 = true; }
    if (!isSheet()) tab = 'tile';
    // own city → unit ring; known terrain → Actions layer; unknown tile (or someone else's city) → Home layer
    var ci = cityAt(c, r);
    ring = { sub: (ci ? ci.side === 'me' : !!storedTerrain(c, r)) ? null : 'home', page: 0 };
    commit();
    autoPan();
  }
  // ring geometry shared by autoPan + layout: buttons are spaced so that the labelled pills don't overlap
  function ringDims(n) {
    var touch = coarse(), bs = touch ? 46 : 42, ts = PP.board && PP.board.tileScreenSize ? PP.board.tileScreenSize() : { w: 60 };
    var gap = 82, rMin = Math.max(touch ? 66 : 62, Math.min(110, ts.w * 0.5 + bs * 0.4));
    var R = n <= 1 ? 0 : n <= 4 ? rMin : Math.max(rMin, (gap / 2) / Math.sin(Math.PI / n));
    return { bs: bs, ms: touch ? 44 : 40, gap: gap, rMin: rMin, R: R, lab: 30, lw: 80 };
  }
  // tile tapped close to the edge of the visible map → glide the map a bit so the whole ring fits around it
  var panAnim = 0;
  function autoPan() {
    if (!sel || !ring || !PP.board || !PP.board.visibleRect || !PP.board.setView) return;
    var m = ringModel(eco()); if (!m) return;
    var n = Math.min(9, m.items.length), D = ringDims(n), R = n ? D.R : 0;
    var vr = PP.board.visibleRect(), p = PP.board.tileToScreen(sel.c, sel.r);
    var mx = R + D.lw / 2 + 6, myT = R + D.bs / 2 + 6, myB = R + D.bs / 2 + D.lab + 6;
    if (vr.w < 2 * mx || vr.h < myT + myB) return;
    var dx = p.x < vr.x + mx ? vr.x + mx - p.x : p.x > vr.x + vr.w - mx ? vr.x + vr.w - mx - p.x : 0;
    var dy = p.y < vr.y + myT ? vr.y + myT - p.y : p.y > vr.y + vr.h - myB ? vr.y + vr.h - myB - p.y : 0;
    if (!dx && !dy) return;
    var v0 = PP.board.view, t0 = 0, dur = 180;
    cancelAnimationFrame(panAnim);
    function step(ts2) {
      if (!t0) t0 = ts2;
      var k = Math.min(1, (ts2 - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      PP.board.setView({ x: v0.x + dx * e, y: v0.y + dy * e, s: v0.s });
      if (k < 1) panAnim = requestAnimationFrame(step);
    }
    panAnim = requestAnimationFrame(step);
  }
  // after a pick: the ring closes at once, the tile stays selected (panel) and its plan chip flashes briefly
  var flash = null;
  function doneRing(c, r) {
    ring = null;
    flash = { k: tkey(c, r), t: Date.now() };
    var tick = function () { if (PP.board && PP.board.redraw) PP.board.redraw(); if (flash && Date.now() - flash.t < 750) setTimeout(tick, 30); else flash = null; };
    setTimeout(tick, 30);
  }
  function closeRing() { sel = null; ring = null; refresh(); }

  function setTerrain(c, r, id) {
    var withRes = HOME_RES[id] ? id : null;
    if (withRes) id = 'field';
    var bt = baseTile(c, r), keep = withRes ? [withRes] : bt.res.filter(function (x) { var R = RES(x); return R && R.terrain === id && EXPLICIT_RES.indexOf(x) < 0; });
    var bld = bt.bld && item(bt.bld) && item(bt.bld).terrain && item(bt.bld).terrain.indexOf(id) >= 0 ? bt.bld : null;
    storeTile(c, r, { terrain: id, res: keep, bld: bld, src: 'user' });
    // plans that no longer fit the corrected terrain are dropped
    var n = pruneTile(c, r);
    commit();
    return n;
  }
  function toggleRes(c, r, id) {
    var bt = baseTile(c, r), res = bt.res, i = res.indexOf(id);
    if (i >= 0) res.splice(i, 1); else res.push(id);
    storeTile(c, r, { terrain: bt.terrain, res: res, src: 'user' });
    commit();
  }
  function setBld(c, r, id) {
    var bt = baseTile(c, r);
    storeTile(c, r, { terrain: bt.terrain, bld: bt.bld === id ? null : id || null, src: 'user' });
    showBld = false;
    commit();
  }
  function markCity(c, r, side) {
    var b = B(), k = tkey(c, r), ci = cityAt(c, r);
    b.noCity = b.noCity.filter(function (x) { return x !== k; });
    ci = ci || cities().filter(function (x) { return x && x.c === c && x.r === r; })[0];
    if (!ci) { ci = { id: uid(), c: c, r: r, side: side, name: '', capital: false, src: 'user' }; cities().push(ci); }
    touchCity(ci); ci.side = side;
    if (side !== 'me') dropCityUnits(ci.id);
    var drop = placementsAt(c, r).length;
    if (drop) b.placements = b.placements.filter(function (p) { return !(p.c === c && p.r === r); });
    return drop;
  }
  function unmarkCity(ci) {
    B().noCity.push(tkey(ci.c, ci.r));
    dropCityUnits(ci.id);
    S().cities = cities().filter(function (x) { return x !== ci; });
  }

  // drop steps that became invalid after removing a terrain change / correcting the terrain
  function pruneTile(c, r) {
    var fl = tileFlow(c, r), drop = fl.steps.filter(function (s) { return !s.ok; }).map(function (s) { return s.p.id; });
    if (!drop.length) return 0;
    B().placements = B().placements.filter(function (p) { return drop.indexOf(p.id) < 0; });
    return drop.length;
  }

  function removePlacement(pid) {
    var b = B(), p = b.placements.filter(function (x) { return x.id === pid; })[0];
    if (!p) return;
    b.placements = b.placements.filter(function (x) { return x.id !== pid; });
    var it = item(p.item), n = it && it.turnsInto ? pruneTile(p.c, p.r) : 0;
    if (n) toast((it ? it.name : 'Action') + ' removed (+' + n + ' dependent)', 1600);
    commit();
  }

  function tapItem(c, r, id, addRes) {
    var b = B(), it = item(id);
    if (!it) return;
    var mine = placementsAt(c, r).filter(function (p) { return p.item === id; })[0];
    if (mine) { removePlacement(mine.id); return; }
    var fl = tileFlow(c, r);
    if (addRes && it.needs && fl.res.indexOf(it.needs) < 0) {
      // resource not on the tile: tick it on the base tile (if it belongs to the base terrain)
      var bt = baseTile(c, r), R = RES(it.needs);
      if (R && R.terrain === bt.terrain && fl.terrain === bt.terrain) { bt.res.push(it.needs); storeTile(c, r, { terrain: bt.terrain, res: bt.res, src: 'user' }); }
      else { toast('No ' + (R ? R.icon + ' ' + resName(it.needs) : it.needs) + ' here'); return; }
      fl = tileFlow(c, r);
    }
    if (fl.base.bld && (isBuilding(id) || it.turnsInto)) {
      toast('Already has ' + ((item(fl.base.bld) || {}).name || 'a building') + ' – change it in the panel (Tile)');
      return;
    }
    // one building per tile: a planned building is replaced
    var repl = '';
    if (isBuilding(id) && fl.occupied && fl.occupied !== fl.base.bld) {
      var old = placementsAt(c, r).filter(function (p) { return p.item === fl.occupied; })[0];
      if (old) { b.placements = b.placements.filter(function (p) { return p.id !== old.id; }); repl = ' (replaces ' + (item(old.item) || {}).name + ')'; }
    }
    if (!storedTerrain(c, r)) storeTile(c, r, { src: 'user' });
    b.placements.push({ id: uid(), c: c, r: r, item: id });
    if (repl) toast(it.name + repl, 1400);
    if (ring) ring.page = 0;
    commit();
  }

  // city ring: one unit per city and turn → tap = plan it (replaces another one), tap again = remove
  function tapCityUnit(ci, k) {
    var b = B(), m = b.cityUnits[ci.id] || {}, u = PP.UNITS[k], had = +m[k] || 0;
    if (!u) return;
    if (had) { addUnit(k, -had, ci.id); commit(); return; }
    var old = Object.keys(m).filter(function (x) { return +m[x] > 0; });
    old.forEach(function (x) { addUnit(x, -(+m[x] || 0), ci.id); });
    addUnit(k, 1, ci.id);
    if (old.length) toast(u.name + ' replaces ' + old.map(function (x) { return PP.UNITS[x].name; }).join(', ') + ' (1 per turn)', 1600);
    commit();
  }

  function unplanTech(id) {
    var b = B();
    b.planned = b.planned.filter(function (x) { return x !== id; });
    (PP.TECHS || []).forEach(function (t) { if (t.parent === id && b.planned.indexOf(t.id) >= 0 && b.owned.indexOf(id) < 0) unplanTech(t.id); });
  }
  function ownTech(id) {
    var b = B();
    if (b.owned.indexOf(id) < 0) b.owned.push(id);
    b.planned = b.planned.filter(function (x) { return x !== id; });
    var t = PP.TECH[id];
    if (t && t.parent) ownTech(t.parent);
  }
  function unownTech(id) {
    var b = B();
    b.owned = b.owned.filter(function (x) { return x !== id; });
    PP.TECHS.forEach(function (t) { if (t.parent === id && b.owned.indexOf(t.id) >= 0) unownTech(t.id); });
    PP.TECHS.forEach(function (t) { if (b.planned.indexOf(t.id) >= 0 && !techAvail(t)) unplanTech(t.id); });
  }
  function tapTech(id) {
    var b = B(), t = PP.TECH[id];
    if (!t) return;
    if (techMode === 'owned') {
      if (b.owned.indexOf(id) >= 0) unownTech(id); else ownTech(id);
    } else {
      if (b.owned.indexOf(id) >= 0) { toast(t.name + ' is already researched'); return; }
      if (b.planned.indexOf(id) >= 0) unplanTech(id);
      else if (techAvail(t)) b.planned.push(id);
      else { // plan the missing parent chain too
        var chain = [], x = t;
        while (x && !hasTech(x.id)) { chain.unshift(x.id); x = x.parent ? PP.TECH[x.parent] : null; }
        chain.forEach(function (cid) { if (b.planned.indexOf(cid) < 0) b.planned.push(cid); });
        toast('Also planned: ' + chain.map(techName).join(' → '));
      }
    }
    commit();
  }

  function endTurn() {
    var e = eco();
    function go() {
      var b = B(), done = {};
      b.planned.forEach(function (id) { if (b.owned.indexOf(id) < 0) b.owned.push(id); });
      b.placements.forEach(function (p) {
        var k = tkey(p.c, p.r);
        if (done[k]) return;
        done[k] = 1;
        var fl = tileFlow(p.c, p.r);
        storeTile(p.c, p.r, { terrain: fl.terrain, res: fl.res, bld: fl.occupied || null, src: 'user' });
      });
      b.stars = e.nextTurn;
      b.planned = []; b.placements = []; b.unitCounts = {}; b.cityUnits = {};
      sel = null; ring = null;
      commit();
      toast('New turn: ' + b.stars + ' ★ · income ' + b.income + ' ★/turn', 3000);
    }
    if (e.rest < 0) {
      var ok = PP.ui && PP.ui.confirm ? PP.ui.confirm('Short by ' + (-e.rest) + ' ★. End turn anyway?') : true;
      if (ok && typeof ok.then === 'function') ok.then(function (v) { if (v) go(); });
      else if (ok) go();
    } else go();
  }
  function clearPlan() {
    var b = B();
    b.planned = []; b.placements = []; b.unitCounts = {}; b.cityUnits = {};
    commit();
    toast('Plan cleared');
  }

  // ================================================================ ring menu
  // model of the ring for the selected tile: { mid: button, items: [button] }
  // button: { k: action key, ic: html, nm: name, cost: '3 ★' | '', cls: [], title }
  //   ring.sub 'home' – Home layer: Empty / Forest / Mountain / Water / My city; centre = ✕ Close
  //   ring.sub null   – Actions layer: everything the terrain allows (own city: unit training); centre = ⌂ Home
  function homeMid(ci, bt, fl) {
    var nm;
    if (ci) nm = ci.side === 'me' ? cityLabel(ci) : ci.side === 'enemy' ? 'Enemy city' : 'City';
    else {
      var T = fl ? fl.terrain : bt.terrain, b0 = bt.bld && item(bt.bld);
      nm = (fl && T !== bt.terrain ? tileName(bt.terrain, bt.res) + ' → ' : '') + tileName(T, fl ? fl.res : bt.res) + (b0 ? ' · ' + b0.name : '');
    }
    return { k: 'home', ic: '<span class="fx">⌂</span><small>Home</small>', nm: nm, cls: ['mid'],
      title: 'Home – choose the terrain (Empty, Crop, Fruit, Forest, Mountain, Water) or your city' };
  }
  function ringModel(e) {
    if (!sel || !ring) return null;
    var c = sel.c, r = sel.r, ci = cityAt(c, r), out = { items: [] }, bt = baseTile(c, r);
    if (ring.sub === 'home') {
      HOME_TER.forEach(function (id) {
        var t = HOME_RES[id] ? { icon: (RES(id) || {}).icon || '🌾' } : TER(id) || { icon: '?' }, nm = HOME_RES[id] || terName(id);
        out.items.push({ k: 'ter:' + id, ic: iconHtml(id, t.icon, 30), nm: nm, cls: !ci && bt.stored && homeId(bt.terrain, bt.res) === id ? ['cur'] : [],
          title: id === 'crop' ? 'Crop – Empty land with Crop (for Farm)' : id === 'fruit' ? 'Fruit – Empty land with Fruit (harvest)' : nm });
      });
      out.items.push({ k: 'city:me', ic: iconHtml('city', '🏠', 30), nm: 'My city', cls: ci && ci.side === 'me' ? ['me', 'cur'] : ['me'], title: 'My city – train units here' });
      out.mid = { k: 'close', ic: '<span class="fx">✕</span><small>Close</small>', nm: 'What is here?', cls: ['mid', 'back'], title: 'Close' };
      return out;
    }
    if (ci) {
      out.mid = homeMid(ci, bt);
      if (ci.side !== 'me') return out;
      var cu = B().cityUnits[ci.id] || {}, U = PP.UNITS || {};
      Object.keys(U).forEach(function (k) {
        var u = U[k];
        if (u.cost == null) return;
        var on = +cu[k] > 0, lock = !hasTech(u.tech), cls = [];
        if (on) cls.push('on'); else if (u.cost > e.rest) cls.push('cant');
        if (lock && !on) cls.push('lock');
        out.items.push({ k: 'unit:' + k, ic: iconHtml(k, u.icon, 30), nm: u.name, cost: u.cost + ' ★', cls: cls, lock: lock && !on, cnt: +cu[k] > 1 ? cu[k] : 0,
          title: u.name + ' – ' + u.cost + ' ★' + (lock ? ' (needs ' + techName(u.tech) + ')' : '') });
      });
      return out;
    }
    var fl = tileFlow(c, r), T = fl.terrain, T0 = fl.base.terrain, planned = fl.steps.map(function (s) { return s.p.item; });
    out.mid = homeMid(null, bt, fl);
    if (NO_RING.indexOf(T) >= 0 && !fl.steps.length) { out.mid.nm += ' · nothing to build'; return out; }
    // planned steps of an earlier terrain (e.g. Hunt before Clear Forest) stay in the ring so one tap removes them
    fl.steps.forEach(function (st) {
      if (!st.it || !st.it.terrain || st.it.terrain.indexOf(T) >= 0) return;
      out.items.push(itemBtn(st.it, { on: 1, bad: !st.ok, rest: e.rest }));
    });
    var list = [];
    items().forEach(function (it) {
      if (it.terrain && it.terrain.indexOf(T) < 0) return;
      if (NO_RING.indexOf(T) >= 0) return;
      var on = planned.indexOf(it.id) >= 0, st = fl.steps.filter(function (s) { return s.p.item === it.id; })[0];
      if (!on) {
        if (it.turnsInto && T !== T0) return;                                  // no way straight back (Clear → Grow)
        if (it.needs && T !== T0 && fl.res.indexOf(it.needs) < 0) return;      // resource can't be there (after a change)
        if (it.needs && EXPLICIT_RES.indexOf(it.needs) >= 0 && fl.res.indexOf(it.needs) < 0) return; // Farm only on Crop
        if ((fl.res.indexOf('crop') >= 0 || fl.res.indexOf('fruit') >= 0) && (needsFreeTile(it) || (it.needs && fl.res.indexOf(it.needs) < 0))) return; // Crop / Fruit tile: its resource action + Road only
        if (fl.base.bld && (isBuilding(it.id) || it.turnsInto || it.id === 'road')) return; // tile already built
        if (it.id === 'road' && fl.road) return;
      }
      list.push(itemBtn(it, { on: on, bad: st && !st.ok, rest: e.rest }));
    });
    // order: resource actions, buildings, road, terrain changes
    var rank = function (b) { var it = item(b.id); return !it ? 9 : it.needs ? 0 : it.turnsInto ? 3 : it.id === 'road' ? 2 : 1; };
    list.sort(function (a, b) { return rank(a) - rank(b); });
    out.items = out.items.concat(list);
    return out;
  }
  function itemBtn(it, o) {
    var lock = !hasTech(it.tech), cls = [], note = itemNote(it);
    if (o.on) cls.push('on'); else if (it.cost > o.rest) cls.push('cant');
    if (o.bad) cls.push('bad');
    if (lock && !o.on) cls.push('lock');
    var badge = it.turnsInto && hasIcon(ITEM_ICON[it.id]) ? '<i class="csr-r">↻</i>' : '';
    return { id: it.id, k: 'it:' + it.id, ic: itemIcon(it, 30) + badge, nm: RING_NAME[it.id] || it.name, cost: star(it.cost), cls: cls, lock: lock && !o.on,
      title: it.name + ' – ' + star(it.cost) + (lock ? ' (needs ' + techName(it.tech) + ')' : '') + (note ? ' – ' + note : '') };
  }
  // ≤ 9 buttons: one ring; more → pages of 7 + a "more" button
  function ringPage(m) {
    var list = m.items, n = list.length;
    if (n <= 9) { ring.page = 0; return list; }
    var per = 7, pages = Math.ceil(n / per);
    if (ring.page >= pages) ring.page = 0;
    var part = list.slice(ring.page * per, ring.page * per + per);
    part.push({ k: 'more', ic: '<span>⋯</span>', nm: 'More', cost: (ring.page + 1) + '/' + pages, cls: ['more'], title: 'More' });
    return part;
  }

  var ringEl = null, ringHtml = '', ringKey = '', ringGeom = null, animT = 0, ringDown = 0;
  function ensureRing() {
    if (ringEl && ringEl.isConnected) return ringEl;
    var st = document.getElementById('stage');
    if (!st) return null;
    ringEl = document.createElement('div');
    ringEl.className = 'csr';
    ringEl.id = 'costRing';
    ringEl.addEventListener('click', onRingClick);
    // keep map gestures from starting under the buttons
    // (a click only counts if its press started on the ring – the tap that opened the ring must not hit a button
    // that appears under the finger)
    ringEl.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); ringDown = Date.now(); });
    st.appendChild(ringEl);
    return ringEl;
  }
  function hideRing() { if (ringEl) { ringEl.hidden = true; } ringGeom = null; }

  function btnHtml(b, i) {
    var lb = (b.nm ? '<b>' + esc(b.nm) + '</b>' : '') + (b.cost ? '<i>' + esc(b.cost) + '</i>' : '');
    return '<button type="button" class="csr-b ' + (b.cls || []).join(' ') + '" data-k="' + esc(b.k) + '" data-i="' + i + '" title="' + esc(b.title || '') +
      '" aria-label="' + esc(b.title || b.nm || '') + '"><span class="csr-c">' + b.ic + '</span>' +
      (lb ? '<span class="csr-p">' + lb + '</span>' : '') +
      (b.lock ? '<i class="csr-l">🔒</i>' : '') + (b.cnt ? '<i class="csr-k">' + b.cnt + '</i>' : '') + '</button>';
  }

  // angles (deg) + radius so all buttons (+ their label pills) stay inside the visible map part;
  // near an edge the arc turns/compresses
  function layoutRing(n, cx, cy, vr, D) {
    var bs = D.bs, gap = D.gap, rMin = D.rMin, pad = 4, lab = D.lab, hw = Math.max(bs, D.lw) / 2;
    function fits(x, y) {
      return x - hw >= vr.x + pad && x + hw <= vr.x + vr.w - pad && y - bs / 2 >= vr.y + pad && y + bs / 2 + lab <= vr.y + vr.h - pad;
    }
    function build(span, dir) {
      var full = span >= 360, step = n < 2 ? 0 : full ? 360 / n : span / (n - 1);
      var R = n < 2 ? rMin : Math.max(rMin, (gap / 2) / Math.sin(step * Math.PI / 360));
      var a0 = full ? dir : dir - span / 2, pts = [];
      for (var i = 0; i < n; i++) {
        var a = (a0 + i * step) * Math.PI / 180;
        pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
      }
      return { R: R, pts: pts };
    }
    if (!n) return { R: 0, pts: [], cx: cx, cy: cy };
    var spans = n <= 4 ? [Math.max(0, (n - 1) * 62)] : n <= 6 ? [360, 240, 180] : [360, 270, 210, 170];
    var dirs = [-90];
    for (var d = 15; d <= 180; d += 15) { dirs.push(-90 + d); dirs.push(-90 - d); }
    var best = null;
    for (var s = 0; s < spans.length; s++) {
      var dl = spans[s] >= 360 ? [-90] : dirs;
      for (var j = 0; j < dl.length; j++) {
        var L = build(spans[s], dl[j]);
        if (L.pts.every(function (p) { return fits(p.x, p.y); })) { L.score = L.R + (spans[s] < 360 && n > 4 ? 8 : 0); if (!best || L.score < best.score) best = L; break; }
      }
    }
    // alternative: the compact ring moved a little away from the edge (the middle button stays on the tile)
    var L0 = build(spans[0], -90), x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    L0.pts.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    var lo = vr.x + pad + hw, hi = vr.x + vr.w - pad - hw, tp = vr.y + pad + bs / 2, bt = vr.y + vr.h - pad - bs / 2 - lab;
    var sx = x0 < lo ? Math.min(lo - x0, hi - x1) : x1 > hi ? Math.max(hi - x1, lo - x0) : 0;
    var sy = y0 < tp ? Math.min(tp - y0, bt - y1) : y1 > bt ? Math.max(bt - y1, tp - y0) : 0;
    var sh = Math.hypot(sx, sy), sc = L0.R + sh * 0.6;
    if (!best || sc < best.score) {
      L0.pts.forEach(function (p) {
        var nx = Math.min(hi, Math.max(lo, p.x + sx)), ny = Math.min(bt, Math.max(tp, p.y + sy));
        if (Math.abs(nx - p.x - sx) > 1 || Math.abs(ny - p.y - sy) > 1) L0.squeezed = true; // map part too small
        p.x = nx; p.y = ny;
      });
      L0.cx = cx + sx; L0.cy = cy + sy;
      best = L0;
    }
    if (best.cx == null) { best.cx = cx; best.cy = cy; }
    return best;
  }

  function placeRing() {
    if (!sel || !ring || !PP.board || !PP.board.tileToScreen || (PP.modes && PP.modes.current !== 'cost')) { hideRing(); return; }
    var el = ensureRing();
    if (!el) return;
    var vr = PP.board.visibleRect ? PP.board.visibleRect() : { x: 0, y: 0, w: 9999, h: 9999 };
    var p = PP.board.tileToScreen(sel.c, sel.r);
    if (vr.w < 120 || vr.h < 120 || p.x < vr.x - 10 || p.x > vr.x + vr.w + 10 || p.y < vr.y - 10 || p.y > vr.y + vr.h + 10) { hideRing(); return; }
    var e = eco(), m = ringModel(e);
    if (!m) { hideRing(); return; }
    var list = ringPage(m), D = ringDims(list.length);
    var html = btnHtml(m.mid, 0) + list.map(function (b, i) { return btnHtml(b, i + 1); }).join('');
    var key = tkey(sel.c, sel.r) + '|' + ring.sub + '|' + ring.page + '|' + list.length;
    el.hidden = false;
    if (html !== ringHtml || !el.firstChild) { el.innerHTML = html; ringHtml = html; }
    if (key !== ringKey) {
      ringKey = key;
      el.classList.remove('anim'); void el.offsetWidth; el.classList.add('anim');
      clearTimeout(animT); animT = setTimeout(function () { if (ringEl) ringEl.classList.remove('anim'); }, 450);
    }
    var L = layoutRing(list.length, p.x, p.y, vr, D);
    if (L.squeezed) { hideRing(); return; }
    ringGeom = { cx: L.cx, cy: L.cy, R: L.R, bs: D.bs };
    var btns = el.children;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], q = i === 0 ? { x: L.cx, y: L.cy } : L.pts[i - 1];
      if (!q) continue;
      var sz = i === 0 ? D.ms : D.bs, lx = Math.round(q.x) + 'px', ly = Math.round(q.y) + 'px';
      if (b.style.left !== lx) b.style.left = lx;
      if (b.style.top !== ly) b.style.top = ly;
      b.style.setProperty('--b', sz + 'px');
      b.style.setProperty('--dx', Math.round(L.cx - q.x) + 'px');
      b.style.setProperty('--dy', Math.round(L.cy - q.y) + 'px');
      b.style.setProperty('--i', i);
    }
  }

  function onRingClick(ev) {
    var b = ev.target.closest ? ev.target.closest('.csr-b') : null;
    if (!b || !sel || !ring) return;
    ev.stopPropagation();
    if (ev.isTrusted !== false && Date.now() - ringDown > 1500 && ev.detail !== 0) return; // ghost click
    ringDown = 0;
    var k = b.dataset.k || '', c = sel.c, r = sel.r, ci = cityAt(c, r), pr = k.split(':');
    if (k === 'home') { ring.sub = 'home'; ring.page = 0; refresh(); return; }
    if (k === 'close') { closeRing(); return; }
    if (k === 'more') { ring.page++; ringKey = ''; refresh(); return; }
    if (pr[0] === 'it') { tapItem(c, r, pr[1]); doneRing(c, r); refresh(); return; }
    if (pr[0] === 'unit') { if (ci) tapCityUnit(ci, pr[1]); doneRing(c, r); refresh(); return; }
    // Home layer: store the terrain / own city and switch to the Actions layer
    if (pr[0] === 'ter') {
      if (ci) unmarkCity(ci);
      var n = setTerrain(c, r, pr[1]);
      ring.sub = null; ring.page = 0;
      if (n) toast((HOME_RES[pr[1]] || terName(pr[1])) + ' – ' + n + ' plan' + (n > 1 ? 's' : '') + ' removed', 1500);
      refresh(); return;
    }
    if (pr[0] === 'city') {
      var drop = markCity(c, r, pr[1]);
      ring.sub = null; ring.page = 0;
      if (drop) toast(drop + ' tile plan' + (drop > 1 ? 's' : '') + ' removed (city)', 1600);
      commit();
    }
  }

  // ================================================================ panel
  function stepper(key, val, input, label) {
    return '<span class="cs-st">' + (label ? '<span class="lb">' + label + '</span>' : '') +
      '<button data-st="' + key + '" data-d="-1" aria-label="less">−</button>' +
      (input ? '<input data-in="' + key + '" type="number" inputmode="numeric" min="0" value="' + val + '">' : '<b>' + val + '</b>') +
      '<button data-st="' + key + '" data-d="1" aria-label="more">+</button></span>';
  }

  function nPlanned(e) { return e.lines.length + B().placements.length; }

  // phone: slim row = everything the bottom sheet shows until "Plan" expands it
  function renderPeek(e) {
    var full = PP.drawer && PP.drawer.isPeek && !PP.drawer.isPeek() && tab === 'plan', n = nPlanned(e);
    return '<div class="cs-peek" data-peek="cost"><span class="lf"><b class="' + (e.rest < 0 ? 'neg' : '') + '">' + e.rest + '</b><span>★ left</span></span>' +
      '<span class="md"><span>planned <b class="' + (e.rest < 0 ? 'neg' : '') + '">' + star(e.spent) + '</b></span> · <span>next turn <b>' + e.nextTurn + ' ★</b></span></span>' +
      '<button class="pl' + (full ? ' on' : '') + '" data-act="plan">' + (full ? '⌄ Less' : '📋 Plan') + (n && !full ? '<em>' + n + '</em>' : '') + '</button></div>';
  }

  function renderBar(e, cmp) {
    var b = B();
    var pct = b.stars > 0 ? Math.min(100, Math.max(0, e.spent / b.stars * 100)) : (e.spent > 0 ? 100 : 0);
    var nPl = b.placements.length;
    var badge = { tile: nPl, units: Object.keys(b.unitCounts).reduce(function (s, k) { return s + (+b.unitCounts[k] || 0); }, 0),
      tech: b.planned.length, plan: nPlanned(e) };
    return '<div class="cs-bar' + (cmp ? ' cmp' : '') + '">' +
      (cmp ? '<div class="cs-in">' + stepper('stars', b.stars, true, '★ now') + stepper('income', b.income, true, 'Income') + '</div>' :
        '<div class="cs-top">' +
          '<div class="cs-rest"><b class="' + (e.rest < 0 ? 'neg' : '') + '">' + e.rest + '</b><span>★ left</span></div>' +
          '<div class="cs-in">' + stepper('stars', b.stars, true, '★ now') + stepper('income', b.income, true, 'Income') + '</div>' +
        '</div>' +
        '<div class="cs-line">Planned <b class="' + (e.rest < 0 ? 'neg' : '') + '">' + star(e.spent) + '</b> · next turn <b>' + e.nextTurn + ' ★</b></div>') +
      '<div class="cs-prog"><i class="' + (e.rest < 0 ? 'over' : '') + '" style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="cs-tabs">' + TABS.map(function (t) {
        var n = badge[t[0]];
        return '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '"><i>' + t[1] + '</i>' + t[2] +
          (n ? '<em>' + n + '</em>' : '') + '</button>';
      }).join('') + '</div>' +
    '</div>';
  }

  function renderTile(e) {
    if (!sel) {
      var b = B(), keys = [];
      b.placements.forEach(function (p) { var k = tkey(p.c, p.r); if (keys.indexOf(k) < 0) keys.push(k); });
      var mine = cities().filter(function (x) { return x.side === 'me' && cityAt(x.c, x.r) === x; });
      return '<div class="cs-empty"><big>👆</big><b>Tap a tile on the map</b><br>' +
        '<span class="cs-note">A ring shows only what is possible on that tile, with name and cost. ' +
        'Tap = plan (the ring closes), tap again = remove. A new tile first asks for the terrain; to change it tap <b>⌂ Home</b> in the middle. Tap your <b>city</b> to train a unit.</span></div>' +
        (mine.length ? '<div class="cs-h">Your cities</div><div class="cs-chips">' + mine.map(function (ci) {
          return '<button class="cs-chip sm" data-tile="' + tkey(ci.c, ci.r) + '">🏠 ' + esc(cityLabel(ci)) + '</button>';
        }).join('') + '</div>' : '') +
        (keys.length ? '<div class="cs-h">Planned tiles</div><div class="cs-chips">' + keys.map(function (k) {
          var cr = k.split(','), icons = placementsAt(+cr[0], +cr[1]).map(function (p) { return (item(p.item) || {}).icon || ''; }).join('');
          return '<button class="cs-chip sm" data-tile="' + k + '">' + icons + '</button>';
        }).join('') + '</div>' : '');
    }
    var city = cityAt(sel.c, sel.r);
    if (city) return renderCity(e, city);
    var c = sel.c, r = sel.r, fl = tileFlow(c, r), base = fl.base, T = fl.terrain;
    var T0 = { icon: tileIcon(base.terrain, base.res), name: tileName(base.terrain, base.res) };
    if (!base.stored) T0 = { icon: '❔', name: 'Unknown tile' };
    var src = !base.stored ? '<small class="q">Choose the terrain in the ring</small>' : '<small>Tile ' + c + ',' + r + '</small>';
    var html = '<div class="cs-tile"><b>' + T0.icon + ' ' + esc(T0.name) + src + '</b>' +
      '<button class="cs-x" data-act="unsel" aria-label="Deselect">✕</button></div>';

    // resources of the base terrain
    var baseRes = base.stored ? (PP.RESOURCES || []).filter(function (x) { return x.terrain === base.terrain; }) : [];
    if (baseRes.length) {
      html += '<div class="cs-row"><span class="cs-lbl">Resource:</span>' + baseRes.map(function (x) {
        var on = base.res.indexOf(x.id) >= 0;
        return '<button class="cs-chip sm' + (on ? ' on' : '') + '" data-res="' + x.id + '">' + x.icon + ' ' + esc(resName(x.id)) + (on ? ' ✓' : '') + '</button>';
      }).join('') + '</div>';
    }
    // existing building
    var blds = !base.stored ? [] : items().filter(function (it) { return isBuilding(it.id) && it.terrain && it.terrain.indexOf(base.terrain) >= 0; });
    if (blds.length) {
      var cur = base.bld && item(base.bld);
      html += '<div class="cs-row"><span class="cs-lbl">Building:</span>';
      if (showBld) {
        html += '<button class="cs-chip sm' + (!cur ? ' on' : '') + '" data-bld="">– none</button>' + blds.map(function (it) {
          return '<button class="cs-chip sm' + (base.bld === it.id ? ' on' : '') + '" data-bld="' + it.id + '" title="' + esc(it.name) + '">' + it.icon + ' ' + esc(it.name) + '</button>';
        }).join('');
      } else {
        html += '<button class="cs-chip sm' + (cur ? ' on' : ' ghost') + '" data-act="bld">' + (cur ? cur.icon + ' ' + esc(cur.name) : 'none') + ' ▾</button>';
      }
      html += '</div>';
    }
    if (fl.steps.length) {
      var sum = fl.steps.reduce(function (s, st) { return s + (st.it ? st.it.cost : 0); }, 0);
      html += '<div class="cs-h"><span>Planned here</span><span>' + star(sum) + '</span></div>' + fl.steps.map(function (st) {
        var it = st.it || { icon: '?', name: st.p.item, cost: 0 };
        var lock = st.ok && it.tech && !hasTech(it.tech);
        return '<div class="cs-pl"><span class="ic">' + it.icon + '</span><span class="nm">' + esc(it.name) +
          (!st.ok ? '<small class="bad">⚠️ ' + esc(st.why) + '</small>' : lock ? '<small class="bad">🔒 needs ' + esc(techName(it.tech)) + '</small>' : itemNote(it) ? '<small>' + esc(itemNote(it)) + '</small>' : '') +
          '</span><span class="pr">' + star(it.cost) + '</span>' +
          '<button data-rm="' + esc(st.p.id) + '" aria-label="Remove">✕</button></div>';
      }).join('');
      if (T !== base.terrain) {
        html += '<div class="cs-to">→ becomes <b>' + (TER(T) || {}).icon + ' ' + esc(tileName(T, fl.res)) + '</b>' +
          (fl.res.length ? ' with ' + fl.res.map(function (x) { return RES(x) ? RES(x).icon + ' ' + resName(x) : x; }).join(', ') : '') + '</div>';
      }
    } else {
      html += '<p class="cs-note">Pick what to build in the ring around the tile.</p>';
    }
    return html;
  }

  function sideSeg(ci) {
    return '<div class="cs-seg">' + [['me', 'Mine'], ['enemy', 'Enemy']].map(function (s) {
      return '<button data-cside="' + s[0] + '" class="' + (ci.side === s[0] ? 'on ' + s[0] : '') + '">' + s[1] + '</button>';
    }).join('') + '</div>';
  }

  function renderCity(e, ci) {
    var b = B();
    var sub = ci.side === 'me' ? 'Your city' : ci.side === 'enemy' ? 'Enemy city' : 'Whose city is this?';
    var html = '<div class="cs-tile"><b>🏠 ' + esc(cityLabel(ci)) + (ci.capital ? ' 👑' : '') +
      '<small' + (ci.side ? '' : ' class="q"') + '>' + sub + ' · Tile ' + ci.c + ',' + ci.r +  + '</small></b>' +
      '<button class="cs-x" data-act="unsel" aria-label="Deselect">✕</button></div>';
    html += sideSeg(ci);
    if (ci.side !== 'me') {
      html += '<p class="cs-note">' + (ci.side === 'enemy' ? 'Enemy city – nothing to train here.' : 'Tap <b>Mine</b> to train units here.') + '</p>';
      return html + '<div class="cs-foot"><input class="cs-name" data-cname="1" placeholder="Name (optional)" value="' + esc(ci.name || '') + '">' +
        '<button class="cs-sm" data-act="nocity">Not a city</button></div>';
    }
    var cu = b.cityUnits[ci.id] || {}, U = PP.UNITS || {}, nHere = 0;
    Object.keys(cu).forEach(function (k) { nHere += +cu[k] || 0; });
    html += '<div class="cs-h"><span>Train units here</span>' + (nHere ? '<span>' + nHere + ' planned</span>' : '') + '</div>';
    html += Object.keys(U).filter(function (k) { return U[k].cost != null; }).map(function (k) {
      return unitRow(k, cu[k] || 0, 'cu:' + k, e);
    }).join('');
    if (nHere > 1) html += '<p class="cs-warn">⚠️ A city trains one unit per turn (the new unit stands on the city tile).</p>';
    html += '<div class="cs-foot"><input class="cs-name" data-cname="1" placeholder="Name (optional)" value="' + esc(ci.name || '') + '">' +
      '<button class="cs-chip sm' + (ci.capital ? ' on' : '') + '" data-act="capital">👑</button>' +
      '<button class="cs-sm" data-act="nocity">Not a city</button></div>';
    return html;
  }

  function unitRow(k, n, key, e) {
    var u = PP.UNITS[k], avail = hasTech(u.tech);
    var cls = ['cs-u', n ? 'active' : '', !avail ? 'locked' : '', !n && u.cost > e.rest ? 'cant' : ''].join(' ');
    return '<div class="' + cls + '"><span class="ic">' + iconHtml(k, u.icon, 24) + '</span><span class="nm">' + esc(u.name) + '</span>' +
      stepper(key, n, false) +
      '<span class="sub"><small>' + u.cost + ' ★' + (n > 1 ? ' · Σ ' + (u.cost * n) + ' ★' : '') + '</small>' +
      (!avail ? '<i>🔒 ' + esc(techName(u.tech)) + '</i>' : '<i>' + u.hp + '❤ ' + u.atk + '⚔ ' + u.def + '🛡</i>') +
      '</span></div>';
  }

  function renderUnits(e) {
    var b = B(), U = PP.UNITS || {};
    var html = '<div class="cs-h"><span>Train units</span></div>';
    if (cities().some(function (x) { return x.side === 'me'; })) html += '<p class="cs-note">Tip: tap one of your cities on the map to train a unit there.</p>';
    html += Object.keys(U).filter(function (k) { return U[k].cost != null; }).map(function (k) {
      return unitRow(k, b.unitCounts[k] || 0, 'u:' + k, e);
    }).join('');
    return html;
  }

  function renderTech(e) {
    var b = B();
    var html = '<div class="cs-seg"><button data-tmode="plan" class="' + (techMode === 'plan' ? 'on' : '') + '">★ Buy</button>' +
      '<button data-tmode="owned" class="' + (techMode === 'owned' ? 'on' : '') + '">✓ I have</button></div>';
    html += '<div class="cs-row" style="justify-content:space-between">' + stepper('cities', cityCount(), false, 'Own cities') + '</div>';
    if (!b.owned.length) html += '<p class="cs-note">Tip: first mark under “✓ I have” what you have already researched.</p>';
    var tiers = [];
    (PP.TECHS || []).forEach(function (t) { if (tiers.indexOf(t.tier) < 0) tiers.push(t.tier); });
    tiers.sort();
    tiers.forEach(function (tier) {
      html += '<div class="cs-h"><span>Tier ' + tier + '</span><span>' + techCost({ tier: tier }) + ' ★</span></div><div class="cs-chips">' +
        PP.TECHS.filter(function (t) { return t.tier === tier; }).map(function (t) {
          var owned = b.owned.indexOf(t.id) >= 0, planned = b.planned.indexOf(t.id) >= 0;
          var cls = owned ? 'owned' : planned ? 'planned' : !techAvail(t) ? 'locked' : techCost(t) > e.rest ? 'cant' : '';
          return '<button class="cs-tc ' + cls + '" data-tech="' + t.id + '">' + (owned ? '✓ ' : planned ? '★ ' : '') + esc(t.name) + '</button>';
        }).join('') + '</div>';
    });
    html += '<p class="cs-note">Cost: tier × cities + 4 ★, with ' + esc(techName('philosophy')) + ' −33%.</p>';
    return html;
  }

  function renderPlan(e) {
    var b = B(), html = '';
    var groups = {}, order = [];
    b.placements.forEach(function (p) { var k = tkey(p.c, p.r); if (!groups[k]) { groups[k] = { c: p.c, r: p.r }; order.push(k); } });
    if (!e.lines.length && !order.length) {
      return '<div class="cs-empty"><big>📋</big>Nothing planned yet.<br><span class="cs-note">Tap tiles, train units or pick techs.</span></div>';
    }
    (e.warnings || []).forEach(function (w) { html += '<p class="cs-warn' + (/^Short by/.test(w) ? ' bad' : '') + '">⚠️ ' + esc(w) + '</p>'; });
    if (order.length) {
      html += '<div class="cs-h"><span>Tiles</span></div>';
      order.forEach(function (k) {
        var g = groups[k], fl = tileFlow(g.c, g.r), cost = 0, bad = 0;
        var names = fl.steps.map(function (st) { if (!st.it) return ''; cost += st.it.cost; if (!st.ok) bad++; return st.it.icon + ' ' + st.it.name; }).filter(Boolean);
        var T0 = TER(fl.base.terrain), T1 = TER(fl.terrain);
        html += '<div class="cs-pr"><span class="ic">' + (T0 ? tileIcon(fl.base.terrain, fl.base.res) : '') + '</span><span class="nm">' + esc(names.join(' · ')) +
          '<small' + (bad ? ' class="bad"' : '') + '>' + (T0 ? esc(tileName(fl.base.terrain, fl.base.res)) : '') + (fl.terrain !== fl.base.terrain && T1 ? ' → ' + esc(tileName(fl.terrain, fl.res)) : '') +
          (bad ? ' · ⚠️ ' + bad + '× doesn\'t fit' : '') + '</small></span><span class="pr">' + star(cost) + '</span>' +
          '<button class="go" data-tile="' + k + '" aria-label="Show tile">›</button>' +
          '<button class="rm" data-rmtile="' + k + '" aria-label="Remove">✕</button></div>';
      });
    }
    var units = e.lines.filter(function (l) { return l.kind === 'unit'; }), techs = e.lines.filter(function (l) { return l.kind === 'tech'; });
    if (units.length) {
      html += '<div class="cs-h"><span>Units</span></div>' + units.map(function (l) {
        var where = [], tagged = 0;
        Object.keys(b.cityUnits).forEach(function (id) {
          var n = +(b.cityUnits[id] || {})[l.id] || 0, ci = cityById(id);
          if (n && ci) { where.push(cityLabel(ci) + (n > 1 ? ' ×' + n : '')); tagged += n; }
        });
        if (where.length && l.n > tagged) where.push('no city ×' + (l.n - tagged));
        return '<div class="cs-pr"><span class="ic">' + iconHtml(l.id, l.icon, 20) + '</span><span class="nm">' + esc(l.label) +
          (where.length ? '<small>🏠 ' + esc(where.join(' · ')) + '</small>' : '') + '</span><span class="pr">' + star(l.cost) + '</span>' +
          '<button class="rm" data-st="u:' + l.id + '" data-d="-1" aria-label="One less">−</button></div>';
      }).join('');
    }
    if (techs.length) {
      html += '<div class="cs-h"><span>Tech</span></div>' + techs.map(function (l) {
        return '<div class="cs-pr"><span class="ic">🔬</span><span class="nm">' + esc(l.label) + '</span><span class="pr">' + star(l.cost) + '</span>' +
          '<button class="rm" data-rmtech="' + l.id + '" aria-label="Remove">✕</button></div>';
      }).join('');
    }
    html += '<div class="cs-sum"><span>Total</span><b>' + star(e.spent) + '</b></div>';
    html += '<div class="cs-sum" style="border:0;padding-top:0"><span>Left</span><b class="' + (e.rest < 0 ? 'neg' : '') + '">' + e.rest + ' ★</b></div>';
    html += '<div class="cs-fc"><b>Next turn</b> ' + Math.max(0, e.rest) + ' left + ' + e.income + ' income = <b>' + e.nextTurn + ' ★</b></div>';
    html += '<button class="cs-end' + (e.rest < 0 ? ' neg' : '') + '" data-act="end">End turn ➜ ' + e.nextTurn + ' ★</button>' +
      '<div class="cs-foot"><span class="cs-note">applies techs & tiles</span><button class="cs-sm" data-act="clear">Clear plan</button></div>';
    return html;
  }

  function renderPanel(el) {
    B();
    syncCities();
    panelEl = el;
    var e = eco(), sheet = isSheet();
    var body = tab === 'units' ? renderUnits(e) : tab === 'tech' ? renderTech(e) : tab === 'plan' ? renderPlan(e) : renderTile(e);
    var sc = scroller(el), top = sc.scrollTop;
    el.innerHTML = '<div class="cs">' + (sheet ? renderPeek(e) : '') + renderBar(e, sheet) + '<div class="cs-body">' + body + '</div></div>';
    var root = el.firstChild;
    if (!sheet) fitBar(sc, root.firstChild);
    if (scrollTop0) {
      scrollTop0 = false; sc.scrollTop = 0;
      // the host may restore its own scroll position after renderPanel → reset again afterwards
      Promise.resolve().then(function () { sc.scrollTop = 0; });
    } else sc.scrollTop = top;
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
  }

  // the element that actually scrolls (drawer body in v6, the panel itself in older hosts)
  function scroller(el) {
    var n = el;
    while (n && n !== document.body) {
      var oy = typeof getComputedStyle === 'function' ? getComputedStyle(n).overflowY : '';
      if (oy === 'auto' || oy === 'scroll') return n;
      n = n.parentElement;
    }
    return el;
  }

  // stretch the sticky bar over the container padding so content does not peek around it
  function fitBar(el, bar) {
    if (typeof getComputedStyle !== 'function' || !bar || !bar.style) return;
    var cs = getComputedStyle(el);
    var pt = parseFloat(cs.paddingTop) || 0, pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    bar.style.margin = (-pt) + 'px ' + (-pr) + 'px 8px ' + (-pl) + 'px';
    bar.style.paddingLeft = Math.max(10, pl) + 'px';
    bar.style.paddingRight = Math.max(10, pr) + 'px';
  }

  function onClick(ev) {
    var btn = ev.target.closest ? ev.target.closest('button') : null;
    if (!btn) return;
    var d = btn.dataset, b = B();
    if (d.act === 'plan') {
      var full = PP.drawer && PP.drawer.isPeek && !PP.drawer.isPeek() && tab === 'plan';
      tab = 'plan'; scrollTop0 = true;
      if (PP.drawer && PP.drawer.setFull) PP.drawer.setFull(!full);
      refresh(); return;
    }
    if (d.tab) { tab = d.tab; scrollTop0 = true; refresh(); return; }
    if (d.st) {
      var n = +d.d;
      if (d.st === 'stars') b.stars = Math.max(0, b.stars + n);
      else if (d.st === 'income') b.income = Math.max(0, b.income + n);
      else if (d.st === 'cities') b.cityCount = Math.max(1, cityCount() + n);
      else if (d.st.indexOf('u:') === 0) addUnit(d.st.slice(2), n, null);
      else if (d.st.indexOf('cu:') === 0) {
        var ci = sel && cityAt(sel.c, sel.r);
        if (!ci) return;
        addUnit(d.st.slice(3), n, ci.id);
      }
      commit(); return;
    }
    if (d.cside || d.act === 'nocity' || d.act === 'capital') {
      if (!sel) return;
      var cc = cityAt(sel.c, sel.r);
      if (!cc) return;
      if (d.cside) { markCity(sel.c, sel.r, d.cside); if (ring) ring.sub = d.cside === 'me' ? null : 'home'; }
      else if (d.act === 'capital') {
        touchCity(cc); cc.capital = !cc.capital;
        if (cc.capital) cities().forEach(function (x) { if (x !== cc && x.side === cc.side) x.capital = false; });
      } else if (d.act === 'nocity') {
        unmarkCity(cc);
        if (ring) { ring.sub = 'home'; ring.page = 0; }
        toast('Not a city – choose the terrain');
      }
      commit(); return;
    }
    if (d.tile) {
      var tc = d.tile.split(',');
      if (PP.board && PP.board.centerOn) PP.board.centerOn(+tc[0], +tc[1]);
      if (isSheet() && PP.drawer && PP.drawer.setFull) PP.drawer.setFull(false);
      select(+tc[0], +tc[1]); return;
    }
    if (d.rmtile) {
      var rc = d.rmtile.split(',');
      b.placements = b.placements.filter(function (p) { return !(p.c === +rc[0] && p.r === +rc[1]); });
      commit(); return;
    }
    if (d.rmtech) { unplanTech(d.rmtech); commit(); return; }
    if (d.tmode) { techMode = d.tmode; refresh(); return; }
    if (d.tech) { tapTech(d.tech); return; }
    if (d.act === 'end') { endTurn(); return; }
    if (d.act === 'clear') { clearPlan(); return; }
    if (d.act === 'unsel') { closeRing(); return; }
    if (!sel) return;
    if (d.act === 'bld') { showBld = !showBld; refresh(); return; }
    if (d.bld !== undefined) { setBld(sel.c, sel.r, d.bld); return; }
    if (d.res) { toggleRes(sel.c, sel.r, d.res); return; }
    if (d.rm) { removePlacement(d.rm); }
  }

  function onChange(ev) {
    var ds = ev.target && ev.target.dataset;
    if (ds && ds.cname && sel) {
      var ci = cityAt(sel.c, sel.r);
      if (ci) { touchCity(ci); ci.name = String(ev.target.value || '').trim().slice(0, 24); commit(); }
      return;
    }
    var k = ds && ds.in;
    if (!k) return;
    B()[k] = Math.max(0, Math.round(+ev.target.value || 0));
    commit();
  }

  // ================================================================ map
  function onTap(t) {
    if (!t || !isFinite(t.c) || !isFinite(t.r)) return;
    syncCities();
    if (sel && ring) {
      // same tile or a tap into the ring's area (between the buttons) → close
      if (sel.c === t.c && sel.r === t.r) { closeRing(); return; }
      if (ringGeom && isFinite(t.sx) && Math.hypot(t.sx - ringGeom.cx, t.sy - ringGeom.cy) < ringGeom.R + ringGeom.bs * 0.5) { closeRing(); return; }
    }
    select(t.c, t.r);
  }
  function onLongPress(t) {
    var b = B(), n = b.placements.length;
    b.placements = b.placements.filter(function (p) { return !(p.c === t.c && p.r === t.r); });
    if (b.placements.length !== n) { toast('Tile plan deleted'); commit(); }
  }

  function tsz() { return PP.board && PP.board.tileScreenSize ? PP.board.tileScreenSize() : { w: 60, h: 36 }; }
  function rrect(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad); else ctx.rect(x, y, w, h);
  }

  function drawUnder(ctx, D) {
    if (!sel || !D || !D.diamond) return;
    D.diamond(ctx, sel.c, sel.r, 'rgba(76,201,240,.22)', '#4cc9f0');
  }

  function drawOver(ctx) {
    if (!PP.board || !PP.board.tileToScreen) return;
    try { drawPlacements(ctx); } finally { placeRing(); }
  }
  // planned items: small icon chip on the tile (+ cost below when there is room)
  function drawPlacements(ctx) {
    var groups = {}, order = [];
    B().placements.forEach(function (p) {
      var k = tkey(p.c, p.r);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(p);
    });
    // units planned in a city: chip on the city tile too
    var cu = B().cityUnits;
    Object.keys(cu).forEach(function (id) {
      var ci = cityById(id); if (!ci || cityAt(ci.c, ci.r) !== ci) return;
      var k = tkey(ci.c, ci.r);
      Object.keys(cu[id] || {}).forEach(function (t) {
        var u = PP.UNITS && PP.UNITS[t], n = +cu[id][t] || 0;
        if (!u || !n) return;
        if (!groups[k]) { groups[k] = []; order.push(k); }
        for (var i = 0; i < n; i++) groups[k].push({ unit: t });
      });
    });
    if (!order.length) return;
    var sz = tsz(), fs = Math.max(13, Math.min(24, sz.h * 0.5)), showCost = sz.w >= 30;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    order.forEach(function (k) {
      var g = groups[k], cr = k.split(','), c = +cr[0], r = +cr[1];
      var fl = tileFlow(c, r), bad = fl.steps.some(function (s) { return !s.ok; });
      var its = g.map(function (p) {
        if (p.unit) { var u = PP.UNITS[p.unit]; return { id: p.unit, icon: u.icon, cost: u.cost, unit: true }; }
        return item(p.item);
      }).filter(Boolean);
      if (!its.length) return;
      var cost = its.reduce(function (s, it) { return s + it.cost; }, 0);
      var p = PP.board.tileToScreen(c, r), n = its.length;
      // just planned here → the chip pops a little and glows (brief confirmation, no toast)
      var fk = flash && flash.k === k ? Math.max(0, 1 - (Date.now() - flash.t) / 700) : 0;
      var fs0 = fs; fs = fs0 * (1 + 0.45 * fk * fk);
      var step = fs * 1.15, w = step * n + fs * 0.35, h = fs * 1.35, x = p.x - w / 2, y = p.y - h * 0.62;
      if (fk) { ctx.save(); ctx.shadowColor = 'rgba(255,209,102,' + (0.9 * fk).toFixed(2) + ')'; ctx.shadowBlur = 18 * fk; }
      ctx.fillStyle = 'rgba(14,18,36,.78)';
      rrect(ctx, x, y, w, h, h / 2); ctx.fill();
      ctx.lineWidth = Math.max(1, fs * 0.09);
      ctx.strokeStyle = bad ? '#ef476f' : 'rgba(255,209,102,.95)';
      ctx.stroke();
      if (fk) ctx.restore();
      ctx.font = Math.round(fs) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui';
      its.forEach(function (it, i) {
        var ix = x + fs * 0.175 + step * (i + 0.5), iy = y + h / 2;
        var icn = it.unit ? it.id : ITEM_ICON[it.id];
        if (!(hasIcon(icn) && PP.icons.draw(ctx, icn, ix, iy, fs * 1.05, { stroke: 'rgba(0,0,0,.45)' }))) ctx.fillText(it.icon, ix, iy + fs * 0.06);
      });
      if (showCost) {
        var label = star(cost), cs = Math.max(8, Math.round(fs * 0.62));
        ctx.font = 'bold ' + cs + 'px system-ui,-apple-system,sans-serif';
        var tw = ctx.measureText(label).width + cs * 0.9, th = cs * 1.45, ty = y + h + th * 0.55;
        ctx.fillStyle = 'rgba(0,0,0,.78)';
        rrect(ctx, p.x - tw / 2, ty - th / 2, tw, th, th / 2); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.fillText(label, p.x, ty + 0.5);
      }
      fs = fs0;
    });
    ctx.restore();
  }

  function hint() {
    if (!sel || !ring) return 'Tap a tile – a ring shows what you can build there';
    return '';
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && ring && PP.modes && PP.modes.current === 'cost') closeRing();
    });
  }

  if (PP.modes && PP.modes.register) {
    PP.modes.register('cost', {
      label: 'Costs',
      icon: '💰',
      get hint() { return hint(); },
      onEnter: function () { B(); syncCities(); },
      onExit: function () { sel = null; ring = null; hideRing(); },
      onTap: onTap,
      onLongPress: onLongPress,
      renderPanel: renderPanel,
      drawUnder: drawUnder,
      drawOver: drawOver,
    });
  }

  // hooks for tests / other tools (MARKET may read planned buildings via tileFlow)
  PP.cost = {
    eco: eco, tileFlow: tileFlow, select: select, endTurn: endTurn, syncCities: syncCities, cityAt: cityAt,
    setTab: function (t) { tab = t; refresh(); },
    get selected() { return sel ? { c: sel.c, r: sel.r } : null; },
    get ring() { return ring ? { sub: ring.sub, page: ring.page, geom: ringGeom } : null; },
    closeRing: closeRing,
    clearSelection: function () { sel = null; ring = null; hideRing(); },
    BUILDINGS: BUILDINGS,
  };
})(window.PP);
