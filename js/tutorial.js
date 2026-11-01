// Polytopia Planner – TUTORIAL: a short page-by-page walkthrough in the sheet (opened from the start card and the menu).
// PP.tutorial.open(page?) – no state, nothing saved.
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  const PAGES = [
    {
      icon: '🗺️', title: 'Welcome!',
      body: `<p>The Polytopia Planner helps you plan your next turn – right on top of a screenshot of your game.</p>
        <ol>
          <li><b>Take a screenshot</b> in the game.</li>
          <li><b>Load it here</b> – the app lays a tile grid over it.</li>
          <li><b>Pick a tool</b> in the bar: calculate fights, plan stars, markets, draw and take notes.</li>
        </ol>
        <p class="tut-tip">Everything is saved automatically on this device.</p>`,
    },
    {
      icon: '📸', title: 'Add a screenshot',
      body: `<ul>
          <li>Tap <b>Choose screenshot</b> and pick the picture from your photos.</li>
          <li>On the Mac: paste it with <b>⌘+V</b> or drag the file into the window.</li>
          <li>No screenshot at hand? <b>Start without screenshot</b> gives you an empty map.</li>
        </ul>
        <p class="tut-tip">Tip: zoom in the game so the tiles are big – the grid and the tile detection work better.</p>`,
    },
    {
      icon: '📐', title: 'Check the grid',
      body: `<p>After loading, the app detects the tiles automatically and asks: <i>“Does it fit?”</i></p>
        <ul>
          <li>Zoom in with two fingers – the lines should sit on the tile edges.</li>
          <li>Fits: <b>✓ Looks good</b>. Doesn't fit: <b>✏️ Adjust</b> – move the grid with one finger, scale it with two (pinch). <b>Reset to auto</b> starts over.</li>
          <li>Later anytime: <b>⋯ Menu → 📐 Adjust grid</b>.</li>
        </ul>`,
    },
    {
      icon: '🪖', title: 'Units – fights',
      body: `<p>Two modes at the top of the panel:</p>
        <ul>
          <li><b>✏️ Place</b>: choose <b>Mine / Enemy</b> and a unit type, then tap tiles. Tap a unit to set <b>HP</b>, <b>Veteran</b> and <b>Defense bonus</b> (detected automatically for forest, mountain and cities) – or delete it.</li>
          <li><b>⚔️ Battle</b>: tap your attackers, then an enemy. The <b>damage calculator</b> shows damage, retaliation and whether the target dies – and can suggest the <b>best order</b>.</li>
        </ul>`,
    },
    {
      icon: '💰', title: 'Costs – plan your stars',
      body: `<ul>
          <li>Enter your <b>stars</b> and <b>income</b> – the budget shows at the top.</li>
          <li><b>Tap a tile</b>: a ring shows what the tile is (Forest, Mountain, My city …) and then everything you can build there, with costs.</li>
          <li>Tabs: <b>Units</b> (train in cities), <b>Tech</b> (tech tree), <b>Plan</b> (list of everything planned).</li>
          <li>You always see how many stars are <b>left</b> and what you'll have <b>next turn</b>.</li>
        </ul>`,
    },
    {
      icon: '🏪', title: 'Market – most stars per turn',
      body: `<ol>
          <li><b>Cities</b>: tap your own cities. Tap again to switch the territory 3×3 → 5×5 → off.</li>
          <li><b>What's here</b>: paint the tiles as they are – terrain, resources, existing buildings.</li>
          <li><b>Plan</b>: the app finds the layout of Windmill, Forge, Sawmill and Market with the most ★ per turn – step by step.</li>
        </ol>`,
    },
    {
      icon: '✏️', title: 'Draw & 📝 Notes',
      body: `<ul>
          <li><b>Draw</b>: <b>arrows</b> (drag from tile to tile), <b>crosses</b> and <b>rings</b> (tap a tile) in different colors. Eraser and ↶ Undo included.</li>
          <li><b>Notes</b>: write your turn as numbered moves – by typing or by voice 🎤. With 📍 you pin a move to a tile on the map.</li>
        </ul>`,
    },
    {
      icon: '💡', title: 'Handy tips',
      body: `<ul>
          <li><b>Two fingers</b>: zoom and move the map. <b>⤢</b> at the top shows the whole image again.</li>
          <li>The panel on the side/bottom can be collapsed and resized at its tab.</li>
          <li><b>⋯ Menu</b>: new screenshot, show grid, clear everything – and this tutorial.</li>
          <li>On the phone: <b>Share → Add to Home Screen</b> – then it opens like an app.</li>
        </ul>
        <p class="tut-tip">Have fun – and good luck in your next battle! ⚔️</p>`,
    },
  ];

  let css = false;
  function injectCss() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `
      .tut{padding:2px 2px 4px}
      .tut-hero{display:flex;align-items:center;gap:12px;margin:6px 0 4px}
      .tut-hero span{font-size:38px;line-height:1}
      .tut-hero h2{margin:0;font-size:19px}
      .tut-hero small{display:block;color:var(--muted);font-size:12px;font-weight:500;margin-top:2px}
      .tut-body{font-size:14.5px;line-height:1.5;min-height:200px}
      .tut-body p{margin:8px 0}
      .tut-body ul,.tut-body ol{margin:8px 0;padding-left:20px}
      .tut-body li{margin:6px 0}
      .tut-tip{background:var(--panel2);border-radius:10px;padding:8px 10px;color:var(--muted);font-size:13px}
      .tut-dots{display:flex;justify-content:center;gap:6px;margin:12px 0 10px}
      .tut-dots button{width:9px;height:9px;padding:0;border:0;border-radius:50%;background:var(--line)}
      .tut-dots button.on{background:var(--accent);width:22px;border-radius:5px}
      .tut-nav{display:flex;gap:8px}
      .tut-nav .btn{flex:1;text-align:center}
      .tut-nav .btn[disabled]{opacity:.35}`;
    document.head.appendChild(s);
  }

  function open(page) {
    injectCss();
    const i = Math.max(0, Math.min(PAGES.length - 1, page | 0)), p = PAGES[i], last = i === PAGES.length - 1;
    PP.ui.openSheet(`
      <div class="sheethead"><b>Tutorial</b><button class="x" data-t="close" aria-label="Close">✕</button></div>
      <div class="tut">
        <div class="tut-hero"><span>${p.icon}</span><div><h2>${p.title}</h2><small>Step ${i + 1} of ${PAGES.length}</small></div></div>
        <div class="tut-body">${p.body}</div>
        <div class="tut-dots">${PAGES.map((_, k) => `<button data-t="go" data-p="${k}" class="${k === i ? 'on' : ''}" aria-label="Step ${k + 1}"></button>`).join('')}</div>
        <div class="tut-nav">
          <button class="btn" data-t="go" data-p="${i - 1}" ${i ? '' : 'disabled'}>‹ Back</button>
          ${last ? '<button class="btn primary" data-t="close">Let\'s go!</button>'
            : `<button class="btn primary" data-t="go" data-p="${i + 1}">Next ›</button>`}
        </div>
      </div>`,
    (ev, b) => {
      if (!b) return;
      if (b.dataset.t === 'close') PP.ui.closeSheet();
      else if (b.dataset.t === 'go') open(+b.dataset.p);
    });
    document.getElementById('sheetBody').scrollTop = 0;
  }

  PP.tutorial = { open };
})(window.PP);
