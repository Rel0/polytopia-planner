// Polytopia Planner – Web Worker that solves Market MILPs with HiGHS (vendor/highs, MIT), so the page stays responsive.
// in:  { id, lp, start: { name: value } | null, opts: { time_limit, … } }
// out: { id, type: 'names', names }                       once, after the model is read
//      { id, type: 'progress', gap, bound, obj }           now and then (throttled)
//      { id, type: 'incumbent', values, obj }              every improving solution (values in the order of names)
//      { id, type: 'done', status, optimal, values, obj, bound, gap } | { id, type: 'error', message }
/* global importScripts, Module */
'use strict';
importScripts('../vendor/highs/highs.js');
const ready = Module({ locateFile: f => '../vendor/highs/' + f });

self.onmessage = async ev => {
  const { id, lp, start, opts } = ev.data || {};
  let model = null;
  try {
    const highs = await ready;
    const CB = highs.constants.callbackType;
    model = highs.createModel();
    model.options.set(Object.assign({ output_flag: false, mip_rel_gap: 0, mip_abs_gap: 0 }, opts || {}));
    model.readModel({ format: 'lp', data: lp });
    const names = [];
    for (let j = 0; ; j++) { let nm; try { nm = model.getColName(j); } catch (e) { break; } if (nm == null || nm === '') break; names.push(nm); }
    self.postMessage({ id, type: 'names', names });
    if (start) {
      const idx = [], val = [];
      const pos = new Map(names.map((nm, j) => [nm, j]));
      for (const nm in start) { const j = pos.get(nm); if (j != null) { idx.push(j); val.push(start[nm]); } }
      try { model.setSolution({ indices: new Int32Array(idx), values: new Float64Array(val) }); } catch (e) { /* no start */ }
    }
    let last = 0;
    model.run({
      [CB.mipImprovingSolution](e) {
        const v = e.data && e.data.mip_solution;
        if (v) self.postMessage({ id, type: 'incumbent', values: Array.from(v), obj: e.data.objective_function_value });
      },
      [CB.mipInterrupt](e) { // called regularly during the MIP search (mipLogging needs solver output on)
        const t = Date.now(); if (t - last < 400) return; last = t;
        const d = e.data || {};
        self.postMessage({ id, type: 'progress', gap: d.mip_gap, bound: d.mip_dual_bound, obj: d.objective_function_value });
      },
    });
    const status = model.getModelStatus(), sol = model.getSolution();
    const optimal = status === highs.constants.modelStatus.optimal;
    self.postMessage({ id, type: 'done', status, optimal, values: Array.from(sol.colValue),
      obj: model.info.get('objective_function_value'), bound: model.info.get('mip_dual_bound'), gap: model.info.get('mip_gap') });
  } catch (e) {
    self.postMessage({ id, type: 'error', message: String(e && e.message || e) });
  } finally {
    if (model) try { model.dispose(); } catch (e) { /* gone */ }
  }
};
