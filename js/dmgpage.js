// Polytopia Planner – damage calculator on /damage-calculator/ (uses js/data.js + js/engine.js, no screenshot).
// Pick units (they appear on a small low-poly battlefield), drag them around, tap your unit then an enemy to choose
// its target. The page works out who should attack whom and in which order ("Sort by"), with splash, explosions,
// retaliation by distance, the defense bonus of the tile and the tech it needs. "Custom" = your own attacks in order.
(function () {
  const E = PP.engine, U = PP.UNITS;
  const I = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = v => String(+(+v).toFixed(1));
  const N = 6;                                   // the board is N × N tiles
  // terrain: label, bonus, tech needed (defender's tribe); city bonus only for units with Fortify
  const KIND = { field: ['Field', 1, null], forest: ['Forest', 1.5, 'Archery'], mountain: ['Mountain', 1.5, 'Climbing'], water: ['Water', 1.5, 'Aquatism'], city: ['City', 1.5, null], wall: ['City wall', 4, null] };
  let uid = 0;
  const maxHp = u => E.maxHp(Object.assign({ carry: 'warrior' }, u));
  const mk = (side, type, c, r) => { const u = { id: ++uid, side, type, vet: false, c, r, tech: true, poison: false }; u.hp = maxHp(u); return u; };
  const st = {
    units: [],           // the page opens with an empty battlefield
    ter: { '3,2': 'forest', '0,4': 'water', '0,5': 'water', '1,5': 'water', '5,0': 'mountain', '5,1': 'mountain', '5,5': 'city' },
    side: 'att', tribe: 'standard', sel: null, picking: false,
    force: {},           // attacker id → defender id: "this unit attacks that one" (set by tapping)
    multi: [],           // more of your units picked with Shift (a tap on an enemy sends all of them)
    help: false,
    goal: 'kills',
    forder: [],          // the order in which you chose targets (Custom: the order of the attacks)
  };
  function setForce(aid, did) { st.force[aid] = did; st.forder = st.forder.filter(x => x !== aid).concat(aid); }
  function unForce(aid) { delete st.force[aid]; st.forder = st.forder.filter(x => x !== aid); }
  // what "best" means – the parts of the score in order of importance
  const GOALS = {
    custom: ['Custom', { kill: 1e12, lost: -1e8, dealt: 1e4, taken: -1, used: 1e6 }],
    kills: ['Most kills', { kill: 1e12, lost: -1e8, dealt: 1e4, taken: -1, used: 1e6 }],
    damage: ['Most damage', { dealt: 1e10, kill: 1e7, lost: -1e4, taken: -1, used: 1e5 }],
    safe: ['No own losses', { lost: -1e12, kill: 1e8, taken: -1e4, dealt: 1, used: 1e6 }],
    few: ['Fewest attacks', { kill: 1e12, used: -1e8, lost: -1e6, dealt: 1, taken: 0 }],
  };
  const FORCE = 1e14;    // a target you chose that is not attacked costs more than anything else is worth
  const terAt = (c, r) => st.ter[c + ',' + r] || 'field';
  const at = (c, r) => st.units.find(u => u.c === c && u.r === r);
  const atts = () => st.units.filter(u => u.side === 'att'), defs = () => st.units.filter(u => u.side === 'def');
  const dist = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
  // every unit that can fight may attack every enemy on the board (the distance only decides the strike back)
  const reaches = (a) => { const A = U[a.type]; return A.atk > 0 || A.convert || A.freeze; };
  function bonusOf(d, withTech) {
    const k = terAt(d.c, d.r), K = KIND[k]; let b = K[1];
    if (K[2] && !withTech) b = 1;
    if ((k === 'city' || k === 'wall') && !U[d.type].fort) b = 1;
    return b;
  }
  const A_ = a => ({ type: a.type, hp: a.hp, vet: a.vet, carry: 'warrior' });

  // ---------------------------------------------------------------- best plan (exact)
  // Every attacker attacks at most once, only targets it can reach. Per target: best order of any subset of the
  // attackers (memo over attackers left + target HP / poison / frozen); splash on the target's neighbours counts as
  // damage dealt. Then the attackers are split between the targets (all ways, DP over subsets).
  // Goal: most kills · fewest attackers lost · most damage dealt · least damage taken.
  const pc = m => { let c = 0; for (; m; m &= m - 1) c++; return c; };
  function solve(flipFor) {
    const A = atts(), D = defs(), n = A.length, full = (1 << n) - 1, W = GOALS[st.goal][1];
    const hs = D.map(d => {
      const Fk = A.reduce((m, a, i) => m | (st.force[a.id] === d.id ? 1 << i : 0), 0);
      // an attacker you sent to another target only attacks that one
      const b = bonusOf(d, flipFor === d.id ? !d.tech : d.tech), reach = A.reduce((m, a, i) => m | (reaches(a, d) && (st.force[a.id] == null || st.force[a.id] === d.id) ? 1 << i : 0), 0);
      const sv = A.map(a => {
        const T = U[a.type]; if (!T.splash && !T.explode) return 0;
        if (T.splash && T.poison && !T.explode) return 0;
        let t = 0;
        D.forEach(o => { if (o !== d && dist(o, d) === 1) t += Math.round(Math.min(o.hp, E.splash(A_(a), { type: o.type, hp: o.hp, vet: o.vet, bonus: bonusOf(o, o.tech), poison: o.poison, carry: 'warrior' })) * 2) * W.dealt; });
        return t;
      });
      const memo = new Map(), am = new Map();
      const hit = (i, hp, p, f) => { const k = i + '|' + hp + '|' + +p + +f; let r = am.get(k); if (!r) { r = E.attack(A_(A[i]), { type: d.type, hp, vet: d.vet, bonus: b, poison: p, frozen: f, carry: 'warrior' }, dist(A[i], d), {}); am.set(k, r); } return r; };
      const h = (mask, hp, p, f) => {
        const key = mask + '|' + hp + '|' + +p + +f; let best = memo.get(key); if (best) return best;
        best = { v: -FORCE * pc(mask & Fk), i: -1 };   // stopping here: the chosen attackers still left are missing
        if (hp > 0) for (let i = 0; i < n; i++) if (mask & reach & (1 << i)) {
          const a = A[i], r = hit(i, hp, p, f), kill = r.defHp <= 0 || !!r.convert, nhp = kill ? 0 : r.defHp, np = p || !!r.poison, nf = f || !!r.freeze;
          const step = (kill ? W.kill : 0) + (r.attHp <= 0 ? W.lost : 0) + Math.round((hp - nhp) * 2) * W.dealt + Math.round((a.hp - r.attHp) * 2) * W.taken + W.used + (r.freeze || r.convert ? 0 : sv[i]);
          const rest = mask & ~(1 << i), v = step + (kill ? -FORCE * pc(rest & Fk) : h(rest, nhp, np, nf).v);
          if (v > best.v) best = { v, i, r, kill, nhp, np, nf };
        }
        memo.set(key, best); return best;
      };
      return { d, b, h, g: S => h(S, d.hp, !!d.poison, false).v - FORCE * pc(Fk & ~S) };
    });
    const M = D.length, G = hs.map(H => { const t = new Float64Array(full + 1); for (let S = 0; S <= full; S++) t[S] = H.g(S); return t; });
    const dp = Array.from({ length: M + 1 }, () => new Float64Array(full + 1)), ch = Array.from({ length: M }, () => new Int32Array(full + 1));
    for (let k = M - 1; k >= 0; k--) for (let av = 0; av <= full; av++) {
      let bv = -Infinity, bs = 0;
      for (let S = av; ; S = (S - 1) & av) { const v = G[k][S] + dp[k + 1][av & ~S]; if (v > bv) { bv = v; bs = S; } if (S === 0) break; }
      dp[k][av] = bv; ch[k][av] = bs;
    }
    let avail = full; const plan = [];
    hs.forEach((H, k) => {
      const S = ch[k][avail]; avail &= ~S;
      const seq = []; let mask = S, hp = H.d.hp, p = !!H.d.poison, f = false;
      for (;;) { const s = H.h(mask, hp, p, f); if (s.i < 0) break; seq.push(A[s.i]); if (s.kill) break; mask &= ~(1 << s.i); hp = s.nhp; p = s.np; f = s.nf; }
      plan.push({ d: H.d, b: H.b, seq });
    });
    const used = new Set(); plan.forEach(o => o.seq.forEach(a => used.add(a.id)));
    return { plan, idle: A.filter(a => !used.has(a.id)) };
  }
  // The attacks played through one after the other: splash / explosions hit the target's neighbours and can kill them.
  // An attack whose target is already dead goes to the best other enemy still alive (not if you chose that target).
  // → { S: per defender, steps, v: score for the chosen goal }
  function simulate(list, flipFor) {
    const W = GOALS[st.goal][1], D = defs(), bOf = d => bonusOf(d, flipFor === d.id ? !d.tech : d.tech);
    const S = new Map(D.map(d => [d.id, { hp: d.hp, poison: d.poison, frozen: false, dead: false, dmg: 0, sp: 0, n: [] }]));
    const steps = []; let n = 0, v = 0;
    const tryHit = (a, d) => { const T = S.get(d.id); return E.attack(A_(a), { type: d.type, hp: T.hp, vet: d.vet, bonus: bOf(d), poison: T.poison, frozen: T.frozen, carry: 'warrior' }, dist(a, d), {}); };
    const val = (a, d, r) => { const T = S.get(d.id), kill = r.defHp <= 0 || r.convert; return (kill ? W.kill : 0) + (r.attHp <= 0 ? W.lost : 0) + Math.round((T.hp - (kill ? 0 : r.defHp)) * 2) * W.dealt + Math.round((a.hp - r.attHp) * 2) * W.taken + W.used; };
    list.forEach(({ a, d: d0 }) => {
      let d = d0;
      if (S.get(d.id).dead) {
        if (st.force[a.id] != null) return;
        let best = null, bv = 0;
        D.forEach(o => { if (S.get(o.id).dead) return; const r = tryHit(a, o), x = val(a, o, r); if (x > bv) { bv = x; best = o; } });
        if (!best) return; d = best;
      }
      const T = S.get(d.id), AU = U[a.type], before = T.hp, r = tryHit(a, d);
      v += val(a, d, r);
      n++; T.n.push(n); T.dmg += before - r.defHp; T.hp = r.defHp;
      if (r.poison) T.poison = true; if (r.freeze) T.frozen = true; if (r.defHp <= 0 || r.convert) { T.dead = true; }
      const fx = [];
      if ((AU.splash && !r.freeze && !r.convert) || r.explode) D.forEach(o => {
        if (o === d || dist(o, d) !== 1) return; const O = S.get(o.id); if (O.dead) return;
        if (AU.splash && AU.poison && !r.explode) { if (!O.poison) { O.poison = true; O.sp = O.sp || 1e-6; fx.push({ o, dmg: 0, poison: true }); } return; }
        const dm = E.splash(A_(a), { type: o.type, hp: O.hp, vet: o.vet, bonus: bOf(o), poison: O.poison, carry: 'warrior' }), b0 = O.hp;
        v += Math.round(Math.min(dm, O.hp) * 2) * W.dealt;
        O.hp = Math.max(0, O.hp - dm); O.sp += dm; if (r.explode) O.poison = true;
        if (O.hp <= 0) { O.dead = true; v += W.kill; }
        fx.push({ o, dmg: dm, before: b0, kill: O.hp <= 0, poison: !!r.explode });
      });
      steps.push({ a, d, r, before, n, fx });
    });
    return { S, steps, v };
  }
  // The best order of all attacks (also between the enemies – e.g. splash first): every order up to 7 attacks,
  // above that a few good candidates (the plan as it is, splash / explosions first, each enemy's attacks together).
  function bestRun(R, flipFor) {
    const list = []; R.plan.forEach(p => p.seq.forEach(a => list.push({ a, d: p.d })));
    let best = simulate(list, flipFor), bestL = list;
    const tryL = L => { const r = simulate(L, flipFor); if (r.v > best.v + 1e-9) { best = r; bestL = L; } };
    if (list.length <= 7) {
      (function perm(pre, rest) {
        if (!rest.length) { tryL(pre); return; }
        for (let i = 0; i < rest.length; i++) perm(pre.concat([rest[i]]), rest.slice(0, i).concat(rest.slice(i + 1)));
      })([], list);
    } else {
      const sp = x => (U[x.a.type].splash || U[x.a.type].explode ? 0 : 1);
      tryL(list.slice().sort((x, y) => sp(x) - sp(y)));
      for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) if (i !== j) { const L = list.slice(), [m] = L.splice(i, 1); L.splice(j, 0, m); tryL(L); }
    }
    best.order = bestL;
    return best;
  }
  // solved once per state (dragging redraws the board many times)
  let cacheK = '', cacheV = null;
  function result() {
    const k = JSON.stringify([st.units.map(u => [u.id, u.side, u.type, u.hp, u.vet, u.c, u.r, u.tech, u.poison]), st.ter, st.force, st.forder, st.goal]);
    if (k !== cacheK) {
      if (st.goal === 'custom') {
        const by = id => st.units.find(x => x.id === id);
        cacheV = { R: { plan: [] }, sim: simulate(st.forder.map(id => ({ a: by(id), d: by(st.force[id]) })).filter(x => x.a && x.d)) };
      } else { const R = solve(); cacheV = { R, sim: bestRun(R) }; }
      cacheK = k;
    }
    return cacheV;
  }

  // ---------------------------------------------------------------- board drawing
  const TW = 92, TH = 53, X0 = N * TW / 2, Y0 = 50;
  const pos = (c, r) => [X0 + (c - r) * TW / 2, Y0 + (c + r) * TH / 2];
  const TCOL = { field: ['#86d65a', '#5fae3d', '#6fc049'], forest: ['#6cc54a', '#4c9a33', '#5aaf3f'], mountain: ['#b9c0c8', '#8e97a2', '#a3abb5'],
    water: ['#5fc9f0', '#3a9fd0', '#4bb4e2'], city: ['#ead2a2', '#c6a671', '#d7bb88'], wall: ['#d9c4a0', '#a88d63', '#bfa57c'] };
  const abbr = t => { const w = U[t].name.replace(/[^A-Za-z ]/g, '').split(' '); return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase(); };
  function drawBoard(sim) {
    let g = '', mid = '', top = '';
    const tiles = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) tiles.push([c, r]);
    tiles.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    for (const [c, r] of tiles) {
      const [x, y] = pos(c, r), k = terAt(c, r), C = TCOL[k], dz = k === 'water' ? 3 : 0, yy = y + dz, side = 8 - dz;
      g += `<g data-tile="${c},${r}"><path d="M${x - TW / 2} ${yy}L${x} ${yy + TH / 2}V${yy + TH / 2 + side}L${x - TW / 2} ${yy + side}Z" fill="${C[2]}"/>` +
        `<path d="M${x + TW / 2} ${yy}L${x} ${yy + TH / 2}V${yy + TH / 2 + side}L${x + TW / 2} ${yy + side}Z" fill="${C[1]}"/>` +
        `<path d="M${x} ${yy - TH / 2}L${x + TW / 2} ${yy}L${x} ${yy + TH / 2}L${x - TW / 2} ${yy}Z" fill="${C[0]}" stroke="rgba(0,0,0,.08)"/>`;
      if (k === 'forest') g += `<path d="M${x - 24} ${yy + 3}l7-17 7 17Z M${x + 14} ${yy - 1}l7-17 7 17Z M${x - 6} ${yy + 12}l6-14 6 14Z" fill="#2f8a3a"/>`;
      if (k === 'mountain') g += `<path d="M${x - 18} ${yy + 6}l18-30 18 30Z" fill="#9aa3ad"/><path d="M${x} ${yy - 24}l-6 10 6-2 6 2Z" fill="#fff"/>`;
      if (k === 'city' || k === 'wall') g += `<path d="M${x + 8} ${yy + 2}v-11h16v11Z" fill="#fff"/><path d="M${x + 6} ${yy - 9}l10-8 10 8Z" fill="#f4b53f"/>`;
      if (k === 'wall') g += `<path d="M${x - TW / 2 + 6} ${yy + 1}L${x} ${yy + TH / 2 - 3}L${x + TW / 2 - 6} ${yy + 1}" fill="none" stroke="#8a6e48" stroke-width="3.5" stroke-dasharray="6 3"/>`;
      g += '</g>';
      const u = at(c, r); if (!u) continue;
      const S = u.side === 'def' ? sim.S.get(u.id) : null, dead = S && S.dead, ty = yy - 12, sel = st.sel === u.id || st.multi.indexOf(u.id) >= 0;
      if (S && S.sp > 0) mid += `<path d="M${x} ${yy - TH / 2 - 3}L${x + TW / 2 + 5} ${yy}L${x} ${yy + TH / 2 + 3}L${x - TW / 2 - 5} ${yy}Z" fill="none" stroke="#f08a24" stroke-width="2.5" stroke-dasharray="6 4"/>`;
      const col = u.side === 'att' ? '#3a93ee' : '#e2477c', hp = S ? Math.max(0, S.hp) : u.hp;
      mid += `<g data-unit="${u.id}" style="cursor:grab;opacity:${dead ? .45 : 1}">` +
        (sel ? `<circle cx="${x}" cy="${ty}" r="27" fill="none" stroke="#ffd84a" stroke-width="4"/>` : '') +
        `<circle cx="${x}" cy="${ty}" r="21" fill="${col}" stroke="#fff" stroke-width="3"/><text x="${x}" y="${ty + 6}" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">${abbr(u.type)}</text>` +
        (u.vet ? `<circle cx="${x - 16}" cy="${ty - 14}" r="6" fill="#f4b53f" stroke="#fff" stroke-width="1.5"/>` : '') +
        `<circle cx="${x + 22}" cy="${ty - 18}" r="12" fill="#fff" stroke="#1c2633" stroke-width="1.5"/><text x="${x + 22}" y="${ty - 13.5}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1c2633">${fmt(hp)}</text>` +
        (dead ? `<path d="M${x - 9} ${ty - 9}l18 18M${x + 9} ${ty - 9}l-18 18" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>` : '') + '</g>';
      if (S) {
        const pills = []; if (S.dmg > 0) pills.push(['#e2477c', '−' + fmt(S.dmg)]); if (S.sp > 0.01) pills.push(['#f08a24', '✸ −' + fmt(S.sp)]); else if (S.sp > 0) pills.push(['#f08a24', '✸ poison']);
        if (pills.length) {
          const ws = pills.map(p => 12 + 7.4 * p[1].length), tw = ws.reduce((t, w) => t + w, 0) + 4 * (pills.length - 1); let px = x - tw / 2;
          pills.forEach((p, i) => { top += `<rect x="${px}" y="${ty + 19}" width="${ws[i]}" height="19" rx="9.5" fill="${p[0]}" stroke="#fff" stroke-width="1.5"/><text x="${px + ws[i] / 2}" y="${ty + 33}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${p[1]}</text>`; px += ws[i] + 4; });
        }
      }
    }
    // arrows: who attacks whom, numbered in order
    sim.steps.forEach(s => {
      const [ax, ay] = pos(s.a.c, s.a.r), [dx, dy] = pos(s.d.c, s.d.r), x1 = ax, y1 = ay - 12, x2 = dx, y2 = dy - 12;
      const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, sx = x1 + ux * 25, sy = y1 + uy * 25, ex = x2 - ux * 29, ey = y2 - uy * 29, mx = sx + (ex - sx) * .3, my = sy + (ey - sy) * .3;
      const fc = st.force[s.a.id] === s.d.id ? '#ffd84a' : '#fff';   // yellow: a target you chose
      top += `<path d="M${sx} ${sy}L${ex} ${ey}" stroke="#1c2633" stroke-width="6" stroke-linecap="round" opacity=".35"/><path d="M${sx} ${sy}L${ex} ${ey}" stroke="${fc}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M${ex + ux * 6} ${ey + uy * 6}L${ex - ux * 6 - uy * 6} ${ey - uy * 6 + ux * 6}L${ex - ux * 6 + uy * 6} ${ey - uy * 6 - ux * 6}Z" fill="${fc}" stroke="#1c2633" stroke-width="1"/>` +
        `<circle cx="${mx}" cy="${my}" r="11" fill="#3a93ee" stroke="#fff" stroke-width="2"/><text x="${mx}" y="${my + 4.5}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff">${s.n}</text>`;
    });
    if (drag && drag.moved) { const [x, y] = drag.pt; top += `<circle cx="${x}" cy="${y}" r="19" fill="${drag.u.side === 'att' ? '#3a93ee' : '#e2477c'}" stroke="#ffd84a" stroke-width="3.5" opacity=".9"/>`; }
    return `<svg viewBox="0 ${Y0 - TH / 2 - 40} ${N * TW} ${N * TH + 60}" id="bsvg">${g}${mid}${top}</svg><div class="toast" id="toast"></div>`;
  }

  // ---------------------------------------------------------------- panel
  function editPanel() {
    const u = st.units.find(x => x.id === st.sel), group = picked();
    if (group.length > 1) {
      const t0 = st.force[group[0].id], same = group.every(a => st.force[a.id] === t0);
      return `<div class="edit"><div class="eh"><span class="dot" style="background:var(--att)"></span><b>${group.length} units</b><small>${group.map(a => esc(U[a.type].name)).join(', ')}</small></div>` +
        `<label class="fld"><span>Target</span><select data-target-all><option value="">${same && t0 == null ? 'Best (automatic)' : same ? 'Best (automatic)' : 'mixed'}</option>${defs().map(d => `<option value="${d.id}"${same && t0 === d.id ? ' selected' : ''}>${esc(U[d.type].name)}</option>`).join('')}</select></label>` +
        '<div class="hint" style="text-align:left;margin:4px 2px 0">or tap an enemy on the board</div></div>';
    }
    if (!st.units.length) return '<div class="hint">Tap a unit above – it appears on the battlefield</div>';
    if (!u) return `<div class="hint">Drag to move · tap your unit, then an enemy, to ${st.goal === 'custom' ? 'add an attack' : 'choose its target'}</div>`;
    const m = maxHp(u), f = u.hp / m, cls = f <= .3 ? 'crit' : f <= .6 ? 'low' : '', isDef = u.side === 'def';
    let h = `<div class="edit"><div class="eh"><span class="dot" style="background:${isDef ? 'var(--def)' : 'var(--att)'}"></span><b>${esc(U[u.type].name)}</b><small>${isDef ? 'defender' : 'attacker'}</small>` +
      `<button class="round" data-act="change" title="Change unit">⇄</button><button class="round${u.vet ? ' on' : ''}" data-act="vet" ${U[u.type].noVet ? 'disabled' : ''} title="Veteran">Vet</button><button class="round" data-act="del" title="Remove">✕</button></div>`;
    if (st.picking) { const T = PP.TRIBES.find(t => t.id === st.tribe) || PP.TRIBES[0]; h += `<div class="pick">${T.units.filter(k => U[k]).map(k => `<button data-to="${k}" class="${k === u.type ? 'on' : ''}">${esc(U[k].name)}</button>`).join('')}</div>`; }
    h += `<div class="hp"><span class="val">${fmt(u.hp)}</span><button class="step" data-act="hp-">−</button><div class="bar ${cls}" data-bar><div class="fill" style="width:${100 * f}%"></div></div><button class="step" data-act="hp+">+</button></div>`;
    if (isDef) {
      // the bonus comes from the tile it stands on; the menu changes that tile
      const k = terAt(u.c, u.r), K = KIND[k];
      h += `<label class="fld"><span>Defense bonus <button class="qm" data-act2="help" aria-label="What is the defense bonus?" aria-expanded="${st.help}">?</button></span><select data-dbonus>${Object.keys(KIND).map(q => `<option value="${q}"${q === k ? ' selected' : ''}>${q === 'field' ? 'None' : KIND[q][0]} ×${KIND[q][1]}</option>`).join('')}</select></label><div class="flags">` +
        (K[2] ? `<button class="ck${u.tech ? ' on' : ''}" data-act="tech"><s>${u.tech ? I('check') : ''}</s>Has ${K[2]}</button>` : '') +
        `<button class="ck${u.poison ? ' on' : ''}" data-act="poison"><s>${u.poison ? I('check') : ''}</s>Poisoned</button></div>`;
      if (st.help) h += '<div class="help">The defender takes less damage depending on the tile it stands on.<br>' +
        '<b>Forest, Mountain, Water ×1.5</b> – only if its tribe has Archery, Climbing or Aquatism.<br>' +
        '<b>City ×1.5, City wall ×4</b> – only units that can fortify (e.g. Warrior, Archer, Defender).<br>Poisoned halves the bonus.</div>';
    } else {
      const tg = defs();
      h += `<label class="fld"><span>Target</span><select data-target><option value="">Best (automatic)</option>${tg.map(d => `<option value="${d.id}"${st.force[u.id] === d.id ? ' selected' : ''}>${esc(U[d.type].name)}</option>`).join('')}</select></label>` +
        `<div class="hint" style="text-align:left;margin:4px 2px 0">or tap an enemy on the board · Shift: pick more units</div>`;
    }
    return h + '</div>';
  }
  function render() {
    const { R, sim } = result(), T = PP.TRIBES.find(t => t.id === st.tribe) || PP.TRIBES[0];
    let h = `<div class="addbar"><div class="seg"><button class="att${st.side === 'att' ? ' on' : ''}" data-side="att">Attacker</button><button class="def${st.side === 'def' ? ' on' : ''}" data-side="def">Defender</button></div>` +
      `<select class="tribe" data-tribe>${PP.TRIBES.map(t => `<option value="${t.id}"${t.id === T.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>`;
    h += `<div class="ubox"><div class="units ${st.side}" id="units">${T.units.filter(k => U[k]).map(k => `<button data-add="${k}"><b>${esc(U[k].name)}</b><small>${U[k].atk}/${U[k].def}${U[k].hp ? ' · ' + U[k].hp : ''}</small></button>`).join('')}</div>` +
      '<button class="sc l" data-scroll="-1" aria-label="scroll left">‹</button><button class="sc r" data-scroll="1" aria-label="scroll right">›</button></div>';
    h += `<div class="board">${drawBoard(sim)}</div>`;
    h += editPanel();
    // result: "Sort by" (Custom = your own attacks in your order) and the attack order – nothing else
    h += `<div class="res"><label class="goal"><span>Sort by</span><select data-goal>${Object.keys(GOALS).map(g => `<option value="${g}"${g === st.goal ? ' selected' : ''}>${GOALS[g][0]}</option>`).join('')}</select>` +
      (Object.keys(st.force).length ? `<button class="lnk" data-act2="clearforce">${st.goal === 'custom' ? 'clear attacks' : 'reset chosen targets'}</button>` : '') + '</label>';
    const D = defs(), A = atts();
    if (!D.length || !A.length) h += `<div class="idle">Add ${!A.length ? 'an attacker' : 'a defender'} to see the fight.</div>`;
    else if (!sim.steps.length) h += `<div class="idle">${st.goal === 'custom' ? 'Tap your unit, then an enemy, to add an attack.' : 'No attack helps here.'}</div>`;
    else {
      // your attacks in order: a killed enemy is struck through; so is your unit if the strike back kills it
      h += '<div class="ord"><div class="oh">Your attack order</div>' + sim.steps.map(s => {
        const kill = s.r.defHp <= 0 || s.r.convert, dies = s.r.attHp <= 0;
        return `<div class="os"><em>${s.n}</em><span class="who${dies ? ' k' : ''}">${esc(U[s.a.type].name)}</span><span class="to">→</span><span class="tgt2${kill ? ' k' : ''}">${esc(U[s.d.type].name)}</span>` +
          `<span class="res2">${s.r.freeze ? 'frozen' : s.r.convert ? 'converted' : `<small>${fmt(s.before)} →</small> ${fmt(Math.max(0, s.r.defHp))}`}${s.r.ret ? `<small class="rt"> ↩ ${s.r.ret}</small>` : ''}</span>` +
          (s.fx.length ? `<span class="spx">✸ ${s.fx.map(f => `<span class="${f.kill ? 'k' : ''}">${esc(U[f.o.type].name)}</span>${f.dmg ? ` ${fmt(f.before)} → ${fmt(Math.max(0, f.before - f.dmg))}` : ' poison'}`).join(', ')}</span>` : '') + '</div>';
      }).join('') + '</div>';
    }
    h += '<a class="go" href="/?tool=units">Use your own screenshot →</a></div>';
    const sl = root.querySelector('#units'), sx = sl ? sl.scrollLeft : 0;
    root.innerHTML = h;
    const nl = root.querySelector('#units'); if (nl) { nl.scrollLeft = sx; moreHint(nl); }
    // "Defense bonus activated": a defender now gets a bonus it did not have before (moved onto it, or the menu)
    const now = {}; let on = null;
    defs().forEach(d => { const b = bonusOf(d, d.tech); now[d.id] = b; if (b > 1 && prevB[d.id] != null && prevB[d.id] <= 1) on = [d, b]; });
    prevB = now;
    if (on) toast(`Defense bonus activated · ${esc(U[on[0].type].name)} ×${on[1]}`);
  }
  let prevB = {};
  function toast(msg) {
    const el = root.querySelector('#toast'); if (!el) return;
    el.innerHTML = msg; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  // the unit list scrolls sideways: a fade + arrow on the side where there is more
  function moreHint(el) {
    const upd = () => { el.parentNode.classList.toggle('more-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 4); el.parentNode.classList.toggle('more-l', el.scrollLeft > 4); };
    el.onscroll = upd; upd();
  }

  // ---------------------------------------------------------------- input
  const root = document.getElementById('calc'), sel = () => st.units.find(x => x.id === st.sel);
  const picked = () => [st.sel].concat(st.multi).map(id => st.units.find(x => x.id === id)).filter(Boolean);
  // a free tile near the side's corner: attackers bottom left, defenders top right
  function freeNear(side) {
    const [c0, r0] = side === 'att' ? [1, 4] : [4, 1]; let best = null, bd = 99;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (at(c, r)) continue; const dd = Math.hypot(c - c0, r - r0); if (dd < bd) { bd = dd; best = [c, r]; } }
    return best;
  }
  root.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return; const ds = b.dataset, u = sel();
    if (ds.scroll) { const l = root.querySelector('#units'); l.scrollBy({ left: +ds.scroll * l.clientWidth * .8, behavior: 'smooth' }); return; }
    if (ds.act2 === 'help') { ev.preventDefault(); st.help = !st.help; }
    else if (ds.act2 === 'clearforce') { st.force = {}; st.forder = []; }
    else if (ds.side) st.side = ds.side;
    else if (ds.add) { const p = freeNear(st.side); if (!p) return; const n = mk(st.side, ds.add, p[0], p[1]); st.units.push(n); st.sel = n.id; st.picking = false; }
    else if (ds.to && u) { u.type = ds.to; if (U[ds.to].noVet) u.vet = false; u.hp = maxHp(u); st.picking = false; }
    else if (ds.ter && u) st.ter[u.c + ',' + u.r] = ds.ter;
    else if (ds.act && u) {
      const a = ds.act, m = maxHp(u);
      if (a === 'change') st.picking = !st.picking;
      else if (a === 'vet') { const full = u.hp >= m; u.vet = !u.vet; u.hp = full ? maxHp(u) : Math.min(u.hp, maxHp(u)); }
      else if (a === 'del') { st.units = st.units.filter(x => x !== u); st.sel = null; for (const k in st.force) if (+k === u.id || st.force[k] === u.id) unForce(+k); }
      else if (a === 'hp-') u.hp = Math.max(1, Math.round(u.hp) - 1);
      else if (a === 'hp+') u.hp = Math.min(m, Math.round(u.hp) + 1);
      else if (a === 'tech') u.tech = !u.tech;
      else if (a === 'poison') u.poison = !u.poison;
    } else return;
    render();
  });
  root.addEventListener('change', ev => {
    const t = ev.target, u = sel();
    if (t.matches('[data-tribe]')) st.tribe = t.value;
    else if (t.matches('[data-goal]')) st.goal = t.value;
    else if (t.matches('[data-dbonus]') && u) st.ter[u.c + ',' + u.r] = t.value;
    else if (t.matches('[data-target]') && u) { if (t.value) setForce(u.id, +t.value); else unForce(u.id); }
    else if (t.matches('[data-target-all]')) picked().forEach(a => { if (t.value) setForce(a.id, +t.value); else unForce(a.id); });
    else return;
    render();
  });
  // board: drag a unit to another tile (onto another unit: they swap); a tap selects it; a tap on empty ground clears
  let drag = null, hpDrag = null, rT = 0;
  const svgPt = (ev) => { const svg = root.querySelector('#bsvg'), p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  const tileAt = (x, y) => { const a = (x - X0) / (TW / 2), b = (y - Y0) / (TH / 2); const c = Math.round((a + b) / 2), r = Math.round((b - a) / 2); return c >= 0 && r >= 0 && c < N && r < N ? [c, r] : null; };
  root.addEventListener('pointerdown', ev => {
    const bar = ev.target.closest('[data-bar]');
    if (bar) { ev.preventDefault(); hpDrag = bar; setHp(ev); return; }
    const g = ev.target.closest('[data-unit]');
    if (g) { ev.preventDefault(); drag = { u: st.units.find(x => x.id === +g.dataset.unit), x: ev.clientX, y: ev.clientY, moved: false, pt: svgPt(ev) }; return; }
    if (ev.target.closest('[data-tile]')) { st.sel = null; st.multi = []; st.picking = false; render(); }
  });
  window.addEventListener('pointermove', ev => {
    if (hpDrag) { setHp(ev); return; }
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 6) return;
    drag.moved = true; drag.pt = svgPt(ev); root.querySelector('.board').innerHTML = drawBoard(result().sim);
  });
  window.addEventListener('pointerup', ev => {
    if (hpDrag) { hpDrag = null; clearTimeout(rT); render(); return; }
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) {
      const s0 = sel(), group = picked();
      // Shift + tap on your units: pick several
      if (ev.shiftKey && d.u.side === 'att') {
        if (!s0 || s0.side !== 'att') { st.sel = d.u.id; st.multi = []; }
        else if (d.u.id === st.sel) { st.sel = st.multi.shift() || null; }
        else { const i = st.multi.indexOf(d.u.id); if (i >= 0) st.multi.splice(i, 1); else st.multi.push(d.u.id); }
        st.picking = false; render(); return;
      }
      // your unit(s) picked, then an enemy: they attack it (the same again: automatic again)
      if (group.length && group[0].side === 'att' && d.u.side === 'def') {
        const fit = group.filter(a => reaches(a));
        if (fit.every(a => st.force[a.id] === d.u.id)) { fit.forEach(a => unForce(a.id)); render(); toast(st.goal === 'custom' ? 'Attack removed' : 'Target automatic again'); return; }
        fit.forEach(a => setForce(a.id, d.u.id));
        render(); toast(`${fit.length > 1 ? fit.length + ' units attack' : esc(U[fit[0].type].name) + ' attacks'} ${esc(U[d.u.type].name)}`); return;
      }
      st.multi = []; st.sel = st.sel === d.u.id ? null : d.u.id; st.picking = false; render(); return;
    }
    const t = tileAt(...svgPt(ev));
    if (t) {
      const o = at(t[0], t[1]); if (o && o !== d.u) { o.c = d.u.c; o.r = d.u.r; } d.u.c = t[0]; d.u.r = t[1]; st.sel = d.u.id;
      for (const k in st.force) { const a = st.units.find(x => x.id === +k), df = st.units.find(x => x.id === st.force[k]); if (!a || !df) unForce(+k); }
    }
    render();
  });
  function setHp(ev) {
    const u = sel(); if (!u) return; const r = hpDrag.getBoundingClientRect(), m = maxHp(u);
    const v = Math.max(1, Math.min(m, Math.ceil((ev.clientX - r.left) / r.width * m))); if (v === u.hp) return;
    u.hp = v; const f = v / m; hpDrag.querySelector('.fill').style.width = 100 * f + '%'; hpDrag.classList.toggle('crit', f <= .3); hpDrag.classList.toggle('low', f > .3 && f <= .6);
    hpDrag.parentNode.querySelector('.val').textContent = fmt(v);
    clearTimeout(rT); rT = setTimeout(() => { root.querySelector('.board').innerHTML = drawBoard(result().sim); }, 80);
  }
  render();
})();
