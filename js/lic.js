// Polytopia Planner – line icons instead of emojis (Lagoon Glass look). One stroke style everywhere: every
// emoji the app writes into its panels, menus, bars and hints is swapped for the matching icon from this set
// (text nodes only – inputs, drop-downs and the canvas keep their text). PP.lic(name, colour) → inline SVG.
window.PP = window.PP || {};
(function (PP) {
  'use strict';
  var P = {
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    sprout: '<path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6z"/><path d="M12 12c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    skull: '<path d="M16 20a2 2 0 0 0 1.6-3.2A9 9 0 1 0 6.4 16.8 2 2 0 0 0 8 20z"/><path d="M8 20v2h8v-2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/>',
    burst: '<path d="M12 2l2 6 6-2-4 5 5 3-6 1 1 6-4-4-4 4 1-6-6-1 5-3-4-5 6 2z"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4M7 17l-3 3M3 19l2 2"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M8.5 14h.01M15.5 14h.01M2 14h2M20 14h2"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
    axe: '<path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9"/><path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    ruler: '<path d="M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z"/><path d="m7.5 10.5 2-2M10.5 13.5l2-2M13.5 16.5l2-2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    tree: '<path d="M12 22v-4"/><path d="M5 18h14L12 3z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.3 2.8 2.5 2.8z"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/>',
    wheat: '<path d="M12 22V9"/><path d="M12 9c-2-1-3-3-3-5 2 0 3 1 3 3 0-2 1-3 3-3 0 2-1 4-3 5z"/><path d="M12 14c-2-1-3-3-3-5M12 14c2-1 3-3 3-5M12 19c-2-1-3-3-3-5M12 19c2-1 3-3 3-5"/>',
    coins: '<circle cx="9" cy="9" r="6"/><path d="M15.6 10.2A6 6 0 1 1 10.2 15.6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7M5 11l9 9"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
    pushpin: '<path d="M12 17v5"/><path d="M9 10.8V4h6v6.8l3 3.2v2H6v-2z"/>',
    wall: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M9 5v7M15 12v7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    crown: '<path d="M3 18h18L19 7l-4 4-3-6-3 6-4-4z"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
    castle: '<path d="M4 21V8h3v2h3V8h4v2h3V8h3v13z"/><path d="M10 21v-5h4v5"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    store: '<path d="M3 9 4.5 4h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    save: '<path d="M5 3h11l5 5v13H5z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
    mountain: '<path d="m8 3 4 8 5-5 5 15H2z"/>',
    waves: '<path d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    snow: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>',
    fruit: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    wand: '<path d="m15 4 5 5L9 20l-5-5z"/><path d="M18 2v3M21 5h-3M11 8l5 5"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    hand: '<path d="M9 11V5a2 2 0 0 1 4 0v5"/><path d="M13 10V9a2 2 0 0 1 4 0v2"/><path d="M17 11a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L4.5 15a2 2 0 0 1 3.4-2L9 15"/>',
    dot: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    grid: '<path d="M4 9h16M4 15h16M9 4v16M15 4v16"/>',
    swirl: '<path d="M12 12a3 3 0 1 1 3 3 6 6 0 1 1-6-6 9 9 0 1 1 9 9"/>',
    party: '<path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m22 2-2.2.8a3 3 0 0 0-2 3l.1 1a3 3 0 0 1-2 3L14 10"/><path d="M11 13c1.9 1.9 2.8 4.2 2 5s-3.1-.1-5-2-2.8-4.2-2-5 3.1.1 5 2z"/>',
  };
  // emoji → [icon, colour] (colour = null: the text colour)
  var CO = { warn: '#d97706', red: '#e5484d', green: '#16a37a', orange: '#f2a516', teal: '#2f7fb8', blue: '#2f7be0', purple: '#8b5cf6' };
  var MAP = {
    '⚠': ['alert', CO.warn], '🌱': ['sprout', CO.green], '☠': ['skull', CO.red], '💥': ['burst', CO.red], '✏': ['pencil'], '🎤': ['mic'], '⚔': ['swords'], '🗑': ['trash', CO.red],
    '📍': ['pin', CO.teal], '🏠': ['home'], '🤖': ['bot'], '🔬': ['flask'], '🧪': ['flask', CO.green], '🪓': ['axe', CO.orange], '🗺': ['map'], '🛡': ['shield', CO.blue], '📐': ['ruler'],
    '📏': ['ruler'], '🔒': ['lock'], '🌲': ['tree', CO.green], '🔥': ['flame', CO.orange], '🪖': ['shield'], '🧠': ['sparkles', CO.purple], '🌾': ['wheat', CO.orange], '💰': ['coins', CO.orange],
    '🌀': ['swirl', CO.purple], '🧽': ['eraser'], '👉': ['arrow'], '👥': ['users'], '📌': ['pushpin', CO.red], '🧱': ['wall', CO.orange], '🎯': ['target', CO.red], '👑': ['crown', CO.orange],
    '📋': ['clipboard'], '🏰': ['castle'], '💦': ['drop', CO.blue], '🏪': ['store', CO.teal], '🎉': ['party', CO.orange], '📸': ['camera'], '📖': ['book'], '💾': ['save'], '🔵': ['dot', CO.blue],
    '🔴': ['dot', CO.red], '🖼': ['image'], '📝': ['note'], '⛰': ['mountain'], '🌊': ['waves', CO.blue], '❄': ['snow', CO.blue], '🍒': ['fruit', CO.purple], '⚡': ['zap', CO.orange],
    '🪄': ['wand', CO.purple], '✨': ['sparkles', CO.orange], '🧰': ['wrench'], '🔄': ['refresh'], '🗂': ['folder'], '⚙': ['settings'], '❓': ['help'], '👆': ['hand'], '🪼': ['drop', CO.purple],
    '👣': ['pin'], '#️⃣': ['grid'], '▶️': ['play'], '🟢': ['dot', CO.green], '🟡': ['dot', CO.orange], '⭐': ['star', CO.orange], '🏆': ['crown', CO.orange], '🚩': ['pin', CO.red],
  };
  function lic(name, col) {
    var d = P[name]; if (!d) return '';
    return '<svg class="li" viewBox="0 0 24 24" aria-hidden="true"' + (col ? ' style="color:' + col + '"' : '') + '>' + d + '</svg>';
  }
  PP.lic = lic;
  if (!/(^|\s)look-lagoon(\s|$)/.test(document.documentElement.className)) return;

  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp('(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\uFE0F?\\s?', 'gu');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, SELECT: 1, INPUT: 1, svg: 1, SVG: 1, CANVAS: 1 };
  function fixText(t) {
    var s = t.nodeValue; RE.lastIndex = 0; if (!RE.test(s)) return;
    var p = t.parentNode; if (!p || SKIP[p.nodeName] || (p.closest && p.closest('svg,select,textarea'))) return;
    var span = document.createElement('span'); span.className = 'lix';
    span.innerHTML = s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; })
      .replace(RE, function (m, e) { var k = MAP[e] || MAP[e.replace('️', '')]; return k ? lic(k[0], k[1]) : m; });
    p.replaceChild(span, t);
  }
  function fix(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fixText);
  }
  var pending = new Set(), raf = 0;
  function flush() { raf = 0; pending.forEach(fix); pending.clear(); }
  function start() {
    fix(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { if (m.type === 'characterData') pending.add(m.target); else m.addedNodes.forEach(function (x) { pending.add(x); }); });
      if (!raf) raf = requestAnimationFrame(flush);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window.PP);
