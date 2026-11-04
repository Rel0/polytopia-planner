// Polytopia Planner v17 – MARKET planner (mode 'market').
// Rule (community wiki, please verify in game): a Market on an Empty tile earns ★ per turn = sum of the levels of the
// adjacent (8-neighbourhood) Windmill, Forge and Sawmill, capped at 8. Windmill level = adjacent Farms, Forge level =
// adjacent Mines, Sawmill level = adjacent Lumber Huts (of any owner). Market / Windmill / Forge / Sawmill need an
// Empty tile without resource (Fruit can be harvested first); a Farm needs Empty with Crop (for Farm), a Mine a
// Mountain with Metal, a Lumber Hut a Forest. One Market, Windmill, Forge and Sawmill per city, built in its own
// territory (tiles within 2, nearest city wins); a Market counts the workshops of any city next to it.
//
// v16: the user paints the board as it is (terrain Empty / Forest / Mountain / Water / City, resources Crop / Metal /
// Fruit, existing buildings). An exact branch & bound search finds the plan with the most ★/turn, then the lowest
// cost, then the fewest steps – using Clear / Burn / Grow Forest, Destroy (relocations), new Farms / Mines / Lumber
// Huts as allowed by the option toggles. Assumptions: Destroy is free (0 ★, one step) and leaves the terrain and its
// resource; Burn Forest gives Crop; Grow Forest removes a field resource.
//
// Steps: ① Cities (tap own cities; territory 3×3 or 5×5 each, borders editable per tile) → ② What's here (paint) →
// ③ Plan (exact optimizer, runs in chunks with a spinner). Only the tiles of the selected territories are planned.
// Pure logic (node-testable): PP.market.optimize(cells, opts), PP.market.createJob(cells, opts).step(deadline)
// cells [{ c, r, terrain, res:[crop|ore|fruit], bld, name?, own? }], opts { clear, burn, grow, destroy, produce, windmill, forge, sawmill, costs }.
// windmill / forge / sawmill = false: no NEW workshop of that type (tech not researched); existing ones still count.
// own = 'c,r' of the city tile the cell belongs to (explicit territory); without it: nearest city within 2.
(function (root) { root.PP = root.PP || {}; })(typeof window !== 'undefined' ? window : globalThis);
(function (PP) {
  'use strict';

  // ======================================================================== rules + data
  const CAP = 8;
  const WS = ['windmill', 'forge', 'sawmill'];
  const PROD = { windmill: 'farm', forge: 'mine', sawmill: 'lumber' }; // workshop → producer it counts
  const PROC_OF = { farm: 'windmill', mine: 'forge', lumber: 'sawmill' };
  const PRODS = ['farm', 'mine', 'lumber'];
  const UNIQUE = ['market', 'windmill', 'forge', 'sawmill'];
  const BLDS = PRODS.concat(UNIQUE);
  const TERR = ['field', 'forest', 'mountain', 'water', 'city'];
  const OPT_KEYS = ['clear', 'burn', 'grow', 'destroy', 'produce'];
  const WS_KEYS = WS; // workshop types the user allows to be built (opts.windmill / forge / sawmill)
  // ★ per action. destroy: free in the game (assumed 0 ★, still one action)
  const DEF_COST = { market: 5, windmill: 5, forge: 5, sawmill: 5, farm: 5, mine: 5, lumber: 3, clear: -1, burn: 5, plant: 5, fruit: 2, destroy: 0 };
  const RANGE = 2; // city territory radius (Chebyshev)
  const BASE = { farm: 'field', mine: 'mountain', lumber: 'forest', windmill: 'field', forge: 'field', sawmill: 'field', market: 'field' };
  const PHASE = { destroy: 0, fruit: 1, plant: 2, clear: 3, burn: 4, farm: 5, mine: 5, lumber: 5, windmill: 6, forge: 6, sawmill: 6, market: 7 };
  const BIG = 10000;     // w = primary·BIG + secondary (cost & actions)
  const HUGE = 1e9;      // V = income·HUGE − w
  const NB = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const key = (c, r) => c + ',' + r;
  const ITEM = id => (PP.ITEM && PP.ITEM[id]) || null;

  function normRegion(reg) {
    if (!reg || ![reg.c1, reg.r1, reg.c2, reg.r2].every(v => isFinite(v))) return null;
    return { c1: Math.min(reg.c1, reg.c2), c2: Math.max(reg.c1, reg.c2), r1: Math.min(reg.r1, reg.r2), r2: Math.max(reg.r1, reg.r2) };
  }
  const inRegion = (reg, c, r) => !!reg && c >= reg.c1 && c <= reg.c2 && r >= reg.r1 && r <= reg.r2;

  // cell: { c, r, terrain: field|forest|mountain|water|city, res: [crop|ore|fruit], bld, name }
  // (legacy { kind } cells of v13 are accepted too). A building implies its terrain (Farm ⇒ Empty with Crop …).
  function normCell(x) {
    let t = x.terrain, bld = x.bld || null;
    if (x.kind) {
      if (x.kind === 'city') t = 'city';
      else if (x.kind === 'free') t = 'field';
      else if (x.kind === 'blocked') t = 'water';
      else if (BLDS.indexOf(x.kind) >= 0) bld = x.kind;
    }
    if (x.city) t = 'city';
    if (TERR.indexOf(t) < 0) t = t ? 'water' : 'field';
    if (t === 'city') bld = null;
    if (bld && BLDS.indexOf(bld) < 0) bld = 'other';
    if (bld && BASE[bld]) t = BASE[bld];
    const res = (Array.isArray(x.res) ? x.res : []).map(q => (q === 'metal' ? 'ore' : q));
    const o = {
      c: +x.c, r: +x.r, t, bld,
      crop: t === 'field' && (res.indexOf('crop') >= 0 || bld === 'farm'),
      ore: t === 'mountain' && (res.indexOf('ore') >= 0 || bld === 'mine'),
      fruit: t === 'field' && res.indexOf('fruit') >= 0 && res.indexOf('crop') < 0 && bld !== 'farm',
    };
    if (t === 'city' && x.name) o.name = String(x.name);
    if (t !== 'city' && x.own != null) o.own = String(x.own);
    return o;
  }
  function normOpts(opts) {
    const o = {};
    for (const k of OPT_KEYS.concat(WS_KEYS)) o[k] = !(opts && opts[k] === false);
    return o;
  }
  function costs(opts) {
    const out = {};
    for (const T of Object.keys(DEF_COST)) {
      const oc = opts && opts.costs && opts.costs[T], it = ITEM(T);
      out[T] = isFinite(oc) ? +oc : T !== 'destroy' && it && isFinite(it.cost) ? it.cost : DEF_COST[T];
    }
    return out;
  }
  // terrain path of a tile (building ignored) → list of actions, or null if impossible
  // Market / Windmill / Forge / Sawmill need Empty without resource (as in the Costs tool)
  function fieldPath(x, o) {
    if (x.t === 'field') {
      if (x.crop) return o.grow && o.clear ? ['plant', 'clear'] : null;
      return x.fruit ? ['fruit'] : [];
    }
    if (x.t === 'forest') return o.clear ? ['clear'] : null;
    return null;
  }
  function prodPath(x, X, o) {
    if (X === 'farm') {
      if (x.t === 'field') return x.crop ? ['farm'] : o.grow && o.burn ? ['plant', 'burn', 'farm'] : null;
      if (x.t === 'forest') return o.burn ? ['burn', 'farm'] : null;
      return null;
    }
    if (X === 'lumber') {
      if (x.t === 'forest') return ['lumber'];
      if (x.t === 'field') return o.grow ? ['plant', 'lumber'] : null;
      return null;
    }
    if (X === 'mine') return x.t === 'mountain' && x.ore ? ['mine'] : null;
    return null;
  }
  // nearest city of a tile: Chebyshev distance (≤ max), then Euclid, then first city
  function nearestCity(x, cities, max) {
    let best = -1, bd = 0, be = 0;
    cities.forEach((ci, k) => {
      const dc = Math.abs(x.c - ci.c), dr = Math.abs(x.r - ci.r), d = Math.max(dc, dr), e = dc * dc + dr * dr;
      if (d > max) return;
      if (best < 0 || d < bd || (d === bd && e < be)) { best = k; bd = d; be = e; }
    });
    return best;
  }

  function prepare(cellsIn, opts) {
    const o = normOpts(opts), C = costs(opts);
    const cells = cellsIn.map(normCell), n = cells.length;
    const idx = new Map(cells.map((x, i) => [key(x.c, x.r), i]));
    const nb = cells.map(x => NB.map(([dc, dr]) => idx.get(key(x.c + dc, x.r + dr))).filter(i => i !== undefined));
    const cIdx = [];
    cells.forEach((x, i) => { if (x.t === 'city') cIdx.push(i); });
    const implicit = !cIdx.length;
    const cities = implicit ? [{ i: -1, c: null, r: null, name: null, implicit: true }]
      : cIdx.map(i => ({ i, c: cells[i].c, r: cells[i].r, name: cells[i].name || null, implicit: false }));
    const cKeys = cIdx.map(i => key(cells[i].c, cells[i].r));
    // explicit territory (cell.own = city key) or nearest city within RANGE
    const owner = cells.map((x, i) => (implicit ? 0 : x.t === 'city' ? cIdx.indexOf(i) : x.own != null ? cKeys.indexOf(x.own) : nearestCity(x, cities, RANGE)));
    const home = owner.map((w, i) => (w >= 0 ? w : implicit ? 0 : nearestCity(cells[i], cities, 1e9)));
    const canAct = cells.map((x, i) => owner[i] >= 0 && x.t !== 'city');
    const dOK = canAct.map(a => a && o.destroy);
    const seq = steps => { let cost = 0; for (const s of steps) cost += C[s]; return { steps, cost, act: steps.length }; };
    const pField = cells.map((x, i) => { if (!canAct[i]) return null; const p = fieldPath(x, o); return p ? seq(p) : null; });
    const pProd = cells.map((x, i) => {
      const m = {};
      for (const X of PRODS) { const p = canAct[i] && o.produce ? prodPath(x, X, o) : null; m[X] = p ? seq(p) : null; }
      return m;
    });
    const isUniq = i => UNIQUE.indexOf(cells[i].bld) >= 0;
    // can tile i end up as producer X (existing or built; a unique building there is freed by its own slot)
    const canProd = cells.map((x, i) => {
      const m = {};
      for (const X of PRODS) m[X] = x.bld === X || (!!pProd[i][X] && (!x.bld || dOK[i]));
      return m;
    });
    const terrTiles = cities.map(() => []);
    cells.forEach((x, i) => { if (canAct[i]) terrTiles[owner[i]].push(i); });
    const E = cities.map(() => ({ market: [], windmill: [], forge: [], sawmill: [] }));
    const fixedU = []; // unique buildings outside every territory: stay as they are
    cells.forEach((x, i) => {
      if (!isUniq(i)) return;
      if (owner[i] >= 0) E[owner[i]][x.bld].push(i); else fixedU.push({ i, T: x.bld });
    });
    const potLevel = (x, T) => { let k = 0; for (const t of nb[x]) if (canProd[t][PROD[T]]) k++; return k; };
    return { o, C, cells, n, idx, nb, cities, implicit, owner, home, canAct, dOK, pField, pProd, canProd, terrTiles, E, fixedU, isUniq, potLevel };
  }

  // ======================================================================== exact search
  // Decision model: per city one "slot" per unique type (Market, Windmill, Forge, Sawmill): keep what exists, destroy
  // it, or build a new one on a tile of its territory (destroying the old one). Then every tile next to a workshop
  // may become a Farm / Mine / Lumber Hut (with Burn / Grow / Destroy as needed).
  //  outer: all Market combinations (one option per city), sorted by an upper bound;
  //  inner: depth-first over the Windmill / Forge / Sawmill slots with branch & bound;
  //  leaf : exact DP over the producer tiles with the capped Market sums as state.
  // Bound: per Market, every slot may pick its best tile and level independently; a level costs the cheapest producer
  // tiles around the workshop (cost shared by the workshops of that type that could touch it), a workshop's cost is
  // shared by the Markets next to it. This never overestimates the income or underestimates the cost.
  // Objective: V = min(income, incCap)·HUGE − w, w = cost·BIG + actions (mode 'steps': actions·BIG + cost).
  function makeSearch(P, sopts) {
    const mode = sopts.mode || 'cost', incCap = sopts.incCap == null ? Infinity : sopts.incCap;
    const { C, cells, n, nb, cities, owner, dOK, pField, pProd, canProd, terrTiles, E, fixedU } = P;
    const K = cities.length;
    const wOf = (cost, act) => (mode === 'steps' ? act * BIG + cost : cost * BIG + act);
    const wPath = p => wOf(p.cost, p.act);
    const wD = wOf(C.destroy, 1);
    const fixedTiles = fixedU.map(f => f.i);
    const fixedMk = fixedU.filter(f => f.T === 'market').map(f => f.i);
    const fixedProc = fixedU.filter(f => f.T !== 'market');
    let best = sopts.init ? sopts.init : null, bestV = best ? best.V : -Infinity;
    const stats = { combos: 0, nodes: 0, leaves: 0 };

    // market options per city
    const adjCanProcAny = x => nb[x].some(y => {
      // y could hold a workshop with some level: existing (any city / fixed) or new
      const b = cells[y].bld;
      for (const T of WS) {
        if (P.potLevel(y, T) === 0) continue;
        if (b === T) return true;
        if (P.o[T] && P.canAct[y] && pField[y] && (!b || dOK[y])) return true;
      }
      return false;
    });
    const mOpts = cities.map((ci, k) => {
      const Ek = E[k].market, list = [{ kind: 'keep', tiles: Ek, frees: [], w: 0, cost: 0, act: 0, k, T: 'market' }];
      const allD = Ek.every(i => dOK[i]);
      if (Ek.length && allD) list.push({ kind: 'destroy', tiles: [], frees: Ek, w: Ek.length * wD, cost: Ek.length * C.destroy, act: Ek.length, k, T: 'market' });
      if (!allD) return list;
      for (const x of terrTiles[k]) {
        if (Ek.indexOf(x) >= 0 || !pField[x]) continue;
        const b = cells[x].bld;
        if (b && !dOK[x]) continue;
        if (!adjCanProcAny(x)) continue;
        const extra = b && !P.isUniq(x) ? 1 : 0;
        const cost = (Ek.length + extra) * C.destroy + pField[x].cost + C.market, act = Ek.length + extra + pField[x].act + 1;
        list.push({ kind: 'new', x, tiles: [x], frees: Ek, w: wOf(cost, act), cost, act, k, T: 'market' });
      }
      return list;
    });

    // ---------------------------------------------------------------- per market combination
    const sCnt = { windmill: new Int16Array(n), forge: new Int16Array(n), sawmill: new Int16Array(n) };
    const stamp = new Int32Array(n); let stampN = 0;
    function buildCombo(mSel) {
      const mt = [], occ0 = new Set(fixedTiles);
      let mW = 0;
      for (const o of mSel) { mW += o.w; for (const x of o.tiles) { mt.push(x); occ0.add(x); } }
      for (const x of fixedMk) mt.push(x);
      const J = mt.length;
      const mAdj = new Map();
      mt.forEach((m, j) => { for (const y of nb[m]) { const a = mAdj.get(y); if (a) a.push(j); else mAdj.set(y, [j]); } });
      const stages = [];
      for (let k = 0; k < K; k++) for (const T of WS) {
        const Ek = E[k][T], list = [], allD = Ek.every(i => dOK[i]);
        if (!Ek.some(i => occ0.has(i))) list.push({ kind: 'keep', tiles: Ek, frees: [], w: 0, cost: 0, act: 0 });
        if (Ek.length && allD) list.push({ kind: 'destroy', tiles: [], frees: Ek, w: Ek.length * wD, cost: Ek.length * C.destroy, act: Ek.length });
        if (allD && P.o[T]) {
          for (const x of terrTiles[k]) {
            if (!mAdj.has(x) || occ0.has(x) || Ek.indexOf(x) >= 0 || !pField[x]) continue;
            const b = cells[x].bld;
            if (b && !dOK[x]) continue;
            if (P.potLevel(x, T) === 0) continue;
            const extra = b && !P.isUniq(x) ? 1 : 0;
            const cost = (Ek.length + extra) * C.destroy + pField[x].cost + C[T], act = Ek.length + extra + pField[x].act + 1;
            list.push({ kind: 'new', x, tiles: [x], frees: Ek, w: wOf(cost, act), cost, act });
          }
        }
        if (!list.length) return null;
        stages.push({ k, T, opts: list });
      }
      for (const f of fixedProc) stages.push({ k: -1, T: f.T, opts: [{ kind: 'fixed', tiles: [f.i], frees: [], w: 0, cost: 0, act: 0 }] });
      // sharing count s(t,T): workshop slots of type T that could touch t
      for (const T of WS) sCnt[T].fill(0);
      for (const st of stages) {
        stampN++;
        for (const o of st.opts) for (const y of o.tiles) for (const t of nb[y]) if (stamp[t] !== stampN) { stamp[t] = stampN; sCnt[st.T][t]++; }
      }
      // per option: markets touched and level curves per market
      for (const st of stages) {
        const X = PROD[st.T], sc = sCnt[st.T];
        for (const o of st.opts) {
          const tm = new Set();
          o.curves = new Map(); // j → Float64Array(9)
          o.maxL = 0;
          const tileCurves = [];
          for (const y of o.tiles) {
            const units = [];
            for (const t of nb[y]) {
              if (occ0.has(t) || !canProd[t][X]) continue;
              let u = 0;
              if (cells[t].bld !== X) u = wPath(pProd[t][X]) + (cells[t].bld && !P.isUniq(t) ? wD : 0);
              units.push(u / Math.max(1, sc[t]));
            }
            units.sort((a, b) => a - b);
            const L = Math.min(CAP, units.length), S = new Float64Array(L + 1);
            for (let q = 1; q <= L; q++) S[q] = S[q - 1] + units[q - 1];
            const A = mAdj.get(y) || [];
            A.forEach(j => tm.add(j));
            tileCurves.push({ y, S, A });
            o.maxL += L;
          }
          o.A = [...tm];
          for (const j of o.A) {
            let cur = new Float64Array(CAP + 1).fill(Infinity); cur[0] = 0;
            for (const tc of tileCurves) {
              if (tc.A.indexOf(j) < 0) continue;
              const nx = new Float64Array(CAP + 1).fill(Infinity);
              for (let a = 0; a <= CAP; a++) {
                if (cur[a] === Infinity) continue;
                for (let L = 0; L < tc.S.length; L++) {
                  const b = Math.min(CAP, a + L), v = cur[a] + tc.S[L] / tc.A.length;
                  if (v < nx[b]) nx[b] = v;
                }
              }
              cur = nx;
            }
            o.curves.set(j, cur);
          }
        }
        // undecided stage per market: g[j][L] = min over options (w/|A| + curve)
        st.g = [];
        for (let j = 0; j < J; j++) {
          const g = new Float64Array(CAP + 1).fill(Infinity); g[0] = 0;
          for (const o of st.opts) {
            const cv = o.curves.get(j); if (!cv) continue;
            const share = o.w / o.A.length;
            for (let L = 1; L <= CAP; L++) if (cv[L] + share < g[L]) g[L] = cv[L] + share;
          }
          st.g.push(g);
        }
        st.relevant = st.g.some(g => g.some((v, L) => L > 0 && v < Infinity));
        st.opts.sort((a, b) => (b.maxL * b.A.length - a.maxL * a.A.length) || (a.w - b.w));
      }
      stages.sort((a, b) => a.opts.length - b.opts.length);
      const cb = { mSel, mt, J, mW, occ0, stages };
      suffixTables(cb);
      return cb;
    }

    // capped min-plus convolution: out[min(8, a+b)] = min(x[a] + y[b])
    function conv(x, y, out) {
      out.fill(Infinity);
      for (let a = 0; a <= CAP; a++) {
        const xa = x[a]; if (xa === Infinity) continue;
        for (let L = 0; L <= CAP; L++) {
          const yl = y[L]; if (yl === Infinity) continue;
          const b = a + L > CAP ? CAP : a + L, v = xa + yl;
          if (v < out[b]) out[b] = v;
        }
      }
      return out;
    }
    const ZERO = new Float64Array(CAP + 1).fill(Infinity); ZERO[0] = 0;
    // suffix tables: U[j][d] = best levels at market j from the undecided stages d..end
    function suffixTables(cb) {
      const { J, stages } = cb, S = stages.length;
      cb.U = [];
      for (let j = 0; j < J; j++) {
        const U = new Array(S + 1);
        U[S] = ZERO;
        for (let d = S - 1; d >= 0; d--) U[d] = stages[d].relevant ? conv(U[d + 1], stages[d].g[j], new Float64Array(CAP + 1)) : U[d + 1];
        cb.U.push(U);
      }
    }
    // upper bound of V: dec[j] = levels at market j from the decided stages 0..d-1 (their own cost in fixedW)
    const tmp9 = new Float64Array(CAP + 1);
    function bound(cb, dec, d, fixedW) {
      const J = cb.J;
      let tot = [0];
      for (let j = 0; j < J; j++) {
        const f = conv(dec[j], cb.U[j][d], tmp9);
        const nt = new Array(tot.length + CAP).fill(Infinity);
        for (let a = 0; a < tot.length; a++) {
          if (tot[a] === Infinity) continue;
          for (let b = 0; b <= CAP; b++) { const v = tot[a] + f[b]; if (v < nt[a + b]) nt[a + b] = v; }
        }
        tot = nt;
      }
      let ub = -Infinity;
      for (let I = 0; I < tot.length; I++) {
        if (tot[I] === Infinity) continue;
        const v = Math.min(I, incCap) * HUGE - fixedW - tot[I];
        if (v > ub) ub = v;
      }
      return ub;
    }

    // exact producer DP for a full layout; returns { V, prods } or null when it can't beat bestV
    function leaf(cb, chosen, fixedW, track) {
      stats.leaves++;
      const { mt, J, stages } = cb;
      const occ = new Set(cb.occ0), freed = new Set();
      for (const o of cb.mSel) o.frees.forEach(x => freed.add(x));
      const procs = [];
      for (let s = 0; s < stages.length; s++) {
        const o = chosen[s];
        o.frees.forEach(x => freed.add(x));
        for (const x of o.tiles) { occ.add(x); procs.push({ x, T: stages[s].T }); }
      }
      const mIdx = new Map(mt.map((m, j) => [m, j]));
      // per tile: contribution vectors per producer type
      const contrib = new Map();
      for (const p of procs) {
        const js = [];
        for (const y of nb[p.x]) { const j = mIdx.get(y); if (j !== undefined) js.push(j); }
        if (!js.length) continue;
        const X = PROD[p.T];
        for (const t of nb[p.x]) {
          if (occ.has(t)) continue;
          let e = contrib.get(t);
          if (!e) { e = {}; contrib.set(t, e); }
          const v = e[X] || (e[X] = new Array(J).fill(0));
          for (const j of js) v[j]++;
        }
      }
      const tilesL = [];
      for (const [t, e] of contrib) {
        const bEff = freed.has(t) ? null : cells[t].bld;
        const options = [];
        const keepV = bEff && e[bEff] ? e[bEff] : null;
        options.push({ X: null, v: keepV, w: 0 });
        for (const X of PRODS) {
          if (!e[X] || X === bEff || !pProd[t][X]) continue;
          if (bEff && !dOK[t]) continue;
          options.push({ X, v: e[X], w: wPath(pProd[t][X]) + (bEff ? wD : 0) });
        }
        if (options.length === 1 && !keepV) continue;
        tilesL.push({ t, options });
      }
      // remaining max per market (for pruning)
      const m = tilesL.length, rem = [];
      let acc = new Array(J).fill(0);
      rem[m] = acc.slice();
      for (let q = m - 1; q >= 0; q--) {
        for (let j = 0; j < J; j++) { let mx = 0; for (const op of tilesL[q].options) if (op.v && op.v[j] > mx) mx = op.v[j]; acc[j] += mx; }
        rem[q] = acc.slice();
      }
      const enc = s => { let h = 0; for (let j = 0; j < J; j++) h = h * 9 + s[j]; return h; };
      const ubOf = (s, q, w) => { let inc = 0; for (let j = 0; j < J; j++) inc += Math.min(CAP, s[j] + rem[q][j]); return Math.min(inc, incCap) * HUGE - fixedW - w; };
      let states = new Map([[0, { s: new Array(J).fill(0), w: 0, from: null, op: null }]]);
      const hist = track ? [] : null;
      for (let q = 0; q < m; q++) {
        const next = new Map();
        for (const st of states.values()) {
          for (const op of tilesL[q].options) {
            const s = st.s.slice();
            if (op.v) for (let j = 0; j < J; j++) if (op.v[j]) s[j] = Math.min(CAP, s[j] + op.v[j]);
            const w = st.w + op.w;
            if (ubOf(s, q + 1, w) <= bestV + 0.5) continue;
            const h = enc(s), cur = next.get(h);
            if (!cur || w < cur.w) next.set(h, { s, w, from: st, op });
          }
        }
        states = next;
        if (!states.size) return null;
      }
      let bst = null, bv = -Infinity;
      for (const st of states.values()) {
        let inc = 0; for (let j = 0; j < J; j++) inc += st.s[j];
        const V = Math.min(inc, incCap) * HUGE - fixedW - st.w;
        if (V > bv) { bv = V; bst = st; }
      }
      if (!bst || bv <= bestV + 0.5) return null;
      const prods = [];
      for (let st = bst, q = m - 1; st && st.op; st = st.from, q--) if (st.op.X) prods.push({ t: tilesL[q].t, X: st.op.X });
      return { V: bv, prods };
    }

    function searchCombo(cb) {
      const { stages, J } = cb, S = stages.length, chosen = new Array(S);
      const occ = new Set(cb.occ0);
      const dec = [];
      for (let d = 0; d <= S; d++) { const l = []; for (let j = 0; j < J; j++) l.push(d ? new Float64Array(CAP + 1) : ZERO); dec.push(l); }
      (function rec(d, fixedW) {
        stats.nodes++;
        if (bound(cb, dec[d], d, fixedW) <= bestV + 0.5) return;
        if (d === S) {
          const r = leaf(cb, chosen, fixedW);
          if (r) { bestV = r.V; best = { V: r.V, mSel: cb.mSel.slice(), stages: stages.map((s, i) => ({ k: s.k, T: s.T, o: chosen[i] })), prods: r.prods }; }
          return;
        }
        for (const o of stages[d].opts) {
          if (o.kind !== 'fixed' && o.tiles.some(x => occ.has(x))) continue;
          o.tiles.forEach(x => occ.add(x));
          chosen[d] = o;
          for (let j = 0; j < J; j++) { const cv = o.curves.get(j); if (cv) conv(dec[d][j], cv, dec[d + 1][j]); else dec[d + 1][j].set(dec[d][j]); }
          rec(d + 1, fixedW + o.w);
          o.tiles.forEach(x => occ.delete(x));
        }
        chosen[d] = undefined;
      })(0, cb.mW);
    }

    // ---------------------------------------------------------------- driver (resumable)
    const sizes = mOpts.map(l => l.length);
    let total = 1; for (const s of sizes) total *= s;
    const list = [];
    let phase = 0, ci = 0, li = 0;
    function comboAt(z) { const sel = []; for (let k = 0; k < K; k++) { sel.push(mOpts[k][z % sizes[k]]); z = Math.floor(z / sizes[k]); } return sel; }
    return {
      stats, total,
      get best() { return best; },
      step(deadline) {
        while (true) {
          if (phase === 0) {
            if (ci >= total) { list.sort((a, b) => b.ub - a.ub); phase = 1; continue; }
            const cb = buildCombo(comboAt(ci++));
            stats.combos++;
            if (cb) { const ub = bound(cb, cb.U.map(() => ZERO), 0, cb.mW); if (ub > -Infinity) list.push({ ub, cb }); }
          } else {
            if (li >= list.length || list[li].ub <= bestV + 0.5) { list.length = 0; return true; }
            searchCombo(list[li++].cb);
          }
          if ((stats.combos & 15) === 0 && Date.now() > deadline) return false;
          if (phase === 1 && Date.now() > deadline) return false;
        }
      },
    };
  }

  // ======================================================================== plan object
  function materialize(P, d, tag) {
    const { cells, nb, C, home, owner } = P;
    const fin = cells.map(x => x.bld), why = cells.map(() => null);
    const stepsAt = cells.map(() => []);
    const isNew = cells.map(() => false);
    const destroyed = new Set();
    const place = (x, T) => {
      const b = cells[x].bld;
      if (b && b !== T) destroyed.add(x);
      fin[x] = T; isNew[x] = true;
      stepsAt[x].push(...P.pField[x].steps, T);
    };
    const all = d.mSel.map(o => ({ T: 'market', o })).concat(d.stages.filter(s => s.k >= 0).map(s => ({ T: s.T, o: s.o })));
    for (const { o } of all) for (const x of o.frees) { destroyed.add(x); if (fin[x] === cells[x].bld) fin[x] = null; }
    for (const { T, o } of all) if (o.kind === 'new') place(o.x, T);
    for (const p of d.prods) {
      const b = fin[p.t];
      if (b && b !== p.X) destroyed.add(p.t);
      fin[p.t] = p.X; isNew[p.t] = true;
      stepsAt[p.t].push(...P.pProd[p.t][p.X].steps);
    }
    destroyed.forEach(x => stepsAt[x].unshift('destroy'));
    // incomes from the final layout (independent recomputation)
    const at = i => ({ c: cells[i].c, r: cells[i].r });
    const level = i => { const X = PROD[fin[i]]; let k = 0; for (const t of nb[i]) if (fin[t] === X) k++; return k; };
    const ws = [], markets = [];
    cells.forEach((x, i) => {
      if (PROD[fin[i]]) ws.push(Object.assign(at(i), { i, item: fin[i], isNew: isNew[i], level: level(i), city: home[i], feeds: [],
        producers: nb[i].filter(t => fin[t] === PROD[fin[i]]).map(t => Object.assign(at(t), { item: fin[t], isNew: isNew[t] })) }));
    });
    cells.forEach((x, i) => {
      if (fin[i] !== 'market') return;
      const feeders = ws.filter(w => nb[i].indexOf(w.i) >= 0);
      let raw = 0; feeders.forEach(w => { raw += w.level; });
      markets.push(Object.assign(at(i), { i, item: 'market', isNew: isNew[i], city: home[i], raw, income: Math.min(CAP, raw), capped: raw > CAP,
        feeders: feeders.map(w => ({ c: w.c, r: w.r, item: w.item, level: w.level, city: w.city })) }));
    });
    markets.forEach((m, mi) => m.feeders.forEach(f => { const w = ws.find(q => q.c === f.c && q.r === f.r); if (w) w.feeds.push(mi); }));
    let income = 0; markets.forEach(m => { income += m.income; });
    // ordered steps
    const steps = [];
    cells.forEach((x, i) => stepsAt[i].forEach((item, q) => steps.push({ i, c: x.c, r: x.r, item, q, cost: C[item], city: home[i],
      what: item === 'destroy' ? cells[i].bld : null })));
    steps.sort((a, b) => PHASE[a.item] - PHASE[b.item] || a.city - b.city || a.r - b.r || a.c - b.c || a.q - b.q);
    steps.forEach((s, k) => { s.no = k + 1; });
    let cost = 0; steps.forEach(s => { cost += s.cost; });
    const tiles = [];
    cells.forEach((x, i) => { if (stepsAt[i].length) tiles.push(Object.assign(at(i), { item: fin[i], from: cells[i].bld, city: home[i], steps: steps.filter(s => s.i === i) })); });
    const used = ws.filter(w => w.feeds.length || w.isNew);
    const groups = P.cities.map((ci, k) => {
      const g = { k, city: { c: ci.c, r: ci.r, name: ci.name, implicit: ci.implicit }, markets: markets.filter(m => m.city === k), workshops: used.filter(w => w.city === k), steps: steps.filter(s => s.city === k) };
      g.income = 0; g.markets.forEach(m => { g.income += m.income; });
      g.cost = 0; g.steps.forEach(s => { g.cost += s.cost; });
      return g;
    });
    ws.forEach(w => { delete w.i; }); markets.forEach(m => { delete m.i; });
    return {
      tag, income, cost, actions: steps.length, steps, tiles, markets, workshops: used, groups,
      marketCount: markets.filter(m => m.income > 0).length, capped: markets.some(m => m.capped),
      buildings: used.concat(markets), n: steps.length,
      payback: income > 0 && cost > 0 ? Math.ceil(cost / income) : null,
      final: fin.map((b, i) => (b ? { c: cells[i].c, r: cells[i].r, bld: b } : null)).filter(Boolean),
      ownerOk: steps.every(s => owner[s.i] >= 0),
    };
  }

  // full optimization as a resumable job: best plan first (job.partial), then alternatives (fewer steps, cheaper)
  function createJob(cellsIn, opts) {
    const t0 = Date.now(), P = prepare(cellsIn || [], opts);
    const st = { combos: 0, nodes: 0, leaves: 0 };
    const add = s => { st.combos += s.combos; st.nodes += s.nodes; st.leaves += s.leaves; };
    const altBudget = opts && opts.altMs != null ? opts.altMs : 2500;
    const alts = !(opts && opts.alts === false);
    let phase = 0, cur = makeSearch(P, { mode: 'cost' }), bestD = null, bestP = null, I0 = 0, frontier = [], fewD = null, tAlt = 0, Ilev = 0, msBest = 0;
    const job = { P, done: false, result: null, partial: null, combos: cur.total };
    const half = () => Math.ceil(I0 / 2);
    const cheaperFound = () => frontier.some(d => !d.inherited);
    const mkResult = altList => ({
      best: bestP, alts: altList, ms: Date.now() - t0, msBest, stats: Object.assign({}, st), opts: P.o,
      cells: P.cells, owner: P.owner, cities: P.cities.map(ci => ({ c: ci.c, r: ci.r, name: ci.name, implicit: ci.implicit })),
    });
    job.step = function (deadline) {
      while (!job.done) {
        const fin = cur ? cur.step(deadline) : true;
        if (!fin) return false;
        if (cur) add(cur.stats);
        if (phase === 0) {
          bestD = cur.best;
          // income of the best (V = I·HUGE − w with 0 ≤ w < HUGE)
          I0 = bestD ? Math.ceil(bestD.V / HUGE) : 0;
          bestP = bestD && I0 > 0 ? materialize(P, bestD, 'best') : null;
          msBest = Date.now() - t0;
          job.partial = mkResult([]);
          tAlt = Date.now();
          if (!alts || !bestP || !bestP.actions) { phase = 9; cur = null; continue; }
          phase = 1; cur = makeSearch(P, { mode: 'steps', incCap: I0 });
        } else if (phase === 1) {
          fewD = cur.best;
          phase = 2; Ilev = I0 - 1; cur = null;
        } else if (phase === 2) {
          if (cur && cur.best) frontier.push(cur.best);
          // levels down to half the best income; further down only while nothing cheaper turned up
          if (Ilev < 1 || (Ilev < half() && cheaperFound()) || Date.now() - tAlt > altBudget) { phase = 9; cur = null; continue; }
          const prev = frontier.length ? frontier[frontier.length - 1] : bestD;
          // incumbent: the plan one level up still reaches Ilev
          const pv = prev.V - Math.ceil(prev.V / HUGE) * HUGE + Ilev * HUGE;
          cur = makeSearch(P, { mode: 'cost', incCap: Ilev, init: { V: pv, mSel: prev.mSel, stages: prev.stages, prods: prev.prods, inherited: true } });
          Ilev--;
        } else {
          job.done = true;
          const alt = [];
          if (bestP && fewD) {
            const f = materialize(P, fewD, 'fewer');
            if (f.actions < bestP.actions && f.income === bestP.income) alt.push(f);
          }
          if (bestP) {
            // cheaper: Pareto plans of lower income – the best payback (at least half the income if possible)
            const ch = [];
            let minCost = bestP.cost;
            for (const d of frontier) {
              if (d.inherited) continue;
              const p = materialize(P, d, 'cheaper');
              if (p.income > 0 && p.cost < minCost) { ch.push(p); minCost = p.cost; }
            }
            const pool = ch.some(p => p.income >= half()) ? ch.filter(p => p.income >= half()) : ch;
            pool.sort((a, b) => a.cost / a.income - b.cost / b.income || b.income - a.income);
            if (pool[0]) alt.push(pool[0]);
          }
          job.result = mkResult(alt);
          return true;
        }
      }
      return true;
    };
    return job;
  }
  // one exact search (tests): mode 'cost' | 'steps', incCap = income that is enough
  function solveOnce(cellsIn, opts, sopts) {
    const P = prepare(cellsIn || [], opts), s = makeSearch(P, sopts || {});
    s.step(Infinity);
    return s.best ? materialize(P, s.best, 'best') : null;
  }
  function optimize(cellsIn, opts) { const j = createJob(cellsIn, opts); j.step(Infinity); return j.result; }

  // income of a finished layout: cells with { terrain, bld } – independent check for the tests
  function incomeOf(cellsIn) {
    const P = prepare(cellsIn, {});
    let total = 0;
    P.cells.forEach((x, i) => {
      if (x.bld !== 'market') return;
      let raw = 0;
      for (const j of P.nb[i]) { const T = P.cells[j].bld; if (PROD[T]) for (const t of P.nb[j]) if (P.cells[t].bld === PROD[T]) raw++; }
      total += Math.min(CAP, raw);
    });
    return total;
  }
  function territory(cellsIn) {
    const P = prepare(cellsIn, {});
    return { owner: P.owner, cities: P.cities, cells: P.cells, implicit: P.implicit };
  }

  PP.market = { CAP, PROD, WS, WS_KEYS, UNIQUE, PRODS, BLDS, OPT_KEYS, DEF_COST, RANGE, optimize, createJob, solveOnce, prepare, incomeOf, territory, normRegion, inRegion, normCell, costs, fieldPath, prodPath };


  // ======================================================================== UI (browser only)
  if (typeof document === 'undefined') return;

  // Destroy is no item of data.js – registered here (map only, so the Costs ring does not list it)
  if (PP.ITEM && !PP.ITEM.destroy) PP.ITEM.destroy = { id: 'destroy', name: 'Destroy', icon: '💥', cost: 0, pop: 0, tech: 'construction', terrain: ['field', 'forest', 'mountain', 'water'], note: 'removes the building' };

  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => (PP.ui && PP.ui.esc ? PP.ui.esc(s) : String(s).replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';'));
  const toast = m => PP.ui && PP.ui.toast && PP.ui.toast(m);
  const NAME = { field: 'Empty', forest: 'Forest', mountain: 'Mountain', water: 'Water', city: 'City', crop: 'Crop (for Farm)', ore: 'Metal', fruit: 'Fruit',
    lumber: 'Lumber Hut', plant: 'Grow Forest', fruitH: 'Harvest Fruit', other: 'Other building' };
  const nm = id => NAME[id] || (ITEM(id) || {}).name || id;
  const stepName = s => (s.item === 'destroy' ? 'Destroy ' + nm(s.what || 'building') : s.item === 'fruit' ? 'Harvest Fruit' : UNIQUE.indexOf(s.item) >= 0 || PRODS.indexOf(s.item) >= 0 ? 'Build ' + nm(s.item) : nm(s.item));
  const ICON = {
    field: '🟩', forest: '🌲', mountain: '⛰️', water: '🌊', city: '🏠', crop: '🌾', ore: '💎', fruit: '🍒',
    farm: '🌾', mine: '⛏️', lumber: '🪵', windmill: '🌬️', forge: '🔨', sawmill: '🪚', market: '🏪',
    destroy: '💥', clear: '🪓', burn: '🔥', plant: '🌱', other: '🏛️',
  };
  const ICON_NAME = { ore: 'metal', plant: 'forest', destroy: null, clear: null, burn: null, other: null };
  const iconName = id => (id in ICON_NAME ? ICON_NAME[id] : id);
  const hasIcon = id => { const n = iconName(id); return !!(n && PP.icons && PP.icons.has && PP.icons.has(n)); };
  function iconHtml(id, size) {
    if (hasIcon(id) && PP.icons.svg) { try { const s = PP.icons.svg(iconName(id), size || 18); if (s) return s; } catch (e) { /* emoji */ } }
    return ICON[id] || '▪️';
  }
  const WS_COL = { windmill: '#facc15', forge: '#fb923c', sawmill: '#a3e635' };
  const CITY_COL = ['#4cc9f0', '#ff70a6', '#b69cff', '#7bd389', '#ff9f43', '#f9f871'];
  const cityCol = k => CITY_COL[(k >= 0 ? k : 0) % CITY_COL.length];
  const TER_B = ['field', 'forest', 'mountain', 'water', 'city'];
  const RES_B = ['crop', 'ore', 'fruit'];
  const BLD_B = ['farm', 'mine', 'lumber', 'windmill', 'forge', 'sawmill', 'market'];
  const BRUSH = TER_B.concat(RES_B, BLD_B);
  const BRUSH_LABEL = { field: 'Empty', forest: 'Forest', mountain: 'Mountain', water: 'Water', city: 'City', crop: 'Crop', ore: 'Metal', fruit: 'Fruit',
    farm: 'Farm', mine: 'Mine', lumber: 'Lumber', windmill: 'Windmill', forge: 'Forge', sawmill: 'Sawmill', market: 'Market' };
  const RES_TER = { crop: 'field', fruit: 'field', ore: 'mountain' };
  const OPT_LABEL = { clear: ['🪓', 'Clear Forest', '+1 ★'], burn: ['🔥', 'Burn Forest', '→ Crop'], grow: ['🌱', 'Grow Forest', 'Empty → Forest'],
    destroy: ['💥', 'Destroy buildings', 'move / replace'], produce: ['🏗️', 'New Farms, Mines, Lumber Huts', ''] };
  const TECH_OF_WS = { windmill: 'Construction', forge: 'Smithery', sawmill: 'Mathematics' }; // fallback when PP.TECH is missing

  const ui = { step: 1, brush: 'forest', paint: null, alt: 0, sel: null, entered: false, borders: false, edit: null };
  const S = () => PP.state;
  // state.market: { cities: [{ c, r, rad: 1|2, made? }], edits: { 'c,r': 1 (added) | 0 (removed) }, touched, opts }
  // (v16 had a rectangle `region`; now always false – core resets it to null when a new screenshot is loaded)
  function M() {
    const st = S();
    if (!st.market || typeof st.market !== 'object') st.market = {};
    const m = st.market;
    if (!m.opts || typeof m.opts !== 'object') m.opts = {};
    for (const k of OPT_KEYS.concat(WS_KEYS)) if (typeof m.opts[k] !== 'boolean') m.opts[k] = true;
    if (!st.tiles || typeof st.tiles !== 'object' || Array.isArray(st.tiles)) st.tiles = {};
    if (!Array.isArray(st.cities)) st.cities = [];
    // region === false: v17 state. null: fresh state or a new screenshot (core resets it) → start over.
    // A v16 rectangle → the cities inside it with the old territory (radius 2). (Not deleted: core would re-add null.)
    if (m.region !== false) {
      const reg = normRegion(m.region);
      m.cities = []; m.edits = {}; m.touched = false;
      if (reg) {
        st.cities.forEach(ci => { if (ci && inRegion(reg, ci.c, ci.r) && noCity().indexOf(key(ci.c, ci.r)) < 0) m.cities.push({ c: ci.c, r: ci.r, rad: 2 }); });
        m.touched = true;
      }
      m.region = false;
    }
    if (!Array.isArray(m.cities)) m.cities = [];
    m.cities = m.cities.filter(x => x && Number.isInteger(x.c) && Number.isInteger(x.r));
    m.cities.forEach(x => { if (x.rad !== 2) x.rad = 1; });
    if (!m.edits || typeof m.edits !== 'object' || Array.isArray(m.edits)) m.edits = {};
    return m;
  }
  const build = () => S().build || (S().build = {});
  const placements = () => { const b = build(); if (!Array.isArray(b.placements)) b.placements = []; return b.placements; };
  const noCity = () => { const b = build(); if (!Array.isArray(b.noCity)) b.noCity = []; return b.noCity; };
  const cityEntry = (c, r) => (Array.isArray(S().cities) ? S().cities.find(x => x && x.c === c && x.r === r) : null) || null;

  // terrain suggestion from the screenshot (only on request)
  function suggest(c, r) {
    try {
      const smp = PP.board && PP.board.sampleTile ? PP.board.sampleTile(c, r) : null;
      const px = smp && (Array.isArray(smp) ? smp : smp.pixels);
      if (px && px.length && PP.vision && PP.vision.classifyTile) return PP.vision.classifyTile(px, smp.lower ? { lower: smp.lower } : undefined).terrain || null;
    } catch (e) { /* none */ }
    return null;
  }
  const TERRAINS = ['field', 'forest', 'mountain', 'water', 'ocean', 'cloud'];
  // effective tile: { c, r, terrain, res, bld, stored, name?, cityId? } – unmarked tiles count as Empty
  function cellAt(c, r) {
    const k = key(c, r), t = S().tiles[k], ce = cityEntry(c, r);
    if ((ce || (t && t.city)) && noCity().indexOf(k) < 0) {
      return { c, r, terrain: 'city', res: [], bld: null, stored: true, name: (ce && ce.name) || '', cityId: ce ? ce.id : null };
    }
    if (t && t.src !== 'auto') {
      let ter = TERRAINS.indexOf(t.terrain) >= 0 ? t.terrain : 'field';
      if (ter === 'ocean' || ter === 'cloud') ter = 'water';
      if (t.mk === 'blocked' && ter === 'field') ter = 'water'; // v13 "Blocked"
      const res = (Array.isArray(t.res) ? t.res : []).filter(q => RES_TER[q] === ter);
      const bld = t.bld ? (BLDS.indexOf(t.bld) >= 0 ? t.bld : 'other') : null;
      return { c, r, terrain: ter, res, bld, other: bld === 'other' ? t.bld : null, stored: true };
    }
    return { c, r, terrain: 'field', res: [], bld: null, stored: false };
  }
  // ------------------------------------------------------------------ planning area = territories of the selected cities
  const isCityAt = (c, r) => cellAt(c, r).terrain === 'city';
  const selCities = () => M().cities.filter(s => isCityAt(s.c, s.r));
  const selAt = (c, r) => M().cities.find(s => s.c === c && s.r === r) || null;
  // nearest city: Chebyshev, then Euclid, then first selected
  function nearestOf(c, r, list) {
    let best = null, bd = 0, be = 0;
    for (const ci of list) {
      const dc = Math.abs(c - ci.c), dr = Math.abs(r - ci.r), d = Math.max(dc, dr), e = dc * dc + dr * dr;
      if (!best || d < bd || (d === bd && e < be)) { best = ci; bd = d; be = e; }
    }
    return best;
  }
  // { cities: [{ c, r, rad, name, k }], owner: Map 'c,r' → k, base: Set (inside some radius), ownerOf(c, r), has(c, r) }
  // Base territory: every tile within the city's radius (3×3 / 5×5), nearest selected city wins; foreign city tiles
  // are left out. Edits: 0 removes a base tile, 1 adds a tile (to the nearest selected city).
  function area() {
    const m = M(), sel = selCities();
    const cities = sel.map((s, k) => { const ce = cityEntry(s.c, s.r); return { c: s.c, r: s.r, rad: s.rad, name: (ce && ce.name) || '', k, implicit: false }; });
    const owner = new Map(), base = new Set(), cand = new Map();
    const cityK = new Map(cities.map(ci => [key(ci.c, ci.r), ci.k]));
    for (const ci of cities) {
      for (let dr = -ci.rad; dr <= ci.rad; dr++) for (let dc = -ci.rad; dc <= ci.rad; dc++) {
        const k = key(ci.c + dc, ci.r + dr);
        if (!cand.has(k)) cand.set(k, { c: ci.c + dc, r: ci.r + dr, by: [] });
        cand.get(k).by.push(ci);
      }
    }
    for (const [k, t] of cand) {
      if (cityK.has(k)) { owner.set(k, cityK.get(k)); continue; }
      if (isCityAt(t.c, t.r)) continue; // someone else's city
      base.add(k);
      if (m.edits[k] === 0) continue;
      owner.set(k, nearestOf(t.c, t.r, t.by).k);
    }
    if (cities.length) {
      for (const k of Object.keys(m.edits)) {
        if (m.edits[k] !== 1 || owner.has(k) || cand.has(k)) continue;
        const [c, r] = k.split(',').map(Number);
        if (!isFinite(c) || !isFinite(r) || isCityAt(c, r)) continue;
        owner.set(k, nearestOf(c, r, cities).k);
      }
    }
    const ownerOf = (c, r) => { const v = owner.get(key(c, r)); return v === undefined ? -1 : v; };
    return { cities, owner, base, ownerOf, has: (c, r) => owner.has(key(c, r)), implicit: false, n: owner.size };
  }
  const terr = area;
  const inArea = (c, r) => area().has(c, r);
  function areaCells(A) {
    A = A || area();
    const out = [];
    for (const [k, own] of A.owner) {
      const [c, r] = k.split(',').map(Number), x = cellAt(c, r), ci = A.cities[own];
      if (x.terrain !== 'city') x.own = key(ci.c, ci.r);
      out.push(x);
    }
    out.sort((a, b) => a.r - b.r || a.c - b.c);
    return out;
  }
  const optCells = list => list.map(x => (x.terrain === 'city' ? { c: x.c, r: x.r, terrain: 'city', name: x.name } : { c: x.c, r: x.r, terrain: x.terrain, res: x.res, bld: x.bld, own: x.own }));
  // tiles next to the area (8-neighbourhood) that could be added
  function fringe(A) {
    const out = new Map();
    for (const k of A.owner.keys()) {
      const [c, r] = k.split(',').map(Number);
      for (const [dc, dr] of NB) {
        const q = key(c + dc, r + dr);
        if (!A.owner.has(q) && !out.has(q) && !isCityAt(c + dc, r + dr)) out.set(q, [c + dc, r + dr]);
      }
    }
    return [...out.values()];
  }
  const LETTERS = 'ABCDEFGHIJKLMNOP';
  const cityName = (ci, k) => (!ci || ci.implicit ? 'City' : ci.name || 'City ' + LETTERS[k % LETTERS.length]);
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

  // ------------------------------------------------------------------ plan (async job, memoized)
  let cache = null, cacheSig = '', running = null;
  const MAX_COMBOS = 20000;
  function planSig() {
    const m = M();
    return JSON.stringify([optCells(areaCells()), m.opts]);
  }
  function planResult() {
    const m = M(); if (!selCities().length) return null;
    const sig = planSig();
    if (cache && sig === cacheSig) return cache;
    if (running && running.sig === sig) return running.job.partial ? Object.assign({}, running.job.partial, { altPending: true }) : { pending: true, job: running.job };
    const job = createJob(optCells(areaCells()), Object.assign({}, m.opts));
    // the exact search keeps every Market combination (product over the cities) in memory – refuse huge ones
    if (job.combos > MAX_COMBOS) { running = null; cacheSig = sig; cache = { tooBig: job.combos, best: null, alts: [], cities: [] }; return cache; }
    const run = running = { sig, job };
    if (job.step(Date.now() + 60)) { running = null; cacheSig = sig; cache = job.result; ui.alt = 0; return cache; }
    let shown = !!job.partial;
    const tick = () => {
      if (running !== run) return; // abandoned (board changed)
      const done = job.step(Date.now() + 28);
      if (done) {
        running = null; cacheSig = sig; cache = job.result;
        if (ui.alt > cache.alts.length) ui.alt = 0;
      } else setTimeout(tick, 0);
      if (done || (!shown && job.partial)) {
        const first = !shown; shown = true;
        if (PP.modes && PP.modes.current === 'market') { PP.app.refresh(); if (ui.step === 3 && first) requestAnimationFrame(fitPlan); }
      }
    };
    setTimeout(tick, 0);
    return job.partial ? Object.assign({}, job.partial, { altPending: true }) : { pending: true, job };
  }
  const curPlan = res => (res && !res.pending ? (ui.alt ? res.alts[ui.alt - 1] : res.best) || res.best : null);

  // ------------------------------------------------------------------ cities (shared PP.state.cities)
  function sideOf(color) {
    const my = S().ui && S().ui.myColor, ok = v => Array.isArray(v) && v.length >= 3 && v.every(x => isFinite(x));
    if (!ok(my) || !ok(color)) return null;
    if (PP.recog && PP.recog.sideFor) {
      let tl = []; try { tl = PP.recog.tribes ? PP.recog.tribes() : []; } catch (e) { tl = []; }
      return PP.recog.sideFor(color, my, tl);
    }
    return Math.hypot(color[0] - my[0], color[1] - my[1], color[2] - my[2]) < 60 ? 'me' : 'enemy';
  }
  const uid = () => (PP.util && PP.util.uid ? PP.util.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  function upsertCity(c, r, src, extra) {
    const list = S().cities, k = key(c, r);
    const nc = noCity(), ni = nc.indexOf(k);
    if (src === 'user' && ni >= 0) nc.splice(ni, 1);
    let ci = cityEntry(c, r);
    if (ci) {
      if (src === 'user' && ci.src === 'auto') ci.src = 'user';
      if (extra && extra.color && !ci.color) ci.color = extra.color;
      if (ci.side == null && extra && extra.side) ci.side = extra.side;
      return ci;
    }
    ci = { id: uid(), c, r, side: (extra && extra.side) || null, name: '', level: 1, pop: 0, capital: false, src };
    if (extra && extra.color) ci.color = extra.color;
    if (extra && extra.conf != null) ci.conf = extra.conf;
    list.push(ci);
    return ci;
  }
  function removeCity(c, r) {
    const k = key(c, r), t = S().tiles[k];
    S().cities = S().cities.filter(x => !(x && x.c === c && x.r === r));
    if (t && t.city) { delete t.city; if (!Object.keys(t).some(q => q !== 'src')) delete S().tiles[k]; }
    if (noCity().indexOf(k) < 0) noCity().push(k);
  }
  // cities on the screenshot (name plates), from the Units tool's detection (cached there)
  function detectedList() {
    let list = [];
    try {
      if (PP.units && PP.units.detectedCities) list = PP.units.detectedCities() || [];
      else if (PP.vision && PP.vision.detectCities && PP.board && PP.board.image && S().grid) {
        const tr = [[150, 95, 60], [100, 66, 51], [60, 60, 170]];
        try { if (PP.recog && PP.recog.tribes) PP.recog.tribes().forEach(k => { if (Array.isArray(k.color)) tr.push(k.color.slice(0, 3)); }); } catch (e) { /* ignore */ }
        list = PP.vision.detectCities(PP.board.image, Object.assign({}, S().grid), tr) || [];
      }
    } catch (e) { list = []; }
    return list.filter(d => d && Number.isInteger(d.c) && Number.isInteger(d.r) && noCity().indexOf(key(d.c, d.r)) < 0);
  }
  const detColor = d => (Array.isArray(d.color) ? d.color.slice(0, 3).map(Math.round) : null);
  // own cities the app knows (city list side 'me', detected name plates of my colour) that are not selected yet
  function knownOwn() {
    const out = [], seen = new Set(M().cities.map(s => key(s.c, s.r)));
    const add = (c, r) => { const k = key(c, r); if (!seen.has(k)) { seen.add(k); out.push({ c, r }); } };
    S().cities.forEach(ci => { if (ci && ci.side === 'me' && noCity().indexOf(key(ci.c, ci.r)) < 0) add(ci.c, ci.r); });
    detectedList().forEach(d => { if (!cityEntry(d.c, d.r) && sideOf(detColor(d)) === 'me') add(d.c, d.r); });
    return out;
  }
  const MAX_CITIES = 6;
  // select a city tile (creates the city entry if the app did not know it)
  function selectCity(c, r, rad) {
    const m = M();
    let s = selAt(c, r);
    if (!isCityAt(c, r)) {
      const d = detectedList().find(q => q.c === c && q.r === r);
      const made = !cityEntry(c, r) && !(S().tiles[key(c, r)] || {}).city;
      upsertCity(c, r, 'user', d ? { color: detColor(d), side: sideOf(detColor(d)) || 'me', conf: d.conf } : { side: 'me' });
      if (s) s.made = s.made || made;
      else s = { c, r, rad: 1, made };
    }
    if (!s) s = { c, r, rad: 1 };
    if (rad) s.rad = rad;
    if (m.cities.indexOf(s) < 0) {
      if (selCities().length >= MAX_CITIES) { toast('At most ' + MAX_CITIES + ' cities at once'); return null; }
      m.cities = m.cities.filter(x => !(x.c === c && x.r === r)).concat(s);
    }
    m.touched = true;
    ui.alt = 0;
    return s;
  }
  function unselectCity(c, r) {
    const m = M(), s = selAt(c, r);
    m.cities = m.cities.filter(x => x !== s);
    m.touched = true; ui.alt = 0;
    // a city this tool created (tap on an unknown tile) disappears again
    if (s && s.made) {
      const ce = cityEntry(c, r);
      if (ce && ce.src === 'user' && !ce.name) S().cities = S().cities.filter(x => x !== ce);
    }
    if (!m.cities.length) m.edits = {};
  }
  // tap in step ①: city → select (3×3) → 5×5 → off; other tiles → snap to a city next to it or mark a new city
  function tapCity(c, r) {
    const s = selAt(c, r);
    if (s && isCityAt(c, r)) {
      const nm1 = cityLabel(c, r);
      if (s.rad === 1) { s.rad = 2; M().touched = true; ui.alt = 0; toast(nm1 + ': 5×5 territory (tap again to remove)'); }
      else { unselectCity(c, r); toast(nm1 + ' removed'); }
      return;
    }
    if (!isCityAt(c, r)) {
      if (inArea(c, r)) { toast('Tap a city tile – or use ✏️ Edit borders to change single tiles'); return; }
      // a known / detected city right next to the tapped tile (name plates sit below the city)
      const near = S().cities.filter(ci => ci && !selAt(ci.c, ci.r) && Math.max(Math.abs(ci.c - c), Math.abs(ci.r - r)) <= 1 && isCityAt(ci.c, ci.r))
        .concat(detectedList().filter(d => !selAt(d.c, d.r) && Math.max(Math.abs(d.c - c), Math.abs(d.r - r)) <= 1));
      if (near.length === 1 || (near.length > 1 && near.every(q => q.c === near[0].c && q.r === near[0].r))) { c = near[0].c; r = near[0].r; }
    }
    const was = isCityAt(c, r), n = selectCity(c, r, 1);
    if (n) toast(cityLabel(c, r) + (was ? '' : ' (marked as city)') + ': 3×3 territory · tap again for 5×5');
  }
  // name as shown in the chips (City A, B … by selection order)
  const cityLabel = (c, r) => {
    const ce = cityEntry(c, r);
    if (ce && ce.name) return ce.name;
    const k = selCities().findIndex(s => s.c === c && s.r === r);
    return k >= 0 ? cityName({}, k) : 'City ' + c + '/' + r;
  };
  // Edit borders: add a tile next to the territory / remove a territory tile (want: true add, false remove, null toggle)
  function editBorder(c, r, want) {
    const m = M(), A = area(), k = key(c, r);
    if (!A.cities.length) return 'none';
    if (isCityAt(c, r)) return 'city';
    if (A.has(c, r)) {
      if (want === true) return 'same';
      if (A.base.has(k)) m.edits[k] = 0; else delete m.edits[k];
    } else {
      if (want === false) return 'same';
      if (!NB.some(([dc, dr]) => A.has(c + dc, r + dr))) return 'far';
      if (A.base.has(k)) delete m.edits[k]; else m.edits[k] = 1;
    }
    m.touched = true; ui.alt = 0;
    return 'ok';
  }

  // ------------------------------------------------------------------ painting
  function storeTile(c, r, o) {
    const tiles = S().tiles, k = key(c, r), cur = tiles[k] || {};
    const next = Object.assign({}, cur, o, { src: 'user' });
    next.res = (next.res || []).filter((x, i, a) => a.indexOf(x) === i && RES_TER[x] === next.terrain);
    if (!next.city) delete next.city;
    delete next.mk;
    if (!next.bld) next.bld = null;
    tiles[k] = next;
  }
  function brushOn(id, x) {
    if (id === 'city') return x.terrain === 'city';
    if (TER_B.indexOf(id) >= 0) return x.stored && x.terrain === id && !x.bld && !x.res.length;
    if (RES_B.indexOf(id) >= 0) return x.res.indexOf(id) >= 0;
    return x.bld === id;
  }
  function applyBrush(c, r, id, on) {
    if (!inArea(c, r) || BRUSH.indexOf(id) < 0) return;
    const x = cellAt(c, r), k = key(c, r);
    if (id === 'city') {
      // a city inside the area is one of the planned cities (own territory 3×3)
      if (on) { upsertCity(c, r, 'user', { side: 'me' }); storeTile(c, r, { terrain: 'field', res: [], bld: null }); selectCity(c, r); }
      else { unselectCity(c, r); removeCity(c, r); delete S().tiles[k]; }
      return;
    }
    if (x.terrain === 'city') { if (!ui.paint || ui.paint.first) toast('City tile – use the City brush to remove it'); return; }
    if (TER_B.indexOf(id) >= 0) {
      if (!on) { delete S().tiles[k]; return; } // back to "not marked" (= Empty)
      const bld = x.bld && BASE[x.bld] === id && !(x.bld === 'farm' && id !== 'field') ? x.bld : null;
      storeTile(c, r, { terrain: id, res: x.res.filter(q => RES_TER[q] === id), bld: x.bld === 'other' && id === x.terrain ? x.other : bld });
      return;
    }
    if (RES_B.indexOf(id) >= 0) {
      const ter = RES_TER[id];
      if (!on) {
        storeTile(c, r, { terrain: x.terrain, res: x.res.filter(q => q !== id), bld: (id === 'crop' && x.bld === 'farm') || (id === 'ore' && x.bld === 'mine') ? null : x.bld === 'other' ? x.other : x.bld });
        return;
      }
      let res = x.terrain === ter ? x.res.filter(q => q !== 'crop' && q !== 'fruit' && q !== 'ore') : [];
      res = res.concat(id);
      // Market / workshops need a tile without resource; Farm needs Crop, Mine needs Metal
      let bld = x.terrain === ter ? x.bld : null;
      if (bld && (UNIQUE.indexOf(bld) >= 0 || (bld === 'farm' && id !== 'crop'))) bld = null;
      storeTile(c, r, { terrain: ter, res, bld: bld === 'other' ? x.other : bld });
      return;
    }
    // buildings
    if (!on) { storeTile(c, r, { terrain: x.terrain, res: x.res, bld: null }); return; }
    if (UNIQUE.indexOf(id) >= 0) {
      const T = terr(), own = T.ownerOf(c, r);
      if (own >= 0 && !T.implicit) {
        for (const y of areaCells(T)) {
          if (y.bld === id && !(y.c === c && y.r === r) && T.ownerOf(y.c, y.r) === own) {
            storeTile(y.c, y.r, { terrain: y.terrain, res: y.res, bld: null });
            toast(nm(id) + ' moved – one per city');
          }
        }
      }
    }
    const ter = BASE[id];
    const res = id === 'farm' ? ['crop'] : id === 'mine' ? ['ore'] : [];
    storeTile(c, r, { terrain: ter, res, bld: id });
  }
  function paintAt(c, r) {
    if (!ui.paint || !ui.brush) return;
    const k = key(c, r);
    if (ui.paint.done.has(k) || !inArea(c, r)) return;
    ui.paint.done.add(k);
    applyBrush(c, r, ui.brush, ui.paint.on);
    ui.paint.first = false;
  }
  function suggestAll() {
    let n = 0;
    for (const x of areaCells()) {
      if (x.stored) continue;
      let t = suggest(x.c, x.r);
      if (t === 'ocean' || t === 'cloud') t = 'water';
      if (TER_B.indexOf(t) < 0 || t === 'city') continue;
      S().tiles[key(x.c, x.r)] = Object.assign({}, S().tiles[key(x.c, x.r)] || {}, { terrain: t, res: [], bld: null, src: 'user' });
      n++;
    }
    return n;
  }

  function fitTiles(list, maxTile) {
    if (!list.length || !PP.board || !PP.grid || !PP.board.visibleRect) return;
    const pts = [];
    for (const [c, r] of list) PP.grid.corners(c, r).forEach(p => pts.push(p));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const vr = PP.board.visibleRect(), g = S().grid, tw = Math.max(Math.abs(g.ux + g.vx), Math.abs(g.ux - g.vx)) || 1;
    let s = Math.min((vr.w - 16) / w, (vr.h - 30) / h);
    if (maxTile) s = Math.min(s, maxTile / tw);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    PP.board.setView({ s, x: vr.x + vr.w / 2 - cx * s, y: vr.y + vr.h / 2 - cy * s });
  }
  function fitRegion() {
    const A = area(); if (!A.n) return;
    const l = [...A.owner.keys()].map(k => k.split(',').map(Number));
    if (ui.step === 1) fringe(A).forEach(q => l.push(q));
    fitTiles(l, 150);
  }
  function fitPlan() {
    const p = curPlan(planResult()); if (!p) { fitRegion(); return; }
    const l = [];
    p.tiles.forEach(t => l.push([t.c, t.r]));
    p.buildings.forEach(b => { l.push([b.c, b.r]); (b.producers || []).forEach(q => l.push([q.c, q.r])); });
    if (!l.length) { fitRegion(); return; }
    fitTiles(l, 150);
  }
  const mode = {
    label: 'Market', icon: '🏪',
    hint() {
      if (ui.step === 1 || !selCities().length) {
        if (ui.borders) return 'Tap a tile next to the territory to add it, a territory tile to remove it (drag for several)';
        return selCities().length ? 'Tap more cities · tap a city again: 3×3 → 5×5 → off' : 'Tap your own cities (the city tile) to plan their Markets';
      }
      if (ui.step === 2) return ui.brush ? 'Tap or drag: ' + nm(ui.brush) + ' (tap again = remove)' : 'Pick a brush, then tap tiles';
      return 'Tap a tile for details';
    },
    onEnter() {
      const m = M();
      if (!m.touched && !m.cities.length) knownOwn().forEach(q => { if (cityEntry(q.c, q.r)) m.cities.push({ c: q.c, r: q.r, rad: 1 }); });
      if (!selCities().length) ui.step = 1; else if (ui.step === 1 && !ui.entered) ui.step = 2;
      ui.entered = true;
    },
    onExit() { ui.paint = null; ui.edit = null; },
    wantsDrag(t) {
      if (!t) return false;
      if (ui.step === 1 || !selCities().length) {
        if (!ui.borders) return false;
        const A = area();
        return A.has(t.c, t.r) || NB.some(([dc, dr]) => A.has(t.c + dc, t.r + dr));
      }
      return ui.step === 2 && !!ui.brush && inArea(t.c, t.r);
    },
    onDrag(phase, t) {
      if (ui.step === 1 || !selCities().length) {
        if (phase === 'start') { ui.edit = { want: !inArea(t.c, t.r), done: new Set() }; }
        if (ui.edit && t && (phase === 'start' || phase === 'move' || phase === 'end')) {
          const k = key(t.c, t.r);
          if (!ui.edit.done.has(k)) { ui.edit.done.add(k); editBorder(t.c, t.r, ui.edit.want); }
        }
        if (phase === 'end' || phase === 'cancel') { ui.edit = null; PP.app.commit(); return; }
        PP.board.redraw();
        return;
      }
      if (ui.step === 2) {
        if (phase === 'start') { ui.paint = { on: !brushOn(ui.brush, cellAt(t.c, t.r)), done: new Set(), first: true }; paintAt(t.c, t.r); }
        else if (phase === 'move' && ui.paint) paintAt(t.c, t.r);
        else if (ui.paint) { if (phase === 'end') paintAt(t.c, t.r); ui.paint = null; PP.app.commit(); return; }
        PP.board.redraw();
      }
    },
    onTap(t) {
      if (ui.step === 1 || !selCities().length) {
        if (ui.borders) {
          const r = editBorder(t.c, t.r, null);
          if (r === 'far') toast('Only tiles next to the territory can be added');
          else if (r === 'city') tapCity(t.c, t.r);
          else if (r === 'none') toast('Tap a city first');
        } else tapCity(t.c, t.r);
        PP.app.commit(); return;
      }
      if (ui.step === 2 && ui.brush) {
        if (!inArea(t.c, t.r)) { toast('Outside the cities’ territories – change them in ① Cities'); return; }
        ui.paint = null;
        applyBrush(t.c, t.r, ui.brush, !brushOn(ui.brush, cellAt(t.c, t.r)));
        PP.app.commit(); return;
      }
      ui.sel = ui.sel && ui.sel.c === t.c && ui.sel.r === t.r ? null : (inArea(t.c, t.r) ? { c: t.c, r: t.r } : null);
      PP.app.refresh();
    },
    renderPanel,
    drawUnder,
    drawOver,
  };

  // ------------------------------------------------------------------ drawer
  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const s = document.createElement('style');
    s.textContent = `
.mk{font-size:14px;line-height:1.35}
.mk h3{margin:12px 0 4px;font-size:14px;color:var(--muted,#9aa5c8);font-weight:700;text-transform:none}
.mk svg{vertical-align:middle}
.mk .mk-steps{display:flex;gap:3px;background:var(--bg,#12172b);border-radius:10px;padding:3px;margin:0 0 6px}
.mk .mk-steps button{flex:1;min-width:0;border:0;background:none;color:var(--muted,#9aa5c8);font-weight:650;font-size:13px;padding:6px 2px;border-radius:8px;line-height:1.1;min-height:36px;white-space:nowrap;touch-action:manipulation}
.mk .mk-steps button.on{background:var(--panel2,#252e52);color:var(--text,#e8ecf8)}
.mk .mk-steps button:disabled{opacity:.4}
.mk .mk-pal{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;margin:0 0 2px}
.mk .mk-pal button{border:1px solid var(--line,#33406e);background:var(--panel2,#252e52);color:var(--text,#e8ecf8);border-radius:8px;padding:2px 0 1px;font-size:9.5px;letter-spacing:-.3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;min-width:0;min-height:44px;overflow:hidden;white-space:nowrap;touch-action:manipulation}
.mk .mk-pal button span{font-size:18px;line-height:1.1;height:22px;display:flex;align-items:center}
.mk .mk-pal button.on{border-color:var(--gold,#ffd166);background:rgba(255,209,102,.22);color:var(--gold,#ffd166);box-shadow:inset 0 0 0 1px var(--gold,#ffd166)}
.mk .mk-pal button.t{background:rgba(155,211,90,.08)}
.mk .mk-pal button.rs{background:rgba(255,255,255,.04);border-style:dashed}
.mk .mk-pal button.b{background:rgba(76,201,240,.08)}
.mk .mk-pal button.on{background:rgba(255,209,102,.22)}
.mk .mk-pal button.go{background:var(--accent,#4cc9f0);color:#08121f;border-color:transparent;font-weight:800;font-size:11px}
.mk .mk-btn{display:block;width:100%;border:0;border-radius:11px;padding:10px;margin:6px 0;font-weight:700;background:var(--panel2,#252e52);color:var(--text,#e8ecf8);min-height:44px;font-size:14px}
.mk .mk-btn.pri{background:var(--accent,#4cc9f0);color:#08121f}
.mk .mk-btn.ok{background:rgba(6,214,160,.18);color:var(--ok,#06d6a0);border:1px solid rgba(6,214,160,.5)}
.mk .mk-btn.sm{display:inline-block;width:auto;min-height:36px;padding:6px 12px;font-size:13px;margin:4px 4px 4px 0}
.mk .mk-note{color:var(--muted,#9aa5c8);font-size:12.5px;margin:6px 0}
.mk .mk-key{display:flex;align-items:center;gap:8px;background:var(--panel2,#252e52);border:1px solid var(--line,#33406e);border-radius:12px;padding:6px 6px 6px 10px;min-height:44px}
.mk .mk-key .t{flex:1;min-width:0;font-size:13.5px;line-height:1.3}
.mk .mk-key .t b.g{color:var(--gold,#ffd166);font-size:16px}
.mk .mk-key .t small{color:var(--muted,#9aa5c8);font-size:12px}
.mk .mk-key .mk-btn{margin:0;width:auto;min-height:40px;padding:6px 10px;font-size:13px;flex:none}
.mk .mk-spin{display:inline-block;width:16px;height:16px;border:2.5px solid rgba(255,255,255,.25);border-top-color:var(--accent,#4cc9f0);border-radius:50%;animation:mkspin .8s linear infinite;vertical-align:-3px;margin-right:6px}
@keyframes mkspin{to{transform:rotate(360deg)}}
.mk .mk-alts{display:flex;gap:5px;margin:6px 0 2px}
.mk .mk-alt{flex:1;min-width:0;border:1px solid var(--line,#33406e);background:var(--panel2,#252e52);color:var(--text,#e8ecf8);border-radius:10px;padding:4px 3px;font-size:11.5px;line-height:1.25;text-align:center;min-height:44px}
.mk .mk-alt b{display:block;font-size:13.5px;color:var(--gold,#ffd166)}
.mk .mk-alt.on{border-color:var(--accent,#4cc9f0);box-shadow:inset 0 0 0 1px var(--accent,#4cc9f0)}
.mk .mk-opts{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:4px 0}
.mk .mk-opt{display:flex;align-items:center;gap:6px;border:1px solid var(--line,#33406e);background:var(--bg,#12172b);color:var(--muted,#9aa5c8);border-radius:10px;padding:5px 7px;min-height:42px;text-align:left;font-size:12.5px;line-height:1.2}
.mk .mk-opt .bx{flex:none;width:18px;height:18px;border-radius:5px;border:2px solid var(--line,#33406e);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900}
.mk .mk-opt.on{color:var(--text,#e8ecf8);border-color:rgba(76,201,240,.6);background:rgba(76,201,240,.1)}
.mk .mk-opt.on .bx{background:var(--accent,#4cc9f0);border-color:var(--accent,#4cc9f0);color:#08121f}
.mk .mk-opt small{display:block;color:var(--muted,#9aa5c8);font-size:11px}
.mk .mk-opt.wide{grid-column:1/-1}
.mk .mk-city{display:flex;align-items:center;gap:7px;margin:10px 0 0;padding:5px 2px 3px;border-bottom:2px solid var(--cc,#4cc9f0);font-size:14px}
.mk .mk-city .dot{width:12px;height:12px;border-radius:50%;background:var(--cc,#4cc9f0);flex:none}
.mk .mk-city .nmx{flex:1;min-width:0;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mk .mk-city .inc{color:var(--gold,#ffd166);font-weight:700;white-space:nowrap}
.mk ol.mk-list{list-style:none;margin:2px 0 6px;padding:0}
.mk ol.mk-list li{display:flex;align-items:center;gap:7px;padding:5px 2px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;min-height:32px}
.mk ol.mk-list li .no{flex:none;min-width:22px;height:22px;padding:0 3px;box-sizing:border-box;border-radius:11px;background:#ffd166;color:#1b1300;font-weight:800;font-size:11.5px;display:flex;align-items:center;justify-content:center}
.mk ol.mk-list li .no.ex{background:rgba(255,255,255,.18);color:var(--text,#e8ecf8)}
.mk ol.mk-list li .ic{font-size:17px;width:24px;text-align:center;flex:none;display:flex;justify-content:center}
.mk ol.mk-list li .tx{flex:1;min-width:0}
.mk ol.mk-list li .tx small{color:var(--muted,#9aa5c8)}
.mk ol.mk-list li .co{font-weight:700;white-space:nowrap}
.mk ol.mk-list li.sel{background:rgba(76,201,240,.12)}
.mk ol.mk-list li.none{color:var(--muted,#9aa5c8);font-size:12.5px}
.mk ol.mk-list li.tot{font-weight:700;border-bottom:0}
.mk ol.mk-list li.tot .co{color:var(--gold,#ffd166)}
.mk .mk-bd{font-size:12.5px;color:var(--muted,#9aa5c8);margin:4px 0;overflow-wrap:anywhere}
.mk .mk-bd b{color:var(--text,#e8ecf8)}
.mk .mk-cnt{display:flex;gap:5px;flex-wrap:wrap;margin:4px 0}
.mk .mk-cnt span{background:var(--bg,#12172b);border-radius:8px;padding:3px 7px;font-size:12px;display:inline-flex;align-items:center;gap:3px}
.mk .mk-cities{margin:6px 0}
.mk .mk-chips{display:flex;flex-direction:column;gap:5px;margin:4px 0 2px}
.mk .mk-chip{display:flex;align-items:center;gap:7px;border:1px solid var(--line,#33406e);border-left:4px solid var(--cc,#4cc9f0);background:var(--panel2,#252e52);border-radius:10px;padding:3px 4px 3px 8px;min-height:44px}
.mk .mk-chip .dot{width:12px;height:12px;border-radius:50%;background:var(--cc,#4cc9f0);flex:none}
.mk .mk-chip .nmx{flex:1;min-width:0;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.15}
.mk .mk-chip .nmx small{display:block;font-weight:400;color:var(--muted,#9aa5c8);font-size:11.5px}
.mk .mk-chip .seg{display:flex;background:var(--bg,#12172b);border-radius:9px;padding:2px;flex:none}
.mk .mk-chip .seg button{border:0;background:none;color:var(--muted,#9aa5c8);font-weight:700;font-size:13px;min-height:36px;min-width:44px;border-radius:7px;touch-action:manipulation}
.mk .mk-chip .seg button.on{background:var(--cc,#4cc9f0);color:#08121f}
.mk .mk-chip .x{border:0;background:none;color:var(--muted,#9aa5c8);font-size:16px;min-width:40px;min-height:40px;flex:none;touch-action:manipulation}
.mk .mk-row{display:flex;flex-wrap:wrap}
.mk .mk-cities label{display:flex;align-items:center;gap:7px;margin:4px 0;font-size:12.5px;color:var(--muted,#9aa5c8)}
.mk .mk-cities .dot{width:12px;height:12px;border-radius:50%;flex:none}
.mk .mk-cities input{flex:1;min-width:0;background:var(--bg,#12172b);color:var(--text,#e8ecf8);border:1px solid var(--line,#33406e);border-radius:8px;padding:6px 8px;font-size:16px}
`;
    document.head.appendChild(s);
  }

  function stepsHtml() {
    const has = selCities().length > 0;
    return '<div class="mk-steps">' + [[1, '① Cities'], [2, '② What’s here'], [3, '③ Plan']].map(([s, l]) =>
      `<button data-step="${s}" class="${s === ui.step ? 'on' : ''}" ${s !== 1 && !has ? 'disabled' : ''}>${l}</button>`).join('') + '</div>';
  }
  const TAG = { best: 'Best', fewer: 'Fewer steps', cheaper: 'Cheaper' };
  function keyLine(p, res) {
    if (res && res.pending) return '<span class="mk-spin"></span><b>Searching all plans…</b> <small>exact search</small>';
    if (res && res.tooBig) return '<b>Too many possibilities</b> <small>– see below</small>';
    if (!p) return '<b>No income possible</b> <small>– check the tiles and the options below</small>';
    const mk = plural(p.marketCount, 'market', 'markets');
    if (!p.actions) return `${TAG[p.tag]}: <b class="g">${p.income} ★/turn</b> · ${mk} <small>– all built already</small>`;
    return `${TAG[p.tag]}: <b class="g">${p.income} ★/turn</b> · ${mk} · cost <b>${p.cost}&nbsp;★</b> · ${plural(p.actions, 'step', 'steps')}`;
  }

  function renderPanel(el) {
    injectCss();
    const m = M();
    if (!selCities().length) ui.step = 1;
    let h = '<div class="mk">';
    if (ui.step === 1) {
      const A = area(), nEd = Object.keys(m.edits).length;
      h += `<div data-peek="cities:${ui.borders ? 'b' : 'c'}:${A.cities.length}">${stepsHtml()}`;
      if (ui.borders) h += '<div class="mk-note" style="margin:2px 0 4px">✏️ <b>Edit borders:</b> tap a tile <b>next to</b> the territory to add it (it joins the nearest city), tap a territory tile to remove it. Drag for several.</div>';
      else h += `<div class="mk-note" style="margin:2px 0 4px">${A.cities.length ? 'Tap more of <b>your cities</b> – or tap one again: 3×3 → 5×5 → off.' : 'Tap <b>your own cities</b> on the map (the city tile). Each gets a 3×3 territory – 5×5 after Border Growth.'}</div>`;
      h += chipsHtml(A);
      h += '<div class="mk-row">';
      if (A.cities.length) h += `<button class="mk-btn sm ${ui.borders ? 'pri' : ''}" data-a="borders">${ui.borders ? '✓ Done' : '✏️ Edit borders'}</button>`;
      if (nEd) h += `<button class="mk-btn sm" data-a="resetBorders">↺ Reset borders (${nEd})</button>`;
      h += '</div>';
      const ko = knownOwn();
      if (ko.length && selCities().length < MAX_CITIES) h += `<button class="mk-btn sm" data-a="addKnown">＋ Add my ${plural(ko.length, 'city', 'cities')}: ${ko.slice(0, 4).map(q => esc(cityLabel(q.c, q.r))).join(', ')}${ko.length > 4 ? ' …' : ''}</button>`;
      if (A.cities.length) h += `<button class="mk-btn pri" data-step="2">Next: ② What’s here ▶</button>`;
      h += '</div>';
      h += '<p class="mk-note">Only tiles inside these territories are planned – Markets, workshops and Farms, Mines, Lumber Huts are built there only. Where territories overlap, a tile belongs to the nearest city.</p>';
    } else if (ui.step === 2) {
      const bt = id => `<button data-brush="${id}" class="${ui.brush === id ? 'on' : ''} ${TER_B.indexOf(id) >= 0 ? 't' : RES_B.indexOf(id) >= 0 ? 'rs' : 'b'}" title="${esc(nm(id))}"><span>${iconHtml(id, 21)}</span>${BRUSH_LABEL[id]}</button>`;
      h += `<div data-peek="tiles">${stepsHtml()}<div class="mk-pal">` + TER_B.concat(RES_B).map(bt).join('') + BLD_B.map(bt).join('') +
        '<button class="go" data-step="3" title="Show the plan"><span>▶</span>Plan</button></div>' +
        `<div class="mk-note" style="margin:3px 0 0;font-size:11.5px">${ui.brush ? '<b>' + esc(nm(ui.brush)) + '</b> – tap or drag over tiles, tap again to remove. ' : ''}Unmarked tiles count as Empty.</div></div>`;
      h += citiesHtml();
      h += countsHtml();
      h += '<p class="mk-note">Mark the board <b>as it is now</b>: terrain (<b>Empty</b>, Forest, Mountain, Water = anything unusable), resources (<b>Crop (for Farm)</b>, Metal, Fruit) and existing buildings. Only the territories of the cities from step ① are shown (coloured outline) – change them there.</p>';
      h += '<button class="mk-btn sm" data-a="suggest">🪄 Suggest terrain from screenshot</button><button class="mk-btn sm" data-a="clearTiles">Clear marks in territories</button>';
    } else {
      const res = planResult(), p = curPlan(res);
      const added = p && p.actions && planAdded(p);
      h += `<div data-peek="plan:${ui.alt}:${ui.sel ? ui.sel.c + '/' + ui.sel.r : ''}:${res && res.pending ? 'p' : 'd'}">${stepsHtml()}<div class="mk-key"><div class="t">${keyLine(p, res)}</div>` +
        (p && p.actions ? `<button class="mk-btn ${added ? 'ok' : 'pri'}" data-a="${added ? 'fromPlan' : 'toPlan'}">${added ? '✓ In plan' : '➕ Cost plan'}</button>` : '') + '</div>';
      if (p && (res.alts.length || res.altPending)) {
        h += '<div class="mk-alts">' + [res.best].concat(res.alts).map((q, i) =>
          `<button class="mk-alt ${i === ui.alt ? 'on' : ''}" data-alt="${i}">${TAG[q.tag]}<b>${q.income} ★/turn</b>${q.cost} ★ · ${plural(q.actions, 'step', 'steps')}</button>`).join('') +
          (res.altPending ? '<div class="mk-alt" style="display:flex;align-items:center;justify-content:center;color:var(--muted,#9aa5c8)"><span class="mk-spin"></span>alternatives…</div>' : '') + '</div>';
      }
      h += (ui.sel && p ? selLine(p, ui.sel.c, ui.sel.r) : '') + '</div>';
      h += '<h3>Allowed actions</h3><div class="mk-opts">' + OPT_KEYS.map(k => {
        const [ic, lab, sub] = OPT_LABEL[k];
        return `<button class="mk-opt ${m.opts[k] ? 'on' : ''} ${k === 'produce' ? 'wide' : ''}" data-opt="${k}"><span class="bx">${m.opts[k] ? '✓' : ''}</span><span>${ic} ${lab}${sub ? `<small>${sub}</small>` : ''}</span></button>`;
      }).join('') + '</div>';
      h += '<h3>Workshops you can build</h3><div class="mk-opts">' + WS_KEYS.map(k => {
        const it = ITEM(k) || {}, tech = it.tech && PP.TECH && PP.TECH[it.tech] ? PP.TECH[it.tech].name : TECH_OF_WS[k];
        return `<button class="mk-opt ${m.opts[k] ? 'on' : ''}" data-opt="${k}" title="Uncheck if you don't have ${esc(tech)} – existing ${esc(nm(k))}s still count"><span class="bx">${m.opts[k] ? '✓' : ''}</span><span>${iconHtml(k, 16)} ${esc(nm(k))}<small>${esc(tech)}</small></span></button>`;
      }).join('') + '</div>';
      if (!WS_KEYS.some(k => m.opts[k])) h += '<p class="mk-note" style="margin-top:2px">No new workshops – the plan only uses the Windmills, Forges and Sawmills already on the board.</p>';
      if (p) h += planHtml(p, res);
      else if (res && res.tooBig) h += `<p class="mk-note" style="color:var(--warn,#ffaa00)">Too many possibilities for the exact search (${res.tooBig.toLocaleString('en')} Market combinations). Mark the tiles in step ② (unmarked tiles count as Empty, so every one is a possible Market site) or plan fewer cities at once.</p>`;
      else if (res && !res.pending) h += '<p class="mk-note">No Market can earn anything here. A Market needs an Empty tile of a city’s territory next to a Windmill, Forge or Sawmill site – and those need Farms, Mines or Lumber Huts (or tiles that can become one) next to them. Check the tiles in step ② and the allowed actions.</p>';
      if (res && !res.pending && !res.altPending && !res.tooBig) h += `<p class="mk-note">Exact search: ${plural(res.cities.filter(c => !c.implicit).length, 'city', 'cities')} · ${res.stats.combos} Market combinations · ${res.stats.nodes} layouts · ${res.stats.leaves} producer optimizations · best plan in ${res.msBest} ms, all ${res.ms} ms.</p>`;
    }
    h += '</div>';
    el.innerHTML = h;
    el.firstChild.addEventListener('click', onClick);
    el.firstChild.addEventListener('change', onChange);
  }
  function chipsHtml(A) {
    if (!A.cities.length) return '';
    return '<div class="mk-chips">' + A.cities.map((ci, k) => {
      const n = [...A.owner.values()].filter(o => o === k).length - 1, at = ci.c + ',' + ci.r;
      return `<div class="mk-chip" style="--cc:${cityCol(k)}"><span class="dot"></span><span class="nmx">${esc(cityName(ci, k))}<small>${ci.c}/${ci.r} · ${n} tiles</small></span>` +
        `<span class="seg"><button data-rad="${at},1" class="${ci.rad === 1 ? 'on' : ''}">3×3</button><button data-rad="${at},2" class="${ci.rad === 2 ? 'on' : ''}">5×5</button></span>` +
        `<button class="x" data-unsel="${at}" title="Remove" aria-label="Remove ${esc(cityName(ci, k))}">✕</button></div>`;
    }).join('') + '</div>';
  }
  function citiesHtml() {
    const T = area();
    return '<div class="mk-cities">' + T.cities.map((ci, k) => {
      const n = [...T.owner.values()].filter(o => o === k).length - 1;
      return `<label><span class="dot" style="background:${cityCol(k)}"></span><input data-city="${ci.c},${ci.r}" value="${esc(ci.name || '')}" placeholder="${esc(cityName(ci, k))} – name" enterkeyhint="done"><span>${ci.c}/${ci.r} · ${n} tiles</span></label>`;
    }).join('') + '</div>';
  }
  function onChange(ev) {
    const inp = ev.target.closest('input[data-city]'); if (!inp) return;
    const [c, r] = inp.dataset.city.split(',').map(Number);
    const ci = upsertCity(c, r, 'user');
    ci.name = inp.value.trim();
    PP.app.commit();
  }
  function countsHtml() {
    const cells = areaCells(), n = {};
    let un = 0;
    for (const x of cells) {
      n[x.terrain] = (n[x.terrain] || 0) + 1;
      x.res.forEach(q => { n[q] = (n[q] || 0) + 1; });
      if (x.bld && x.bld !== 'other') n[x.bld] = (n[x.bld] || 0) + 1;
      if (!x.stored) un++;
    }
    const order = ['city', 'field', 'forest', 'mountain', 'water', 'crop', 'ore', 'fruit'].concat(BLD_B);
    return '<div class="mk-cnt">' + order.filter(k => n[k]).map(k => `<span title="${esc(nm(k))}">${iconHtml(k, 15)} ${n[k]}</span>`).join('') + (un ? `<span title="Not marked – counted as Empty">❔ ${un} unmarked</span>` : '') + '</div>';
  }
  const groupName = (p, k) => { const g = p.groups[k]; return g ? cityName(g.city, k) : 'City'; };
  function selLine(p, c, r) {
    const x = cellAt(c, r), T = terr(), own = T.ownerOf(c, r);
    let h = `<div class="mk-bd" style="margin:6px 2px 0">📍 <b>${c}/${r}</b> · ${iconHtml(x.terrain === 'city' ? 'city' : x.terrain, 15)} ${esc(x.terrain === 'city' ? cityName(T.cities[own] || {}, own) : nm(x.terrain))}${x.res.map(q => ' + ' + esc(nm(q))).join('')}${x.bld ? ' + ' + esc(nm(x.other || x.bld)) : ''}`;
    if (x.terrain !== 'city') h += own >= 0 ? ` <small>· territory of <b style="color:${cityCol(own)}">${esc(cityName(T.cities[own], own))}</b></small>` : ' <small>· outside the territories</small>';
    h += ': ';
    const tp = p.tiles.find(t => t.c === c && t.r === r);
    const b = p.buildings.find(v => v.c === c && v.r === r);
    if (tp) h += tp.steps.map(s => `<b>${s.no}</b> ${esc(stepName(s))}`).join(' → ') + (b ? ' · ' + bldText(b, p) : '');
    else if (b) h += bldText(b, p);
    else {
      const ws = p.workshops.find(w => w.producers.some(q => q.c === c && q.r === r));
      h += ws ? 'counts for the ' + nm(ws.item) + ' at ' + ws.c + '/' + ws.r : 'not used by this plan';
    }
    return h + '</div>';
  }
  function bldText(b, p) {
    if (b.item === 'market') {
      const f = b.feeders.map(w => `${nm(w.item)} Lv${w.level}${w.city !== b.city && p.groups.length > 1 ? ' of ' + esc(groupName(p, w.city)) : ''}`).join(' + ');
      return `<b>Market</b> ${b.isNew ? '' : '(built) '}= <b>${b.income} ★/turn</b>${f ? ` <small>(${f}${b.capped ? ' = ' + b.raw + ', max. ' + CAP : ''})</small>` : ''}`;
    }
    const pn = { farm: ['Farm', 'Farms'], mine: ['Mine', 'Mines'], lumber: ['Lumber Hut', 'Lumber Huts'] }[PROD[b.item]];
    const nNew = b.producers.filter(q => q.isNew).length;
    let h = `<b>${nm(b.item)}</b> ${b.isNew ? '' : '(built) '}<small>Lv${b.level}: ${plural(b.level, pn[0], pn[1])}${nNew ? ', ' + nNew + ' new' : ''}</small>`;
    const other = b.feeds.map(i => p.markets[i]).filter(mm => mm.city !== b.city);
    if (other.length) h += ` <small>· ${b.feeds.length > other.length ? 'also ' : ''}feeds ${other.map(mm => esc(groupName(p, mm.city)) + '’s Market').join(', ')}</small>`;
    return h;
  }
  function planHtml(p, res) {
    const multi = p.groups.length > 1;
    let h = '<h3>Markets</h3>';
    for (const g of p.groups) {
      const col = cityCol(g.k);
      if (multi || !g.city.implicit) h += `<div class="mk-city" style="--cc:${col}"><span class="dot"></span><span class="nmx">${esc(cityName(g.city, g.k))} <small style="color:var(--muted,#9aa5c8);font-weight:400">${g.city.implicit ? '' : g.city.c + '/' + g.city.r}</small></span><span class="inc">${g.income} ★/turn</span></div>`;
      h += '<ol class="mk-list">';
      const list = g.markets.concat(g.workshops);
      if (!list.length) h += '<li class="none">No Market here – nothing with a level fits into this city’s territory.</li>';
      h += list.map(b => `<li data-go="${b.c},${b.r}" class="${ui.sel && ui.sel.c === b.c && ui.sel.r === b.r ? 'sel' : ''}"><span class="ic">${iconHtml(b.item, 19)}</span><span class="tx">${bldText(b, p)} <small>· ${b.c}/${b.r}${b.isNew ? ' · new' : ''}</small></span></li>`).join('');
      if (g.steps.length) h += `<li class="none">${plural(g.steps.length, 'step', 'steps')} in this territory · ${g.cost} ★</li>`;
      h += '</ol>';
    }
    if (p.steps.length) {
      h += '<h3>Build order</h3><ol class="mk-list">';
      h += p.steps.map(s => `<li data-go="${s.c},${s.r}" class="${ui.sel && ui.sel.c === s.c && ui.sel.r === s.r ? 'sel' : ''}"><span class="no" style="background:${cityCol(s.city)}">${s.no}</span><span class="ic">${iconHtml(s.item === 'fruit' ? 'fruit' : s.item, 18)}</span><span class="tx">${esc(stepName(s))} <small>· ${s.c}/${s.r}${p.groups.length > 1 ? ' · ' + esc(groupName(p, s.city)) : ''}</small></span><span class="co">${s.cost > 0 ? s.cost + ' ★' : s.cost < 0 ? '+' + (-s.cost) + ' ★' : '0 ★'}</span></li>`).join('');
      h += '</ol>';
    }
    h += `<ol class="mk-list"><li class="tot"><span class="tx">Total: ${p.income} ★/turn · ${plural(p.actions, 'step', 'steps')}${p.payback ? ' · pays off in ' + plural(p.payback, 'turn', 'turns') : ''}</span><span class="co">${p.cost} ★</span></li></ol>`;
    const owned = (S().build && Array.isArray(S().build.owned)) ? S().build.owned : [];
    const techs = [];
    p.steps.forEach(s => { const t = (ITEM(s.item) || {}).tech; if (t && owned.indexOf(t) < 0 && techs.indexOf(t) < 0) techs.push(t); });
    if (techs.length) h += '<p class="mk-note">Needs tech: ' + techs.map(t => '<b>' + esc((PP.TECH && PP.TECH[t] ? PP.TECH[t].name : t)) + '</b>').join(', ') + '</p>';
    if (p.actions) {
      const added = planAdded(p);
      h += `<button class="mk-btn ${added ? 'ok' : 'pri'}" data-a="${added ? 'fromPlan' : 'toPlan'}">${added ? '✓ In the cost plan – tap to remove' : '➕ Add all ' + p.actions + ' steps to the cost plan'}</button>`;
    } else h += '<p class="mk-note">Everything is already built – the Markets earn this now.</p>';
    return h;
  }
  const sameStep = (q, s) => q.c === s.c && q.r === s.r && q.item === s.item && q.src === 'market';
  function planAdded(p) {
    const pl = placements();
    return p.steps.length > 0 && p.steps.every(s => pl.some(q => sameStep(q, s)));
  }
  function addToPlan(p) {
    const b = build();
    b.placements = placements().filter(q => q.src !== 'market'); // replaces an earlier Market plan
    for (const s of p.steps) {
      const g = p.groups[s.city], ce = g && !g.city.implicit ? cityEntry(g.city.c, g.city.r) : null;
      const e = { id: uid(), c: s.c, r: s.r, item: s.item, src: 'market' };
      if (ce) e.city = ce.id;
      b.placements.push(e);
    }
  }
  function onClick(ev) {
    const b = ev.target.closest('button,[data-go]'); if (!b || b.disabled) return;
    const d = b.dataset, m = M();
    if (d.step) {
      ui.step = +d.step; ui.sel = null; if (ui.step !== 1) ui.borders = false;
      PP.app.refresh();
      requestAnimationFrame(ui.step === 3 ? fitPlan : fitRegion);
      return;
    }
    if (d.brush) { ui.brush = ui.brush === d.brush ? null : d.brush; PP.app.refresh(); return; }
    if (d.alt) { ui.alt = +d.alt; ui.sel = null; PP.app.refresh(); requestAnimationFrame(fitPlan); return; }
    if (d.opt) { m.opts[d.opt] = !m.opts[d.opt]; ui.alt = 0; PP.app.commit(); return; }
    if (d.go) {
      const [c, r] = d.go.split(',').map(Number);
      ui.sel = ui.sel && ui.sel.c === c && ui.sel.r === r ? null : { c, r };
      PP.app.refresh(); return;
    }
    const a = d.a;
    if (d.rad) {
      const [c, r, rad] = d.rad.split(',').map(Number), sc = selAt(c, r);
      if (sc) { sc.rad = rad; m.touched = true; ui.alt = 0; PP.app.commit(); requestAnimationFrame(fitRegion); }
      return;
    }
    if (d.unsel) {
      const [c, r] = d.unsel.split(',').map(Number);
      unselectCity(c, r);
      if (!selCities().length) ui.borders = false;
      PP.app.commit(); return;
    }
    if (a === 'borders') { ui.borders = !ui.borders; PP.app.refresh(); if (ui.borders) requestAnimationFrame(fitRegion); return; }
    if (a === 'resetBorders') { m.edits = {}; ui.alt = 0; PP.app.commit(); toast('Borders reset to 3×3 / 5×5'); return; }
    if (a === 'addKnown') {
      let n = 0;
      for (const q of knownOwn()) if (selectCity(q.c, q.r)) n++;
      PP.app.commit(); requestAnimationFrame(fitRegion);
      toast(n ? plural(n, 'city', 'cities') + ' added' : 'Nothing added'); return;
    }
    if (a === 'suggest') { const n = suggestAll(); toast(n ? n + ' tiles suggested – please check them' : 'Nothing to suggest (all tiles marked)'); PP.app.commit(); return; }
    if (a === 'clearTiles') {
      for (const x of areaCells()) if (x.terrain !== 'city') delete S().tiles[key(x.c, x.r)];
      toast('Marks cleared (cities stay)'); PP.app.commit(); return;
    }
    if (a === 'toPlan') {
      const p = curPlan(planResult()); if (!p) return;
      addToPlan(p);
      PP.app.commit(); toast('Added ' + plural(p.actions, 'step', 'steps') + ' to the cost plan: ' + p.cost + ' ★'); return;
    }
    if (a === 'fromPlan') {
      const p = curPlan(planResult()); if (!p) return;
      build().placements = placements().filter(q => !p.steps.some(s => sameStep(q, s)));
      PP.app.commit(); toast('Removed from the cost plan'); return;
    }
  }

  // ------------------------------------------------------------------ canvas
  const scr = (x, y) => PP.board.toScreen(x, y);
  function diamondPath(ctx, c, r, shrink) {
    const p = PP.board.tileToScreen(c, r), k = shrink || 1;
    const pts = PP.grid.corners(c, r).map(q => scr(q.x, q.y));
    ctx.beginPath();
    pts.forEach((q, i) => { const x = p.x + (q.x - p.x) * k, y = p.y + (q.y - p.y) * k; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
  }
  function emoji(ctx, s, x, y, size, alpha) {
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(s, x, y + size * 0.06);
    ctx.restore();
  }
  function drawIcon(ctx, id, x, y, size, alpha) {
    if (hasIcon(id) && PP.icons.draw) {
      ctx.save();
      if (alpha != null) ctx.globalAlpha = alpha;
      let ok = true;
      try { PP.icons.draw(ctx, iconName(id), x, y, size); } catch (e) { ok = false; }
      ctx.restore();
      if (ok) return;
    }
    emoji(ctx, ICON[id] || '▪️', x, y, size * 0.86, alpha);
  }
  function disc(ctx, x, y, rad, fill, stroke, lw, dash) {
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; if (dash) ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); }
  }
  function numBadge(ctx, n, x, y, rad, bg, fg) {
    const s = String(n);
    ctx.font = `800 ${Math.round(rad * 1.2)}px system-ui,sans-serif`;
    const w = Math.max(rad * 2, ctx.measureText(s).width + rad * 0.9);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - rad, w, rad * 2, rad); else ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = bg || '#ffd166'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fg || '#1b1300'; ctx.fillText(s, x, y + rad * 0.08);
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  const EDGES = [[0, 1, 0, -1], [1, 2, 1, 0], [2, 3, 0, 1], [3, 0, -1, 0]];
  // per-city tint + outline (solid where the area ends, dashed between two cities)
  function drawTerritory(ctx, A, faint) {
    for (const [k, own] of A.owner) {
      const [c, r] = k.split(',').map(Number), col = cityCol(own);
      if (!faint) { diamondPath(ctx, c, r, 1); ctx.fillStyle = hexA(col, ui.step === 1 ? 0.2 : 0.08); ctx.fill(); }
      const pts = PP.grid.corners(c, r).map(q => scr(q.x, q.y));
      for (const [a, b, dc, dr] of EDGES) {
        const o = A.ownerOf(c + dc, r + dr);
        if (o === own) continue;
        ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y);
        if (o < 0) {
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
          ctx.lineWidth = 2.2; ctx.strokeStyle = hexA(col, faint ? 0.7 : 1); ctx.stroke();
        } else {
          ctx.lineWidth = 2; ctx.strokeStyle = hexA(col, faint ? 0.55 : 0.9); ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
  }
  const TER_FILL = { field: 'rgba(155,211,90,.22)', forest: 'rgba(30,120,50,.42)', mountain: 'rgba(150,150,160,.45)', water: 'rgba(20,60,140,.6)' };
  function drawUnder(ctx) {
    const A = area();
    if (!A.n) return;
    const sz = PP.board.size();
    ctx.save();
    // dim everything outside the territories (screen rect clockwise, tiles counter-clockwise → holes with 'nonzero')
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sz.h); ctx.lineTo(sz.w, sz.h); ctx.lineTo(sz.w, 0); ctx.closePath();
    for (const k of A.owner.keys()) {
      const [c, r] = k.split(',').map(Number), pts = PP.grid.corners(c, r).map(q => scr(q.x, q.y));
      const cw = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x) > 0;
      const ord = cw ? [0, 3, 2, 1] : [0, 1, 2, 3];
      ord.forEach((q, i) => (i ? ctx.lineTo(pts[q].x, pts[q].y) : ctx.moveTo(pts[q].x, pts[q].y))); ctx.closePath();
    }
    ctx.fillStyle = ui.step === 1 ? 'rgba(6,9,22,.42)' : 'rgba(6,9,22,.55)'; ctx.fill('nonzero');
    if (ui.step === 1 && ui.borders) {
      for (const [c, r] of fringe(A)) {
        diamondPath(ctx, c, r, 0.86); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const k of Object.keys(M().edits)) {
        if (M().edits[k] !== 0 || !A.base.has(k)) continue;
        const [c, r] = k.split(',').map(Number);
        diamondPath(ctx, c, r, 0.86); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,120,120,.85)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (ui.step === 2) {
      for (const x of areaCells(A)) {
        if (x.terrain === 'city') continue;
        diamondPath(ctx, x.c, x.r, 0.94);
        if (!x.stored) { ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); continue; }
        ctx.fillStyle = TER_FILL[x.terrain] || TER_FILL.water; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
      }
    }
    drawTerritory(ctx, A, ui.step === 3);
    if (ui.step === 3) {
      const p = curPlan(planResult());
      if (p) {
        for (const m of p.markets) { diamondPath(ctx, m.c, m.r, 0.98); ctx.fillStyle = hexA(cityCol(m.city), 0.45); ctx.fill(); }
        for (const w of p.workshops) { diamondPath(ctx, w.c, w.r, 0.92); ctx.globalAlpha = 0.35; ctx.fillStyle = WS_COL[w.item]; ctx.fill(); ctx.globalAlpha = 1; }
      }
    }
    ctx.restore();
  }
  function drawCities(ctx, D, u, big, small) {
    const T = area();
    const fs = small ? clamp(u * 0.17, 9, 11) : clamp(u * 0.2, 9, 13);
    T.cities.forEach((ci, k) => {
      const q = PP.board.tileToScreen(ci.c, ci.r), R = big * (small ? 0.42 : 0.66);
      disc(ctx, q.x, q.y, R, 'rgba(10,14,30,.75)', cityCol(k), small ? 2 : 2.4);
      drawIcon(ctx, 'city', q.x, q.y, R * 1.45);
      const name = cityName(ci, k) + (ui.step === 1 ? ' · ' + (ci.rad === 2 ? '5×5' : '3×3') : ''), y = q.y + R + fs * 0.8;
      if (D && D.pill) {
        D.pill(ctx, q.x, y, name, hexA(cityCol(k), 0.9), fs);
        ctx.save(); ctx.font = `bold ${fs}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0b0f1f'; ctx.fillText(name, q.x, y + 1); ctx.restore();
      }
    });
  }
  function drawOver(ctx, D) {
    const t = PP.board.tileScreenSize(), u = clamp(t.h, 14, 90);
    const sz = PP.board.size(), vis = q => q.x > -60 && q.y > -60 && q.x < sz.w + 60 && q.y < sz.h + 60;
    const big = clamp(u * 0.5, 11, 34);
    if (ui.step === 1 || !selCities().length) {
      ctx.save();
      // known cities that are not selected: dashed ring = tap target
      const seen = new Set();
      const ring = (c, r, me) => {
        const k = key(c, r); if (seen.has(k) || selAt(c, r) && isCityAt(c, r)) return; seen.add(k);
        const q = PP.board.tileToScreen(c, r); if (!vis(q)) return;
        const R = clamp(u * 0.42, 10, 28);
        disc(ctx, q.x, q.y, R, me ? 'rgba(76,201,240,.22)' : 'rgba(255,255,255,.12)', 'rgba(0,0,0,.6)', 4);
        disc(ctx, q.x, q.y, R, null, me ? 'rgba(76,201,240,.95)' : 'rgba(255,255,255,.9)', 2, [5, 4]);
      };
      S().cities.forEach(ci => { if (ci && isCityAt(ci.c, ci.r)) ring(ci.c, ci.r, ci.side === 'me'); });
      detectedList().forEach(d => ring(d.c, d.r, sideOf(detColor(d)) === 'me'));
      drawCities(ctx, D, u, big);
      ctx.restore();
      return;
    }
    ctx.save();
    if (ui.step === 2) {
      for (const x of areaCells()) {
        if (x.terrain === 'city' || !x.stored) continue;
        const q = PP.board.tileToScreen(x.c, x.r); if (!vis(q)) continue;
        if (x.bld) {
          const R = big * 0.62, U = UNIQUE.indexOf(x.bld) >= 0;
          disc(ctx, q.x, q.y, R, U ? 'rgba(40,30,5,.78)' : 'rgba(10,14,30,.65)', U ? '#ffd166' : 'rgba(255,255,255,.8)', 1.5);
          drawIcon(ctx, x.bld, q.x, q.y, big * 0.95);
        } else if (x.terrain !== 'field') drawIcon(ctx, x.terrain, q.x, q.y, big * 0.8, 0.95);
        x.res.forEach((rs, i) => {
          if ((rs === 'crop' && x.bld === 'farm') || (rs === 'ore' && x.bld === 'mine')) return;
          const rx = q.x + big * (0.55 + i * 0.5), ry = q.y + big * 0.32;
          disc(ctx, rx, ry, big * 0.3, 'rgba(10,14,30,.75)', 'rgba(255,255,255,.7)', 1);
          drawIcon(ctx, rs, rx, ry, big * 0.48);
        });
      }
      drawCities(ctx, D, u, big);
    } else {
      const res = planResult(), p = curPlan(res);
      drawCities(ctx, D, u, big, true);
      if (p) drawPlan(ctx, D, p, u, big);
    }
    if (ui.sel) { diamondPath(ctx, ui.sel.c, ui.sel.r, 1); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
  const ACT_GLYPH = { destroy: '💥', fruit: '🍒', plant: '🌱', clear: '🪓', burn: '🔥' };
  function drawPlan(ctx, D, p, u, big) {
    // workshop → counted producers (thin, dashed, workshop colour)
    for (const w of p.workshops) {
      const wp = PP.board.tileToScreen(w.c, w.r);
      for (const pr of w.producers) {
        const q = PP.board.tileToScreen(pr.c, pr.r);
        ctx.beginPath(); ctx.moveTo(wp.x, wp.y); ctx.lineTo(q.x, q.y);
        ctx.lineWidth = clamp(u * 0.04, 1.2, 2.4); ctx.strokeStyle = WS_COL[w.item]; ctx.globalAlpha = 0.85; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    // Market → workshops (thick, city colour)
    for (const m of p.markets) {
      const mp = PP.board.tileToScreen(m.c, m.r);
      for (const w of m.feeders) {
        const wp = PP.board.tileToScreen(w.c, w.r);
        ctx.beginPath(); ctx.moveTo(mp.x, mp.y); ctx.lineTo(wp.x, wp.y);
        ctx.lineWidth = clamp(u * 0.16, 3, 9); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
        ctx.lineWidth = clamp(u * 0.1, 2, 6); ctx.strokeStyle = cityCol(m.city); ctx.stroke();
      }
    }
    const pill = (x, y, txt, bg, s) => { if (D && D.pill) D.pill(ctx, x, y, txt, bg, s); };
    const fs = clamp(u * 0.2, 9, 13), rad = clamp(u * 0.15, 6.5, 11);
    // producers that are used (existing or new)
    const prodSeen = new Set();
    for (const w of p.workshops) for (const pr of w.producers) {
      const k = key(pr.c, pr.r); if (prodSeen.has(k)) continue; prodSeen.add(k);
      if (p.tiles.some(t => t.c === pr.c && t.r === pr.r)) continue;
      const q = PP.board.tileToScreen(pr.c, pr.r);
      disc(ctx, q.x, q.y, big * 0.42, 'rgba(10,14,30,.6)', WS_COL[w.item], 1.3);
      drawIcon(ctx, pr.item, q.x, q.y, big * 0.62);
    }
    for (const m of p.markets) { diamondPath(ctx, m.c, m.r, 0.98); ctx.lineWidth = 3; ctx.strokeStyle = cityCol(m.city); ctx.stroke(); }
    // tiles with steps: final building (or 💥 if only destroyed); existing buildings that count: ✓
    const bAt = new Map(p.buildings.map(b => [key(b.c, b.r), b]));
    const later = [], pills = [];
    for (const t of p.tiles) {
      const q = PP.board.tileToScreen(t.c, t.r), col = cityCol(t.city), b = bAt.get(key(t.c, t.r));
      const R = big * (b ? 0.7 : 0.5);
      disc(ctx, q.x, q.y, R, 'rgba(25,30,55,.88)', col, 2.2, [4, 2]);
      if (t.item) drawIcon(ctx, t.item, q.x, q.y, big * (b ? 1.0 : 0.72)); else emoji(ctx, '💥', q.x, q.y, big * 0.6);
      const nos = t.steps.map(s => s.no);
      later.push(() => numBadge(ctx, nos.length > 2 ? nos[0] + '–' + nos[nos.length - 1] : nos.join('·'), q.x - R * 0.8, q.y - R * 0.9, rad, col, '#0b0f1f'));
      const gl = t.steps.map(s => ACT_GLYPH[s.item]).filter(Boolean);
      if (gl.length) later.push(() => {
        const gs = clamp(u * 0.18, 9, 13), tx = gl.join('');
        ctx.save(); ctx.font = `${gs}px ${EMOJI_FONT}`;
        const wdt = ctx.measureText(tx).width + 6, gx = q.x + R * 0.95, gy = q.y - R * 0.55;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(gx - wdt / 2, gy - gs * 0.62, wdt, gs * 1.24, gs * 0.5); else ctx.rect(gx - wdt / 2, gy - gs * 0.62, wdt, gs * 1.24);
        ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(tx, gx, gy + 1);
        ctx.restore();
      });
    }
    for (const b of p.buildings) {
      const q = PP.board.tileToScreen(b.c, b.r), R = big * 0.7;
      if (!b.isNew) {
        disc(ctx, q.x, q.y, R, 'rgba(10,14,30,.7)', 'rgba(255,255,255,.85)', 1.8);
        drawIcon(ctx, b.item, q.x, q.y, big * 1.0);
        later.push(() => numBadge(ctx, '✓', q.x - R * 0.8, q.y - R * 0.9, rad * 0.9, '#e8ecf8', '#0b6b4f'));
      }
      if (b.item === 'market') pills.push(() => pill(q.x, q.y + R + fs * 0.7, b.income + ' ★/turn', 'rgba(150,100,0,.97)', fs));
      else pills.push(() => pill(q.x, q.y + R + fs * 0.55, 'Lv' + b.level, 'rgba(6,120,90,.95)', fs * 0.92));
    }
    later.forEach(f => f());
    pills.forEach(f => f());
  }

  if (PP.modes && PP.modes.register) PP.modes.register('market', mode);
  PP.market.ui = ui;
  PP.market.plan = () => planResult();
  PP.market.cellAt = cellAt;
  PP.market.territoryOfArea = () => terr();
  PP.market.area = () => area();
  PP.market.tapCity = (c, r) => { tapCity(c, r); PP.app.commit(); };
  PP.market.selectCity = (c, r, rad) => { const x = selectCity(c, r, rad); PP.app.commit(); return x; };
  PP.market.unselectCity = (c, r) => { unselectCity(c, r); PP.app.commit(); };
  PP.market.editBorder = (c, r, want) => { const x = editBorder(c, r, want == null ? null : want); PP.app.commit(); return x; };
  PP.market.setBorders = on => { ui.borders = !!on; PP.app.refresh(); };
  PP.market.setStep = s => { ui.step = s; PP.app.refresh(); };
  PP.market.setBrush = b => { ui.brush = b; PP.app.refresh(); };
  PP.market.paint = (c, r, id, on) => { applyBrush(c, r, id, on !== false); PP.app.commit(); };
  PP.market.setOpts = o => { Object.assign(M().opts, o); PP.app.commit(); };
  PP.market.fitPlan = () => fitPlan();
})((typeof window !== 'undefined' ? window : globalThis).PP);
