// Polytopia Planner – Label tool (v29): collect training data for the tile detection. Only shown with ?label in the URL.
// Every tile of the screenshot starts with the model's guess; pick a brush and tap the tiles that are wrong.
// "Export" downloads one JSON file per screenshot (image + grid + every tile's label) for tools/tilemodel/export.py.
// Label format (as in the training data): terrain[+resource…][+building][+unit] or "skip" (covered by the game's UI).
window.PP = window.PP || {};
(function (PP) {
  'use strict';
  const S = () => PP.state;
  const esc = s => (PP.ui && PP.ui.esc ? PP.ui.esc(s) : String(s));
  const toast = m => PP.ui && PP.ui.toast && PP.ui.toast(m);

  const TERRAIN = [['field', 'Field', '🟩'], ['forest', 'Forest', '🌲'], ['mountain', 'Mountain', '⛰️'], ['water', 'Water', '🌊'],
    ['city', 'City', '🏠'], ['village', 'Village', '🛖'], ['cloud', 'Cloud', '☁️'], ['edge', 'Space / edge', '⬛'], ['skip', 'Skip (UI)', '🚫']];
  const EXTRA = [['crop', 'Crop', '🌾'], ['fruit', 'Fruit', '🍒'], ['metal', 'Metal', '💎'], ['animal', 'Animal', '🦌'], ['fish', 'Fish', '🐟'], ['unit', 'Unit on it', '🪖']];
  const BUILD = [['farm', 'Farm', '🌾'], ['mine', 'Mine', '⛏️'], ['lumber', 'Lumber hut', '🪵'], ['windmill', 'Windmill', '🌬️'], ['forge', 'Forge', '🔨'],
    ['sawmill', 'Sawmill', '🪚'], ['market', 'Market', '🏪'], ['port', 'Port', '⚓'], ['other', 'Other building', '🏛️'], ['ruin', 'Ruin', '🗿']];
  const TCOL = { field: '155,211,90', forest: '30,140,60', mountain: '160,160,170', water: '40,110,220', city: '255,120,160', village: '230,170,90',
    cloud: '230,235,255', edge: '0,0,0', skip: '255,60,60' };
  const MODEL_MAP = { field: 'field', forest: 'forest', mountain: 'mountain', water: 'water', city: 'city', cloud: 'cloud', outside: 'edge' };
  const ui = { brush: 'forest' };

  // ---------------------------------------------------------------- data
  // S().labeler = { sig, tiles: { 'c,r': { t, ex: [...], b, user } } } – one screenshot at a time
  function sigOf(P) {
    let h = P.w * 31 + P.h;
    for (let i = 0; i < 64; i++) { const k = (Math.floor(P.data.length / 4 / 65 * (i + 1)) * 4); h = (h * 33 + P.data[k] + P.data[k + 1] * 3 + P.data[k + 2] * 7) % 2147483647; }
    return P.w + 'x' + P.h + ':' + h;
  }
  function store() {
    const P = PP.board && PP.board.pixels ? PP.board.pixels() : null;
    if (!P) return null;
    const sig = sigOf(P);
    if (!S().labeler || S().labeler.sig !== sig) S().labeler = { sig, tiles: {} };
    return { P, L: S().labeler };
  }
  const tileW = () => { const g = S().grid; return Math.abs(g.ux - g.vx); };
  // all tiles whose centre lies on the screenshot
  function tilesOn(P) {
    const corners = [[0, 0], [P.w, 0], [0, P.h], [P.w, P.h]].map(([x, y]) => PP.grid.frac(x, y));
    const cs = corners.map(f => f.c), rs = corners.map(f => f.r), out = [];
    const w = tileW(), h = 0.6 * w;
    for (let c = Math.floor(Math.min(...cs)) - 1; c <= Math.ceil(Math.max(...cs)) + 1; c++)
      for (let r = Math.floor(Math.min(...rs)) - 1; r <= Math.ceil(Math.max(...rs)) + 1; r++) {
        const p = PP.grid.center(c, r);
        if (p.x > w * 0.3 && p.x < P.w - w * 0.3 && p.y > h * 0.4 && p.y < P.h - h * 0.4) out.push({ c, r, x: p.x, y: p.y });
      }
    return out;
  }
  // the model's guess (cached per tile)
  const guessMemo = new Map();
  function guess(P, t) {
    const k = S().labeler.sig + '|' + tileW().toFixed(2) + '|' + t.c + ',' + t.r;
    if (guessMemo.has(k)) return guessMemo.get(k);
    let g = { t: 'field', conf: 0 };
    try { const p = PP.tilemodel && PP.tilemodel.classify(P, t.x, t.y, tileW()); if (p) g = { t: MODEL_MAP[p.terrain] || 'field', conf: p.conf }; } catch (e) { /* default */ }
    guessMemo.set(k, g); return g;
  }
  function labelOf(P, L, t) {
    const u = L.tiles[t.c + ',' + t.r];
    if (u) return u;
    const g = guess(P, t);
    return { t: g.t, ex: [], b: null, user: false, conf: g.conf };
  }
  const labelText = l => (l.t === 'skip' ? 'skip' : [l.t].concat(l.ex || [], l.b ? [l.b] : []).join('+'));

  // v38: unit details (side, type, HP) – training data for unit type / HP reading. Stored as l.u = { side, type, hp }
  const COMMON_UNITS = ['warrior', 'archer', 'defender', 'rider', 'swordsman', 'catapult', 'knight', 'mindbender', 'giant', 'cloak', 'dagger', 'raft', 'scout', 'rammer', 'bomber'];
  function unitName(id) { return (PP.UNITS && PP.UNITS[id] && PP.UNITS[id].name) || id; }
  function unitEditor(t) {
    const st = store(); if (!st) return;
    const { P, L } = st, k = t.c + ',' + t.r, cur = labelOf(P, L, t);
    const l = { t: cur.t, ex: (cur.ex || []).slice(), b: cur.b || null, user: true, u: Object.assign({ side: ui.lastSide || 'me', type: ui.lastType || 'warrior', hp: 10 }, cur.u || {}) };
    if (l.ex.indexOf('unit') < 0) l.ex.push('unit');
    const more = Object.keys(PP.UNITS || {}).filter(id => COMMON_UNITS.indexOf(id) < 0);
    const html = () => `<div class="sheethead"><b>🪖 Unit on ${t.c}/${t.r}</b><button class="x" data-ue="close" aria-label="Close">✕</button></div>
      <div style="padding:2px 4px 8px;font-size:13px">
        <div style="margin:4px 0 4px;opacity:.75">Whose unit?</div>
        <div style="display:flex;gap:6px">${[['me', '🔵 Mine'], ['enemy', '🔴 Enemy']].map(([v, n]) => `<button data-ue="side" data-v="${v}" style="flex:1;padding:9px;border-radius:10px;border:1px solid ${l.u.side === v ? '#4cc9f0' : 'var(--line,#33406e)'};background:${l.u.side === v ? 'rgba(76,201,240,.2)' : 'var(--panel2,#252e52)'};color:inherit;font-weight:700">${n}</button>`).join('')}</div>
        <div style="margin:10px 0 4px;opacity:.75">HP (the white number next to the unit)</div>
        <div style="display:flex;gap:6px;align-items:center"><button data-ue="hp" data-v="-1" style="width:44px;height:40px;border-radius:10px;border:0;background:var(--panel2,#252e52);color:inherit;font-size:20px">−</button>
          <b style="min-width:44px;text-align:center;font-size:20px">${l.u.hp}</b>
          <button data-ue="hp" data-v="1" style="width:44px;height:40px;border-radius:10px;border:0;background:var(--panel2,#252e52);color:inherit;font-size:20px">+</button>
          ${[5, 10, 15, 20, 40].map(v => `<button data-ue="hpset" data-v="${v}" style="padding:8px 9px;border-radius:9px;border:1px solid var(--line,#33406e);background:transparent;color:inherit">${v}</button>`).join('')}</div>
        <div style="margin:10px 0 4px;opacity:.75">Type</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${COMMON_UNITS.map(id => tbtn(id)).join('')}</div>
        <details style="margin-top:6px"><summary style="opacity:.75">More types</summary><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">${more.map(id => tbtn(id)).join('')}</div></details>
        <div style="display:flex;gap:6px;margin-top:12px"><button data-ue="del" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--line,#33406e);background:transparent;color:inherit">No unit here</button>
          <button data-ue="ok" style="flex:2;padding:10px;border-radius:10px;border:0;background:#4cc9f0;color:#08121f;font-weight:800">✓ Save</button></div></div>`;
    const tbtn = id => `<button data-ue="type" data-v="${id}" style="padding:6px 8px;border-radius:9px;border:1px solid ${l.u.type === id ? '#4cc9f0' : 'var(--line,#33406e)'};background:${l.u.type === id ? 'rgba(76,201,240,.2)' : 'var(--panel2,#252e52)'};color:inherit;font-size:12.5px">${esc(unitName(id))}</button>`;
    const open = () => PP.ui.openSheet(html(), (ev, b) => {
      if (!b) return; const a = b.dataset.ue, v = b.dataset.v;
      if (a === 'close') { PP.ui.closeSheet(); return; }
      if (a === 'side') l.u.side = v; else if (a === 'type') l.u.type = v;
      else if (a === 'hp') l.u.hp = Math.max(1, Math.min(99, l.u.hp + +v)); else if (a === 'hpset') l.u.hp = +v;
      else if (a === 'del') { l.ex = l.ex.filter(x => x !== 'unit'); delete l.u; L.tiles[k] = l; PP.ui.closeSheet(); PP.app.commit(); return; }
      else if (a === 'ok') { ui.lastSide = l.u.side; ui.lastType = l.u.type; L.tiles[k] = l; PP.ui.closeSheet(); PP.app.commit(); toast('Unit saved'); return; }
      open();
    });
    open();
  }
  function apply(t) {
    const st = store(); if (!st) { toast('Load a screenshot first'); return; }
    if (ui.brush === 'unitd') { unitEditor(t); return; }
    const { P, L } = st, k = t.c + ',' + t.r, cur = labelOf(P, L, t);
    const l = { t: cur.t, ex: (cur.ex || []).slice(), b: cur.b || null, user: true, u: cur.u };
    const b = ui.brush;
    if (TERRAIN.some(x => x[0] === b)) l.t = b;
    else if (EXTRA.some(x => x[0] === b)) { const i = l.ex.indexOf(b); if (i >= 0) { l.ex.splice(i, 1); if (b === 'unit') delete l.u; } else l.ex.push(b); }
    else if (BUILD.some(x => x[0] === b)) l.b = l.b === b ? null : b;
    else if (b === 'reset') { delete L.tiles[k]; PP.app.commit(); return; }
    L.tiles[k] = l;
    PP.app.commit();
  }

  // ---------------------------------------------------------------- export
  function exportJson() {
    const st = store(); if (!st) { toast('Load a screenshot first'); return; }
    const { P, L } = st, w = tileW(), tiles = tilesOn(P).map(t => {
      const l = labelOf(P, L, t);
      const o = { c: t.c, r: t.r, x: +t.x.toFixed(1), y: +t.y.toFixed(1), label: labelText(l), user: !!l.user, conf: l.conf != null ? +l.conf.toFixed(2) : null };
      if (l.u && (l.ex || []).indexOf('unit') >= 0) o.unit = { side: l.u.side, type: l.u.type, hp: l.u.hp }; // v38
      return o;
    });
    // the screenshot itself (JPEG) so the file is complete on its own
    const cv = document.createElement('canvas'); cv.width = P.w; cv.height = P.h;
    const id = new ImageData(new Uint8ClampedArray(P.data), P.w, P.h); cv.getContext('2d').putImageData(id, 0, 0);
    const data = { version: 1, created: new Date().toISOString(), size: [P.w, P.h], grid: { w, ox: S().grid.ox, oy: S().grid.oy, ux: S().grid.ux, uy: S().grid.uy, vx: S().grid.vx, vy: S().grid.vy },
      tiles, image: cv.toDataURL('image/jpeg', 0.92) };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'polytopia-labels-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    const nUser = tiles.filter(t => t.user).length;
    toast(`Exported ${tiles.length} tiles (${nUser} corrected by you)`);
  }

  // ---------------------------------------------------------------- drawing
  function diamond(ctx, c, r, k) {
    const p = PP.board.tileToScreen(c, r), pts = PP.grid.corners(c, r).map(q => PP.board.toScreen(q.x, q.y));
    ctx.beginPath();
    pts.forEach((q, i) => { const x = p.x + (q.x - p.x) * k, y = p.y + (q.y - p.y) * k; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
  }
  function draw(ctx) {
    const st = store(); if (!st) return;
    const { P, L } = st, ts = PP.board.tileScreenSize(), fs = Math.max(9, Math.min(14, ts.h * 0.22));
    ctx.save();
    for (const t of tilesOn(P)) {
      const l = labelOf(P, L, t), col = TCOL[l.t] || '255,255,255';
      diamond(ctx, t.c, t.r, 0.9);
      ctx.fillStyle = `rgba(${col},${l.user ? 0.38 : 0.16})`; ctx.fill();
      ctx.lineWidth = l.user ? 2.2 : 1.2;
      ctx.strokeStyle = l.user ? '#fff' : (l.conf != null && l.conf < 0.6 ? 'rgba(255,183,3,.95)' : 'rgba(255,255,255,.45)');
      if (!l.user) ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      if (ts.h < 18) continue;
      const q = PP.board.tileToScreen(t.c, t.r), txt = labelText(l).replace(/\+/g, ' ') + (l.u ? ' · ' + (l.u.side === 'me' ? '🔵' : '🔴') + unitName(l.u.type) + ' ' + l.u.hp : '');
      ctx.font = `bold ${fs}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(txt, q.x, q.y); ctx.fillStyle = l.user ? '#fff' : '#ffe08a'; ctx.fillText(txt, q.x, q.y);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- panel
  function renderPanel(el) {
    const st = store();
    const btn = (id, label, icon) => `<button data-lb="${id}" class="${ui.brush === id ? 'on' : ''}" style="padding:6px 8px;border-radius:9px;border:1px solid ${ui.brush === id ? '#4cc9f0' : 'var(--line,#33406e)'};background:${ui.brush === id ? 'rgba(76,201,240,.18)' : 'var(--panel2,#252e52)'};color:inherit;font-size:12.5px">${icon} ${esc(label)}</button>`;
    const row = (title, list) => `<div style="margin:8px 0 2px;font-size:12px;opacity:.75">${title}</div><div style="display:flex;flex-wrap:wrap;gap:5px">${list.map(x => btn(x[0], x[1], x[2])).join('')}</div>`;
    let info = 'Load a screenshot and confirm the grid first.';
    if (st) {
      const all = tilesOn(st.P), user = all.filter(t => st.L.tiles[t.c + ',' + t.r]).length, units = Object.values(st.L.tiles).filter(l => (l.ex || []).indexOf('unit') >= 0).length;
      info = `${all.length} tiles · ${user} set by you · ${units} with a unit. Yellow text = the model's guess (orange outline: unsure) – tap the wrong ones with the right brush. Everything else counts as correct when you export.`;
    }
    el.innerHTML = `<div style="padding:4px 2px">
      <h4 style="margin:0 0 4px">🏷️ Label tiles <small style="opacity:.7">– training data for the detection</small></h4>
      <p style="margin:0 0 6px;font-size:12.5px;opacity:.85">${info}</p>
      ${row('Terrain (sets it)', TERRAIN)}
      ${row('On the tile (toggles)', EXTRA)}
      ${row('Building (toggles)', BUILD)}
      ${row('Units – for the unit detection (tap a unit: whose, type, HP)', [['unitd', 'Unit details', '🪖']])}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${btn('reset', 'Back to guess', '↺')}
        <button data-lba="export" style="padding:8px 12px;border-radius:10px;border:0;background:#4cc9f0;color:#08121f;font-weight:700">⬇️ Export labels (.json)</button>
        <button data-lba="clear" style="padding:8px 10px;border-radius:10px;border:1px solid var(--line,#33406e);background:transparent;color:inherit">Clear my labels</button></div>
      <p style="margin:8px 0 0;font-size:11.5px;opacity:.7">Labels: terrain under everything (a city tile is City). Unit = a unit stands on the tile. Skip = tile hidden by the game's UI. Ships count as Water + Unit.</p>
    </div>`;
    el.onclick = ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.lb) { ui.brush = b.dataset.lb; PP.app.refresh(); return; }
      if (b.dataset.lba === 'export') exportJson();
      else if (b.dataset.lba === 'clear') { if (S().labeler) S().labeler.tiles = {}; PP.app.commit(); toast('Your labels for this screenshot are cleared'); }
    };
  }

  PP.modes.register('label', {
    label: 'Label', icon: '🏷️',
    hint: () => (ui.brush === 'unitd' ? 'Tap a unit: whose it is, its type and HP' : 'Brush: ' + ((TERRAIN.concat(EXTRA, BUILD).find(x => x[0] === ui.brush) || [0, ui.brush === 'reset' ? 'Back to guess' : ui.brush])[1]) + ' – tap tiles'),
    onTap(t) { apply(t); },
    drawOver(ctx) { draw(ctx); },
    renderPanel,
  });
})(window.PP);
