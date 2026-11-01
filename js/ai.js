// Polytopia Planer v4 – optional AI unit detection with Claude (official Anthropic TypeScript SDK, loaded lazily).
// The API key lives only in localStorage 'polyplan.apikey' – never logged, never sent anywhere except to Anthropic.
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  const KEY = 'polyplan.apikey';
  const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1';
  const MODEL = 'claude-opus-5-5';
  const MAX_SIDE = 1600;

  // ---------------------------------------------------------------- key storage
  const getKey = () => { try { return (localStorage.getItem(KEY) || '').trim(); } catch (e) { return ''; } };
  const hasKey = () => !!getKey();
  // hidden on the public site: only offered with ?ai in the address or once a key is saved on this device
  const enabled = () => hasKey() || /[?&]ai(=|&|$)/.test(location.search);
  function setKey(k) { try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- SDK (dynamic ESM import from CDN)
  let sdkP = null;
  function loadSdk() {
    if (!sdkP) {
      // dynamic import() works from classic scripts, also on file://
      sdkP = import(SDK_URL).catch(e => { sdkP = null; throw e; });
    }
    return sdkP;
  }
  // browser opt-in option verified in the SDK README: `dangerouslyAllowBrowser: true`
  function makeClient(mod, apiKey) {
    const Anthropic = mod.default || mod.Anthropic;
    return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 5 * 60 * 1000 });
  }

  // ---------------------------------------------------------------- request
  const unitKeys = () => Object.keys(PP.UNITS || { warrior: 1 });
  function schema() {
    return {
      type: 'object',
      properties: {
        units: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'x pixel of the point where the unit stands (centre of its tile)' },
              y: { type: 'number', description: 'y pixel of that point' },
              type: { type: 'string', enum: unitKeys().concat(['unknown']) },
              hp: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'HP number shown next to the unit, null if not readable' },
              veteran: { type: 'boolean' },
              badge_color: { type: 'string', description: 'tribe badge fill colour as hex, e.g. #23287d' },
              confidence: { type: 'number', description: '0..1' },
            },
            required: ['x', 'y', 'type', 'hp', 'veteran', 'badge_color', 'confidence'],
            additionalProperties: false,
          },
        },
      },
      required: ['units'],
      additionalProperties: false,
    };
  }
  function prompt(w, h) {
    return `This is a screenshot (${w}×${h} px) of the mobile game "The Battle of Polytopia" (isometric diamond tiles, fixed camera).
Find EVERY unit (figure) on the map – own and enemy – and report for each:
- x, y: pixel coordinates in THIS image of the point where the unit stands, i.e. the centre of the diamond tile under the figure's feet (not the badge, not the head).
- type, one of: warrior (Krieger: small figure with club/sword), archer (Bogenschütze: bow), defender (Verteidiger: big shield), rider (Reiter: on a horse), swordsman (Schwertkämpfer: bigger armoured figure with large sword), catapult (Katapult: siege machine), knight (Ritter: armoured horse with lance), mindbender (Mind Bender: robed figure with staff), giant (Riese: huge figure)` +
      (unitKeys().some(k => !/^(warrior|archer|defender|rider|swordsman|catapult|knight|mindbender|giant)$/.test(k)) ? `, or one of: ${unitKeys().join(', ')}` : '') +
      `. Ships/boats or anything you cannot classify: "unknown".
- hp: the small grey/white HP number drawn next to the unit (null if you cannot read it).
- veteran: true if the unit is marked as veteran.
- badge_color: every unit has a small round badge (up-right of the figure) filled with its tribe colour and a white unit icon; give that fill colour as hex.
- confidence: 0..1 how sure you are about this unit.
Ignore city name plates, buildings, resources (fruit, animals, fish, ore), monuments, and the game UI (header, buttons). Units may stand inside cities. Report each unit once.`;
  }
  // screenshot → JPEG base64 with long side ≤ 1600 px; returns { data, w, h, scale }
  function encodeImage(img) {
    const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
    const s = Math.min(1, MAX_SIDE / Math.max(W0, H0));
    const w = Math.round(W0 * s), h = Math.round(H0 * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
    const url = c.toDataURL('image/jpeg', 0.9);
    return { data: url.slice(url.indexOf(',') + 1), w, h, scale: w / W0 };
  }
  function buildRequest(enc) {
    return {
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: schema() } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: enc.data } },
          { type: 'text', text: prompt(enc.w, enc.h) },
        ],
      }],
    };
  }

  // ---------------------------------------------------------------- response → detections
  function hexToRgb(s) {
    const m = String(s || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1]; if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  function aiError(msg) { const e = new Error(msg); e.pp = true; return e; }
  // msg = SDK message object; ctx = { scale, grid } → [{ c, r, type?, hp?, vet, color, conf, x, y }]
  function parseResponse(msg, ctx) {
    if (!msg || typeof msg !== 'object') throw aiError('Empty response from the AI');
    if (msg.stop_reason === 'refusal') throw aiError('The AI declined the request – please try a different screenshot.');
    if (msg.stop_reason === 'max_tokens') throw aiError('The AI response was cut off (too long) – please try again.');
    const texts = (msg.content || []).filter(b => b && b.type === 'text' && typeof b.text === 'string');
    if (!texts.length) throw aiError('The AI returned no data.');
    let data;
    try { data = JSON.parse(texts[texts.length - 1].text); } catch (e) { throw aiError('AI response was not valid JSON.'); }
    if (!data || !Array.isArray(data.units)) throw aiError('AI response has an unexpected format.');
    const g = ctx.grid, sc = ctx.scale || 1, keys = new Set(Object.keys(PP.UNITS || {}));
    const det = g.ux * g.vy - g.vx * g.uy || 1e-9;
    const out = [];
    for (const u of data.units) {
      if (!u || !isFinite(u.x) || !isFinite(u.y)) continue;
      const X = u.x / sc, Y = u.y / sc, dx = X - g.ox, dy = Y - g.oy;
      const c = Math.round((dx * g.vy - g.vx * dy) / det), r = Math.round((g.ux * dy - g.uy * dx) / det);
      const it = { c, r, x: Math.round(X), y: Math.round(Y), vet: !!u.veteran,
        conf: isFinite(u.confidence) ? Math.max(0, Math.min(1, +u.confidence)) : 0.5 };
      if (typeof u.type === 'string' && keys.has(u.type)) it.type = u.type;
      if (Number.isInteger(u.hp) && u.hp > 0) it.hp = u.hp;
      const col = hexToRgb(u.badge_color); if (col) it.color = col;
      out.push(it);
    }
    return out;
  }

  // SDK typed errors → readable message (most specific first)
  function errorMessage(e, mod) {
    const A = (mod && (mod.default || mod.Anthropic)) || {};
    const cls = n => (mod && mod[n]) || A[n];
    const is = n => { const C = cls(n); return typeof C === 'function' && e instanceof C; };
    if (e && e.pp) return e.message;
    if (is('AuthenticationError')) return 'Invalid API key – please check it in the menu under “🤖 AI detection”.';
    if (is('PermissionDeniedError')) return 'No access with this API key (missing permission).';
    if (is('RateLimitError')) return 'Too many requests or credit limit reached – please wait a moment.';
    if (is('APIConnectionTimeoutError')) return 'The AI timed out – please try again.';
    if (is('APIConnectionError')) return 'No connection to Anthropic – are you offline?';
    if (is('BadRequestError')) return 'Request rejected by the API (400).';
    if (is('InternalServerError')) return 'Anthropic server error – please try again later.';
    if (is('APIError')) return 'AI error' + (e.status ? ' (' + e.status + ')' : '') + '.';
    return 'AI detection failed.';
  }

  // ---------------------------------------------------------------- main entry
  let busy = false;
  async function detectUnits() {
    const img = PP.board && PP.board.image;
    if (!img || PP.state.board !== 'image') throw aiError('Please load a screenshot first.');
    const key = getKey();
    if (!key) throw aiError('No API key saved.');
    if (busy) throw aiError('AI detection is already running …');
    busy = true;
    let mod = null;
    try {
      try { mod = await loadSdk(); } catch (e) { throw aiError('Could not load the AI module – are you offline?'); }
      const client = makeClient(mod, key);
      const enc = encodeImage(img);
      const grid = Object.assign({}, PP.state.grid);
      const msg = await client.beta.messages.create(buildRequest(enc));
      return parseResponse(msg, { scale: enc.scale, grid });
    } catch (e) {
      const m = errorMessage(e, mod);
      console.warn('AI detection:', (e && e.name) || 'Error', (e && e.status) || ''); // no key, no request body
      throw aiError(m);
    } finally { busy = false; }
  }
  // detect + apply + toast (menu / settings button)
  function run() {
    const toast = m => PP.ui && PP.ui.toast(m, 4000);
    toast('🤖 AI is detecting units …');
    return detectUnits().then(list => {
      if (PP.recog) PP.recog.applyDetections(list, 'ai');
      toast(list.length + ' units detected – just tap wrong ones to fix them');
      return list;
    }, e => { toast('⚠️ ' + e.message); return null; });
  }

  // ---------------------------------------------------------------- settings sheet
  function openSettings() {
    const has = hasKey(), canRun = has && PP.state.board === 'image';
    PP.ui.openSheet(`
      <div class="sheethead"><b>🤖 AI detection</b><button class="x" data-ai="close" aria-label="Close">✕</button></div>
      <p>Optional: Claude (Anthropic) detects units, types and HP on the screenshot. For this you need your own
        API key from <b>console.anthropic.com</b>.</p>
      <div class="lbl">API key ${has ? '<b>✓ saved</b>' : ''}</div>
      <input id="aiKey" class="txt" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"
        placeholder="${has ? 'enter a new key to replace it' : 'sk-ant-…'}" value="">
      <p class="note">🔒 The key is stored only on this device. The screenshot is sent to Anthropic · approx. 2–5 cents per detection.</p>
      <div class="actions">
        ${has ? '<button class="danger" data-ai="del">Delete key</button>' : ''}
        <button class="primary" data-ai="save">Save</button>
      </div>
      ${canRun ? '<div class="btnrow big"><button class="primary" data-ai="run">🤖 Detect units now</button></div>' : ''}`,
    (ev, b) => {
      if (!b) return;
      const a = b.dataset.ai;
      if (a === 'close') PP.ui.closeSheet();
      else if (a === 'del') { setKey(''); PP.ui.toast('Key deleted'); openSettings(); }
      else if (a === 'save') {
        const inp = document.getElementById('aiKey'), v = ((inp && inp.value) || '').trim();
        if (inp) inp.value = '';
        if (!v) { PP.ui.toast(has ? 'Key unchanged' : 'Please enter a key'); return; }
        if (/\s/.test(v) || v.length < 20) { PP.ui.toast('That doesn’t look like an API key'); return; }
        setKey(v);
        PP.ui.toast(v.startsWith('sk-ant-') ? 'Key saved' : 'Saved (unusual format – please check)');
        openSettings();
      } else if (a === 'run') { PP.ui.closeSheet(); run(); }
    });
  }

  PP.ai = { hasKey, enabled, openSettings, detectUnits, run,
    // exposed for tests
    _internal: { buildRequest, parseResponse, errorMessage, encodeImage, schema, prompt, loadSdk, makeClient, KEY, SDK_URL } };
})(window.PP);
