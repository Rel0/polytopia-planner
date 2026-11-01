// Polytopia Planner v13 – NOTES: plan your turn as numbered moves (mode 'notes'), with voice input.
// State: PP.state.notes = [{ id, text, done, c?, r? }]   (order = move number; c/r = optional linked tile)
// Prefs: PP.state.ui.notes = { lang: 'en-US'|'de-DE' }
// Voice: Web Speech API (needs a secure context: https or localhost). Otherwise the composer is big and focused,
// so the iOS keyboard's dictation key is one tap away.
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  const S = () => PP.state;
  const esc = s => (PP.ui && PP.ui.esc ? PP.ui.esc(s) : String(s));
  const toast = (m, ms) => PP.ui.toast(m, ms);
  const LANGS = [['en-US', 'EN', 'English'], ['de-DE', 'DE', 'Deutsch']];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const SECURE = window.isSecureContext !== false;
  const HINT_INSECURE = 'Voice needs a secure (https) connection — use your keyboard\'s 🎤 dictation key instead.';

  function notes() { const st = S(); if (!Array.isArray(st.notes)) st.notes = []; return st.notes; }
  function prefs() {
    const ui = S().ui || (S().ui = {});
    const p = ui.notes && typeof ui.notes === 'object' ? ui.notes : (ui.notes = {});
    if (!LANGS.some(l => l[0] === p.lang)) p.lang = /^de\b/i.test(navigator.language || '') ? 'de-DE' : 'en-US';
    return p;
  }
  const byId = id => notes().find(n => n.id === id) || null;
  const numOf = id => notes().findIndex(n => n.id === id) + 1;
  const linked = n => n && Number.isFinite(n.c) && Number.isFinite(n.r);

  // ---------------------------------------------------------------- session UI state
  const ui = {
    sel: null,        // highlighted note id (new text always becomes a NEW move)
    linking: null,    // note id waiting for a map tap
    draft: '',        // composer text
    focus: false,     // focus the composer after the next render
    listening: false,
    interim: '',
    base: '',         // composer text when dictation started
    voiceMsg: '',     // inline message under the voice bar (errors / fallback hint)
    blocked: false,   // voice failed for good in this session (permission / insecure)
  };
  const voiceOK = () => !!SR && SECURE && !ui.blocked;

  // ---------------------------------------------------------------- undo (session only)
  let hist = [];
  function snapshot() { hist.push(JSON.stringify(notes())); if (hist.length > 40) hist.shift(); }
  function undo() {
    if (!hist.length) { toast('Nothing to undo'); return; }
    const prev = JSON.parse(hist.pop()), list = notes();
    list.length = 0; list.push(...prev);
    if (ui.sel && !byId(ui.sel)) ui.sel = null;
    PP.app.commit();
  }

  // ---------------------------------------------------------------- note operations
  const tidy = t => String(t || '').replace(/\s+/g, ' ').trim();
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  // typed / spoken text always becomes a new move (editing an existing one happens inline in the list)
  function addText(text) {
    text = tidy(text);
    if (!text) return null;
    snapshot();
    ui.sel = null;
    const n = { id: PP.util.uid(), text: cap(text), done: false };
    notes().push(n);
    PP.app.commit();
    scrollToNote(n.id);
    return n;
  }
  function move(id, d) {
    const list = notes(), i = list.findIndex(n => n.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    snapshot();
    const [n] = list.splice(i, 1); list.splice(j, 0, n);
    PP.app.commit();
    scrollToNote(id);
  }
  function remove(id) {
    const i = notes().findIndex(n => n.id === id); if (i < 0) return;
    snapshot();
    notes().splice(i, 1);
    if (ui.sel === id) ui.sel = null;
    if (ui.linking === id) ui.linking = null;
    PP.app.commit();
    toast('Move ' + (i + 1) + ' deleted · Undo available');
  }
  function scrollToNote(id) {
    requestAnimationFrame(() => {
      const el = document.querySelector('.nt-item[data-id="' + id + '"]');
      if (el && el.scrollIntoView && !(PP.drawer.isPeek && PP.drawer.isPeek())) el.scrollIntoView({ block: 'nearest' });
    });
  }
  function select(id) {
    ui.sel = ui.sel === id ? null : id;
    PP.app.refresh();
    if (ui.sel) scrollToNote(ui.sel);
  }
  function startLink(id) {
    const n = byId(id); if (!n) return;
    if (ui.linking === id) { // second tap on 📍: remove the link (or cancel)
      ui.linking = null;
      if (linked(n)) { snapshot(); delete n.c; delete n.r; PP.app.commit(); toast('Tile link removed'); } else PP.app.refresh();
      return;
    }
    ui.linking = id;
    if (PP.drawer.isSheet && PP.drawer.isSheet()) PP.drawer.setFull(false); else if (PP.drawer.yieldMap) PP.drawer.yieldMap();
    PP.app.refresh();
  }

  // ---------------------------------------------------------------- voice (Web Speech API)
  let rec = null;
  function composer() { return document.getElementById('ntIn'); }
  function setComposer(v, live) {
    const ta = composer(); if (!ta) return;
    ta.value = v; ta.classList.toggle('live', !!live);
  }
  function fallback(msg) {
    ui.voiceMsg = msg || HINT_INSECURE;
    ui.focus = true;
    PP.app.refresh();
  }
  function startVoice() {
    if (ui.listening) { stopVoice(); return; }
    if (!SR) { ui.blocked = true; fallback('This browser has no speech recognition — use your keyboard\'s 🎤 dictation key instead.'); return; }
    if (!SECURE) { ui.blocked = true; fallback(HINT_INSECURE); return; }
    if (ui.blocked) { fallback(ui.voiceMsg); return; }
    try {
      rec = new SR();
      rec.lang = prefs().lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = onResult;
      rec.onerror = onError;
      rec.onend = onEnd;
      ui.base = tidy(ui.draft); ui.interim = ''; ui.voiceMsg = '';
      rec.start();
      ui.listening = true;
    } catch (e) {
      rec = null; ui.listening = false;
      fallback('Voice could not start (' + (e && e.message || e) + ') — use your keyboard\'s 🎤 dictation key instead.');
      return;
    }
    if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) { /* ignore */ }
    PP.app.refresh();
  }
  function stopVoice() { if (rec) try { rec.stop(); } catch (e) { /* ignore */ } }
  // ev: SpeechRecognitionEvent-like { resultIndex, results: [ { 0: { transcript }, isFinal } ] }
  function onResult(ev) {
    let fin = '', inter = '';
    for (let i = ev.resultIndex || 0; i < ev.results.length; i++) {
      const r = ev.results[i], t = r && r[0] ? r[0].transcript : '';
      if (r.isFinal) fin += t; else inter += t;
    }
    if (fin) {
      const text = [ui.base, fin].filter(Boolean).join(' ');
      ui.base = ''; ui.interim = ''; ui.draft = '';
      const n = addText(text);
      if (n && !ui.sel) toast('🎤 Move ' + numOf(n.id) + ' added');
      return;
    }
    ui.interim = inter;
    setComposer([ui.base, inter].filter(Boolean).join(' '), true);
  }
  function onError(ev) {
    const e = ev && ev.error;
    if (e === 'aborted') return;
    if (e === 'not-allowed' || e === 'service-not-allowed') {
      ui.blocked = true;
      ui.voiceMsg = !SECURE ? HINT_INSECURE : 'Microphone access was denied — allow it in the browser settings, or use your keyboard\'s 🎤 dictation key.';
      ui.focus = true;
    } else if (e === 'no-speech') ui.voiceMsg = 'Didn\'t hear anything — tap 🎤 and speak.';
    else if (e === 'audio-capture') ui.voiceMsg = 'No microphone found — use your keyboard\'s 🎤 dictation key instead.';
    else if (e === 'network') ui.voiceMsg = 'Speech service not reachable (offline?) — use your keyboard\'s 🎤 dictation key.';
    else if (e === 'language-not-supported') ui.voiceMsg = 'This language is not supported for voice here.';
    else ui.voiceMsg = 'Voice error' + (e ? ' (' + e + ')' : '') + ' — try again or type.';
  }
  function onEnd() {
    rec = null;
    const wasInterim = ui.interim;
    ui.listening = false;
    if (wasInterim) { ui.draft = [ui.base, wasInterim].filter(Boolean).join(' '); } // ended without a final result: keep the text to edit
    ui.interim = ''; ui.base = '';
    PP.app.refresh();
  }

  // ---------------------------------------------------------------- map
  function markerPos(n, i) {
    const p = PP.board.tileToScreen(n.c, n.r), t = PP.board.tileScreenSize();
    // several moves on one tile: side by side
    const same = notes().filter(m => linked(m) && m.c === n.c && m.r === n.r), k = same.indexOf(n), cnt = same.length;
    const R = Math.max(9, Math.min(13, t.h * 0.28));
    return { x: p.x + (k - (cnt - 1) / 2) * (R * 2 + 2), y: p.y - t.h * 0.42, R, num: i + 1 };
  }
  function drawMarkers(ctx) {
    const list = notes();
    list.forEach((n, i) => {
      if (!linked(n)) return;
      const m = markerPos(n, i), sel = n.id === ui.sel, R = sel ? m.R + 3 : m.R;
      ctx.save();
      ctx.globalAlpha = n.done && !sel ? 0.6 : 1;
      // little pin tail towards the tile centre
      ctx.beginPath(); ctx.moveTo(m.x - R * 0.45, m.y + R * 0.7); ctx.lineTo(m.x, m.y + R + 6); ctx.lineTo(m.x + R * 0.45, m.y + R * 0.7); ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
      ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
      ctx.fillStyle = n.done ? '#6b7699' : '#ffd166'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = sel ? 3 : 1.5; ctx.strokeStyle = sel ? '#4cc9f0' : 'rgba(10,14,30,.85)'; ctx.stroke();
      ctx.font = `800 ${Math.round(R * 1.15)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = n.done ? '#fff' : '#1a1f33';
      ctx.fillText(n.done ? '✓' : String(m.num), m.x, m.y + 1);
      ctx.restore();
    });
    if (ui.linking) {
      const n = byId(ui.linking);
      if (n && linked(n)) {
        const p = PP.board.tileToScreen(n.c, n.r), t = PP.board.tileScreenSize();
        ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeStyle = '#4cc9f0';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, t.w * 0.38, t.h * 0.38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
  }
  function hitMarker(sx, sy) {
    const list = notes();
    let best = null, bd = Infinity;
    list.forEach((n, i) => {
      if (!linked(n)) return;
      const m = markerPos(n, i), d = Math.hypot(sx - m.x, sy - m.y);
      if (d < Math.max(18, m.R + 6) && d < bd) { bd = d; best = n; }
    });
    return best;
  }

  PP.modes.register('notes', {
    label: 'Notes',
    icon: '📝',
    hint() {
      if (ui.linking) { const k = numOf(ui.linking); return k ? 'Tap a tile for Move ' + k + ' · 📍 again to ' + (linked(byId(ui.linking)) ? 'remove the link' : 'cancel') : ''; }
      if (ui.listening) return '🎤 Listening…';
      return notes().some(linked) ? 'Tap a numbered pin to select its move' : '';
    },
    onEnter() { ui.focus = true; ui.voiceMsg = ui.blocked ? ui.voiceMsg : ''; },
    onExit() { ui.linking = null; stopVoice(); },
    onTap(t) {
      if (ui.linking) {
        const n = byId(ui.linking); ui.linking = null;
        if (n) {
          snapshot(); n.c = t.c; n.r = t.r; ui.sel = null;  // linking doesn't select: next text is a new move
          PP.app.commit(); toast('📍 Move ' + numOf(n.id) + ' linked to this tile');
          if (PP.drawer.isOverlay() && !PP.drawer.isOpen()) PP.drawer.open();
        } else PP.app.refresh();
        return;
      }
      const hit = hitMarker(t.sx, t.sy);
      if (hit) {
        if (!PP.drawer.isOpen()) S().ui.drawerOpen = true;
        select(hit.id);
        if (ui.sel) toast('Move ' + numOf(hit.id) + ': ' + (tidy(hit.text) || '(empty)'), 2500);
      } else if (ui.sel) { ui.sel = null; PP.app.refresh(); }
    },
    drawOver(ctx) { drawMarkers(ctx); },
    renderPanel(el) { injectCss(); renderPanel(el); },
  });

  // ---------------------------------------------------------------- panel
  function voiceBarHtml(list) {
    const p = prefs(), ok = voiceOK(), done = list.filter(n => n.done).length, sel = byId(ui.sel);
    const micCls = 'nt-mic' + (ui.listening ? ' on' : '') + (ok ? '' : ' off');
    const micLbl = ui.listening ? 'Stop listening' : ok ? 'Speak a move' : 'Voice not available here';
    return `<div class="nt-bar">
        <button class="${micCls}" data-nt="mic" aria-label="${micLbl}" title="${micLbl}"><span>${ui.listening ? '■' : '🎤'}</span></button>
        <button class="nt-add" data-nt="add">＋ Add move</button>
        ${SR && SECURE ? `<select class="nt-lang" data-nt="lang" aria-label="Voice language">${LANGS.map(l => `<option value="${l[0]}" ${l[0] === p.lang ? 'selected' : ''}>${l[1]}</option>`).join('')}</select>` : ''}
        <span class="nt-cnt">${list.length ? `<b>${list.length}</b> ${list.length === 1 ? 'move' : 'moves'}${done ? `<br>${done} done` : ''}` : 'no moves'}</span>
      </div>`;
  }
  function renderPanel(el) {
    const list = notes(), sel = byId(ui.sel), nextNo = list.length + 1;
    if (ui.sel && !sel) ui.sel = null;
    const ok = voiceOK();
    const ph = ui.listening ? 'Listening… speak now' : `Move ${nextNo}: e.g. Warrior takes the village`;
    const showHint = ui.voiceMsg || (!ok && (!SR || !SECURE) ? HINT_INSECURE : '');
    let h = `<div class="nt-peek" data-peek="nt">
      <textarea id="ntIn" class="nt-in${ui.listening ? ' live' : ''}" rows="2" enterkeyhint="done" autocomplete="off" placeholder="${esc(ph)}">${esc(ui.listening ? [ui.base, ui.interim].filter(Boolean).join(' ') : ui.draft)}</textarea>
      ${voiceBarHtml(list)}
      ${showHint ? `<div class="nt-msg${ui.voiceMsg && ok ? ' soft' : ''}">${esc(showHint)}</div>` : ''}
    </div>`;
    h += '<div class="nt-list">';
    if (!list.length) h += '<p class="nt-empty">Plan your turn: add <b>Move 1</b>, <b>Move 2</b> … by typing or with 🎤. Tick moves off as you play them.</p>';
    list.forEach((n, i) => {
      const lk = linked(n), isSel = n.id === ui.sel, isLink = n.id === ui.linking;
      h += `<div class="nt-item${n.done ? ' done' : ''}${isSel ? ' sel' : ''}" data-id="${n.id}">
        <button class="nt-tick" data-nt="tick" aria-pressed="${!!n.done}" aria-label="${n.done ? 'Mark as not done' : 'Mark as done'}">${n.done ? '✓' : ''}</button>
        <div class="nt-main">
          <button class="nt-lbl" data-nt="sel" aria-pressed="${isSel}">Move ${i + 1}${lk ? ` <i>📍 ${n.c}, ${n.r}</i>` : ''}${isSel ? ' <em>selected</em>' : ''}</button>
          <textarea class="nt-txt" data-id="${n.id}" rows="1" placeholder="(empty – type here)">${esc(n.text)}</textarea>
        </div>
        <div class="nt-btns">
          <button data-nt="up" ${i ? '' : 'disabled'} aria-label="Move up">↑</button>
          <button data-nt="link" class="${lk ? 'lk' : ''}${isLink ? ' on' : ''}" aria-label="${lk ? 'Change tile link' : 'Link to a tile'}">📍</button>
          <button data-nt="down" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button>
          <button data-nt="del" class="del" aria-label="Delete move">🗑</button>
        </div>
      </div>`;
    });
    h += '</div>';
    h += `<div class="nt-foot">
        <button data-nt="undo" ${hist.length ? '' : 'disabled'}>↶ Undo</button>
        <button data-nt="cleardone" ${list.some(n => n.done) ? '' : 'disabled'}>Clear done</button>
        <button data-nt="clear" class="danger" ${list.length ? '' : 'disabled'}>🗑️ Clear all</button>
      </div>
      <p class="nt-note">${ok ? '🎤 speaks one move; select a move first to add to it instead. ' : ''}Tap <b>📍</b> then a tile to pin a move to the map. Enter adds the move, Shift+Enter makes a new line.</p>`;
    el.innerHTML = h;
    el.querySelectorAll('.nt-txt').forEach(grow);

    el.onclick = ev => {
      const b = ev.target.closest('[data-nt]'); if (!b || !el.contains(b) || b.disabled || b.tagName === 'SELECT') return;
      const a = b.dataset.nt, item = b.closest('.nt-item'), id = item && item.dataset.id, n = id && byId(id);
      if (a === 'mic') { ui.draft = (composer() || {}).value || ui.draft; startVoice(); }
      else if (a === 'add') {
        const ta = composer(), v = tidy(ta ? ta.value : ui.draft);
        if (!v) { ui.focus = true; PP.app.refresh(); toast(sel ? 'Type or dictate the text to add' : 'Type or dictate the move first'); return; }
        ui.draft = ''; ui.focus = true; addText(v);
      }
      else if (a === 'desel') { ui.sel = null; PP.app.refresh(); }
      else if (a === 'sel' && n) select(id);
      else if (a === 'tick' && n) { snapshot(); n.done = !n.done; PP.app.commit(); }
      else if (a === 'up' && n) move(id, -1);
      else if (a === 'down' && n) move(id, 1);
      else if (a === 'link' && n) startLink(id);
      else if (a === 'del' && n) remove(id);
      else if (a === 'undo') undo();
      else if (a === 'cleardone') { snapshot(); const keep = notes().filter(x => !x.done); notes().length = 0; notes().push(...keep); PP.app.commit(); toast('Done moves cleared · Undo available'); }
      else if (a === 'clear') {
        if (!PP.ui.confirm('Delete all ' + notes().length + ' moves?')) return;
        snapshot(); notes().length = 0; ui.sel = null; ui.linking = null; PP.app.commit(); toast('All moves cleared · Undo available');
      }
    };
    el.oninput = ev => {
      const t = ev.target;
      if (t.id === 'ntIn') { if (!ui.listening) ui.draft = t.value; t.classList.remove('live'); return; }
      if (t.classList.contains('nt-txt')) {
        const n = byId(t.dataset.id); if (!n) return;
        n.text = t.value; grow(t); PP.app.saveSoon();
      }
    };
    el.onchange = ev => {
      const t = ev.target;
      if (t.dataset.nt === 'lang') { prefs().lang = t.value; PP.app.saveSoon(); toast('Voice language: ' + (LANGS.find(l => l[0] === t.value) || [0, 0, t.value])[2]); }
    };
    // inline edit finished → redraw markers / selection row with the new text
    if (!el._ntFocusOut) el.addEventListener('focusout', el._ntFocusOut = ev => {
      if (ev.target.classList && ev.target.classList.contains('nt-txt')) {
        const n = byId(ev.target.dataset.id);
        if (n && n.text !== tidy(n.text) && !/\n/.test(n.text)) n.text = n.text.trim();
        PP.app.saveSoon();
        const sr = el.querySelector('.nt-selrow span'), s = byId(ui.sel);
        if (sr && s) sr.textContent = tidy(s.text) || '(empty)';
      }
    });
    el.onkeydown = ev => {
      if (ev.target.id === 'ntIn' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault();
        const v = tidy(ev.target.value); if (!v) return;
        ui.draft = ''; ui.focus = true; addText(v);
      }
    };
    if (ui.focus) {
      ui.focus = false;
      // phone with working voice: don't pop up the keyboard over the map unasked
      const want = !ok || !PP.drawer.isOverlay() || !!ui.voiceMsg;
      const ta = composer();
      if (want && ta && PP.drawer.isOpen()) { try { ta.focus({ preventScroll: true }); const L = ta.value.length; ta.setSelectionRange(L, L); } catch (e) { /* ignore */ } }
    }
  }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(34, ta.scrollHeight + 2) + 'px'; }

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const css = `
.nt-peek{display:flex;flex-direction:column;gap:6px;padding-bottom:2px}
.nt-selrow{display:flex;align-items:center;gap:8px;background:rgba(76,201,240,.12);border:1px solid rgba(76,201,240,.45);border-radius:10px;padding:4px 4px 4px 10px;font-size:13px;min-width:0}
.nt-selrow b{color:var(--accent);white-space:nowrap}
.nt-selrow span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.nt-selrow button{flex:none;width:30px;height:30px;border:0;border-radius:8px;background:var(--panel2)}
.nt-in{width:100%;min-height:64px;resize:vertical;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:9px 11px;font-size:16px;line-height:1.35;color:var(--text);display:block}
.nt-in:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px rgba(76,201,240,.25)}
.nt-in.live{color:#bfe9ff;font-style:italic;border-color:#ef476f}
.nt-bar{display:flex;align-items:center;gap:8px;min-width:0}
.nt-mic{flex:none;width:58px;height:48px;border-radius:14px;border:0;background:var(--accent);color:#08121f;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.nt-mic.off{background:var(--panel2);color:var(--muted);box-shadow:none}
.nt-mic.off span{opacity:.6}
.nt-mic.on{background:#ef476f;color:#fff;animation:ntPulse 1.1s ease-in-out infinite}
@keyframes ntPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,71,111,.6)}50%{box-shadow:0 0 0 8px rgba(239,71,111,0)}}
.nt-add{flex:1;min-width:0;height:48px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px}
.nt-lang{flex:none;height:48px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text);padding:0 6px;font-weight:700;font-size:14px}
.nt-cnt{flex:none;font-size:12px;color:var(--muted);text-align:right;line-height:1.25;min-width:44px}
.nt-cnt b{color:var(--text);font-size:15px}
.nt-msg{font-size:12.5px;line-height:1.35;color:#ffcf7a;background:rgba(255,170,0,.12);border-radius:10px;padding:7px 10px}
.nt-msg.soft{color:var(--muted);background:rgba(255,255,255,.05)}
.nt-list{margin-top:10px;display:flex;flex-direction:column;gap:6px}
.nt-empty{color:var(--muted);font-size:13px;line-height:1.45;margin:4px 2px}
.nt-item{display:flex;align-items:flex-start;gap:8px;background:var(--panel2);border:1px solid transparent;border-radius:12px;padding:7px 6px 7px 8px}
.nt-item.sel{border-color:var(--accent);background:rgba(76,201,240,.1)}
.nt-tick{flex:none;width:32px;height:32px;margin-top:4px;border-radius:50%;border:2px solid var(--muted);background:none;color:#08121f;font-weight:900;font-size:17px;display:flex;align-items:center;justify-content:center;padding:0}
.nt-item.done .nt-tick{background:var(--ok);border-color:var(--ok)}
.nt-main{flex:1;min-width:0;display:flex;flex-direction:column}
.nt-lbl{align-self:flex-start;border:0;background:none;padding:2px 0;font-size:12px;font-weight:800;letter-spacing:.03em;color:var(--gold);text-align:left}
.nt-lbl i{font-style:normal;font-weight:600;color:var(--muted);margin-left:4px}
.nt-lbl em{font-style:normal;font-weight:700;color:var(--accent);margin-left:4px}
.nt-item.done .nt-lbl{color:var(--muted)}
.nt-txt{width:100%;resize:none;overflow:hidden;background:transparent;border:1px solid transparent;border-radius:8px;padding:4px 6px;margin-left:-6px;font-size:15px;line-height:1.35;color:var(--text);min-height:34px}
.nt-txt:focus{outline:none;background:var(--bg);border-color:var(--line)}
.nt-item.done .nt-txt{color:var(--muted);text-decoration:line-through}
.nt-btns{flex:none;display:grid;grid-template-columns:34px 34px;gap:4px}
.nt-btns button{width:34px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--panel);font-size:15px;padding:0;display:flex;align-items:center;justify-content:center;font-weight:700}
.nt-btns button.lk{border-color:var(--gold)}
.nt-btns button.on{background:var(--accent);border-color:var(--accent)}
.nt-btns button.del{color:#ff8ca6}
.nt-foot{display:flex;gap:8px;margin-top:12px}
.nt-foot button{flex:1;min-width:0;min-height:42px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--text);font-weight:600;font-size:13px;padding:6px 4px}
.nt-foot button.danger{color:#ff8ca6;border-color:rgba(239,71,111,.45)}
.nt-note{font-size:12px;line-height:1.4;color:var(--muted);margin:10px 0 0}`;
    const st = document.createElement('style'); st.id = 'nt-css'; st.textContent = css;
    document.head.appendChild(st);
  }

  // test / integration hooks
  PP.notes = {
    list: notes,
    add: addText,
    select: id => { ui.sel = id; PP.app.refresh(); },
    get ui() { return ui; },
    voiceAvailable: voiceOK,
    // feed a (fake) SpeechRecognition event / error / end – same handlers the real recognizer uses
    _onResult: onResult, _onError: onError, _onEnd: onEnd,
  };
})(window.PP);
