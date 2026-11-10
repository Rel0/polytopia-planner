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
      if (mx === r) { h = (60 * ((g - b) / d)) % 360; if (h < 0) h += 360; } // like Python's %, no extra rounding
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

  // ---------------------------------------------------------------- v3 city name plate (feat.plate_features)
  const PX = 48, PY = 24;
  function plateFeatures(P, x, y, w) {
    const n = PX * PY, H = new Float64Array(n), S = new Float64Array(n), V = new Float64Array(n);
    const T = new Uint8Array(n), D = new Uint8Array(n), Sa = new Uint8Array(n);
    for (let j = 0; j < PY; j++) {
      const gy = -0.35 * w + (j + 0.5) / PY * 0.6 * w;
      for (let i = 0; i < PX; i++) {
        const gx = ((i + 0.5) / PX - 0.5) * 1.1 * w, k = j * PX + i, t = px(P, x + gx, y + gy);
        H[k] = t[0]; S[k] = t[1]; V[k] = t[2];
        T[k] = t[1] < 0.25 && t[2] > 0.85 ? 1 : 0; D[k] = t[2] < 0.3 ? 1 : 0; Sa[k] = t[1] > 0.3 && t[2] > 0.3 ? 1 : 0;
      }
    }
    const tw = new Float64Array(PY), td = new Float64Array(PY), ts = new Float64Array(PY), tt = new Float64Array(PY);
    let sT = 0, sD = 0, sS = 0, sv = 0, sv2 = 0;
    for (let j = 0; j < PY; j++) {
      let a = 0, b = 0, c = 0, e = 0;
      for (let i = 0; i < PX; i++) { const k = j * PX + i; a += T[k]; b += D[k]; c += Sa[k]; sv += V[k]; sv2 += V[k] * V[k]; if (i) e += Math.abs(T[k] - T[k - 1]); }
      tw[j] = a / PX; td[j] = b / PX; ts[j] = c / PX; tt[j] = e / (PX - 1); sT += a; sD += b; sS += c;
    }
    const sm = new Float64Array(PY);
    for (let j = 0; j < PY; j++) sm[j] = ((j ? tt[j - 1] : 0) + tt[j] + (j < PY - 1 ? tt[j + 1] : 0)) / 3;
    let k = 0; for (let j = 1; j < PY; j++) if (sm[j] > sm[k]) k = j;
    const lo = Math.max(0, k - 2), hi = Math.min(PY, k + 3);
    let nc = 0, ci = 0, tdB = 0, tsB = 0;
    for (let i = 0; i < PX; i++) { let any = 0; for (let j = lo; j < hi; j++) if (T[j * PX + i]) { any = 1; break; } if (any) { nc++; ci += i; } }
    for (let j = lo; j < hi; j++) { tdB += td[j]; tsB += ts[j]; }
    const width = nc / PX, cen = nc ? Math.abs(ci / nc / (PX - 1) - 0.5) : 0.5;
    let rs = 0, rn = 0;
    for (let j = 0; j < Math.max(0, k - 4); j++) { rs += sm[j]; rn++; }
    for (let j = k + 5; j < PY; j++) { rs += sm[j]; rn++; }
    const contrast = sm[k] - (rn ? rs / rn : 0);
    let nrows = 0; if (sm[k] > 0) for (let j = 0; j < PY; j++) if (sm[j] > 0.5 * sm[k]) nrows++;
    let bar = 0, bartt = 0, bj = -1;
    for (let j = Math.min(PY, k + 2); j < Math.min(PY, k + 9); j++) if (bj < 0 || tw[j] > bar) { bar = tw[j]; bj = j; }
    if (bj >= 0) bartt = tt[bj]; else bar = 0;
    const hist = new Float64Array(12); let sb = 0;
    for (let j = lo; j < hi; j++) for (let i = 0; i < PX; i++) {
      const q = j * PX + i; if (!Sa[q]) continue; sb++;
      const b = Math.floor(H[q] / 30); if (b >= 0 && b < 12) hist[b]++;
    }
    let hm = 0; for (let b = 0; b < 12; b++) if (hist[b] > hm) hm = hist[b];
    const conc = hm / Math.max(1, sb);
    const vm = sv / n, vs = Math.sqrt(Math.max(0, sv2 / n - vm * vm));
    // plate box edges (rows r → r+1 in the central 60 % of the width)
    const c0 = Math.floor(PX / 5), c1 = PX - Math.floor(PX / 5);
    const rowStat = (j, sign) => { let m = 0, f = 0; for (let i = c0; i < c1; i++) { const dv = V[(j + 1) * PX + i] - V[j * PX + i]; m += dv; if (sign < 0 ? dv < -0.05 : dv > 0.05) f++; } return [m / (c1 - c0), f / (c1 - c0)]; };
    let eu = 0, fu = 0, ed = 0, fd = 0, fu0 = true, fd0 = true;
    for (let j = Math.max(0, k - 6); j < k; j++) { const r2 = rowStat(j, -1); if (fu0 || r2[0] < eu) eu = r2[0]; if (fu0 || r2[1] > fu) fu = r2[1]; fu0 = false; }
    for (let j = k; j < Math.min(PY - 1, k + 7); j++) { const r2 = rowStat(j, 1); if (fd0 || r2[0] > ed) ed = r2[0]; if (fd0 || r2[1] > fd) fd = r2[1]; fd0 = false; }
    // strokes in the left / middle / right third of the text band
    const a3 = Math.floor(PX / 3), b3 = Math.floor(2 * PX / 3);
    let l = 0, ln = 0, m = 0, mn = 0, r = 0, rn2 = 0;
    for (let j = lo; j < hi; j++) for (let i = 0; i < PX - 1; i++) {
      const dd = Math.abs(T[j * PX + i + 1] - T[j * PX + i]);
      if (i < a3) { l += dd; ln++; } else if (i < b3) { m += dd; mn++; } else { r += dd; rn2++; }
    }
    const l3 = ln ? l / ln : 0, m3 = mn ? m / mn : 0, r3 = rn2 ? r / rn2 : 0;
    return [sm[k], tw[k], tdB / (hi - lo), tsB / (hi - lo), width, cen, contrast, nrows, bar, bartt, conc,
      k / PY, sT / n, sD / n, sS / n, vm, vs, eu, ed, fu, fd, l3, m3, r3, Math.min(l3, r3) / (m3 + 1e-3), Math.abs(l3 - r3)];
  }
  // ---------------------------------------------------------------- v3 crop (feat.crop_features)
  const CX = 36, CY = 22;
  function cropFeatures(P, x, y, w) {
    const n0 = CX * CY, H = new Float64Array(n0), S = new Float64Array(n0), V = new Float64Array(n0), M = new Uint8Array(n0);
    for (let j = 0; j < CY; j++) {
      const gy = ((j + 0.5) / CY - 0.5) * 0.66 * w - 0.04 * w;
      for (let i = 0; i < CX; i++) {
        const gx = ((i + 0.5) / CX - 0.5) * 0.9 * w, k = j * CX + i, t = px(P, x + gx, y + gy);
        H[k] = t[0]; S[k] = t[1]; V[k] = t[2];
        M[k] = Math.abs(gx) / (0.45 * w) + Math.abs(gy + 0.04 * w) / (0.33 * w) <= 1 ? 1 : 0;
      }
    }
    const at = (j, i) => V[Math.min(CY - 1, Math.max(0, j)) * CX + Math.min(CX - 1, Math.max(0, i))];
    const C = new Float64Array(n0);
    let nm = 0, nb = 0, nd = 0, np2 = 0;
    for (let j = 0; j < CY; j++) for (let i = 0; i < CX; i++) {
      const k = j * CX + i;
      C[k] = V[k] - (at(j - 1, i) + at(j + 1, i) + at(j, i - 1) + at(j, i + 1)) / 4;
      if (M[k]) { nm++; if (C[k] > 0.06) nb++; if (C[k] < -0.06) nd++; }
    }
    const n = Math.max(1, nm);
    let sx = 0, cx = 0, sy = 0, cy = 0;
    for (let j = 0; j < CY; j++) for (let i = 0; i < CX - 1; i++) { const k = j * CX + i; if (M[k] && M[k + 1]) { sx += Math.abs(V[k + 1] - V[k]); cx++; } }
    for (let j = 0; j < CY - 1; j++) for (let i = 0; i < CX; i++) { const k = j * CX + i; if (M[k] && M[k + CX]) { sy += Math.abs(V[k + CX] - V[k]); cy++; } }
    const ex = cx ? sx / cx : 0, ey = cy ? sy / cy : 0;
    for (let j = 0; j < CY; j++) for (let i = 1; i < CX - 1; i++) { const k = j * CX + i; if (V[k] > V[k - 1] && V[k] > V[k + 1] && C[k] > 0.04 && M[k]) np2++; }
    const vm = [], hm = [], smv = [];
    for (let k = 0; k < n0; k++) if (M[k]) { vm.push(V[k]); hm.push(H[k]); smv.push(S[k]); }
    const median = a => { if (!a.length) return 0; const b = a.slice().sort((p, q) => p - q), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
    const mean = a => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0);
    const mv = median(vm), mh = median(hm);
    let uni = 0;
    for (let q = 0; q < vm.length; q++) { let dh = Math.abs(hm[q] - mh); dh = Math.min(dh, 360 - dh); if (dh < 15 && Math.abs(vm[q] - mv) < 0.08) uni++; }
    uni = vm.length ? uni / vm.length : 0;
    let gr = 0, ye = 0, bsS = 0, bn = 0;
    for (let k = 0; k < n0; k++) if (M[k] && C[k] > 0.06) { bn++; bsS += S[k]; if (H[k] >= 60 && H[k] < 200) gr++; else if (H[k] >= 30 && H[k] < 60) ye++; }
    const sMean = mean(smv), vMean = mean(vm);
    let vv = 0; for (const a of vm) vv += (a - vMean) * (a - vMean);
    return [nb / n, nd / n, ex, ey, ex / (ey + 1e-3), np2 / n, uni, mv, mh / 360, bn ? gr / bn : 0, bn ? ye / bn : 0,
      bn && smv.length ? bsS / bn - sMean : 0, sMean, vm.length ? Math.sqrt(vv / vm.length) : 0];
  }

  // probability that (x, y) is the centre of a city tile (its name plate) – PP.CITY_MODEL (tools/tilemodel/city.py)
  function cityProb(P, x, y, w) {
    const M = PP.CITY_MODEL;
    if (!P || !P.data || !(w > 6) || !M || !M.trees) return null;
    const f = features(P, x, y, w).concat(plateFeatures(P, x, y, w));
    return forest(M, f).probs['1'] || 0;
  }

  function classify(P, x, y, w) {
    const M = PP.TILE_MODEL;
    if (!P || !P.data || !(w > 6) || !M || !M.terrain) return null;
    const f = features(P, x, y, w), t = forest(M.terrain, f);
    const out = { terrain: t.cls, conf: t.conf, probs: t.probs, res: null, resConf: 0 };
    const R = t.cls === 'field' ? M.field : t.cls === 'mountain' ? M.mountain : null;
    // v3 models: the field model also gets the crop features
    let fc = null; // field features + crop features (field resource model and farm model)
    if (R) { const r = forest(R, t.cls === 'field' && M.fieldFeat ? (fc = f.concat(cropFeatures(P, x, y, w))) : f); out.res = r.cls === 'none' ? null : r.cls; out.resConf = r.conf; out.resProbs = r.probs; }
    // v4 models: an existing Farm on a field, a Lumber Hut in a forest → out.bld when likely (the app checks BLD_SURE)
    const B = t.cls === 'field' ? M.farm : t.cls === 'forest' ? M.lumber : null;
    if (B) { const r = forest(B, t.cls === 'field' ? fc || f.concat(cropFeatures(P, x, y, w)) : f), k = t.cls === 'field' ? 'farm' : 'lumber'; out.bldProb = r.probs[k] || 0; out.bld = out.bldProb >= 0.5 ? k : null; }
    return out;
  }

  // terrain below SURE is shown as "please check"; resources are only filled in at RES_SURE or above
  // v49 FOREST_SURE: a forest that isn't there ("ghost forest") spoils a plan (Lumber Huts, Sawmills). Leave-one-
  // screenshot-out on 38 screenshots: forest called at ≥ 0.6 → 20 of 405 wrong, at ≥ 0.75 → 2 of 266 wrong
  PP.tilemodel = { classify, features, plateFeatures, cropFeatures, cityProb, forest, SURE: 0.6, FOREST_SURE: 0.75, BLD_SURE: 0.5, RES_SURE: 0.7, CROP_SURE: 0.6, FRUIT_SURE: 0.6, CITY_SURE: 0.4,
    get ready() { return !!(PP.TILE_MODEL && PP.TILE_MODEL.terrain); }, get cityReady() { return !!(PP.CITY_MODEL && PP.CITY_MODEL.trees); } };
})(window.PP);
