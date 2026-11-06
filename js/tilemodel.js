// Polytopia Planner – tile models (v2). Runs fully in the browser, no API key, no upload.
// Features (1:1 port of tools/tilemodel/feat.py): colour / texture statistics of the tile diamond and of the column
// above it (trees, mountains and buildings rise above their tile) – 42 – plus the ring: the outer band of the diamond
// without its top corner – 20. The ring stays visible when a unit stands on the tile.
// Models (js/tilemodel-data.js, PP.TILE_MODEL, trained with tools/tilemodel/export.py): terrain; resource on a field
// (none / crop / fruit); resource on a mountain (none / metal).
// PP.tilemodel.classify(P, x, y, w) → { terrain, conf, probs, res, resConf } | null
//   P = { w, h, data } (RGBA of the whole screenshot), (x, y) = tile centre, w = tile width (image px)
window.PP = window.PP || {};
(function (PP) {
  'use strict';
  const N = 14, NR = 18, HUE_BINS = 12;

  // HSV like feat.py: h in degrees, s and v in 0…1
  function hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 1e-6) {
      if (mx === r) h = ((60 * ((g - b) / d)) % 360 + 360) % 360;
      else if (mx === g) h = 60 * ((b - r) / d) + 120;
      else h = 60 * ((r - g) / d) + 240;
    }
    return [h, mx > 0 ? d / mx : 0, mx];
  }
  function px(P, fx, fy) {
    const xs = Math.min(P.w - 1, Math.max(0, Math.trunc(fx))), ys = Math.min(P.h - 1, Math.max(0, Math.trunc(fy)));
    const k = (ys * P.w + xs) * 4; return hsv(P.data[k], P.data[k + 1], P.data[k + 2]);
  }

  // ---------------------------------------------------------------- diamond + column (feat.features)
  function sample(P, x, y, w, region) {
    const h = 0.6 * w, n = N * N, Hh = new Float32Array(n), S = new Float32Array(n), V = new Float32Array(n), In = new Uint8Array(n);
    for (let qi = 0; qi < N; qi++) {
      const q = (qi + 0.5) / N - 0.5;
      for (let pi = 0; pi < N; pi++) {
        const p = (pi + 0.5) / N - 0.5;
        let dx, dy;
        if (region === 'dia') { dx = (p - q) * w / 2 * 0.85; dy = (p + q) * h / 2 * 0.85; }
        else { dx = p * 0.6 * w; dy = -h / 2 - (q + 0.5) * 0.55 * w; }
        const fx = x + dx, fy = y + dy, i = qi * N + pi;
        In[i] = fx >= 0 && fx < P.w && fy >= 0 && fy < P.h ? 1 : 0;
        const t = px(P, fx, fy); Hh[i] = t[0]; S[i] = t[1]; V[i] = t[2];
      }
    }
    return { h: Hh, s: S, v: V, inside: In };
  }
  function block(b, out) {
    const { h, s, v, inside } = b, n = N * N;
    let tot = 0; for (let i = 0; i < n; i++) tot += inside[i];
    const T = Math.max(1, tot), hist = new Float64Array(HUE_BINS), w8 = new Uint8Array(n);
    let pale = 0, grey = 0, dark = 0;
    for (let i = 0; i < n; i++) {
      w8[i] = s[i] > 0.25 && v[i] > 0.15 && inside[i] ? 1 : 0;
      if (w8[i]) { const k = Math.floor(h[i] / 30); if (k >= 0 && k < HUE_BINS) hist[k]++; }
      if (!inside[i]) continue;
      if (s[i] < 0.18 && v[i] > 0.8) pale++;
      if (s[i] < 0.25 && v[i] > 0.35 && v[i] <= 0.8) grey++;
      if (v[i] < 0.2) dark++;
    }
    for (let k = 0; k < HUE_BINS; k++) out.push(hist[k] / T);
    out.push(pale / T, grey / T, dark / T);
    let m = 0, m2 = 0, ms = 0, c = 0;
    for (let i = 0; i < n; i++) if (inside[i] || !tot) { m += v[i]; m2 += v[i] * v[i]; ms += s[i]; c++; }
    m /= c; ms /= c;
    out.push(m, Math.sqrt(Math.max(0, m2 / c - m * m)), ms);
    let ax = 0, ay = 0, ah = 0;
    for (let r = 0; r < N; r++) for (let q = 0; q < N - 1; q++) {
      const i = r * N + q; ax += Math.abs(v[i + 1] - v[i]);
      ah += Math.abs((w8[i + 1] ? h[i + 1] : 0) - (w8[i] ? h[i] : 0));
    }
    for (let r = 0; r < N - 1; r++) for (let q = 0; q < N; q++) { const i = r * N + q; ay += Math.abs(v[i + N] - v[i]); }
    const cnt = N * (N - 1);
    out.push(ax / cnt + ay / cnt, ah / cnt / 180);
    out.push(tot / n);
  }

  // ---------------------------------------------------------------- ring (feat.ring_features)
  const RING = (() => {
    const m = new Uint8Array(NR * NR), P = new Float32Array(NR * NR), Q = new Float32Array(NR * NR); let tot = 0;
    for (let qi = 0; qi < NR; qi++) for (let pi = 0; pi < NR; pi++) {
      const p = (pi + 0.5) / NR - 0.5, q = (qi + 0.5) / NR - 0.5, i = qi * NR + pi;
      P[i] = p; Q[i] = q; m[i] = Math.max(Math.abs(p), Math.abs(q)) >= 0.28 && p + q > -0.45 ? 1 : 0; tot += m[i];
    }
    return { m, P, Q, tot };
  })();
  function ring(P, x, y, w, out) {
    const h = 0.6 * w, n = NR * NR, H = new Float32Array(n), S = new Float32Array(n), V = new Float32Array(n), In = new Uint8Array(n);
    let tot = 0;
    for (let i = 0; i < n; i++) {
      const fx = x + (RING.P[i] - RING.Q[i]) * w / 2 * 0.92, fy = y + (RING.P[i] + RING.Q[i]) * h / 2 * 0.92;
      In[i] = RING.m[i] && fx >= 0 && fx < P.w && fy >= 0 && fy < P.h ? 1 : 0; tot += In[i];
      const t = px(P, fx, fy); H[i] = t[0]; S[i] = t[1]; V[i] = t[2];
    }
    const T = Math.max(1, tot), hist = new Float64Array(HUE_BINS);
    let pale = 0, grey = 0, dark = 0;
    for (let i = 0; i < n; i++) {
      if (!In[i]) continue;
      if (S[i] > 0.25 && V[i] > 0.15) { const k = Math.floor(H[i] / 30); if (k >= 0 && k < HUE_BINS) hist[k]++; }
      if (S[i] < 0.18 && V[i] > 0.8) pale++;
      if (S[i] < 0.25 && V[i] > 0.35 && V[i] <= 0.8) grey++;
      if (V[i] < 0.2) dark++;
    }
    for (let k = 0; k < HUE_BINS; k++) out.push(hist[k] / T);
    out.push(pale / T, grey / T, dark / T);
    let m = 0, m2 = 0, ms = 0, c = 0;
    for (let i = 0; i < n; i++) if (In[i] || !tot) { m += V[i]; m2 += V[i] * V[i]; ms += S[i]; c++; }
    m /= c; ms /= c;
    out.push(m, Math.sqrt(Math.max(0, m2 / c - m * m)), ms);
    // texture over neighbouring pairs that are both ring points
    let sx = 0, nx = 0, sy = 0, ny = 0;
    for (let r = 0; r < NR; r++) for (let q = 0; q < NR - 1; q++) { const i = r * NR + q; if (In[i] && In[i + 1]) { sx += Math.abs(V[i + 1] - V[i]); nx++; } }
    for (let r = 0; r < NR - 1; r++) for (let q = 0; q < NR; q++) { const i = r * NR + q; if (In[i] && In[i + NR]) { sy += Math.abs(V[i + NR] - V[i]); ny++; } }
    out.push((nx ? sx / nx : 0) + (ny ? sy / ny : 0));
    out.push(tot / RING.tot);
  }

  function features(P, x, y, w) {
    const out = [];
    block(sample(P, x, y, w, 'dia'), out);
    block(sample(P, x, y, w, 'col'), out);
    ring(P, x, y, w, out);
    return out;
  }

  // ---------------------------------------------------------------- forests (compact format of export.py)
  // per tree: f feature (-1 = leaf), t threshold, r right child (left child = next node), v leaf probabilities (%)
  function prepTree(t, K) {
    if (t.off) return t;
    const off = new Int32Array(t.f.length); let j = 0;
    for (let i = 0; i < t.f.length; i++) if (t.f[i] < 0) { off[i] = j; j += K; }
    t.off = off; return t;
  }
  function forest(F, f) {
    const K = F.classes.length, acc = new Float64Array(K);
    for (const t0 of F.trees) {
      const t = prepTree(t0, K); let i = 0;
      while (t.f[i] >= 0) i = f[t.f[i]] <= t.t[i] ? i + 1 : t.r[i];
      const o = t.off[i]; for (let k = 0; k < K; k++) acc[k] += t.v[o + k];
    }
    let best = 0; for (let k = 1; k < K; k++) if (acc[k] > acc[best]) best = k;
    const sum = F.trees.length * 100, probs = {};
    F.classes.forEach((c, k) => { probs[c] = +(acc[k] / sum).toFixed(3); });
    return { cls: F.classes[best], conf: +(acc[best] / sum).toFixed(3), probs };
  }

  function classify(P, x, y, w) {
    const M = PP.TILE_MODEL;
    if (!P || !P.data || !(w > 6) || !M || !M.terrain) return null;
    const f = features(P, x, y, w), t = forest(M.terrain, f);
    const out = { terrain: t.cls, conf: t.conf, probs: t.probs, res: null, resConf: 0 };
    const R = t.cls === 'field' ? M.field : t.cls === 'mountain' ? M.mountain : null;
    if (R) { const r = forest(R, f); out.res = r.cls === 'none' ? null : r.cls; out.resConf = r.conf; out.resProbs = r.probs; }
    return out;
  }

  // terrain below SURE is shown as "please check"; resources are only filled in at RES_SURE or above
  PP.tilemodel = { classify, features, forest, SURE: 0.6, RES_SURE: 0.7, get ready() { return !!(PP.TILE_MODEL && PP.TILE_MODEL.terrain); } };
})(window.PP);
