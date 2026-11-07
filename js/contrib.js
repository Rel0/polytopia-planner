// Polytopia Planner – voluntary training contributions (opt-in). Nothing is sent without a "yes" on this device.
// With a yes: when a screenshot has at least MIN_LABELS marks the user made (tiles, cities, units) and nothing was
// changed for QUIET ms, the screenshot (game bars at the top / bottom blacked out) + grid + those marks go to
// /api/contrib, anonymously. One id per screenshot – a later version replaces the earlier one on the server.
// The ids sent from this device are kept here, so "Delete my contributions" can remove them again.
window.PP = window.PP || {};
(function (PP) {
  'use strict';
  const KEY = 'polyplan.contrib', IDS = 'polyplan.contribIds', MIN_LABELS = 5, QUIET = 60000, URL_ = '/api/contrib';
  const S = () => PP.state;
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  const consent = () => ls.get(KEY);                       // 'yes' | 'no' | null (not asked yet)
  const sentIds = () => { try { return JSON.parse(ls.get(IDS) || '[]'); } catch (e) { return []; } };
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');

  // the user's own marks in the format of the Label tool (terrain[+resource][+building]); units with side / type / HP
  function marks() {
    const st = S(), g = st.grid, out = [], units = [];
    if (!g) return { tiles: out, units };
    const ctr = (c, r) => ({ x: +(g.ox + c * g.ux + r * g.vx).toFixed(1), y: +(g.oy + c * g.uy + r * g.vy).toFixed(1) });
    const T = { field: 'field', forest: 'forest', mountain: 'mountain', water: 'water', ocean: 'water', cloud: 'cloud', space: 'edge' };
    Object.keys(st.tiles || {}).forEach(k => {
      const t = st.tiles[k]; if (!t || t.src === 'auto') return;
      const [c, r] = k.split(',').map(Number); if (!isFinite(c) || !isFinite(r)) return;
      const ter = t.city ? 'city' : T[t.terrain]; if (!ter) return;
      const parts = [ter].concat(ter === 'city' ? [] : (t.res || []).map(x => (x === 'ore' ? 'metal' : x)));
      if (t.bld && ter !== 'city') parts.push(t.bld);
      out.push(Object.assign({ c, r, label: parts.join('+') }, ctr(c, r)));
    });
    (st.cities || []).forEach(ci => {
      if (!ci || ci.src === 'auto' || out.some(o => o.c === ci.c && o.r === ci.r)) return;
      out.push(Object.assign({ c: ci.c, r: ci.r, label: 'city' }, ctr(ci.c, ci.r)));
    });
    (st.units || []).forEach(u => {
      if (!u || u.src === 'auto' || u.src === 'ai') return;
      units.push(Object.assign({ c: u.c, r: u.r, side: u.side, type: u.type, hp: u.hp }, ctr(u.c, u.r)));
    });
    return { tiles: out, units };
  }
  // JPEG of the screenshot, the game's top bar (names, stars) and bottom bar (buttons) blacked out
  function shot() {
    const P = PP.board && PP.board.pixels ? PP.board.pixels() : null; if (!P) return null;
    const c = document.createElement('canvas'); c.width = P.w; c.height = P.h;
    const x = c.getContext('2d'); x.putImageData(new ImageData(new Uint8ClampedArray(P.data), P.w, P.h), 0, 0);
    x.fillStyle = '#000'; x.fillRect(0, 0, P.w, Math.round(P.h * 0.16)); x.fillRect(0, Math.round(P.h * 0.86), P.w, P.h); // header incl. "Waiting for <player>", buttons
    return { url: c.toDataURL('image/jpeg', 0.85), w: P.w, h: P.h };
  }
  let lastSig = '', changedAt = 0, busy = false, lastSent = '';
  function tick() {
    const st = S(); if (!st || st.board !== 'image' || busy) return;
    const m = marks(), n = m.tiles.length + m.units.length;
    if (n < MIN_LABELS) return;
    if (consent() == null) { ask(); return; }
    if (consent() !== 'yes') return;
    const sig = JSON.stringify([st.grid, m]);
    if (sig !== lastSig) { lastSig = sig; changedAt = Date.now(); return; }
    if (sig === lastSent || Date.now() - changedAt < QUIET) return;
    send(m, sig);
  }
  function send(m, sig) {
    const st = S(), im = shot(); if (!im) return;
    const u = st.ui || (st.ui = {}); // ui: not part of undo
    if (!u.contrib || u.contrib.w !== im.w || u.contrib.h !== im.h) u.contrib = { id: rid(), w: im.w, h: im.h }; // new screenshot → new id
    const body = { id: u.contrib.id, version: 1, app: 'v40', size: [im.w, im.h], grid: st.grid, image: im.url, tiles: m.tiles, units: m.units };
    busy = true;
    fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' })
      .then(r => { if (r.ok) { lastSent = sig; const l = sentIds(); if (l.indexOf(body.id) < 0) { l.push(body.id); ls.set(IDS, JSON.stringify(l.slice(-500))); } } })
      .catch(() => { /* offline – next time */ })
      .then(() => { busy = false; });
  }
  let asking = false, later = false;
  function ask() {
    if (asking || later || !PP.ui || !PP.ui.openSheet || (PP.ui.isSheetOpen && PP.ui.isSheetOpen())) return;
    asking = true;
    PP.ui.openSheet(`<div class="sheethead"><b>🧠 Help improve the detection?</b><button class="x" data-c="later" aria-label="Close">✕</button></div>
      <p class="note">Your screenshot (game bars blacked out) and the tiles, cities and units you marked are sent anonymously and only used to train the detection. You can change this any time in the Menu.</p>
      <div class="btnrow big"><button data-c="no">No</button><button class="primary" data-c="yes">Yes, help</button></div>
      <p class="note"><a href="privacy.html#contrib">Privacy</a></p>`,
    (ev, b) => {
      if (!b) return;
      const v = b.dataset.c; if (!v) return;
      if (v !== 'later') ls.set(KEY, v); else later = true; // ✕: ask again next visit
      PP.ui.closeSheet(); asking = false;
      if (v === 'yes' && PP.ui.toast) PP.ui.toast('Thank you! 🧠');
    }, null, () => { asking = false; });
  }
  function settings() {
    const on = consent() === 'yes', n = sentIds().length;
    PP.ui.openSheet(`<div class="sheethead"><b>🧠 Help improve the detection</b><button class="x" data-c="x" aria-label="Close">✕</button></div>
      <div class="menu"><button data-c="toggle">${on ? '✓ On – tap to turn off' : 'Off – tap to turn on'}</button>
      ${n ? `<button data-c="del" class="danger">🗑️ Delete my contributions (${n})</button>` : ''}</div>
      <p class="note">Screenshot (game bars blacked out) + your marks, anonymous. <a href="privacy.html#contrib">Privacy</a></p>`,
    (ev, b) => {
      if (!b) return; const v = b.dataset.c;
      if (v === 'x') { PP.ui.closeSheet(); return; }
      if (v === 'toggle') { ls.set(KEY, on ? 'no' : 'yes'); settings(); return; }
      if (v === 'del') {
        fetch(URL_ + '/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: sentIds() }), credentials: 'omit' })
          .then(r => { if (r.ok) { ls.set(IDS, '[]'); if (S().ui) delete S().ui.contrib; PP.ui.toast && PP.ui.toast('Your contributions were deleted'); settings(); } else PP.ui.toast && PP.ui.toast('Could not delete – try again later'); })
          .catch(() => { PP.ui.toast && PP.ui.toast('Could not delete – you are offline'); });
      }
    });
  }
  setInterval(tick, 15000);
  PP.contrib = { settings, status: () => consent(), marks };
})(window.PP);
