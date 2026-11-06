// Polytopia Planner v3 – CORE: state, persistence, grid, board rendering, gestures, modes, UI helpers.
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  const $ = s => document.querySelector(s);
  const LS_KEY = 'polyplan.v2';
  const BLANK = { w: 1200, h: 1600 };
  const DEFAULT_GRID = { ox: 600, oy: 200, ux: 60, uy: 36, vx: -60, vy: 36 };
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
  const COLOR = { me: '#3a86ff', enemy: '#ef476f', meCity: '#2758b0', enemyCity: '#a82a4a' };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));

  // ---------------------------------------------------------------- utils
  PP.util = PP.util || {};
  PP.util.uid = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
  PP.util.clamp = clamp;

  // ---------------------------------------------------------------- state
  function defaults() {
    return {
      version: 6,
      board: null,
      grid: Object.assign({}, DEFAULT_GRID),
      units: [],      // UNITS coins { id, c, r, side, type, hp, vet, bonus, color? }
      cities: [],     // legacy (engine.effectiveBonus); not drawn in v6
      combat: { attackers: [], targets: [] },
      build: { stars: 5, income: 2, owned: [], planned: [], unitCounts: {}, placements: [], rewards: {} },
      tiles: {},      // '<c>,<r>' → { terrain, res:[], bld, src }  (COST + MARKET)
      marks: [],      // DRAW { id, kind:'arrow'|'cross'|'ring', c1, r1, c2?, r2?, color, size }
      market: { region: null, includePlanned: true },
      // CORE-only UI prefs
      ui: { showGrid: false, mode: null, drawerOpen: true, drawerW: 0, sheetFull: false, last: { side: 'me', type: 'warrior', tab: 'unit' } },
    };
  }
  function fillDefaults(t, d) {
    for (const k of Object.keys(d)) {
      const dv = d[k], tv = t[k];
      if (tv === undefined || (dv !== null && tv === null && k !== 'board')) t[k] = clone(dv);
      else if (Array.isArray(dv) && !Array.isArray(tv)) t[k] = clone(dv);
      else if (isObj(dv)) { if (!isObj(tv)) t[k] = clone(dv); else fillDefaults(tv, dv); }
    }
    return t;
  }
  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { s = null; }
    if (!isObj(s)) s = {};
    const oldVersion = +s.version || 0;
    delete s.world; delete s.arrows; // v5 fields
    fillDefaults(s, defaults());
    if (oldVersion < 6) { s.ui.showGrid = false; s.ui.drawerOpen = true; delete s.ui.panelCollapsed; s.ui.mode = null; }
    s.version = 6;
    if (!['image', 'blank', null].includes(s.board)) s.board = null;
    for (const k of ['ox', 'oy', 'ux', 'uy', 'vx', 'vy']) if (!isFinite(s.grid[k])) s.grid = Object.assign({}, DEFAULT_GRID);
    return s;
  }
  PP.state = loadState();
  const S = () => PP.state;

  let saveTimer = 0;
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = 0;
    try { localStorage.setItem(LS_KEY, JSON.stringify(PP.state)); } catch (e) { console.warn('save failed', e); }
  }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 200); }
  window.addEventListener('pagehide', () => { if (saveTimer) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) saveNow(); });

  // remove dangling references (deleted units/cities, side changes)
  function sanitize() {
    const st = S();
    const uById = new Map(st.units.map(u => [u.id, u]));
    st.combat.attackers = (st.combat.attackers || []).filter(id => uById.has(id) && uById.get(id).side === 'me');
    st.combat.targets = (st.combat.targets || []).filter(id => uById.has(id) && uById.get(id).side === 'enemy');
  }

  // IndexedDB for the screenshot (too big for localStorage)
  const idb = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('polyplan', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    },
    async set(k, v) {
      try {
        const db = await this.open();
        await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      } catch (e) { console.warn('idb set failed', e); }
    },
    async get(k) {
      try {
        const db = await this.open();
        return await new Promise(res => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
      } catch (e) { return null; }
    },
  };

  // ---------------------------------------------------------------- find
  PP.find = {
    unitAt: (c, r) => S().units.find(u => u.c === c && u.r === r) || null,
    cityAt: (c, r) => S().cities.find(x => x.c === c && x.r === r) || null,
    unit: id => S().units.find(u => u.id === id) || null,
    city: id => S().cities.find(x => x.id === id) || null,
  };

  // ---------------------------------------------------------------- data fallbacks
  const FALLBACK_UNITS = { warrior: { name: 'Warrior', icon: '⚔️', hp: 10, atk: 2, def: 2, mov: 1, rng: 1, cost: 2, tech: null } };
  const UNITS = () => (PP.UNITS && Object.keys(PP.UNITS).length ? PP.UNITS : FALLBACK_UNITS);
  const unitDef = u => UNITS()[u.type] || Object.values(UNITS())[0];
  function maxHp(u) {
    if (PP.engine && PP.engine.maxHp) { try { const v = PP.engine.maxHp(u); if (isFinite(v)) return v; } catch (e) { /* fallthrough */ } }
    return (unitDef(u).hp || 10) + (u.vet ? 5 : 0);
  }
  function effBonus(u) {
    if (PP.engine && PP.engine.effectiveBonus) { try { return PP.engine.effectiveBonus(u, S().cities); } catch (e) { /* ignore */ } }
    return u.bonus || 1;
  }
  const arrowColors = () => (PP.ARROW_COLORS && PP.ARROW_COLORS.length ? PP.ARROW_COLORS : ['#ffaa00', '#06d6a0', '#ef476f', '#4cc9f0']);

  // ---------------------------------------------------------------- grid
  PP.grid = {
    center(c, r) { const g = S().grid; return { x: g.ox + c * g.ux + r * g.vx, y: g.oy + c * g.uy + r * g.vy }; },
    frac(x, y) {
      const g = S().grid, det = g.ux * g.vy - g.vx * g.uy || 1e-9, dx = x - g.ox, dy = y - g.oy;
      return { c: (dx * g.vy - g.vx * dy) / det, r: (g.ux * dy - g.uy * dx) / det };
    },
    toTile(x, y) { const f = PP.grid.frac(x, y); return { c: Math.round(f.c), r: Math.round(f.r) }; },
    dist: (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)),
    corners(c, r) {
      const g = S().grid, p = PP.grid.center(c, r);
      const sx = (g.ux + g.vx) / 2, sy = (g.uy + g.vy) / 2, dx = (g.ux - g.vx) / 2, dy = (g.uy - g.vy) / 2;
      return [{ x: p.x - sx, y: p.y - sy }, { x: p.x + dx, y: p.y + dy }, { x: p.x + sx, y: p.y + sy }, { x: p.x - dx, y: p.y - dy }];
    },
    // tile width w (horizontal neighbour distance), height/width ratio, rotation
    params() {
      const g = S().grid, dx = g.ux - g.vx, dy = g.uy - g.vy;
      const w = Math.hypot(dx, dy) || 1, h = Math.hypot(g.ux + g.vx, g.uy + g.vy);
      return { w, ratio: h / w, theta: Math.atan2(dy, dx) };
    },
    // rebuild basis; keeps tile (ac,ar) at its current image position
    setParams(w, ratio, theta, ac, ar) {
      const g = S().grid, keep = PP.grid.center(ac || 0, ar || 0);
      const h = w * ratio, ex = Math.cos(theta), ey = Math.sin(theta), nx = -ey, ny = ex;
      g.ux = ex * w / 2 + nx * h / 2; g.uy = ey * w / 2 + ny * h / 2;
      g.vx = -ex * w / 2 + nx * h / 2; g.vy = -ey * w / 2 + ny * h / 2;
      g.ox = keep.x - (ac || 0) * g.ux - (ar || 0) * g.vx; g.oy = keep.y - (ac || 0) * g.uy - (ar || 0) * g.vy;
    },
  };

  // ---------------------------------------------------------------- board / view
  let drawerEl = null;
  let cv, ctx, stage, dpr = 1, cw = 0, ch = 0, img = null, imgUrl = null, needFit = true;
  let hiRes = null; // upscaled + sharpened copy of the screenshot, used when zoomed in
  let view = { x: 0, y: 0, s: 0.3 };
  let rafId = 0;
  let bgFn = null; // v5: background provider (world layer), drawn in image coordinates
  const worldSize = () => (S().board === 'image' && img ? { w: img.naturalWidth, h: img.naturalHeight } : BLANK);
  const toScreen = (x, y) => ({ x: x * view.s + view.x, y: y * view.s + view.y });
  const toImage = (sx, sy) => ({ x: (sx - view.x) / view.s, y: (sy - view.y) / view.s });
  const clampS = s => clamp(s, 0.01, 30);

  function tileScreenSize() {
    const g = S().grid;
    return { w: Math.max(Math.abs(g.ux + g.vx), Math.abs(g.ux - g.vx)) * view.s, h: Math.max(Math.abs(g.uy + g.vy), Math.abs(g.uy - g.vy)) * view.s };
  }
  function markerRadius() { const t = tileScreenSize(); return clamp(Math.min(t.w * 0.3, t.h * 0.5), 14, 24); }

  PP.board = {
    tileToScreen(c, r) { const p = PP.grid.center(c, r); return toScreen(p.x, p.y); },
    screenToTile(sx, sy) { const p = toImage(sx, sy); return PP.grid.toTile(p.x, p.y); },
    toScreen, toImage, tileScreenSize, markerRadius,
    redraw() { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; draw(); }); },
    fit,
    get view() { return Object.assign({}, view); },
    get image() { return img; }, // current screenshot <img> (null on blank boards) – used by vision/ai
    size: () => ({ w: cw, h: ch }),
    worldSize,
    // v5: fn(ctx, B) draws the board background in image coordinates; return false → default screenshot.
    // B.drawImage() draws the screenshot (sharpened copy when zoomed in) with the current ctx state (e.g. globalAlpha).
    setBackground(fn) { bgFn = typeof fn === 'function' ? fn : null; PP.board.redraw(); },
    // v5: set the view directly ({x, y, s}: screen = image * s + (x, y))
    setView(v) {
      if (!v) return;
      view = { x: isFinite(v.x) ? +v.x : view.x, y: isFinite(v.y) ? +v.y : view.y, s: isFinite(v.s) ? clampS(+v.s) : view.s };
      needFit = false; PP.board.redraw();
    },
    // center tile (c,r) in the visible map area (not covered by the drawer / floating card), optional scale s
    centerOn(c, r, s) {
      const p = PP.grid.center(c, r), sc = isFinite(s) ? clampS(+s) : view.s, vr = visibleRect();
      view = { s: sc, x: vr.x + vr.w / 2 - p.x * sc, y: vr.y + vr.h / 2 - p.y * sc };
      needFit = false; PP.board.redraw();
    },
    // part of the stage (stage/canvas coordinates) that is not covered by the overlay drawer or a floating card
    visibleRect: () => visibleRect(),
    // v6: set to false by a tool (UNITS) that draws the unit coins itself (core then draws no unit markers)
    drawUnits: true,
  };
  function visibleRect(noAct) {
    let x0 = 0, x1 = cw, y0 = 0, y1 = ch;
    if (!stage) return { x: 0, y: 0, w: cw, h: ch };
    const sr = stage.getBoundingClientRect();
    const dr = drawerEl && !drawerEl.hidden && !drawerEl.classList.contains('collapsed') ? drawerEl.getBoundingClientRect() : null;
    if (dr && dr.width > 0 && dr.left < sr.right - 1 && dr.right > sr.left + 1 && dr.top < sr.bottom - 1) {
      // overlay drawer: use the biggest free part – left of it, above it (bottom sheet) or below it
      const left = Math.max(0, dr.left - sr.left), above = Math.max(0, dr.top - sr.top), below = Math.max(0, sr.bottom - dr.bottom);
      const best = Math.max(left * ch, above * cw, below * cw);
      if (best === above * cw) y1 = Math.max(60, above);
      else if (best === left * ch) x1 = Math.max(40, left);
      else y0 = ch - below;
    }
    const fl = $('#float');
    if (fl && !fl.hidden) { const fr = fl.getBoundingClientRect(); if (fr.height) y1 = Math.max(60, Math.min(y1, fr.top - sr.top)); }
    // the mode's action bar on the map (Market: "✓ Built") sits at the bottom of the free part – keep the map above it
    const ma = noAct ? null : $('#mapAct');
    if (ma && !ma.hidden) { const mr = ma.getBoundingClientRect(); if (mr.height) y1 = Math.max(60, Math.min(y1, mr.top - sr.top - 4)); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const ow = cw, oh = ch;
    cw = r.width; ch = r.height; dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    if (needFit && boardReady()) fit();
    // keep the map anchored to the top: the panel below changes height on many taps and must not move the map
    else { if (ow && oh) view.x += (cw - ow) / 2; draw(); }
  }
  const boardReady = () => S().board === 'blank' || (S().board === 'image' && !!img);
  function fit() {
    if (!cw || !boardReady()) { needFit = true; return; }
    const { w, h } = worldSize(), pad = 6;
    const aw = Math.max(50, cw - 2 * pad), ah = Math.max(50, ch - 2 * pad);
    const s = Math.min(aw / w, ah / h);
    view = { s, x: (cw - w * s) / 2, y: pad + (ah - h * s) / 2 };
    needFit = false; draw();
  }

  // pixel access to the original screenshot (offscreen canvas, cached per image)
  let pix = null;
  function imagePixels() {
    if (!img) return null;
    if (pix && pix.src === img) return pix;
    try {
      const w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      pix = { src: img, w, h, data: x.getImageData(0, 0, w, h).data };
    } catch (e) { console.warn('imagePixels failed', e); pix = null; }
    return pix;
  }
  // v29: RGBA pixels of the whole screenshot { src, w, h, data } (cached) – for the tile model
  PP.board.pixels = () => (S().board === 'image' && img ? imagePixels() : null);
  // ~60 RGB samples from the upper 2/3 of the tile diamond (lower third is often covered by the tile's side/units)
  PP.board.sampleTile = function (c, r) {
    if (S().board !== 'image' || !img) return null;
    const P = imagePixels(); if (!P) return null;
    const g = S().grid, ctr = PP.grid.center(c, r), hh = Math.abs(g.uy + g.vy), N = 9, out = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p = ((i + 0.5) / N - 0.5) * 0.9, q = ((j + 0.5) / N - 0.5) * 0.9;
        const dy = p * g.uy + q * g.vy;
        if (dy > hh / 6) continue;
        const x = Math.floor(ctr.x + p * g.ux + q * g.vx), y = Math.floor(ctr.y + dy);
        if (x < 0 || y < 0 || x >= P.w || y >= P.h) continue;
        const k = (y * P.w + x) * 4;
        out.push([P.data[k], P.data[k + 1], P.data[k + 2]]);
      }
    }
    return { pixels: out };
  };

  // ---------------------------------------------------------------- draw helpers (screen space)
  function rr(c, x, y, w, h, rad) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, rad); else c.rect(x, y, w, h);
  }
  PP.draw = {
    arrow(c, p, q, color, pad, width) {
      pad = pad || 0; width = width || 8;
      let dx = q.x - p.x, dy = q.y - p.y;
      const L = Math.hypot(dx, dy);
      if (L < 2 * pad + 6) return;
      dx /= L; dy /= L;
      const nx = -dy, ny = dx;
      const sx = p.x + dx * pad, sy = p.y + dy * pad, ex = q.x - dx * pad, ey = q.y - dy * pad;
      const len = L - 2 * pad, hl = Math.min(width * 2.1, len * 0.55), hw = width * 1.25, w2 = width / 2;
      const bx = ex - dx * hl, by = ey - dy * hl;
      c.save();
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(sx + nx * w2, sy + ny * w2);
      c.lineTo(bx + nx * w2, by + ny * w2);
      c.lineTo(bx + nx * hw, by + ny * hw);
      c.lineTo(ex, ey);
      c.lineTo(bx - nx * hw, by - ny * hw);
      c.lineTo(bx - nx * w2, by - ny * w2);
      c.lineTo(sx - nx * w2, sy - ny * w2);
      c.closePath(); c.fill();
      c.restore();
    },
    pill(c, x, y, text, bg, size) {
      text = String(text); size = size || 12;
      c.save();
      c.font = `bold ${size}px system-ui,${EMOJI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(text).width + 12, h = size + 6;
      c.fillStyle = bg || 'rgba(0,0,0,.78)';
      rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fill();
      c.fillStyle = '#fff'; c.fillText(text, x, y + 1);
      c.restore();
      return w;
    },
    badge(c, x, y, text, bg) {
      text = String(text);
      c.save();
      c.font = `bold 12px system-ui,${EMOJI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(text).width, w = Math.max(22, tw + 10), h = 22;
      c.fillStyle = bg || '#ef476f';
      rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fill();
      c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
      c.fillStyle = '#fff'; c.fillText(text, x, y + 1);
      c.restore();
      return w;
    },
    diamond(c, tc, tr, fill, stroke) {
      const pts = PP.grid.corners(tc, tr).map(p => toScreen(p.x, p.y));
      c.save();
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = 2.5; c.lineJoin = 'round'; c.strokeStyle = stroke; c.stroke(); }
      c.restore();
    },
    tileIcon(c, tc, tr, icon, label) {
      const p = PP.board.tileToScreen(tc, tr), t = tileScreenSize();
      const size = clamp(t.h * 0.6, 12, 28);
      c.save();
      c.font = `${Math.round(size)}px ${EMOJI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(icon, p.x, p.y + 1);
      c.restore();
      if (label != null && label !== '') PP.draw.pill(c, p.x, p.y + size * 0.55 + 7, label, 'rgba(0,0,0,.72)', 10);
    },
    markerRadius: () => markerRadius(),
  };
  const D = PP.draw;

  // ---------------------------------------------------------------- main draw
  function draw() {
    if (!cv || !cw) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1122'; ctx.fillRect(0, 0, cw, ch);
    updateHint();
    const st = S();
    if (!st.board) return;
    const ws = worldSize();
    ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.s, view.s);
    let bgDone = false;
    if (bgFn) { try { bgDone = bgFn(ctx, BG_API) === true; } catch (e) { bgDone = false; reportError(e, 'background'); } }
    if (bgDone) { /* world layer drawn */ }
    else if (st.board === 'image' && img) drawShot();
    else if (st.board === 'blank') { ctx.fillStyle = '#2e6b4c'; ctx.fillRect(0, 0, ws.w, ws.h); }
    ctx.restore();
    const m = curMode(), calib = PP.modes.current === 'calibrate';
    if (st.ui.showGrid || calib || st.board === 'blank') drawGrid(calib);
    if (calib) return; // calibrating: screenshot + grid only
    hook(m, 'drawUnder', ctx, D);
    if (PP.board.drawUnits !== false) drawUnits(m); // fallback markers (UNITS turns this off and draws coins)
    // v6: persistent layers of all tools (coins, marks, planned icons …), active or not
    for (const id of layerOrder()) {
      const mm = registry[id];
      if (mm && typeof mm.drawAlways === 'function') {
        try { mm.drawAlways(ctx, D, id === PP.modes.current); } catch (e) { reportError(e, id + '.drawAlways'); }
      }
    }
    hook(m, 'drawOver', ctx, D);
  }

  function drawShot() {
    if (!img) return;
    ctx.imageSmoothingQuality = 'high';
    // zoomed in beyond 1 image px per device px → draw the sharpened high-res copy
    if (view.s * dpr > 1.15) wantHiRes();
    if (hiRes && hiRes.src === img && view.s * dpr > 1.15) ctx.drawImage(hiRes.canvas, 0, 0, img.naturalWidth, img.naturalHeight);
    else ctx.drawImage(img, 0, 0);
  }
  const BG_API = { drawImage: drawShot, get view() { return view; }, get dpr() { return dpr; }, get image() { return img; } };

  function drawGrid(strong) {
    const ws = worldSize();
    const tl = toScreen(0, 0), br = toScreen(ws.w, ws.h);
    const x0 = Math.max(0, tl.x), y0 = Math.max(0, tl.y), x1 = Math.min(cw, br.x), y1 = Math.min(ch, br.y);
    if (x1 <= x0 || y1 <= y0) return;
    const ts = tileScreenSize();
    if (ts.w < 6) return;
    const fr = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([sx, sy]) => { const p = toImage(sx, sy); return PP.grid.frac(p.x, p.y); });
    const cmin = Math.floor(Math.min(...fr.map(f => f.c))) - 1, cmax = Math.ceil(Math.max(...fr.map(f => f.c))) + 1;
    const rmin = Math.floor(Math.min(...fr.map(f => f.r))) - 1, rmax = Math.ceil(Math.max(...fr.map(f => f.r))) + 1;
    if ((cmax - cmin) + (rmax - rmin) > 600) return;
    const P = (c, r) => { const p = PP.grid.center(c, r); return toScreen(p.x, p.y); };
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    ctx.beginPath();
    for (let c = cmin; c <= cmax; c++) { const a = P(c + 0.5, rmin - 0.5), b = P(c + 0.5, rmax + 0.5); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    for (let r = rmin; r <= rmax; r++) { const a = P(cmin - 0.5, r + 0.5), b = P(cmax + 0.5, r + 0.5); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    if (strong) { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.strokeStyle = 'rgba(76,201,240,.95)'; ctx.lineWidth = 1.5; }
    else { ctx.strokeStyle = S().board === 'blank' ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; }
    ctx.stroke();
    ctx.restore();
  }

  // drawAlways order: market (bottom) → cost → units → draw (top) → anything else
  const LAYER_ORDER = ['market', 'cost', 'units', 'draw'];
  const layerOrder = () => LAYER_ORDER.concat(Object.keys(registry).filter(k => !LAYER_ORDER.includes(k)));
  const arrowWidth = () => clamp(tileScreenSize().h * 0.3, 5, 16);
  const arrowPad = () => Math.min(tileScreenSize().h * 0.18, 10);
  const visible = (p, m) => p.x > -m && p.y > -m && p.x < cw + m && p.y < ch + m;
  function deco(m, obj, kind) {
    const d = m.decorate ? hook(m, 'decorate', obj, kind) : null;
    return d || {};
  }

  // badge whose left edge sits near x (so long texts don't cover the marker)
  function sideBadge(x, y, text, bg) {
    ctx.save(); ctx.font = `bold 12px system-ui,${EMOJI_FONT}`;
    const w = Math.max(22, ctx.measureText(String(text)).width + 10);
    ctx.restore();
    D.badge(ctx, x + Math.max(0, w / 2 - 11), y, text, bg);
  }

  const tribeCol = o => (Array.isArray(o.color) && o.color.length >= 3 && o.color.slice(0, 3).every(v => isFinite(v)) ? `rgb(${o.color[0] | 0},${o.color[1] | 0},${o.color[2] | 0})` : null);
  function drawUnits(m) {
    const R0 = markerRadius();
    for (const u of S().units) {
      const p = PP.board.tileToScreen(u.c, u.r);
      if (!visible(p, 60)) continue;
      const dd = deco(m, u, 'unit'), R = R0;
      if (dd.hidden) continue;
      ctx.save();
      if (dd.dim) ctx.globalAlpha = 0.35;
      if (dd.ring) { ctx.beginPath(); ctx.arc(p.x, p.y, R + 4, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = dd.ring; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fillStyle = u.side === 'enemy' ? COLOR.enemy : COLOR.me; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
      if (tribeCol(u)) { ctx.beginPath(); ctx.arc(p.x, p.y, R - 2.5, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = tribeCol(u); ctx.stroke(); } // v5: tribe colour ring
      ctx.font = `${Math.round(R * 1.0)}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText(unitDef(u).icon || '?', p.x, p.y + 1);
      const txt = dd.label != null ? dd.label : (u.hp + (u.vet ? ' ★' : ''));
      D.pill(ctx, p.x, p.y + R + 9, txt, dd.labelBg || 'rgba(0,0,0,.78)', R0 >= 18 ? 12 : 11);
      const b = effBonus(u);
      if (b > 1) D.pill(ctx, p.x - R, p.y - R + 2, b >= 4 ? '🧱' : '🛡', 'rgba(0,0,0,.78)', 10);
      if (dd.badge != null && dd.badge !== '') sideBadge(p.x + R * 0.8, p.y - R * 0.8, dd.badge, dd.badgeBg || '#ef476f');
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- modes
  const registry = {};
  let reported = 0;
  function reportError(e, where) {
    console.error(where, e);
    if (Date.now() - reported > 4000) { reported = Date.now(); toast('⚠️ Error in ' + where + ': ' + (e && e.message || e)); }
  }
  function hook(m, name, ...args) {
    if (!m || typeof m[name] !== 'function') return undefined;
    try { return m[name](...args); } catch (e) { reportError(e, (PP.modes.current || '?') + '.' + name); return undefined; }
  }
  const curMode = () => registry[PP.modes.current] || {};
  // v6 tools on the left rail (order = rail order)
  const TOOLS = [
    { id: 'units', icon: '🪖', label: 'Units' },
    { id: 'cost', icon: '💰', label: 'Costs' },
    { id: 'draw', icon: '✏️', label: 'Draw' },
    { id: 'market', icon: '🏪', label: 'Market' },
    { id: 'notes', icon: '📝', label: 'Notes' },
  ];
  // v29: the label tool (training data for the tile detection) only with ?label in the URL
  try { if (new URLSearchParams(location.search).has('label')) TOOLS.push({ id: 'label', icon: '🏷️', label: 'Label' }); } catch (e) { /* no URL */ }
  const TOOL_IDS = TOOLS.map(t => t.id);
  const MODE_LABELS = { units: 'Units', cost: 'Costs', draw: 'Draw', market: 'Market', notes: 'Notes', label: 'Label', calibrate: 'Grid' };
  const toolInfo = id => TOOLS.find(t => t.id === id) || { id, icon: (registry[id] || {}).icon || '🧰', label: (registry[id] || {}).label || MODE_LABELS[id] || id };
  const firstTool = () => TOOL_IDS.find(id => registry[id]) || 'idle';
  // deep link from the landing pages: /?tool=units|cost|market|draw|notes opens that tool (once)
  let linkTool = (() => { try { return new URLSearchParams(location.search).get('tool'); } catch (e) { return null; } })();
  const takeLinkTool = () => { const t = linkTool && registry[linkTool] && TOOL_IDS.includes(linkTool) ? linkTool : null; linkTool = null; return t; };

  PP.modes = {
    takeLinkTool: () => takeLinkTool(),
    current: null,
    register(name, mode) { registry[name] = mode || {}; if (domReady) updateRail(); },
    get: name => registry[name] || null,
    has: name => !!registry[name],
    tools: () => TOOLS.map(t => Object.assign({ available: !!registry[t.id] }, t)),
    set(name) {
      if (!registry[name]) { toast(`“${MODE_LABELS[name] || name}” is not available yet`); return false; }
      if (name === PP.modes.current) { refresh(); return true; }
      const old = curMode();
      hook(old, 'onExit');
      PP.modes.current = name;
      if (TOOL_IDS.includes(name)) S().ui.mode = name;
      hook(registry[name], 'onEnter');
      panelScrollReset = true; panelFresh = true;
      save(); refresh();
      return true;
    },
  };
  // empty mode when no tool is loaded (nothing happens on taps)
  registry.idle = { label: '' };

  // ---------------------------------------------------------------- drawer (right side panel)
  PP.drawer = {
    open() { if (!S().ui.drawerOpen) { S().ui.drawerOpen = true; save(); } refresh(); },
    close() { if (S().ui.drawerOpen) { S().ui.drawerOpen = false; save(); } refresh(); },
    toggle() { return S().ui.drawerOpen ? PP.drawer.close() : PP.drawer.open(); },
    // phone: get out of the way after the user picked something to place on the map
    yieldMap() {
      if (!PP.drawer.isOverlay()) return;
      // bottom sheet: only get out of the way when it covers most of the map
      if (isSheet() && drawerEl && stage && drawerEl.getBoundingClientRect().height < stage.getBoundingClientRect().height * 0.55) return;
      PP.drawer.close();
    },
    isOpen: () => !!(drawerEl && !drawerEl.hidden && S().ui.drawerOpen),
    // true when the drawer floats over the map (phone); false when docked beside it (≥ 900 px)
    isOverlay: () => !window.matchMedia('(min-width: 900px)').matches,
    isSheet: () => isSheet(),
    // v8: bottom sheet in its compact peek state (only the tool's [data-peek] part visible)
    isPeek: () => !!(drawerEl && drawerEl.classList.contains('peek')),
    setFull: full => setSheetFull(full),
    fit: () => { fitSheet(); placeHint(); },
    get el() { return $('#panel'); },
  };
  // ---------------------------------------------------------------- UI helpers
  let toastTimer = 0;
  function toast(msg, ms) {
    const t = $('#toast'); if (!t) { console.log(msg); return; }
    t.textContent = msg; t.classList.add('show');
    // v8: phone bottom sheet open → show the toast above it (and above its tab / expand button)
    const dr = drawerEl && isSheet() && !drawerEl.hidden && !drawerEl.classList.contains('collapsed') ? drawerEl.getBoundingClientRect() : null;
    t.style.bottom = dr && dr.height ? Math.round(window.innerHeight - dr.top + 86) + 'px' : '';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2000);
  }
  let sheetClick = null, sheetInput = null, sheetClose = null;
  PP.ui = {
    toast,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    confirm: msg => window.confirm(msg),
    // onClick(ev, btn): ev is the click event (ev.btn / ev.dataset = clicked button / its dataset)
    // onInput(ev): input/change events inside the sheet. Re-opening while open keeps scroll position.
    openSheet(html, onClick, onInput, onClose) {
      const sh = $('#sheet'), body = $('#sheetBody'), wasOpen = !sh.hidden, top = body.scrollTop;
      body.innerHTML = html;
      sheetClick = onClick || null; sheetInput = onInput || null; sheetClose = onClose || null;
      sh.hidden = false;
      body.scrollTop = wasOpen ? top : 0;
    },
    closeSheet() {
      const sh = $('#sheet'); if (sh.hidden) return;
      sh.hidden = true; $('#sheetBody').innerHTML = '';
      const cb = sheetClose; sheetClick = sheetInput = sheetClose = null;
      if (cb) try { cb(); } catch (e) { reportError(e, 'sheet'); }
    },
    isSheetOpen: () => !$('#sheet').hidden,
  };
  const esc = PP.ui.esc;

  // ---------------------------------------------------------------- refresh / commit
  let domReady = false, panelScrollReset = false;
  function updateHint() {
    const el = $('#hint'); if (!el) return;
    let h = curMode().hint;
    if (typeof h === 'function') { try { h = h(); } catch (e) { h = ''; } }
    if (el.textContent !== (h || '')) el.textContent = h || '';
    el.hidden = !h || !S().board;
    // v30: a mode may show an action bar on the map (always at the same spot, usable with the panel collapsed)
    const ma = $('#mapAct');
    if (ma) {
      let a = curMode().mapAct;
      if (typeof a === 'function') { try { a = a(); } catch (e) { a = ''; reportError(e, 'mapAct'); } }
      if (ma._h !== (a || '')) { ma._h = a || ''; ma.innerHTML = ma._h; }
      ma.hidden = !a || !S().board;
    }
    placeHint();
  }
  function updateRail() {
    const rail = $('#railTools'); if (!rail) return;
    if (!rail.childElementCount) {
      rail.innerHTML = TOOLS.map(t => `<button data-tool="${t.id}" aria-label="${esc(t.label)}"><span>${t.icon}</span><small>${esc(t.label)}</small></button>`).join('');
    }
    const has = !!S().board, open = !!S().ui.drawerOpen;
    rail.querySelectorAll('[data-tool]').forEach(b => {
      const id = b.dataset.tool, on = id === PP.modes.current;
      b.classList.toggle('on', on);
      b.classList.toggle('open', on && open);
      b.classList.toggle('missing', !registry[id]);
      b.disabled = !has;
    });
  }
  function railClick(id) {
    if (!S().board) return;
    if (!registry[id]) { toast(`“${toolInfo(id).label}” is not available yet (js/${id}.js missing)`, 2500); return; }
    if (id === PP.modes.current) { PP.drawer.toggle(); return; }
    S().ui.drawerOpen = true;
    PP.modes.set(id);
  }
  // fresh panel element per mode so old el.onclick / listeners of the previous tool are gone
  let panelFresh = true;
  function panelEl(host) {
    let el = host.querySelector('.pbody');
    if (!el || panelFresh) {
      const n = document.createElement('div'); n.className = 'pbody';
      if (host.id === 'drawerBody') n.id = 'panel';
      if (el) el.replaceWith(n); else host.appendChild(n);
      el = n; panelFresh = false;
    }
    return el;
  }
  function renderPanel() {
    const dr = drawerEl, fl = $('#float'), m = curMode(), st = S();
    const floatMode = m.panelPlace === 'float'; // calibrate: small card at the bottom of the map
    // floating card
    if (floatMode && st.board && m.renderPanel) {
      fl.hidden = false; dr.hidden = true;
      const el = panelEl(fl);
      try { m.renderPanel(el); } catch (e) { el.innerHTML = '<p class="note">Error while rendering.</p>'; reportError(e, PP.modes.current + '.renderPanel'); }
      return;
    }
    fl.hidden = true; if (fl.querySelector('.pbody')) fl.querySelector('.pbody').remove();
    if (!st.board || !m.renderPanel) { dr.hidden = true; return; }
    dr.hidden = false;
    const open = !!st.ui.drawerOpen, info = toolInfo(PP.modes.current);
    dr.classList.toggle('collapsed', !open);
    $('#drawerTitle').innerHTML = `<span>${info.icon}</span> ${esc(info.label)}`;
    const sheet = isSheet();
    $('#drawerTab').innerHTML = open ? `<i>${sheet ? '⌄' : '›'}</i>` : `<span>${info.icon}</span><i>${sheet ? '⌃' : '‹'}</i>`;
    $('#drawerClose').textContent = sheet ? '⌄' : '›';
    $('#drawerTab').setAttribute('aria-label', open ? 'Collapse panel' : 'Open ' + info.label);
    if (st.ui.drawerW) dr.style.setProperty('--dw', st.ui.drawerW + 'px'); else dr.style.removeProperty('--dw');
    if (st.ui.drawerH) dr.style.setProperty('--dh', st.ui.drawerH + 'px'); else dr.style.removeProperty('--dh');
    if (!open) { fitSheet(); return; }
    const body = $('#drawerBody'), el = panelEl(body), top = body.scrollTop;
    try { m.renderPanel(el); } catch (e) { el.innerHTML = '<p class="note">Error while rendering.</p>'; reportError(e, PP.modes.current + '.renderPanel'); }
    body.scrollTop = panelScrollReset ? 0 : top;
    panelScrollReset = false;
    fitSheet();
  }
  // v8: bottom sheet "peek" state – a tool marks the essential part of its panel with [data-peek]; while
  // ui.sheetFull is off, the sheet is exactly as tall as that element (title row hidden, the rest of the panel
  // stays reachable by scrolling inside the sheet). The expand button (top-right edge) toggles peek ↔ full.
  let peekKey = null;
  function fitSheet() {
    const dr = drawerEl; if (!dr) return;
    const body = $('#drawerBody'), st = S();
    const pk = isSheet() && !dr.hidden && st.ui.drawerOpen ? body.querySelector('[data-peek]') : null;
    const wasPeek = dr.classList.contains('peek'), peek = !!pk && !st.ui.sheetFull;
    dr.classList.toggle('haspeek', !!pk);
    dr.classList.toggle('peek', peek);
    // "More": the sheet grows to its whole content (capped by max-height, rest scrolls)
    dr.classList.toggle('full', !!pk && !peek);
    renderSheetSwitch(pk);
    if (peek) {
      // new peek content (other selection / sub-mode) or just switched to peek → show it from the top
      const key = pk.getAttribute('data-peek') || '';
      if (!wasPeek || key !== peekKey) body.scrollTop = 0;
      peekKey = key;
      const br = body.getBoundingClientRect(), pr = pk.getBoundingClientRect();
      const bt = parseFloat(getComputedStyle(dr).borderTopWidth) || 0;
      const h = Math.ceil(pr.bottom - br.top + body.scrollTop + bt + 6);
      if (dr.style.getPropertyValue('--ph') !== h + 'px') dr.style.setProperty('--ph', h + 'px');
    } else peekKey = null;
    const xb = $('#sheetExpand');
    if (xb) {
      xb.innerHTML = peek ? '<i>⌃</i>More' : '<i class="dn">⌃</i>Less';
      xb.setAttribute('aria-label', peek ? 'Expand panel' : 'Shrink panel');
      xb.setAttribute('aria-expanded', String(!peek));
    }
    if (wasPeek !== peek) placeHint();
  }
  // optional mini switch on the sheet's top-left edge: mode.sheetSwitch = { items:[{id,label}], value(), set(id) }
  function renderSheetSwitch(pk) {
    const sw = $('#sheetSwitch'); if (!sw) return;
    const m = curMode(), cfg = pk && m.sheetSwitch;
    sw.hidden = !cfg;
    if (!cfg) return;
    let cur = null;
    try { cur = cfg.value(); } catch (e) { /* ignore */ }
    const html = cfg.items.map(it => `<button type="button" data-sw="${esc(it.id)}" class="${it.id === cur ? 'on' : ''}">${it.label}</button>`).join('');
    if (sw.innerHTML !== html) sw.innerHTML = html;
  }
  function setSheetFull(full) {
    full = !!full;
    if (S().ui.sheetFull !== full) { S().ui.sheetFull = full; save(); }
    if (!full) $('#drawerBody').scrollTop = 0;
    fitSheet(); placeHint(); PP.board.redraw();
  }
  function refresh() {
    if (!domReady) return;
    const has = !!S().board;
    $('#empty').hidden = has;
    document.body.classList.toggle('noboard', !has);
    updateRail(); updateHeader(); renderPanel(); placeHint(); draw();
  }
  function commit() {
    sanitize(); save();
    refresh();
  }
  // header budget chip (★ stars · +income) – tap opens the cost tool
  function updateHeader() {
    const b = $('#budget'); if (!b) return;
    const bd = S().build || {}, show = !!S().board && Number.isFinite(+bd.stars);
    b.hidden = !show;
    if (show) b.innerHTML = `★ <b>${+bd.stars}</b>${Number.isFinite(+bd.income) ? ` <small>+${+bd.income}</small>` : ''}`;
  }
  // hint pill: bottom-centre of the visible map part
  function placeHint() {
    const ma = $('#mapAct');
    if (ma && !ma.hidden) {
      // always at the same height: the bottom of the map (phone: just above the panel's grab tab, on top of the panel)
      const sheet = isSheet(), vr = sheet ? { x: 0, w: cw } : visibleRect(true);
      ma.style.left = (vr.x + vr.w / 2) + 'px';
      ma.style.width = Math.max(200, Math.min(440, vr.w - 16)) + 'px';
      ma.style.bottom = (sheet && drawerEl && !drawerEl.hidden ? 46 : 10) + 'px';
    }
    document.body.classList.toggle('mapact', !!(ma && !ma.hidden));
    const el = $('#hint'); if (!el || el.hidden) return;
    const vr = visibleRect();
    el.style.left = (vr.x + vr.w / 2) + 'px';
    el.style.maxWidth = Math.max(120, vr.w - 16) + 'px';
    // bottom sheet: keep clear of its grab tab (sticks out ~40 px above the sheet)
    const tabGap = isSheet() && drawerEl && !drawerEl.hidden ? 46 : 10;
    el.style.bottom = (ch - (vr.y + vr.h) + (ma && !ma.hidden ? 4 : tabGap)) + 'px';
    el.style.visibility = vr.w < 150 ? 'hidden' : '';
  }

  // ---------------------------------------------------------------- gestures
  const pts = new Map();
  let g = null, lpTimer = 0;
  function evPos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function tileInfo(sx, sy) {
    const p = toImage(sx, sy), t = PP.grid.toTile(p.x, p.y);
    return { c: t.c, r: t.r, sx, sy, x: p.x, y: p.y, unit: PP.find.unitAt(t.c, t.r), city: PP.find.cityAt(t.c, t.r) };
  }
  function startPinch() {
    const [a, b] = [...pts.values()];
    g = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: Object.assign({}, view) };
  }
  // v7: a mode may take two-finger gestures itself (calibrate: pinch scales the grid instead of zooming the map)
  function wantsPinch(m) {
    if (typeof m.onPinch !== 'function') return false;
    if (typeof m.wantsPinch === 'function') { try { return !!m.wantsPinch(); } catch (e) { return false; } }
    return true;
  }
  function pinchInfo() {
    const [a, b] = [...pts.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, p = toImage(mx, my);
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, sx: mx, sy: my, x: p.x, y: p.y };
  }
  function wantsDrag(m, t) {
    if (typeof m.onDrag !== 'function') return false;
    if (typeof m.wantsDrag === 'function') { try { return !!m.wantsDrag(t); } catch (e) { return false; } }
    return true;
  }
  function onDown(e) {
    if (!S().board) return;
    e.preventDefault();
    // iOS sometimes never delivers pointerup/cancel (e.g. a menu pops up under the finger). Such a "ghost finger"
    // turned every later one-finger touch into a pinch (zoom) and swallowed all taps. A primary pointer starts a
    // brand-new touch sequence, so nothing else can still be down: forget stale pointers.
    if (e.isPrimary && pts.size) { pts.clear(); g = null; clearTimeout(lpTimer); }
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = evPos(e); pts.set(e.pointerId, p);
    clearTimeout(lpTimer);
    if (pts.size === 1) {
      const forcePan = e.pointerType === 'mouse' && e.button !== 0;
      g = { type: 'pending', sx: p.x, sy: p.y, vx: view.x, vy: view.y, forcePan, t0: tileInfo(p.x, p.y), touch: e.pointerType !== 'mouse' };
      if (!forcePan) lpTimer = setTimeout(() => { if (g && g.type === 'pending') { g.type = 'done'; longPress(g.t0); } }, 500);
    } else if (pts.size === 2) {
      const m = curMode();
      if (g && g.type === 'mdrag') { hook(m, 'onDrag', wantsPinch(m) ? 'end' : 'cancel', g.last || g.t0); }
      if (wantsPinch(m)) { const q = pinchInfo(); g = { type: 'mpinch', p0: q }; hook(m, 'onPinch', 'start', { f: 1, p0: q, p: q }); }
      else startPinch();
      draw();
    }
  }
  function onMove(e) {
    if (!pts.has(e.pointerId)) return;
    const p = evPos(e); pts.set(e.pointerId, p);
    if (!g) return;
    if (g.type === 'mpinch') {
      if (pts.size < 2) return;
      const q = pinchInfo();
      hook(curMode(), 'onPinch', 'move', { f: q.d / g.p0.d, p0: g.p0, p: q });
      PP.board.redraw(); return;
    }
    if (g.type === 'pinch') {
      if (pts.size < 2) return;
      const [a, b] = [...pts.values()];
      const s = clampS(g.v0.s * Math.hypot(a.x - b.x, a.y - b.y) / g.d0);
      const wx = (g.m0.x - g.v0.x) / g.v0.s, wy = (g.m0.y - g.v0.y) / g.v0.s;
      view = { s, x: (a.x + b.x) / 2 - wx * s, y: (a.y + b.y) / 2 - wy * s };
      PP.board.redraw(); return;
    }
    if (g.type === 'done') return;
    const dx = p.x - g.sx, dy = p.y - g.sy;
    if (g.type === 'pending') {
      if (Math.hypot(dx, dy) < (g.touch ? 10 : 6)) return;
      clearTimeout(lpTimer);
      const m = curMode();
      if (!g.forcePan && wantsDrag(m, g.t0)) { g.type = 'mdrag'; g.last = g.t0; if (PP.modes.current !== 'calibrate' && PP.drawer.isOpen()) PP.drawer.yieldMap(); hook(m, 'onDrag', 'start', g.t0); }
      else g.type = 'pan';
    }
    if (g.type === 'pan') { view.x = g.vx + dx; view.y = g.vy + dy; PP.board.redraw(); }
    else if (g.type === 'mdrag') { g.last = tileInfo(p.x, p.y); hook(curMode(), 'onDrag', 'move', g.last); PP.board.redraw(); }
  }
  function onUp(e) {
    if (!pts.has(e.pointerId)) return;
    const p = evPos(e);
    pts.delete(e.pointerId); clearTimeout(lpTimer);
    if (!g) return;
    if (g.type === 'mpinch') {
      const m = curMode();
      hook(m, 'onPinch', e.type === 'pointercancel' ? 'cancel' : 'end', null);
      if (pts.size === 1 && e.type !== 'pointercancel') {
        // the remaining finger keeps dragging (the grid in calibrate mode)
        const q = [...pts.values()][0], t = tileInfo(q.x, q.y);
        if (wantsDrag(m, t)) { g = { type: 'mdrag', sx: q.x, sy: q.y, t0: t, last: t }; hook(m, 'onDrag', 'start', t); }
        else g = { type: 'pan', sx: q.x, sy: q.y, vx: view.x, vy: view.y };
      } else g = pts.size ? { type: 'done' } : null;
      PP.board.redraw();
      return;
    }
    if (g.type === 'pinch') {
      if (pts.size === 1) { const q = [...pts.values()][0]; g = { type: 'pan', sx: q.x, sy: q.y, vx: view.x, vy: view.y }; }
      else if (!pts.size) g = null;
      return;
    }
    if (pts.size) return;
    const cur = g; g = null;
    if (e.type === 'pointercancel') { if (cur.type === 'mdrag') hook(curMode(), 'onDrag', 'cancel', cur.last); PP.board.redraw(); return; }
    if (cur.type === 'pending' && !cur.forcePan) tap(cur.t0);
    else if (cur.type === 'mdrag') hook(curMode(), 'onDrag', 'end', tileInfo(p.x, p.y));
    PP.board.redraw();
  }
  function onWheel(e) {
    if (!S().board) return;
    e.preventDefault();
    const p = evPos(e);
    const s = clampS(view.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    const wx = (p.x - view.x) / view.s, wy = (p.y - view.y) / view.s;
    view = { s, x: p.x - wx * s, y: p.y - wy * s }; PP.board.redraw();
  }
  function tap(t) {
    const m = curMode();
    // phone: the floating drawer leaves too little map, so a map tap collapses it;
    // tools reopen it via PP.drawer.open() when they have something to show
    if (PP.drawer.isOverlay() && !isSheet() && PP.drawer.isOpen() && PP.modes.current !== 'calibrate') PP.drawer.close();
    if (typeof m.onTap === 'function') hook(m, 'onTap', t);
  }
  function longPress(t) {
    const m = curMode();
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* ignore */ }
    if (typeof m.onLongPress === 'function') hook(m, 'onLongPress', t);
  }

  // ---------------------------------------------------------------- editor sheet (unit | city)
  let ed = null;
  const BONI = [{ v: 1, label: 'None' }, { v: 1.5, label: '×1.5 Forest/Mountain' }, { v: 4, label: '×4 Wall' }];
  function openEditor(c, r, prefer) {
    const unit = PP.find.unitAt(c, r), city = PP.find.cityAt(c, r), last = S().ui.last;
    const types = UNITS(), type = types[last.type] ? last.type : Object.keys(types)[0];
    ed = {
      c, r,
      tab: prefer || (unit ? 'unit' : city ? 'city' : (last.tab === 'city' ? 'city' : 'unit')),
      unitNew: !unit, cityNew: !city, dirty: { unit: false, city: false },
      unit: unit ? Object.assign({}, unit) : { id: PP.util.uid(), c, r, side: last.side || 'me', type, hp: 10, vet: false, bonus: 1 },
      city: city ? Object.assign({}, city) : { id: PP.util.uid(), c, r, side: last.side || 'me', name: '', level: 1, pop: 0, capital: false, walls: false },
    };
    if (!unit) ed.unit.hp = maxHp(ed.unit);
    renderEditor();
  }
  function renderEditor() {
    const e = ed, isU = e.tab === 'unit', o = isU ? e.unit : e.city, isNew = isU ? e.unitNew : e.cityNew;
    let body = '';
    if (isU) {
      const u = e.unit, mx = maxHp(u);
      u.hp = clamp(Math.round(u.hp), 1, mx);
      body = `
        <div class="ugrid">${Object.entries(UNITS()).map(([k, d]) => `
          <button data-type="${k}" class="${u.type === k ? 'on' : ''}"><span>${d.icon}</span>${esc(d.name)}
          <small>⚔${d.atk} 🛡${d.def}${d.rng > 1 ? ' 🎯' + d.rng : ''}</small></button>`).join('')}</div>
        <div class="lbl">HP <b>${u.hp} / ${mx}</b></div>
        <div class="hprow"><button data-hp="-1" aria-label="less">−</button><input id="hpR" type="range" min="1" max="${mx}" value="${u.hp}"><button data-hp="1" aria-label="more">+</button></div>
        <button class="toggle ${u.vet ? 'on' : ''}" data-vet="1">★ Veteran (+5 max HP)</button>
        <div class="lbl">Defense bonus</div>
        <div class="seg">${BONI.map(b => `<button data-bonus="${b.v}" class="${(u.bonus || 1) === b.v ? 'on' : ''}">${b.label}</button>`).join('')}</div>
        <p class="note">If the unit stands in a city, ×1.5 applies automatically (×4 with City Wall).</p>`;
    } else {
      const ci = e.city;
      ci.level = clamp(ci.level || 1, 1, 8); ci.pop = clamp(ci.pop || 0, 0, ci.level);
      body = `
        <div class="lbl">Name (optional)</div>
        <input id="cityName" class="txt" type="text" maxlength="24" placeholder="e.g. Capital" value="${esc(ci.name)}">
        <div class="kv" style="margin-top:10px"><span>Level</span><div class="step"><button data-lv="-1">−</button><b>${ci.level}</b><button data-lv="1">+</button></div></div>
        <div class="kv"><span>Population <small class="muted">(${ci.level + 1} for level ${ci.level + 1})</small></span><div class="step"><button data-pop="-1">−</button><b>${ci.pop}</b><button data-pop="1">+</button></div></div>
        <div class="toggles">
          <button class="toggle ${ci.capital ? 'on' : ''}" data-cap="1">👑 Capital</button>
          <button class="toggle ${ci.walls ? 'on' : ''}" data-walls="1">🧱 City Wall</button>
        </div>`;
    }
    const mark = x => (x ? ' ✓' : '');
    const html = `
      <div class="sheethead"><b>${isNew ? 'New' : 'Edit'} <small>· Tile ${e.c}, ${e.r}</small></b><button class="x" data-act="cancel" aria-label="Close">✕</button></div>
      <div class="seg big">
        <button data-tab="unit" class="${isU ? 'on' : ''}">🪖 Unit${mark(!e.unitNew)}</button>
        <button data-tab="city" class="${!isU ? 'on' : ''}">🏠 City${mark(!e.cityNew)}</button>
      </div>
      <div class="seg">
        <button data-side="me" class="${o.side === 'me' ? 'on me' : ''}">🔵 Mine</button>
        <button data-side="enemy" class="${o.side === 'enemy' ? 'on enemy' : ''}">🔴 Enemy</button>
      </div>
      ${body}
      <div class="actions">
        ${isNew ? '' : '<button class="danger" data-act="del">Delete</button>'}
        <button data-act="cancel">Cancel</button>
        <button class="primary" data-act="ok">${isNew ? 'Add' : 'Save'}</button>
      </div>`;
    PP.ui.openSheet(html, editorClick, editorInput, () => { ed = null; });
  }
  function editorClick(ev, b) {
    if (!b || !ed) return;
    const e = ed, d = b.dataset, u = e.unit, ci = e.city;
    if (d.tab) { e.tab = d.tab; }
    else if (d.side) { (e.tab === 'unit' ? u : ci).side = d.side; e.dirty[e.tab] = true; }
    else if (d.type) { u.type = d.type; u.hp = maxHp(u); e.dirty.unit = true; }
    else if (d.hp) { u.hp += +d.hp; e.dirty.unit = true; }
    else if (d.vet) { const full = u.hp >= maxHp(u); u.vet = !u.vet; if (full || u.hp > maxHp(u)) u.hp = maxHp(u); e.dirty.unit = true; }
    else if (d.bonus) { u.bonus = +d.bonus; e.dirty.unit = true; }
    else if (d.lv) { ci.level = clamp((ci.level || 1) + +d.lv, 1, 8); e.dirty.city = true; }
    else if (d.pop) { ci.pop = clamp((ci.pop || 0) + +d.pop, 0, ci.level || 1); e.dirty.city = true; }
    else if (d.cap) { ci.capital = !ci.capital; e.dirty.city = true; }
    else if (d.walls) { ci.walls = !ci.walls; e.dirty.city = true; }
    else if (d.act === 'cancel') return PP.ui.closeSheet();
    else if (d.act === 'del') return deleteEdited();
    else if (d.act === 'ok') return saveEdited();
    else return;
    renderEditor();
  }
  function editorInput(ev) {
    if (!ed) return;
    if (ev.target.id === 'hpR') { ed.unit.hp = +ev.target.value; ed.dirty.unit = true; if (ev.type === 'change') renderEditor(); else { const l = document.querySelector('#sheetBody .lbl b'); if (l) l.textContent = `${ed.unit.hp} / ${maxHp(ed.unit)}`; } }
    else if (ev.target.id === 'cityName') { ed.city.name = ev.target.value; ed.dirty.city = true; }
  }
  function upsert(list, obj) { const i = list.findIndex(x => x.id === obj.id); if (i >= 0) list[i] = obj; else list.push(obj); }
  function saveEdited() {
    const st = S(), e = ed;
    const doUnit = e.tab === 'unit' || e.dirty.unit, doCity = e.tab === 'city' || e.dirty.city;
    if (doUnit) {
      const u = e.unit; u.c = e.c; u.r = e.r; u.hp = clamp(Math.round(u.hp), 1, maxHp(u));
      u.src = 'user'; if ('conf' in u) u.conf = 1; // v4: user-confirmed, never replaced by re-detection
      st.units = st.units.filter(x => x.id === u.id || !(x.c === u.c && x.r === u.r));
      upsert(st.units, u);
    }
    if (doCity) {
      const ci = e.city; ci.c = e.c; ci.r = e.r; ci.name = (ci.name || '').trim();
      st.cities = st.cities.filter(x => x.id === ci.id || !(x.c === ci.c && x.r === ci.r));
      if (ci.capital) st.cities.forEach(x => { if (x.id !== ci.id && x.side === ci.side) x.capital = false; });
      upsert(st.cities, ci);
    }
    const o = e.tab === 'unit' ? e.unit : e.city;
    st.ui.last = { side: o.side, type: e.unit.type, tab: e.tab };
    PP.ui.closeSheet(); commit();
  }
  function deleteEdited() {
    const st = S(), e = ed;
    if (e.tab === 'unit') st.units = st.units.filter(x => x.id !== e.unit.id);
    else st.cities = st.cities.filter(x => x.id !== e.city.id);
    PP.ui.closeSheet(); commit();
    toast(e.tab === 'unit' ? 'Unit deleted' : 'City deleted');
  }
  PP.ui.openEditor = openEditor;

  // ---------------------------------------------------------------- quick unit picker (one tap = unit created)
  let qu = null;
  function quickUnit(opts, onDone) {
    opts = opts || {};
    const last = S().ui.last || {};
    qu = { c: opts.c, r: opts.r, side: opts.side || last.side || 'me', hp: null, vet: false, onDone: onDone || null };
    renderQuick();
  }
  function renderQuick() {
    const q = qu, lastType = (S().ui.last || {}).type;
    const html = `
      <div class="sheethead"><b>Place unit <small>· Tile ${q.c}, ${q.r}</small></b><button class="x" data-q="close" aria-label="Close">✕</button></div>
      <div class="seg big">
        <button data-qside="me" class="${q.side === 'me' ? 'on me' : ''}">🔵 Mine</button>
        <button data-qside="enemy" class="${q.side === 'enemy' ? 'on enemy' : ''}">🔴 Enemy</button>
      </div>
      <div class="qopts">
        <span class="muted">HP</span>
        <div class="step"><button data-qhp="-1" aria-label="less">−</button><b>${q.hp == null ? 'full' : q.hp}</b><button data-qhp="1" aria-label="more">+</button></div>
        <button class="toggle ${q.vet ? 'on' : ''}" data-qvet="1">★ Veteran</button>
      </div>
      <div class="ugrid quick">${Object.entries(UNITS()).map(([k, d]) => `
        <button data-qtype="${k}" class="${k === lastType ? 'on' : ''}"><span>${d.icon}</span>${esc(d.name)}
        <small>⚔${d.atk} 🛡${d.def}${d.rng > 1 ? ' 🎯' + d.rng : ''}</small></button>`).join('')}</div>
      <p class="note">Tap a type to place the unit. Details later: long-press.</p>`;
    PP.ui.openSheet(html, quickClick, null, () => { qu = null; });
  }
  function quickClick(ev, b) {
    if (!b || !qu) return;
    const q = qu, d = b.dataset;
    if (d.q === 'close') return PP.ui.closeSheet();
    if (d.qside) q.side = d.qside;
    else if (d.qvet) q.vet = !q.vet;
    else if (d.qhp) {
      const ref = maxHp({ type: (S().ui.last || {}).type || Object.keys(UNITS())[0], vet: q.vet });
      q.hp = clamp((q.hp == null ? ref : q.hp) + +d.qhp, 1, 45);
      if (q.hp >= ref && +d.qhp > 0) q.hp = null; // back to "full"
    } else if (d.qtype) {
      const st = S(), u = { id: PP.util.uid(), c: q.c, r: q.r, side: q.side, type: d.qtype, hp: 10, vet: q.vet, bonus: 1, src: 'user' };
      const mx = maxHp(u);
      u.hp = q.hp == null ? mx : clamp(q.hp, 1, mx);
      st.units = st.units.filter(x => !(x.c === u.c && x.r === u.r));
      st.units.push(u);
      st.ui.last = { side: u.side, type: u.type, tab: 'unit' };
      const cb = q.onDone;
      PP.ui.closeSheet();
      if (cb) try { cb(u); } catch (e) { reportError(e, 'quickUnit'); }
      commit();
      return;
    } else return;
    renderQuick();
  }
  PP.ui.quickUnit = quickUnit;

  // ---------------------------------------------------------------- core modes
  // calibrate mode – steps: 'auto' (confirm detected grid), 'tune' (fine-tune), 1/2 (manual 2-tap measurement)
  const RATIO = 0.6; // Polytopia: tile height/width, rotation 0 (fixed camera)
  const cal = { step: 'tune', p1: null, drag: null, pinch: null, next: null, adv: false, fingers: 'grid' };
  function calAnchorTile() {
    const p = toImage(cw / 2, ch / 2);
    return PP.grid.toTile(p.x, p.y);
  }
  function calReset(step) { cal.step = step || 'tune'; cal.p1 = null; cal.drag = null; cal.pinch = null; }
  // tile-width limits for the slider / pinch
  const calWLimits = () => { const ws = worldSize(); return { min: ws.w / 40, max: ws.w / 2 }; };
  function calShowW() {
    const w = PP.grid.params().w, l = $('#calW'), r = $('#calWR');
    if (l) l.textContent = fmt(w, 1) + ' px';
    if (r) r.value = w;
  }
  function enterCal(step) {
    if (PP.modes.current === 'calibrate') { calReset(step); refresh(); } else { cal.next = step; PP.modes.set('calibrate'); }
  }
  const curRatio = () => { const r = PP.grid.params().ratio; return r >= 0.45 && r <= 0.8 ? r : RATIO; };
  // grid confirmed → back to the last tool (fresh screenshot: Units) with the drawer open
  let afterCal = null;
  function calDone() {
    save();
    const st = S(), want = takeLinkTool() || afterCal || st.ui.mode;
    afterCal = null;
    st.ui.drawerOpen = true;
    PP.modes.set(want && registry[want] && TOOL_IDS.includes(want) ? want : firstTool());
    toast('Grid saved');
  }
  // apply a PP.vision.detectGrid result; the tile at the screen center keeps its (c,r) → placed objects stay put
  function applyDetected(det) {
    const at = calAnchorTile(), keep = PP.grid.center(at.c, at.r);
    const w = det.w, h = RATIO * w, dx = keep.x - det.cx, dy = keep.y - det.cy;
    const a = Math.round(dx / w + dy / h), b = Math.round(dy / h - dx / w);
    const qx = det.cx + (a - b) * w / 2, qy = det.cy + (a + b) * h / 2;
    const g = S().grid;
    g.ux = w / 2; g.uy = h / 2; g.vx = -w / 2; g.vy = h / 2;
    g.ox = qx - at.c * g.ux - at.r * g.vx; g.oy = qy - at.c * g.uy - at.r * g.vy;
  }
  let lastDetect = null, lastDetectImg = null;
  function runDetect() {
    if (!img || !PP.vision || !PP.vision.detectGrid) return null;
    const det = PP.vision.detectGrid(img);
    lastDetect = det; lastDetectImg = img;
    if (det) console.log('Grid detection', det);
    if (det && det.ok) { applyDetected(det); return det; }
    return null;
  }
  // v29: the most common detection error is a grid at half or double the tile size → one tap fixes it.
  // The new width is searched again (± 3 %) so the lines also land on the right tile edges (offset).
  function calScale(f) {
    const w = PP.grid.params().w * f, lim = calWLimits();
    if (w < lim.min || w > lim.max) { toast(f > 1 ? 'Tiles can\'t get bigger' : 'Tiles can\'t get smaller'); return; }
    let det = null;
    if (img && PP.vision && PP.vision.detectGrid) { try { det = PP.vision.detectGrid(img, { wMin: w * 0.97, wMax: w * 1.03 }); } catch (e) { det = null; } }
    if (det && det.w > 0) applyDetected(det);
    else {
      const at = calAnchorTile(), keep = PP.grid.center(at.c, at.r), g = S().grid;
      g.ux *= f; g.uy *= f; g.vx *= f; g.vy *= f;
      g.ox = keep.x - at.c * g.ux - at.r * g.vx; g.oy = keep.y - at.c * g.uy - at.r * g.vy;
    }
    commit(); calShowW();
    toast(f > 1 ? 'Tiles 2× bigger' : 'Tiles half the size');
  }
  const SCALE_ROW = '<div class="lbl">Wrong size? One diamond should cover exactly one tile.</div>' +
    '<div class="btnrow"><button data-cal="half" title="Each diamond covers several tiles">½ Diamonds too big</button><button data-cal="dbl" title="A tile is split into several diamonds">2× Diamonds too small</button></div>';
  const fmt = (v, d) => v.toFixed(d);
  PP.modes.register('calibrate', {
    label: 'Grid',
    panelPlace: 'float',
    hint: () => (cal.step === 'auto' ? 'Do the lines sit on the tile edges?'
      : cal.step === 1 ? '① Tap exactly on the center of a tile'
        : cal.step === 2 ? '② Now the center of the tile to its right'
          : cal.fingers === 'map' ? 'Drag/pinch: move & zoom the map · Tap: center a tile'
            : 'Drag: move grid · Pinch: resize grid · Tap: center a tile'),
    onEnter() { calReset(cal.next || 'tune'); cal.next = null; cal.fingers = 'grid'; },
    wantsDrag() { return cal.step === 'tune' && cal.fingers === 'grid'; },
    wantsPinch() { return cal.step === 'tune' && cal.fingers === 'grid'; },
    // two fingers scale the grid around the pinch center (and move it with the fingers' midpoint):
    // the image point under the start midpoint p0 stays under the current midpoint p
    onPinch(phase, q) {
      const g = S().grid;
      if (phase === 'start') { cal.pinch = { ox: g.ox, oy: g.oy, ux: g.ux, uy: g.uy, vx: g.vx, vy: g.vy, w: PP.grid.params().w }; return; }
      const z = cal.pinch; if (!z) return;
      if (phase === 'move') {
        const lim = calWLimits(), f = clamp(q.f, lim.min / z.w, lim.max / z.w);
        g.ux = z.ux * f; g.uy = z.uy * f; g.vx = z.vx * f; g.vy = z.vy * f;
        g.ox = q.p.x + f * (z.ox - q.p0.x); g.oy = q.p.y + f * (z.oy - q.p0.y);
        calShowW();
      } else if (phase === 'end') { cal.pinch = null; commit(); }
      else { Object.assign(g, { ox: z.ox, oy: z.oy, ux: z.ux, uy: z.uy, vx: z.vx, vy: z.vy }); cal.pinch = null; PP.board.redraw(); }
    },
    onTap(t) {
      if (cal.step === 'auto') return;
      if (cal.step === 1) { cal.p1 = { x: t.x, y: t.y }; cal.step = 2; refresh(); return; }
      if (cal.step === 2) {
        const p1 = cal.p1, w = Math.abs(t.x - p1.x); // only the horizontal distance counts (no rotation)
        if (w * view.s < 12) { toast('Too close – tap the neighboring tile to the right'); return; }
        const tile = PP.grid.toTile(p1.x, p1.y); // keep units on their (c,r)
        PP.grid.setParams(w, curRatio(), 0, 0, 0);
        const g = S().grid;
        g.ox = p1.x - tile.c * g.ux - tile.r * g.vx; g.oy = p1.y - tile.c * g.uy - tile.r * g.vy;
        cal.step = 'tune'; cal.p1 = null; commit();
        toast('Grid set – now fine-tune it');
        return;
      }
      // tune: snap the tapped tile's center to the tap position
      const g = S().grid, c0 = PP.grid.center(t.c, t.r);
      g.ox += t.x - c0.x; g.oy += t.y - c0.y; commit();
    },
    onDrag(phase, t) {
      const g = S().grid;
      if (phase === 'start') cal.drag = { ox: g.ox, oy: g.oy, x: t.x, y: t.y };
      else if (!cal.drag) return;
      else if (phase === 'move') { g.ox = cal.drag.ox + (t.x - cal.drag.x); g.oy = cal.drag.oy + (t.y - cal.drag.y); }
      else if (phase === 'end') { cal.drag = null; commit(); }
      else { g.ox = cal.drag.ox; g.oy = cal.drag.oy; cal.drag = null; PP.board.redraw(); }
    },
    drawOver(c) {
      if (cal.step !== 2 || !cal.p1) return;
      const p = toScreen(cal.p1.x, cal.p1.y);
      c.save();
      c.beginPath(); c.arc(p.x, p.y, 7, 0, Math.PI * 2); c.fillStyle = '#4cc9f0'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
      c.restore();
      D.badge(c, p.x, p.y - 20, '1', '#0a7fa8');
    },
    renderPanel(el) {
      const isImg = S().board === 'image' && !!img;
      if (cal.step === 'auto') {
        const unsure = lastDetect && lastDetect.conf != null && lastDetect.conf < 0.6;
        el.innerHTML = `
          <div class="calok"${unsure ? ' style="background:rgba(255,170,0,.14)"' : ''}><b${unsure ? ' style="color:#ffb703"' : ''}>${unsure ? 'Grid detected – not quite sure, please check' : 'Grid detected automatically ✓ – does it fit?'}</b>
            <span>Do the lines sit on the tile edges? Zoom in with two fingers to check.</span></div>
          ${SCALE_ROW}
          <div class="btnrow big"><button data-cal="tune">✏️ Adjust</button><button class="primary" data-cal="done">✓ Looks good</button></div>`;
      } else if (cal.step === 1 || cal.step === 2) {
        const st = n => (cal.step === n ? 'cur' : cal.step > n ? 'done' : '');
        const fig = `<svg class="calfig" width="150" height="46" viewBox="0 0 150 46" aria-hidden="true">
          <g fill="rgba(255,255,255,.08)" stroke="#4cc9f0" stroke-width="1.5">
            <path d="M15 23 L45 5 L75 23 L45 41 Z"/><path d="M75 23 L105 5 L135 23 L105 41 Z"/></g>
          <path d="M51 23 H93" stroke="#ffd166" stroke-width="2" marker-end="url(#ah)"/>
          <defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#ffd166"/></marker></defs>
          <circle cx="45" cy="23" r="7" fill="#4cc9f0"/><text x="45" y="27" font-size="10" text-anchor="middle" fill="#08121f" font-weight="700">1</text>
          <circle cx="105" cy="23" r="7" fill="#4cc9f0"/><text x="105" y="27" font-size="10" text-anchor="middle" fill="#08121f" font-weight="700">2</text></svg>`;
        el.innerHTML = `
          <div class="row between"><b>📐 Measure grid</b><span class="muted small">Step ${cal.step} of 2</span></div>
          <ol class="calsteps">
            <li class="${st(1)}"><b>${cal.step > 1 ? '✓' : '1'}</b><span>Tap the <b>center of a tile</b>.</span></li>
            <li class="${st(2)}"><b>2</b><span>Tap the <b>center of the tile to its right</b> (same height).</span></li>
          </ol>
          ${fig}
          <p class="note">Tip: zoom in with two fingers first, then tap precisely. One finger moves the map.</p>
          <div class="btnrow">${cal.step === 2 ? '<button data-cal="restart">↺ Restart</button>' : ''}<button data-cal="tune">Skip</button></div>`;
      } else {
        const p = PP.grid.params(), lim = calWLimits(), minW = lim.min, maxW = lim.max, gm = cal.fingers === 'grid';
        el.innerHTML = `
          <div class="row between"><b>📐 Adjust grid</b><span class="muted small">Tile <b id="calW">${fmt(p.w, 1)} px</b></span></div>
          <div class="seg" role="group" aria-label="Fingers move"><button data-cal="fg" class="${gm ? 'on' : ''}">▦ Move grid</button><button data-cal="fm" class="${gm ? '' : 'on'}">🗺 Move map</button></div>
          ${SCALE_ROW}
          <div class="lbl">Tile size (fine)</div>
          <div class="hprow"><button data-cal="w-" aria-label="smaller">−</button><input id="calWR" type="range" min="${minW}" max="${maxW}" step="${(maxW - minW) / 2000}" value="${clamp(p.w, minW, maxW)}"><button data-cal="w+" aria-label="larger">+</button></div>
          <details class="adv" ${cal.adv ? 'open' : ''}><summary>Advanced</summary>
            <div class="lbl">Height/width ratio <b id="calR">${fmt(p.ratio, 3)}</b></div>
            <div class="hprow"><input id="calRR" type="range" min="0.45" max="0.8" step="0.005" value="${clamp(p.ratio, 0.45, 0.8)}"><button data-cal="r0">0.6</button></div>
            <p class="note">Polytopia always uses 0.6 – only change it if the grid doesn't fit otherwise.</p>
            <div class="btnrow"><button data-cal="restart">📏 Measure with 2 taps</button></div>
          </details>
          <div class="btnrow">${isImg ? '<button data-cal="auto">↺ Reset to auto</button>' : '<button data-cal="restart">📏 2 Taps</button>'}<button class="primary" data-cal="done">✓ Done</button></div>`;
        const det = el.querySelector('details');
        if (det) det.ontoggle = () => { cal.adv = det.open; };
      }
      el.onclick = ev => {
        const b = ev.target.closest('button'); if (!b || !b.dataset.cal) return;
        const a = b.dataset.cal, p = PP.grid.params(), at = calAnchorTile();
        if (a === 'half' || a === 'dbl') { calScale(a === 'dbl' ? 2 : 0.5); return; }
        if (a === 'restart') { calReset(1); refresh(); }
        else if (a === 'tune') { calReset('tune'); refresh(); }
        else if (a === 'done') calDone();
        else if (a === 'auto') {
          // reuse the detection of this screenshot if there is one (same result, no wait)
          const det = lastDetectImg === img && lastDetect && lastDetect.ok ? lastDetect : runDetect();
          if (det) { applyDetected(det); calReset('auto'); commit(); toast('Grid reset to the automatic detection'); }
          else toast('No grid detected – please adjust it by hand');
        }
        else if (a === 'fg' || a === 'fm') { cal.fingers = a === 'fg' ? 'grid' : 'map'; refresh(); }
        else if (a === 'w-' || a === 'w+') { PP.grid.setParams(p.w * (a === 'w+' ? 1.002 : 1 / 1.002), p.ratio, 0, at.c, at.r); commit(); }
        else if (a === 'r0') { PP.grid.setParams(p.w, RATIO, 0, at.c, at.r); commit(); }
      };
      el.oninput = ev => {
        const id = ev.target.id; if (id !== 'calWR' && id !== 'calRR') return;
        const p = PP.grid.params(), at = calAnchorTile(), v = +ev.target.value;
        if (id === 'calWR') { PP.grid.setParams(v, p.ratio, 0, at.c, at.r); $('#calW').textContent = fmt(v, 1) + ' px'; }
        else { PP.grid.setParams(p.w, v, 0, at.c, at.r); $('#calR').textContent = fmt(v, 3); }
        save(); PP.board.redraw();
      };
    },
    onExit() { calReset('tune'); save(); },
  });

  // ---------------------------------------------------------------- board loading
  // clears everything that belongs to a screenshot (keeps owned techs, stars/income and unknown extra fields)
  function clearBoardItems(all) {
    const st = S(), b = st.build;
    st.units = []; st.cities = []; st.marks = [];
    st.combat = { attackers: [], targets: [] };
    st.tiles = {};
    st.market = Object.assign({}, st.market || {}, { region: null });
    b.placements = []; b.rewards = {}; b.unitCounts = {}; b.planned = [];
    if (all) b.owned = [];
  }
  // header OCR (stars / income / turn) in the background; ignored if another image was loaded meanwhile
  let ocrToken = 0, lastOcr = null;
  function startOcr(im) {
    if (!PP.vision || !PP.vision.readHeader) return Promise.resolve(null);
    const tok = ++ocrToken;
    return PP.vision.readHeader(im).then(r => {
      lastOcr = r;
      if (!r || tok !== ocrToken || img !== im) return r;
      const b = S().build, ok = v => Number.isFinite(v) && v >= 0 && v < 1000, parts = [];
      if (ok(r.stars)) { b.stars = r.stars; parts.push('★ ' + r.stars); }
      if (ok(r.income)) { b.income = r.income; parts.push('+' + r.income + ' per turn'); }
      if (ok(r.turn)) S().ui.turn = r.turn;
      if (parts.length) { commit(); toast(parts.join(' · ') + ' taken from the screenshot', 3500); }
      return r;
    }).catch(() => null);
  }
  // Upscale with high-quality smoothing, then unsharp-mask, so zooming in looks crisper.
  // Capped at ~8 MP to stay light on phones; can't add detail the screenshot doesn't have.
  // The sharpening runs in a Web Worker and only when the user first zooms in: done on the main thread at
  // start-up it froze the app for ~0.6 s (4× slower phones: much more).
  const HI_WORKER_SRC = `self.onmessage = function (e) {
    var W = e.data.W, H = e.data.H, amount = e.data.amount, d = new Uint8ClampedArray(e.data.buf), n = W * H;
    var tmp = new Float32Array(n * 3), blur = new Float32Array(n * 3), xx, yy, k;
    for (yy = 0; yy < H; yy++) { var row = yy * W;
      for (xx = 0; xx < W; xx++) { var a = row + Math.max(0, xx - 1), b = row + xx, c = row + Math.min(W - 1, xx + 1);
        for (k = 0; k < 3; k++) tmp[b * 3 + k] = (d[a * 4 + k] + d[b * 4 + k] + d[c * 4 + k]) / 3; } }
    for (yy = 0; yy < H; yy++) { var up = Math.max(0, yy - 1) * W, mid = yy * W, dn = Math.min(H - 1, yy + 1) * W;
      for (xx = 0; xx < W; xx++) for (k = 0; k < 3; k++)
        blur[(mid + xx) * 3 + k] = (tmp[(up + xx) * 3 + k] + tmp[(mid + xx) * 3 + k] + tmp[(dn + xx) * 3 + k]) / 3; }
    for (var i = 0; i < n; i++) for (k = 0; k < 3; k++) { var o = d[i * 4 + k]; d[i * 4 + k] = o + amount * (o - blur[i * 3 + k]); }
    self.postMessage({ buf: d.buffer }, [d.buffer]);
  };`;
  let hiWorker = null, hiBusy = null, hiTimer = 0;
  function hiWorkerGet() {
    if (hiWorker !== null) return hiWorker;
    try { hiWorker = new Worker(URL.createObjectURL(new Blob([HI_WORKER_SRC], { type: 'text/javascript' }))); }
    catch (e) { hiWorker = false; } // no workers → simply no sharpened copy (never block the UI for it)
    return hiWorker;
  }
  // called from draw(): start the sharpened copy once the user zooms past 1:1 and the gesture has settled
  function wantHiRes() {
    if (!img || hiRes && hiRes.src === img || hiBusy === img || hiTimer) return;
    // schedule once (draw() runs every frame while animations play, so don't keep re-arming the timer)
    hiTimer = setTimeout(() => { hiTimer = 0; buildHiRes(img); }, 350);
  }
  function buildHiRes(src) {
    if (!src || src !== img || hiBusy === src || (hiRes && hiRes.src === src)) return;
    const wk = hiWorkerGet(); if (!wk) return;
    try {
      const w = src.naturalWidth, h = src.naturalHeight;
      const f = Math.min(3, Math.sqrt(6e6 / (w * h)));
      if (f < 1.4) return;
      const W = Math.round(w * f), H = Math.round(h * f);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(src, 0, 0, W, H);
      const id = x.getImageData(0, 0, W, H);
      hiBusy = src;
      const onMsg = e => {
        wk.removeEventListener('message', onMsg);
        hiBusy = null;
        if (img !== src) return;
        try { x.putImageData(new ImageData(new Uint8ClampedArray(e.data.buf), W, H), 0, 0); hiRes = { canvas: c, src }; PP.board.redraw(); }
        catch (err) { hiRes = null; }
      };
      wk.addEventListener('message', onMsg);
      wk.postMessage({ buf: id.data.buffer, W, H, amount: 0.9 }, [id.data.buffer]);
    } catch (e) { hiBusy = null; hiRes = null; }
  }
  // resolves { det } after the grid detection ran (fresh) or after the image is shown (restore)
  function loadImageBlob(blob, fresh) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob), im = new Image();
      im.onload = () => {
        if (imgUrl) URL.revokeObjectURL(imgUrl);
        img = im; imgUrl = url; pix = null; hiRes = null;
        const st = S();
        st.board = 'image';
        if (!fresh) { needFit = true; fit(); commit(); resolve({ det: null }); return; }
        idb.set('img', blob);
        const w = im.naturalWidth / 7, h = RATIO * w;
        st.grid = { ox: im.naturalWidth / 2, oy: im.naturalHeight / 2, ux: w / 2, uy: h / 2, vx: -w / 2, vy: h / 2 };
        needFit = true; fit();
        commit();
        // let the image paint first, then detect (≈ 0.1 s)
        setTimeout(() => {
          if (img !== im) { resolve({ det: null }); return; }
          const det = runDetect();
          afterCal = firstTool() === 'idle' ? null : (registry.units ? 'units' : firstTool());
          if (det) enterCal('auto');
          else { enterCal(1); toast('Grid not detected automatically – please tap two tiles', 3500); }
          commit();
          resolve({ det: lastDetect, ocr: startOcr(im) });
        }, 30);
      };
      im.onerror = () => {
        URL.revokeObjectURL(url);
        toast('Image could not be loaded');
        if (!fresh) { S().board = null; commit(); }
        resolve(null);
      };
      im.src = url;
    });
  }
  function newScreenshot(file, force) {
    if (!file || (!force && !(file.type || '').startsWith('image/'))) { if (file) toast('Please choose an image file'); return Promise.resolve(null); }
    clearBoardItems(); // coins, marks, tiles, plans belong to the old picture
    return loadImageBlob(file, true);
  }
  function setBlank() {
    const st = S();
    if (st.board === 'image' && !PP.ui.confirm('Remove the screenshot and use a blank board?')) return;
    if (st.board === 'image') clearBoardItems();
    img = null; pix = null; hiRes = null; ocrToken++; st.board = 'blank'; st.grid = Object.assign({}, DEFAULT_GRID);
    needFit = true; fit();
    st.ui.drawerOpen = true;
    const lt = takeLinkTool();
    if (lt) PP.modes.set(lt);
    else if (PP.modes.current === 'calibrate' || !TOOL_IDS.includes(PP.modes.current)) PP.modes.set(firstTool());
    commit();
  }

  // ---------------------------------------------------------------- menu
  function openMenu() {
    const st = S();
    PP.ui.openSheet(`
      <div class="sheethead"><b>Menu</b><button class="x" data-m="close" aria-label="Close">✕</button></div>
      <div class="menu">
        <button data-m="shot">🖼️ New screenshot</button>
        <button data-m="calib" ${st.board ? '' : 'disabled'}>📐 Adjust grid</button>
        <button data-m="grid" ${st.board ? '' : 'disabled'}>#️⃣ Show grid <span>${st.ui.showGrid ? 'On' : 'Off'}</span></button>
        <button data-m="fit" ${st.board ? '' : 'disabled'}>⤢ Show whole image</button>
        ${PP.ai && PP.ai.openSettings && PP.ai.enabled() ? `<button data-m="ai">🤖 AI detection <span>${PP.ai.hasKey && PP.ai.hasKey() ? 'Key ✓' : 'off'}</span></button>` : ''}
        ${PP.tutorial ? '<button data-m="tut">📖 Tutorial</button>' : ''}
        <button data-m="privacy">🔒 Privacy</button>
        <button data-m="clear" class="danger">🗑️ Clear everything</button>
      </div>
      <p class="note">Units, drawings and plans are saved automatically on this device. Game values from the community wiki – may differ depending on the game version.</p>
      <p class="note">Unofficial fan tool – not affiliated with or endorsed by Midjiwan AB. “The Battle of Polytopia” is a trademark of Midjiwan AB. All icons are original drawings.</p>`,
    (ev, b) => {
      if (!b) return;
      const m = b.dataset.m;
      if (m === 'close') PP.ui.closeSheet();
      else if (m === 'shot') { PP.ui.closeSheet(); $('#file').click(); }
      else if (m === 'calib') { PP.ui.closeSheet(); enterCal('tune'); }
      else if (m === 'grid') { st.ui.showGrid = !st.ui.showGrid; commit(); openMenu(); }
      else if (m === 'fit') { PP.ui.closeSheet(); fit(); }
      else if (m === 'ai') PP.ai.openSettings();
      else if (m === 'tut') PP.tutorial.open();
      else if (m === 'privacy') location.href = 'privacy.html';
      else if (m === 'clear') {
        if (!PP.ui.confirm('Delete all units, drawings, tiles, plans and techs?')) return;
        clearBoardItems(true); PP.ui.closeSheet(); commit(); toast('Everything cleared');
      }
    });
  }

  // ---------------------------------------------------------------- init
  function bindDom() {
    cv = $('#cv'); ctx = cv.getContext('2d'); stage = $('#stage');
    cv.addEventListener('pointerdown', onDown);
    const ma = $('#mapAct');
    if (ma) ma.addEventListener('click', e => { const m = curMode(); if (m && m.mapActClick) try { m.mapActClick(e); } catch (er) { reportError(er, 'mapAct'); } });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    // safety nets for lost pointer-ups (finger lifted over an overlay, capture lost, Safari taking over the gesture)
    // capture lost mid-gesture → treat as cancel (never as a tap)
    cv.addEventListener('lostpointercapture', e => { if (pts.has(e.pointerId)) onUp({ type: 'pointercancel', pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY }); });
    window.addEventListener('pointerup', e => { if (pts.has(e.pointerId)) onUp(e); }, true);
    window.addEventListener('pointercancel', e => { if (pts.has(e.pointerId)) onUp(e); }, true);
    document.addEventListener('touchend', e => {
      if (e.touches && e.touches.length === 0) setTimeout(() => { if (pts.size) { pts.clear(); g = null; clearTimeout(lpTimer); PP.board.redraw(); } }, 80);
    }, { passive: true, capture: true });
    document.addEventListener('touchcancel', e => {
      if (e.touches && e.touches.length === 0) { pts.clear(); g = null; clearTimeout(lpTimer); }
    }, { passive: true, capture: true });
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    new ResizeObserver(resize).observe(stage);

    drawerEl = $('#drawer');
    $('#railTools').addEventListener('click', ev => { const b = ev.target.closest('[data-tool]'); if (b) railClick(b.dataset.tool); });
    $('#menuBtn').onclick = openMenu;
    $('#fitBtn').onclick = () => { if (S().board) fit(); };
    $('#budget').onclick = () => { if (registry.cost) railClick('cost'); };
    $('#drawerClose').onclick = () => PP.drawer.close();
    bindDrawerTab($('#drawerTab'));
    // v8: expand/shrink button at the top-right edge of the bottom sheet (peek ↔ full)
    const xb = document.createElement('button');
    xb.id = 'sheetExpand'; xb.type = 'button';
    xb.onclick = () => setSheetFull(!S().ui.sheetFull);
    drawerEl.appendChild(xb);
    const sw = document.createElement('div');
    sw.id = 'sheetSwitch'; sw.hidden = true;
    sw.addEventListener('click', ev => {
      const b = ev.target.closest('[data-sw]'), m = curMode();
      if (b && m.sheetSwitch) { try { m.sheetSwitch.set(b.dataset.sw); } catch (e) { reportError(e, 'sheetSwitch'); } }
    });
    drawerEl.appendChild(sw);
    let rsT = 0;
    window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { fitSheet(); placeHint(); }, 60); });
    // re-place hint + canvas after the drawer slid in/out or docked
    drawerEl.addEventListener('transitionend', () => { placeHint(); });
    $('#blankBtn').onclick = setBlank;
    $('#tutBtn').onclick = () => { if (PP.tutorial) PP.tutorial.open(); };
    $('#file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) newScreenshot(f); };

    const sheet = $('#sheet');
    sheet.addEventListener('click', ev => {
      if (ev.target === sheet) { PP.ui.closeSheet(); return; }
      if (!sheetClick) return;
      const b = ev.target.closest('button');
      if (b && b.disabled) return;
      try { Object.defineProperty(ev, 'btn', { value: b }); Object.defineProperty(ev, 'dataset', { value: b ? b.dataset : {} }); } catch (e) { /* ignore */ }
      try { sheetClick(ev, b); } catch (e) { reportError(e, 'sheet'); }
    });
    const onSheetInput = ev => { if (sheetInput) try { sheetInput(ev); } catch (e) { reportError(e, 'sheet'); } };
    sheet.addEventListener('input', onSheetInput);
    sheet.addEventListener('change', onSheetInput);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') PP.ui.closeSheet(); });

    document.addEventListener('paste', e => {
      const item = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.type.startsWith('image/'));
      if (item) { e.preventDefault(); newScreenshot(item.getAsFile()); }
    });
    document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drag'); });
    document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drag'); });
    document.addEventListener('drop', e => {
      e.preventDefault(); document.body.classList.remove('drag');
      const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(x => x.type.startsWith('image/'));
      if (f) newScreenshot(f);
    });
  }

  // phone/tablet layout: tools at the bottom, panel as bottom sheet (see app.css)
  function isSheet() { return window.matchMedia('(max-width: 899px)').matches; }
  // drawer tab: tap = open/collapse, drag = resize (sideways on the side panel, up/down on the bottom sheet)
  function bindDrawerTab(tab) {
    let d = null;
    tab.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { tab.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const rb = drawerEl.getBoundingClientRect();
      d = { x: e.clientX, y: e.clientY, w: rb.width, h: rb.height, moved: false };
    });
    tab.addEventListener('pointermove', e => {
      if (!d) return;
      if (isSheet()) {
        const dy = e.clientY - d.y;
        if (!d.moved && Math.abs(dy) < 8) return;
        if (!S().ui.drawerOpen) return;
        d.moved = true;
        const main = $('main').getBoundingClientRect(), want = d.h - dy;
        // v8: with a peek part, dragging down to the bottom → peek, dragging up out of peek → full sheet
        if (drawerEl.classList.contains('haspeek')) {
          if (want < 110) { if (S().ui.sheetFull) { S().ui.sheetFull = false; fitSheet(); } return; }
          if (!S().ui.sheetFull) { S().ui.sheetFull = true; fitSheet(); }
        }
        const h = Math.round(clamp(want, 120, main.height - 60 - 70));
        S().ui.drawerH = h; drawerEl.style.setProperty('--dh', h + 'px'); drawerEl.classList.add('resizing');
        return;
      }
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) < 8) return;
      if (!S().ui.drawerOpen) return;
      d.moved = true;
      const main = $('main').getBoundingClientRect(), maxW = Math.max(220, Math.min(560, main.width - 110));
      const w = Math.round(clamp(d.w - dx, 200, maxW));
      S().ui.drawerW = w; drawerEl.style.setProperty('--dw', w + 'px'); drawerEl.classList.add('resizing');
    });
    const up = () => {
      if (!d) return;
      const moved = d.moved; d = null; drawerEl.classList.remove('resizing');
      if (moved) { save(); placeHint(); PP.board.redraw(); } else PP.drawer.toggle();
    };
    tab.addEventListener('pointerup', up);
    tab.addEventListener('pointercancel', up);
  }

  let inited = false;
  PP.app = {
    init() {
      if (inited) return; inited = true;
      bindDom(); domReady = true;
      const st = S();
      let m = st.ui.mode;
      if (!registry[m] || !TOOL_IDS.includes(m)) m = firstTool();
      PP.modes.current = m;
      hook(registry[m], 'onEnter');
      resize(); refresh();
      if (st.board === 'image') {
        idb.get('img').then(blob => {
          if (blob) loadImageBlob(blob, false);
          else { st.board = null; commit(); toast('Screenshot not found – please load it again'); }
        });
      }
    },
    commit, refresh, save: saveNow, saveSoon: save, updateHeader, clearBoardItems,
    loadImage: newScreenshot, setBlank, openMenu,
    // load a screenshot blob like a freshly picked file (no MIME check); resolves { det, ocr: Promise }
    loadImageBlob: blob => newScreenshot(blob, true),
    get lastDetect() { return lastDetect; },
    get lastOcr() { return lastOcr; },
  };

  window.addEventListener('error', e => { if (e && e.message) reportError(e.error || e.message, 'script'); });
})(window.PP);
