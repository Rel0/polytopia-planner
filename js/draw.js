// Polytopia Planer v6 – DRAW: fine arrows, crosses and rings on tiles (mode 'draw').
// State: PP.state.marks = [{ id, kind:'arrow'|'cross'|'ring', c1, r1, c2?, r2?, color, size }]
// Prefs:  PP.state.ui.draw = { shape, color, size, eraser }
// Marks are drawn in every tool through the core v6 hook drawAlways(ctx, D, active).
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  const COLORS = [
    { v: '#ffc23d', n: 'Gold' },
    { v: '#ff5470', n: 'Red' },
    { v: '#4cc9f0', n: 'Blue' },
    { v: '#3ee08f', n: 'Green' },
    { v: '#c39bff', n: 'Purple' },
    { v: '#fbf8f0', n: 'White' },
  ];
  const SIZES = { S: 0.02, M: 0.03, L: 0.044 }; // stroke width as fraction of the on-screen tile width
  const SIZE_LABEL = { S: 'Thin', M: 'Medium', L: 'Bold' };
  const SHAPES = [['arrow', 'Arrow'], ['cross', 'Cross'], ['ring', 'Ring']];
  const OUTLINE = 'rgba(6,8,18,.5)';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const S = () => PP.state;
  const esc = s => (PP.ui && PP.ui.esc ? PP.ui.esc(s) : String(s));

  function marks() { const st = S(); if (!Array.isArray(st.marks)) st.marks = []; return st.marks; }
  function prefs() {
    const ui = S().ui || (S().ui = {});
    const p = ui.draw && typeof ui.draw === 'object' ? ui.draw : (ui.draw = {});
    if (!SHAPES.some(s => s[0] === p.shape)) p.shape = 'arrow';
    if (!COLORS.some(c => c.v === p.color)) p.color = COLORS[0].v;
    if (!SIZES[p.size]) p.size = 'M';
    p.eraser = !!p.eraser;
    return p;
  }

  // ---------------------------------------------------------------- undo history (session only)
  let hist = [], histFor = null;
  function snapshot() {
    const m = marks();
    if (histFor !== m) { hist = []; histFor = m; }
    hist.push(JSON.stringify(m));
    if (hist.length > 60) hist.shift();
  }
  function undo() {
    const m = marks();
    if (histFor !== m || !hist.length) { PP.ui.toast('Nothing to undo'); return; }
    const prev = JSON.parse(hist.pop());
    m.length = 0; m.push(...prev);
    PP.app.commit();
  }
  const canUndo = () => histFor === marks() && hist.length > 0;

  // ---------------------------------------------------------------- geometry (screen space)
  const T = () => PP.board.tileScreenSize();
  const P = (c, r) => PP.board.tileToScreen(c, r);
  function strokeW(size) { return clamp(T().w * (SIZES[size] || SIZES.M), 1.1, size === "L" ? 6.5 : 5); }
  function gridVec() { // on-screen vectors of one step along c (u) and r (v)
    const a = P(0, 0), u = P(1, 0), v = P(0, 1);
    return { ux: u.x - a.x, uy: u.y - a.y, vx: v.x - a.x, vy: v.y - a.y };
  }

  // tapered shaft + slim concave arrow head + small origin dot, as one path
  function arrowPath(p, q, w) {
    let dx = q.x - p.x, dy = q.y - p.y;
    const L0 = Math.hypot(dx, dy);
    if (L0 < 4) return null;
    dx /= L0; dy /= L0;
    const nx = -dy, ny = dx, t = T();
    // how far the tile extends along this direction (diamond-aware), used for padding
    const ext = Math.abs(dx) * t.w / 2 + Math.abs(dy) * t.h / 2;
    const sPad = 0, ePad = Math.min(ext * 0.28, L0 * 0.2);
    const sx = p.x + dx * sPad, sy = p.y + dy * sPad, ex = q.x - dx * ePad, ey = q.y - dy * ePad;
    const len = Math.hypot(ex - sx, ey - sy);
    const hl = Math.min(Math.max(w * 5.6, 8), len * 0.5), hw = hl * 0.36, notch = hl * 0.28;
    const bx = ex - dx * hl, by = ey - dy * hl;            // barb base line
    const kx = bx + dx * notch, ky = by + dy * notch;      // inner notch where the shaft ends
    const w0 = w * 0.42, w1 = w * 0.5;                      // half widths at start / end of the shaft
    const path = new Path2D();
    path.moveTo(sx + nx * w0, sy + ny * w0);
    path.lineTo(kx + nx * w1, ky + ny * w1);
    path.lineTo(bx + nx * hw, by + ny * hw);
    path.lineTo(ex, ey);
    path.lineTo(bx - nx * hw, by - ny * hw);
    path.lineTo(kx - nx * w1, ky - ny * w1);
    path.lineTo(sx - nx * w0, sy - ny * w0);
    path.closePath();
    const dot = new Path2D();
    dot.arc(p.x, p.y, Math.max(w * 1.1, 2), 0, Math.PI * 2);
    return { path, dot };
  }

  function drawArrow(ctx, m, alpha) {
    const w = strokeW(m.size), g = arrowPath(P(m.c1, m.r1), P(m.c2, m.r2), w);
    if (!g) return;
    const ow = clamp(w * 0.32, 0.7, 1.6);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // pass 1: dark outline + soft shadow (only the outer half survives pass 2)
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = Math.max(1.5, w * 1.2); ctx.shadowOffsetY = Math.max(0.4, w * 0.2);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = ow * 2;
    ctx.stroke(g.path); ctx.stroke(g.dot);
    ctx.shadowColor = 'transparent';
    // pass 2: colour
    ctx.fillStyle = m.color;
    ctx.fill(g.path); ctx.fill(g.dot);
    ctx.restore();
  }

  function strokeTwice(ctx, path, color, w, alpha) {
    const ow = clamp(w * 0.3, 0.7, 1.5);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = Math.max(1.5, w * 1.2); ctx.shadowOffsetY = Math.max(0.4, w * 0.2);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + ow * 2; ctx.stroke(path);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(path);
    ctx.restore();
  }

  function drawCross(ctx, m, alpha) {
    const c = P(m.c1, m.r1), g = gridVec(), k = 0.27, w = strokeW(m.size) * 1.2;
    const path = new Path2D();
    path.moveTo(c.x - g.ux * k, c.y - g.uy * k); path.lineTo(c.x + g.ux * k, c.y + g.uy * k);
    path.moveTo(c.x - g.vx * k, c.y - g.vy * k); path.lineTo(c.x + g.vx * k, c.y + g.vy * k);
    strokeTwice(ctx, path, m.color, w, alpha);
  }

  function drawRing(ctx, m, alpha) {
    const c = P(m.c1, m.r1), t = T(), w = strokeW(m.size) * 1.1;
    const pr = PP.grid.params ? PP.grid.params() : { ratio: t.h / t.w, theta: 0 };
    // ellipse inscribed in the tile diamond (half axes w/(2√2), h/(2√2)) with a little air
    const rx = t.w * 0.34 - w / 2, ry = rx * (pr.ratio || 0.6);
    if (rx < 2) return;
    const path = new Path2D();
    path.ellipse(c.x, c.y, rx, ry, pr.theta || 0, 0, Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = (alpha == null ? 1 : alpha) * 0.16;
    ctx.fillStyle = m.color; ctx.fill(path);
    ctx.restore();
    strokeTwice(ctx, path, m.color, w, alpha);
  }

  function renderMark(ctx, m, alpha) {
    if (!m || !isFinite(m.c1) || !isFinite(m.r1)) return;
    if (m.kind === 'arrow') { if (isFinite(m.c2) && isFinite(m.r2)) drawArrow(ctx, m, alpha); }
    else if (m.kind === 'cross') drawCross(ctx, m, alpha);
    else if (m.kind === 'ring') drawRing(ctx, m, alpha);
  }
  function renderAll(ctx) {
    const list = marks();
    // rings/crosses first, arrows on top
    for (const m of list) if (m.kind !== 'arrow') renderMark(ctx, m);
    for (const m of list) if (m.kind === 'arrow') renderMark(ctx, m);
  }

  function tileHighlight(ctx, c, r, color, strong) {
    const pts = PP.grid.corners(c, r).map(p => PP.board.toScreen(p.x, p.y)), ctr = P(c, r), k = 0.9;
    const path = new Path2D();
    pts.forEach((p, i) => { const x = ctr.x + (p.x - ctr.x) * k, y = ctr.y + (p.y - ctr.y) * k; if (i) path.lineTo(x, y); else path.moveTo(x, y); });
    path.closePath();
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = strong ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.12)'; ctx.fill(path);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3; ctx.stroke(path);
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke(path);
    ctx.restore();
  }

  // ---------------------------------------------------------------- hit testing
  function hitArrow(sx, sy) {
    const list = marks(), tol = Math.max(12, T().h * 0.22);
    let best = -1, bd = Infinity;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]; if (a.kind !== 'arrow') continue;
      const p = P(a.c1, a.r1), q = P(a.c2, a.r2), dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy || 1;
      const k = clamp(((sx - p.x) * dx + (sy - p.y) * dy) / L2, 0, 1);
      const d = Math.hypot(p.x + k * dx - sx, p.y + k * dy - sy);
      if (d < tol && d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function tileMarkIndex(c, r, kind) {
    const list = marks();
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.kind !== 'arrow' && m.c1 === c && m.r1 === r && (!kind || m.kind === kind)) return i;
    }
    return -1;
  }

  // ---------------------------------------------------------------- interaction
  let drag = null; // { a:{c,r}, b:{c,r} }
  function removeAt(i, what) {
    snapshot(); marks().splice(i, 1); PP.app.commit();
    if (what) PP.ui.toast(what + ' deleted');
  }
  function erase(t) {
    let i = hitArrow(t.sx, t.sy);
    if (i >= 0) { removeAt(i, 'Arrow'); return; }
    i = tileMarkIndex(t.c, t.r);
    if (i >= 0) { removeAt(i, marks()[i].kind === 'ring' ? 'Ring' : 'Cross'); return; }
    const list = marks(); // arrows starting/ending on the tapped tile
    for (let k = list.length - 1; k >= 0; k--) {
      const m = list[k];
      if (m.kind === 'arrow' && ((m.c1 === t.c && m.r1 === t.r) || (m.c2 === t.c && m.r2 === t.r))) { removeAt(k, 'Arrow'); return; }
    }
    PP.ui.toast('Nothing to erase here');
  }

  PP.modes.register('draw', {
    label: 'Draw',
    icon: '✏️',
    hint() {
      const p = prefs();
      if (drag) return 'Release on the target tile';
      if (p.eraser) return 'Eraser: tap a mark';
      return p.shape === 'arrow' ? 'Drag from tile to tile · 2 fingers: move map'
        : (p.shape === 'cross' ? 'Tap a tile: Cross' : 'Tap a tile: Ring');
    },
    wantsDrag() { const p = prefs(); return p.shape === 'arrow' && !p.eraser; },
    onDrag(phase, t) {
      if (phase === 'start') { drag = { a: { c: t.c, r: t.r }, b: { c: t.c, r: t.r } }; return; }
      if (!drag) return;
      if (phase === 'move') { drag.b = { c: t.c, r: t.r }; return; }
      if (phase === 'end') {
        drag.b = { c: t.c, r: t.r };
        const { a, b } = drag, p = prefs(); drag = null;
        if (a.c === b.c && a.r === b.r) { PP.app.refresh(); return; }
        const list = marks(), i = list.findIndex(m => m.kind === 'arrow' && m.c1 === a.c && m.r1 === a.r && m.c2 === b.c && m.r2 === b.r);
        snapshot();
        if (i >= 0 && list[i].color === p.color && list[i].size === p.size) { list.splice(i, 1); PP.ui.toast('Arrow deleted'); }
        else if (i >= 0) { list[i].color = p.color; list[i].size = p.size; }
        else list.push({ id: PP.util.uid(), kind: 'arrow', c1: a.c, r1: a.r, c2: b.c, r2: b.r, color: p.color, size: p.size });
        PP.app.commit();
        return;
      }
      drag = null; PP.app.refresh(); // cancel
    },
    onTap(t) {
      const p = prefs();
      if (p.eraser) { erase(t); return; }
      if (p.shape === 'arrow') {
        const i = hitArrow(t.sx, t.sy);
        if (i >= 0) removeAt(i, 'Arrow');
        else PP.ui.toast('Drag from tile to tile to draw');
        return;
      }
      const list = marks(), same = tileMarkIndex(t.c, t.r, p.shape), other = tileMarkIndex(t.c, t.r);
      snapshot();
      if (same >= 0 && list[same].color === p.color && list[same].size === p.size) list.splice(same, 1);
      else if (same >= 0) { list[same].color = p.color; list[same].size = p.size; }
      else {
        if (other >= 0) list.splice(other, 1); // one cross/ring per tile
        list.push({ id: PP.util.uid(), kind: p.shape, c1: t.c, r1: t.r, color: p.color, size: p.size });
      }
      PP.app.commit();
    },
    drawUnder(ctx) {
      if (!drag) return;
      const col = prefs().color;
      tileHighlight(ctx, drag.a.c, drag.a.r, col, false);
      if (drag.b.c !== drag.a.c || drag.b.r !== drag.a.r) tileHighlight(ctx, drag.b.c, drag.b.r, '#ffffff', true);
    },
    // core v6: persistent layer, drawn in every tool (draw = top layer)
    drawAlways(ctx) { renderAll(ctx); },
    drawOver(ctx) {
      if (drag && (drag.a.c !== drag.b.c || drag.a.r !== drag.b.r)) {
        const p = prefs();
        drawArrow(ctx, { c1: drag.a.c, r1: drag.a.r, c2: drag.b.c, r2: drag.b.r, color: p.color, size: p.size }, 0.8);
      }
    },
    renderPanel(el) { injectCss(); renderPanel(el); },
    onExit() { drag = null; },
  });

  // ---------------------------------------------------------------- panel
  function shapeIcon(kind, color) {
    const s = `stroke="${color}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
    const o = 'stroke="rgba(0,0,0,.4)" stroke-linecap="round" stroke-linejoin="round" fill="none"';
    if (kind === 'arrow') {
      const d = 'M6 26 L24.5 10.5', h = 'M26.5 8.8 L16.6 12.6 L19.6 13.6 L20.9 17.2 Z';
      return `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <path d="${d}" ${o} stroke-width="4.2"/><path d="${h}" ${o} stroke-width="2.4"/><circle cx="6" cy="26" r="2.6" fill="rgba(0,0,0,.55)"/>
        <path d="${d}" ${s} stroke-width="2"/><path d="${h}" fill="${color}"/><circle cx="6" cy="26" r="1.9" fill="${color}"/></svg>`;
    }
    if (kind === 'cross') {
      const d = 'M7 11 L25 21 M7 21 L25 11';
      return `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="${d}" ${o} stroke-width="4"/><path d="${d}" ${s} stroke-width="2.2"/></svg>`;
    }
    return `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <ellipse cx="16" cy="16" rx="11" ry="6.6" fill="${color}" fill-opacity=".16"/>
      <ellipse cx="16" cy="16" rx="11" ry="6.6" ${o} stroke-width="3.6"/><ellipse cx="16" cy="16" rx="11" ry="6.6" ${s} stroke-width="2"/></svg>`;
  }

  function renderPanel(el) {
    const p = prefs(), list = marks(), n = list.length;
    const cnt = k => list.filter(m => m.kind === k).length;
    el.innerHTML = `
      <div class="dw">
        <div class="dw-head"><b>✏️ Draw</b><span>${n ? `${cnt('arrow')} arrows · ${cnt('cross')} crosses · ${cnt('ring')} rings` : 'empty'}</span></div>
        <div class="dw-shapes" role="radiogroup" aria-label="Shape">
          ${SHAPES.map(([k, l]) => `<button data-shape="${k}" class="${!p.eraser && p.shape === k ? 'on' : ''}" role="radio" aria-checked="${!p.eraser && p.shape === k}">${shapeIcon(k, p.color)}<small>${l}</small></button>`).join('')}
          <button data-act="eraser" class="dw-eraser ${p.eraser ? 'on' : ''}" aria-pressed="${p.eraser}"><span class="dw-ico">⌫</span><small>Eraser</small></button>
        </div>
        <div class="dw-lbl">Color</div>
        <div class="dw-colors">${COLORS.map(c => `<button data-color="${c.v}" class="${c.v === p.color ? 'on' : ''}" style="--c:${c.v}" aria-label="${c.n}" title="${c.n}"></button>`).join('')}</div>
        <div class="dw-lbl">Width</div>
        <div class="dw-sizes">${Object.keys(SIZES).map(k => `<button data-size="${k}" class="${k === p.size ? 'on' : ''}" aria-label="${SIZE_LABEL[k]}"><i style="height:${k === 'S' ? 1.5 : k === 'M' ? 2.5 : 4}px;background:${p.color}"></i><small>${SIZE_LABEL[k]}</small></button>`).join('')}</div>
        <div class="dw-row">
          <button data-act="undo" ${canUndo() ? '' : 'disabled'}>↶ Undo</button>
          <button data-act="clear" class="dw-danger" ${n ? '' : 'disabled'}>🗑️ Clear all</button>
        </div>
        <p class="dw-note">${p.eraser ? 'Eraser: tap an arrow, cross or ring to remove it.'
          : p.shape === 'arrow' ? 'Drag with one finger from tile to tile – the arrow snaps to the tile center. Tap an arrow to delete it. Use two fingers to move/zoom the map.'
            : `Tap a tile to place a ${p.shape === 'cross' ? 'cross' : 'ring'}; tap again to remove it.`}</p>
      </div>`;
    el.onclick = ev => {
      const b = ev.target.closest('button'); if (!b || !el.contains(b) || b.disabled) return;
      const d = b.dataset;
      if (d.shape) { p.shape = d.shape; p.eraser = false; if (PP.drawer.yieldMap) PP.drawer.yieldMap(); }
      else if (d.color) { p.color = d.color; p.eraser = false; }
      else if (d.size) { p.size = d.size; p.eraser = false; }
      else if (d.act === 'eraser') p.eraser = !p.eraser;
      else if (d.act === 'undo') { undo(); return; }
      else if (d.act === 'clear') {
        if (!list.length) return;
        snapshot(); list.length = 0; PP.app.commit();
        PP.ui.toast('All marks cleared · Undo available'); return;
      } else return;
      PP.app.commit();
    };
  }

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const css = `
.dw{display:flex;flex-direction:column;gap:2px}
.dw-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}
.dw-head span{font-size:12px;color:var(--muted,#9aa3c0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dw-lbl{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9aa3c0);margin:10px 0 4px;font-weight:600}
.dw-shapes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.dw-shapes button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:58px;padding:6px 2px;border-radius:12px;
  border:1px solid var(--line,rgba(255,255,255,.12));background:rgba(255,255,255,.03);color:var(--text,#e8ecf8);min-width:0}
.dw-shapes button small{font-size:11.5px;font-weight:600;color:var(--muted,#9aa3c0)}
.dw-shapes button.on{border-color:rgba(255,255,255,.75);background:rgba(255,255,255,.1)}
.dw-shapes button.on small{color:var(--text,#fff)}
.dw-shapes .dw-ico{font-size:21px;line-height:30px;height:30px}
.dw-shapes .dw-eraser.on{border-color:#ff8ca6;background:rgba(239,71,111,.16)}
.dw-colors{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;justify-items:center}
.dw-colors button{width:100%;max-width:42px;aspect-ratio:1;min-height:36px;border-radius:50%;border:0;background:none;padding:0;position:relative}
.dw-colors button::after{content:"";position:absolute;inset:18%;border-radius:50%;background:var(--c);box-shadow:0 0 0 1px rgba(0,0,0,.45),inset 0 -2px 3px rgba(0,0,0,.18)}
.dw-colors button.on::before{content:"";position:absolute;inset:2px;border-radius:50%;border:2px solid var(--c);opacity:.95}
.dw-sizes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dw-sizes button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px 7px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.12));background:none;min-width:0;color:var(--text,#e8ecf8)}
.dw-sizes button i{display:block;width:62%;border-radius:4px;box-shadow:0 0 0 .5px rgba(0,0,0,.6)}
.dw-sizes button small{font-size:11.5px;color:var(--muted,#9aa3c0);font-weight:600}
.dw-sizes button.on{border-color:rgba(255,255,255,.75);background:rgba(255,255,255,.08)}
.dw-sizes button.on small{color:var(--text,#fff)}
.dw-row{display:flex;gap:8px;margin-top:12px}
.dw-row button{flex:1;min-width:0;min-height:44px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.14));background:none;color:var(--text,#e8ecf8);font-weight:600;font-size:13.5px;padding:8px 4px}
.dw-row button.dw-danger{color:#ff8ca6;border-color:rgba(239,71,111,.45)}
.dw-row button:disabled{opacity:.4}
.dw-note{font-size:12.5px;line-height:1.4;color:var(--muted,#9aa3c0);margin:10px 0 0}`;
    const st = document.createElement('style'); st.id = 'dw-css'; st.textContent = css;
    document.head.appendChild(st);
  }

  PP.marks = {
    render(ctx) { renderAll(ctx); }, // e.g. for exports; core draws marks via mode 'draw'.drawAlways
    renderMark,
    list: marks,
    COLORS: COLORS.map(c => c.v),
  };
})(window.PP);
