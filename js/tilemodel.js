// Polytopia Planner – tile terrain model (v29). Runs fully in the browser, no API key, no upload.
// Features: colour / texture statistics of the tile diamond and of the column above it (trees, mountains and
// buildings rise above their tile) – a 1:1 port of tools/tilemodel/feat.py. Model: random forest in
// js/tilemodel-data.js (PP.TILE_MODEL), trained with tools/tilemodel/export.py.
// PP.tilemodel.classify(P, x, y, w) → { terrain, conf, probs } | null
//   P = { w, h, data } (RGBA of the whole screenshot), (x, y) = tile centre, w = tile width (image px)
window.PP = window.PP || {};
(function (PP) {
  'use strict';
  const N = 14;
  const HUE_BINS = 12;

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

  // sample N×N points of a region → arrays h, s, v, inside (row-major, N×N)
  function sample(P, x, y, w, region) {
    const h = 0.6 * w, H = P.h, W = P.w, d = P.data;
    const n = N * N, Hh = new Float32Array(n), S = new Float32Array(n), V = new Float32Array(n), In = new Uint8Array(n);
    for (let qi = 0; qi < N; qi++) {           // rows: Q
      const q = (qi + 0.5) / N - 0.5;
      for (let pi = 0; pi < N; pi++) {         // cols: P
        const p = (pi + 0.5) / N - 0.5;
        let dx, dy;
        if (region === 'dia') { dx = (p - q) * w / 2 * 0.85; dy = (p + q) * h / 2 * 0.85; }
        else { dx = p * 0.6 * w; dy = -h / 2 - (q + 0.5) * 0.55 * w; }
        const fx = x + dx, fy = y + dy, i = qi * N + pi;
        In[i] = fx >= 0 && fx < W && fy >= 0 && fy < H ? 1 : 0;
        const xs = Math.min(W - 1, Math.max(0, Math.trunc(fx))), ys = Math.min(H - 1, Math.max(0, Math.trunc(fy)));
        const k = (ys * W + xs) * 4, t = hsv(d[k], d[k + 1], d[k + 2]);
        Hh[i] = t[0]; S[i] = t[1]; V[i] = t[2];
      }
    }
    return { h: Hh, s: S, v: V, inside: In };
  }

  function block(b, out) {
    const { h, s, v, inside } = b, n = N * N;
    let tot = 0; for (let i = 0; i < n; i++) tot += inside[i];
    const T = Math.max(1, tot);
    const hist = new Float64Array(HUE_BINS), w8 = new Uint8Array(n);
    let pale = 0, grey = 0, dark = 0;
    for (let i = 0; i < n; i++) {
      w8[i] = s[i] > 0.25 && v[i] > 0.15 && inside[i] ? 1 : 0;
      if (w8[i]) { const k = Math.floor(h[i] / 30); if (k >= 0 && k < HUE_BINS && h[i] >= k * 30 && h[i] < (k + 1) * 30) hist[k]++; }
      if (!inside[i]) continue;
      if (s[i] < 0.18 && v[i] > 0.8) pale++;
      if (s[i] < 0.25 && v[i] > 0.35 && v[i] <= 0.8) grey++;
      if (v[i] < 0.2) dark++;
    }
    for (let k = 0; k < HUE_BINS; k++) out.push(hist[k] / T);
    out.push(pale / T, grey / T, dark / T);
    // mean / std of v and mean s over the inside points (all points if none is inside)
    let m = 0, m2 = 0, ms = 0, c = 0;
    for (let i = 0; i < n; i++) if (inside[i] || !tot) { m += v[i]; m2 += v[i] * v[i]; ms += s[i]; c++; }
    m /= c; ms /= c;
    out.push(m, Math.sqrt(Math.max(0, m2 / c - m * m)), ms);
    // texture: mean |Δv| to the right + to the next row; hue changes of the coloured points
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

  function features(P, x, y, w) {
    const out = [];
    block(sample(P, x, y, w, 'dia'), out);
    block(sample(P, x, y, w, 'col'), out);
    return out;
  }

  function predict(f) {
    const M = PP.TILE_MODEL; if (!M) return null;
    const K = M.classes.length, acc = new Float64Array(K);
    for (const t of M.trees) {
      let i = 0;
      while (t.f[i] >= 0) i = f[t.f[i]] <= t.t[i] ? t.l[i] : t.r[i];
      const v = t.v[i]; for (let k = 0; k < K; k++) acc[k] += v[k];
    }
    let best = 0; for (let k = 1; k < K; k++) if (acc[k] > acc[best]) best = k;
    const probs = {}; M.classes.forEach((c, k) => { probs[c] = +(acc[k] / M.trees.length).toFixed(3); });
    return { terrain: M.classes[best], conf: +(acc[best] / M.trees.length).toFixed(3), probs };
  }

  function classify(P, x, y, w) {
    if (!P || !P.data || !(w > 6) || !PP.TILE_MODEL) return null;
    return predict(features(P, x, y, w));
  }

  // tiles below this confidence are shown as "please check" (measured: ≥ 0.6 → 98.7 % right on unseen screenshots)
  PP.tilemodel = { classify, features, predict, SURE: 0.6, get ready() { return !!PP.TILE_MODEL; } };
})(window.PP);
