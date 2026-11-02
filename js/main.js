// Polytopia Planner v6 – start (loaded last, after the tools units/cost/draw/market registered their modes)
window.PP = window.PP || {};
(function (PP) {
  'use strict';
  if (!PP.app || !PP.app.init) {
    document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px;color:#ff8ca6">js/core.js could not be loaded.</p>');
    return;
  }
  PP.app.init();
  // deep link (?tool=…) with a board already loaded → open that tool now; without a board it opens after
  // "Start without screenshot" / the first screenshot
  if (PP.state && PP.state.board && PP.modes.takeLinkTool) {
    const lt = PP.modes.takeLinkTool();
    if (lt) { PP.state.ui.drawerOpen = true; PP.modes.set(lt); }
  }
  // hide the boot screen once the app is drawn – waiting for a saved screenshot to come back from storage
  const boot = document.getElementById('boot'), t0 = performance.now();
  const ready = () => !PP.state || PP.state.board !== 'image' || !!(PP.board && PP.board.image);
  (function wait() {
    if (!boot) return;
    if (ready() || performance.now() - t0 > 4000) {
      requestAnimationFrame(() => { boot.classList.add('done'); setTimeout(() => boot.remove(), 300); });
    } else requestAnimationFrame(wait);
  })();
  const missing = PP.modes.tools().filter(t => !t.available).map(t => t.label);
  if (missing.length) { console.warn('Tools missing:', missing); PP.ui.toast('Not loaded: ' + missing.join(', '), 3000); }
})(window.PP);
