// Polytopia Planner – Market planner as a mixed-integer linear program (v29).
// Same rules as the branch & bound search in market.js (PP.market.prepare), but solved by HiGHS (MIT, WebAssembly),
// which PROVES optimality for any number of cities. Pure logic, no DOM: build(P, spec) → { lp, decode(columns) }.
//
// Variables (all binary unless noted):
//   s{k}_{T}_keep / _dest / _n{x}  the slot of city k for unique building T (market / windmill / forge / sawmill):
//                                   keep what is there, destroy it, or build new on tile x (exactly one)
//   p{t}_{X}                        new producer X (farm / mine / lumber) on tile t
//   L{y}_{T}  (continuous 0…8)      level of a workshop of type T on tile y (0 if there is none)
//   I{x}      (continuous 0…8)      income of a Market on tile x (0 if there is none)
// Income:   I_x ≤ 8·[Market on x],  I_x ≤ Σ_{y next to x} Σ_T L_{y,T}
// Level:    L_{y,T} ≤ 8·[workshop T on y],  L_{y,T} ≤ Σ_{t next to y} [producer PROD[T] on t]
// Producer on t (final): new p_{t,X}, or the existing one if nothing else is built there.
// Objective stages (spec.mode): 'income' max Σ I; 'cost' min cost·1000 + actions (with Σ I ≥ spec.minIncome);
// 'steps' min actions·1000 + cost; 'ratio' min (cost·1000 + actions) − λ·1000·Σ I (Dinkelbach, fastest payback).
(function (root) { root.PP = root.PP || {}; })(typeof window !== 'undefined' ? window : globalThis);
(function (PP) {
  'use strict';
  const CAP = 8, WS = ['windmill', 'forge', 'sawmill'], UNIQUE = ['market', 'windmill', 'forge', 'sawmill'];
  const PROD = { windmill: 'farm', forge: 'mine', sawmill: 'lumber' }, PRODS = ['farm', 'mine', 'lumber'];
  const SCALE = 1000; // cost·SCALE + actions (actions < SCALE)

  function build(P, spec) {
    spec = spec || {};
    const { cells, nb, cities, owner, dOK, pField, pProd, canAct, E, fixedU, C, o } = P;
    const K = cities.length, n = cells.length;
    const isU = i => UNIQUE.indexOf(cells[i].bld) >= 0;
    const vars = []; // { name, kind, k, T, x, t, X, cost, act }
    const bin = [], cont = [];
    const add = v => { vars.push(v); (v.cont ? cont : bin).push(v.name); return v; };

    // ---------------------------------------------------------------- slots
    const slots = []; // { k, T, opts: [var] }
    const uniqueAt = Array.from({ length: n }, () => []); // tile → [{ var, T }] (new or kept unique building)
    for (let k = 0; k < K; k++) for (const T of UNIQUE) {
      const Ek = E[k][T], allD = Ek.every(i => dOK[i]), opts = [];
      const keep = add({ name: `s${k}_${T}_keep`, kind: 'keep', k, T, cost: 0, act: 0 });
      opts.push(keep);
      Ek.forEach(i => uniqueAt[i].push({ v: keep, T }));
      if (allD && Ek.length) opts.push(add({ name: `s${k}_${T}_dest`, kind: 'destroy', k, T, cost: Ek.length * C.destroy, act: Ek.length }));
      const allowNew = allD && (T === 'market' ? o.market !== false : o[T]);
      if (allowNew) for (const x of P.terrTiles[k]) {
        if (Ek.indexOf(x) >= 0 || !pField[x]) continue;
        if (cells[x].noWs && cells[x].noWs.indexOf(T) >= 0) continue; // Border Growth ring: no new workshop of this type
        const b = cells[x].bld;
        if (b && !dOK[x]) continue;
        if (T !== 'market' && !nb[x].some(t => P.canProd[t][PROD[T]])) continue; // a workshop that can never have a level
        const extra = b && !isU(x) ? 1 : 0;
        const v = add({ name: `s${k}_${T}_n${x}`, kind: 'new', k, T, x,
          cost: (Ek.length + extra) * C.destroy + pField[x].cost + C[T], act: Ek.length + extra + pField[x].act + 1 });
        opts.push(v); uniqueAt[x].push({ v, T });
      }
      slots.push({ k, T, opts });
    }
    // ---------------------------------------------------------------- producers
    const prodAt = Array.from({ length: n }, () => []); // tile → [var]
    for (let t = 0; t < n; t++) {
      if (!canAct[t]) continue;
      const b = cells[t].bld;
      for (const X of PRODS) {
        if (!pProd[t][X] || X === b) continue;
        if (b && !isU(t) && !dOK[t]) continue; // a unique building there is freed by its own slot
        const extra = b && !isU(t) ? 1 : 0;
        prodAt[t].push(add({ name: `p${t}_${X}`, kind: 'prod', t, X, cost: pProd[t][X].cost + extra * C.destroy, act: pProd[t][X].act + extra }));
      }
    }
    // ---------------------------------------------------------------- linear expressions
    const rows = [];
    const term = (c, v) => (c === 1 ? ' + ' : c === -1 ? ' - ' : (c >= 0 ? ' + ' : ' - ') + Math.abs(c) + ' ') + v;
    const row = (name, terms, op, rhs) => {
      if (!terms.length) { if ((op === '<=' && 0 > rhs) || (op === '>=' && 0 < rhs) || (op === '=' && rhs !== 0)) rows.push(`${name}: 0 x_zero ${op} ${rhs}`); return; }
      rows.push(`${name}:` + terms.map(([c, v]) => term(c, v)).join('') + ` ${op} ${rhs}`);
    };
    // exactly one option per slot
    slots.forEach((s, q) => row(`one${q}`, s.opts.map(v => [1, v.name]), '=', 1));
    // a tile holds at most one building: uniques (new or kept) + new producers
    for (let t = 0; t < n; t++) {
      const ts = uniqueAt[t].map(u => [1, u.v.name]).concat(prodAt[t].map(v => [1, v.name]));
      if (ts.length > 1) row(`tile${t}`, ts, '<=', 1);
    }
    // final producer X on t as an expression: new p_{t,X}, or the existing producer unless something replaces it
    const finalProd = (t, X) => {
      const ts = prodAt[t].filter(v => v.X === X).map(v => [1, v.name]);
      let c0 = 0;
      if (cells[t].bld === X) { c0 = 1; prodAt[t].forEach(v => ts.push([-1, v.name])); uniqueAt[t].forEach(u => { if (u.v.kind === 'new') ts.push([-1, u.v.name]); }); }
      return { ts, c0 };
    };
    // workshop T on y / Market on x (expressions incl. constants for fixed buildings outside the territories)
    const fixedAt = new Map(fixedU.map(f => [f.i, f.T]));
    const present = (y, T) => {
      const ts = uniqueAt[y].filter(u => u.T === T).map(u => [1, u.v.name]);
      return { ts, c0: fixedAt.get(y) === T ? 1 : 0 };
    };
    const levelVars = new Map(); // 'y,T' → name
    const zOf = new Map();       // 't,y,T' → z name
    const hOf = new Map();       // 'y,T,x' → h name
    const incVars = [];
    // workshops: every tile that can hold one (by some slot or fixed)
    for (let y = 0; y < n; y++) for (const T of WS) {
      const pr = present(y, T); if (!pr.ts.length && !pr.c0) continue;
      const name = `L${y}_${T}`;
      add({ name, kind: 'level', y, T, cont: true, cost: 0, act: 0 });
      levelVars.set(y + ',' + T, name);
      // tight form: L = Σ_t z_t with z_t ≤ [producer on t] and z_t ≤ [workshop T on y] (each producer counts only
      // if the workshop is really there – much stronger LP bound than L ≤ 8·present)
      const ts = [[1, name]];
      for (const t of nb[y]) {
        const f = finalProd(t, PROD[T]); if (!f.ts.length && !f.c0) continue;
        const z = `z${t}_${y}_${T}`;
        add({ name: z, kind: 'z', cont: true, ub: 1, cost: 0, act: 0 });
        zOf.set(t + ',' + y + ',' + T, z);
        row(`zp${t}_${y}_${T}`, [[1, z]].concat(f.ts.map(([c, v]) => [-c, v])), '<=', f.c0);
        row(`zw${t}_${y}_${T}`, [[1, z]].concat(pr.ts.map(([c, v]) => [-c, v])), '<=', pr.c0);
        ts.push([-1, z]);
      }
      row(`ll${y}_${T}`, ts, '<=', 0);
    }
    for (let x = 0; x < n; x++) {
      const pr = present(x, 'market'); if (!pr.ts.length && !pr.c0) continue;
      const name = `I${x}`;
      add({ name, kind: 'inc', x, cont: true, cost: 0, act: 0 });
      incVars.push(name);
      row(`ig${x}`, [[1, name]].concat(pr.ts.map(([c, v]) => [-CAP * c, v])), '<=', CAP * pr.c0);
      // tight form: I ≤ Σ_y h_y with h_y ≤ L_y and h_y ≤ 8·[Market on x]
      const ts = [[1, name]];
      for (const y of nb[x]) for (const T of WS) {
        const L = levelVars.get(y + ',' + T); if (!L) continue;
        const h = `h${y}_${T}_${x}`;
        add({ name: h, kind: 'h', cont: true, cost: 0, act: 0 });
        hOf.set(y + ',' + T + ',' + x, h);
        row(`hl${y}_${T}_${x}`, [[1, h], [-1, L]], '<=', 0);
        row(`hm${y}_${T}_${x}`, [[1, h]].concat(pr.ts.map(([c, v]) => [-CAP * c, v])), '<=', CAP * pr.c0);
        ts.push([-1, h]);
      }
      row(`is${x}`, ts, '<=', 0);
    }
    // ---------------------------------------------------------------- valid cuts (tighten the LP, change no real plan)
    // A city has at most one workshop per type and one Market (except several painted existing ones, which are left
    // out here): so a producer counts for at most one workshop of a slot, a workshop for at most one Market of a slot.
    const slotTiles = s => {
      const l = s.opts.filter(v => v.kind === 'new').map(v => v.x);
      const Ek = E[s.k][s.T];
      return Ek.length <= 1 ? l.concat(Ek) : l;
    };
    let nc = 0;
    for (const s of slots) {
      const Y = slotTiles(s); if (Y.length < 2) continue;
      if (s.T !== 'market') {
        const ts = new Set(); Y.forEach(y => nb[y].forEach(t => ts.add(t)));
        for (const t of ts) {
          const zs = Y.filter(y => zOf.has(t + ',' + y + ',' + s.T)).map(y => zOf.get(t + ',' + y + ',' + s.T));
          if (zs.length < 2) continue;
          const f = finalProd(t, PROD[s.T]);
          row(`cz${nc++}`, zs.map(z => [1, z]).concat(f.ts.map(([c, v]) => [-c, v])), '<=', f.c0);
        }
      } else {
        const ys = new Set(); Y.forEach(x => nb[x].forEach(y => ys.add(y)));
        for (const y of ys) for (const T of WS) {
          const L = levelVars.get(y + ',' + T); if (!L) continue;
          const hs = Y.filter(x => hOf.has(y + ',' + T + ',' + x)).map(x => hOf.get(y + ',' + T + ',' + x));
          if (hs.length < 2) continue;
          row(`ch${nc++}`, hs.map(h => [1, h]).concat([[-1, L]]), '<=', 0);
        }
      }
    }
    // ---------------------------------------------------------------- objective
    const mode = spec.mode || 'income', costV = vars.filter(v => !v.cont && (v.cost || v.act));
    let obj, sense;
    if (mode === 'income') { sense = 'Maximize'; obj = incVars.map(v => [1, v]); }
    else if (mode === 'steps') { sense = 'Minimize'; obj = costV.map(v => [v.act * SCALE + v.cost, v.name]); }
    else if (mode === 'ratio') { sense = 'Minimize'; obj = costV.map(v => [v.cost * SCALE + v.act, v.name]).concat(incVars.map(v => [-spec.lambda * SCALE, v])); }
    else { sense = 'Minimize'; obj = costV.map(v => [v.cost * SCALE + v.act, v.name]); }
    if (spec.minIncome != null && incVars.length) row('minInc', incVars.map(v => [1, v]), '>=', spec.minIncome);
    if (spec.minIncome != null && !incVars.length && spec.minIncome > 0) row('minInc', [], '>=', spec.minIncome);
    const fmt = c => (Math.abs(c - Math.round(c)) < 1e-9 ? String(Math.round(c)) : String(+c.toFixed(6)));
    const objTxt = obj.length ? obj.map(([c, v]) => (c >= 0 ? ' + ' : ' - ') + fmt(Math.abs(c)) + ' ' + v).join('') : ' 0 x_zero';
    rows.push('z0: x_zero >= 0');
    let lp = `${sense}\n obj:${objTxt}\nSubject To\n ` + rows.join('\n ') + '\nBounds\n x_zero = 0\n';
    vars.filter(v => v.cont).forEach(v => { lp += ` 0 <= ${v.name} <= ${v.ub || CAP}\n`; });
    lp += 'Binaries\n ' + bin.join(' ') + '\nEnd\n';

    // ---------------------------------------------------------------- solution → decision for PP.market.materialize
    function decode(cols) {
      const on = name => cols[name] && cols[name].Primal > 0.5;
      const D = { mSel: [], stages: [], prods: [] };
      const opt = v => (v.kind === 'new' ? { kind: 'new', x: v.x, tiles: [v.x], frees: E[v.k][v.T].slice() }
        : v.kind === 'destroy' ? { kind: 'destroy', tiles: [], frees: E[v.k][v.T].slice() } : { kind: 'keep', tiles: E[v.k][v.T].slice(), frees: [] });
      for (const s of slots) {
        const v = s.opts.find(q => on(q.name)) || s.opts[0];
        if (s.T === 'market') D.mSel[s.k] = opt(v); else D.stages.push({ k: s.k, T: s.T, o: opt(v) });
      }
      vars.forEach(v => { if (v.kind === 'prod' && on(v.name)) D.prods.push({ t: v.t, X: v.X }); });
      return D;
    }
    // a decision (e.g. from the group search) → values of the binary variables (HiGHS completes the rest)
    function start(D) {
      const val = {};
      bin.forEach(nm => { val[nm] = 0; });
      const same = (v, o) => o && v.kind === o.kind && (v.kind !== 'new' || v.x === o.x);
      for (const s of slots) {
        const o = s.T === 'market' ? D.mSel[s.k] : (D.stages.find(q => q.k === s.k && q.T === s.T) || {}).o;
        const v = s.opts.find(q => same(q, o)); if (v) val[v.name] = 1;
      }
      D.prods.forEach(q => { const nm = `p${q.t}_${q.X}`; if (nm in val) val[nm] = 1; });
      return val;
    }
    return { lp, decode, start, names: () => vars.map(v => v.name), nVars: vars.length, nBin: bin.length, nRows: rows.length };
  }

  PP.marketMilp = { build, SCALE };
})(typeof window !== 'undefined' ? window.PP : globalThis.PP);
