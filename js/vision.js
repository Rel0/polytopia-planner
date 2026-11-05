// Polytopia Planer v3 – VISION: automatic grid detection, header OCR (stars/income/turn), image helpers.
// No DOM state of its own; works on <img>/<canvas> elements. Loaded before core.js.
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  const R = 0.6;                 // Polytopia tile height/width (fixed camera)
  const MAX_SIDE = 900;          // downscale long side for detection
  const BIN = 0.2;               // histogram bin width (image px) for the line coordinate s
  const MIN_SCORE = 0.08;        // accept threshold (sample 0.22; text screenshot 0.02)
  const MIN_EDGE = 0.01;         // min fraction of pixels on diamond edges per direction (sample ≈ 0.06)
  // Tesseract.js 5.1.1 is self-hosted in vendor/tesseract (no third-party CDN: visitors' IPs stay on our server)
  const TESS_DIR = new URL('vendor/tesseract/', location.href).href;
  const TESS_URL = TESS_DIR + 'tesseract.min.js';

  const dims = el => ({ w: el.naturalWidth || el.videoWidth || el.width || 0, h: el.naturalHeight || el.videoHeight || el.height || 0 });
  function canvasFrom(src, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, w, h);
    return { canvas: c, ctx: x };
  }

  // ------------------------------------------------------------ grid detection
  // Port of /tmp/poly-measure/auto.py: gradient pixels perpendicular to the two diamond line families
  // (slopes ±0.6) vote with their projected gradient; the line spacing h = 0.6·w is the period of
  // s = y ∓ 0.6·x. score(w) = Σ_families |Z(h)| − |Z(2h)|, Z(h) = Σ wgt·e^{2πi s/h} / Σ wgt.
  // For speed, s is histogrammed (BIN px) and Z is evaluated with a rotating phasor over the bins.
  // v7: (1) only edges inside the map count – blocks that are mostly black (space, header/footer UI
  //     on black) are masked out, UI text/buttons used to bias w by 1–2 %;
  //     (2) refinement: w ±1.5 % in 0.05 px (original image px), offsets from the refined phase
  //     (tried: harmonic-sharpened coherence and excluding the map outline – both measured worse);
  //     (3) period guard (w/2, 2w, 2w/3, 3w/2) and a confidence 0…1 (`conf`).
  // v29: tile width from the fog of war. Every cloud tile carries the same triangle pattern, so the image matches
  // itself when shifted by one tile vector (±w/2, 0.3·w). For each candidate w: mean |Δgrey| over pixel pairs that
  // are both cloud; the tile width is a sharp minimum (≈ 0.25–0.5 of the typical difference). Multiples of w match
  // too → the smallest clear minimum wins. Works on the downscaled image (W×H, sx = original px per pixel).
  // → { w (original px), conf, ratio, frac } or null (too few clouds / no clear minimum)
  function cloudPeriod(data, W, H, sx) {
    const isCloud = new Uint8Array(W * H), grey = new Float32Array(W * H);
    let nc = 0;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const r = data[j], g = data[j + 1], b = data[j + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      if (mx > 175 && b >= r && b >= g - 6 && (mx - mn) < 0.42 * mx && r > 120) { isCloud[i] = 1; nc++; }
    }
    const frac = nc / (W * H);
    if (frac < 0.06) return null;
    const S = 2; // sample every 2nd pixel
    const diff = w => {
      let tot = 0, parts = 0;
      const iy = Math.round(0.3 * w);
      for (const sg of [1, -1]) {
        const ix = Math.round(sg * w / 2);
        let sum = 0, n = 0;
        for (let y = 0; y + iy < H; y += S) {
          const row = y * W, row2 = (y + iy) * W;
          for (let x = Math.max(0, -ix); x < W && x + ix < W; x += S) {
            const a = row + x, b = row2 + x + ix;
            if (isCloud[a] && isCloud[b]) { sum += Math.abs(grey[a] - grey[b]); n++; }
          }
        }
        if (n > 400) { tot += sum / n; parts++; }
      }
      return parts ? tot / parts : Infinity;
    };
    const lo = Math.max(8, Math.round(14 / sx)), hi = Math.round(Math.min(0.45 * W, H / 0.3 - 4));
    const curve = [];
    for (let w = lo; w <= hi; w += 1) curve.push([w, diff(w)]);
    const fin = curve.map(c => c[1]).filter(v => isFinite(v)).sort((a, b) => a - b);
    if (fin.length < 10) return null;
    const med = fin[fin.length >> 1];
    const mins = [];
    for (let i = 1; i < curve.length - 1; i++) if (curve[i][1] < curve[i - 1][1] && curve[i][1] <= curve[i + 1][1]) mins.push(curve[i]);
    if (!mins.length) return null;
    const bestR = Math.min(...mins.map(m => m[1])) / med;
    if (bestR > 0.6) return null; // no clear repeat
    let pick = mins.filter(m => m[1] / med <= bestR + 0.08).sort((a, b) => a[0] - b[0])[0];
    // a clear minimum at w/2 or w/3 means w is a multiple of the tile (on the downscaled image the longer shift
    // can even match a bit better, the rounding error being relatively smaller)
    for (let again = true; again;) {
      again = false;
      for (const k of [2, 3]) {
        const c = mins.filter(m => Math.abs(m[0] - pick[0] / k) <= 0.04 * pick[0] / k + 1).sort((a, b) => a[1] - b[1])[0];
        if (c && c[1] / med <= Math.max(0.5, pick[1] / med + 0.15)) { pick = c; again = true; break; }
      }
    }
    const ratio = pick[1] / med;
    // refine: shifting by 3 tiles (3·(±w/2, 0.3·w)) makes a width error 3× more visible; fall back to 2 / 1 tiles
    // when the image is too small for that
    let bw = pick[0];
    for (const m of [3, 2]) {
      if (0.3 * bw * m >= H - 20 || 0.5 * bw * m >= W - 20) continue;
      let bd = Infinity, cand = bw;
      for (let w = pick[0] - 1.5; w <= pick[0] + 1.5; w += 0.1) { const d = diff(w * m); if (d < bd) { bd = d; cand = w; } }
      if (bd < Infinity) { bw = cand; break; }
    }
    return { w: bw * sx, ratio: +ratio.toFixed(2), frac: +frac.toFixed(2), conf: +Math.max(0, Math.min(1, (0.6 - ratio) / 0.35)).toFixed(2) };
  }

  const DARK = 28, DARK_BLOCK = 0.45;   // luminance of "space" black; max dark fraction of a map block
  function detectGrid(src, opts) {
    try {
      opts = opts || {};
      const t0 = performance.now();
      const { w: W0, h: H0 } = dims(src);
      if (!W0 || !H0) return null;
      const k = Math.min(1, MAX_SIDE / Math.max(W0, H0));
      const W = Math.max(8, Math.round(W0 * k)), H = Math.max(8, Math.round(H0 * k));
      const sx = W0 / W, sy = H0 / H;
      const data = canvasFrom(src, W, H).ctx.getImageData(0, 0, W, H).data;
      const g = new Float32Array(W * H);
      for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114;

      // map mask: blocks of ~1.5 % of the image width; a block belongs to the map unless it is mostly black.
      // The 3×3 neighbourhood decides (a block at the map outline keeps its outline edges).
      const B = Math.max(6, Math.round(Math.max(W, H) / 64));
      const bw_ = Math.ceil(W / B), bh_ = Math.ceil(H / B);
      const dark = new Float32Array(bw_ * bh_), cnt = new Float32Array(bw_ * bh_);
      // v29: cloud tiles (fog of war) count like space – their triangle pattern repeats at half the tile size and
      // pulled the period to w/2. Cloud = pale, bluish white (low saturation, bright, blue ≥ red).
      for (let y = 0, j = 0; y < H; y++) for (let x = 0; x < W; x++, j += 4) {
        const bi = ((y / B) | 0) * bw_ + ((x / B) | 0); cnt[bi]++;
        if (g[y * W + x] < DARK) { dark[bi]++; continue; }
        if (opts.noCloudMask) continue;
        const r = data[j], gg = data[j + 1], b = data[j + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        if (mx > 175 && b >= r && b >= gg - 6 && (mx - mn) < 0.42 * mx && r > 120) dark[bi]++;
      }
      const keep = new Uint8Array(bw_ * bh_);
      let kept = 0;
      for (let by = 0; by < bh_; by++) for (let bx = 0; bx < bw_; bx++) {
        let d = 0, c = 0;
        for (let yy = Math.max(0, by - 1); yy <= Math.min(bh_ - 1, by + 1); yy++)
          for (let xx = Math.max(0, bx - 1); xx <= Math.min(bw_ - 1, bx + 1); xx++) { d += dark[yy * bw_ + xx]; c += cnt[yy * bw_ + xx]; }
        if (opts.noMask || d / c < DARK_BLOCK) { keep[by * bw_ + bx] = 1; kept++; }
      }
      // nothing (or almost nothing) map-like → fall back to the whole image
      const useMask = kept >= 0.05 * bw_ * bh_;
      const mapFrac = kept / (bw_ * bh_);

      // s ranges (image px) for both families, + binned weights
      const fam = [1, -1].map(sgn => {
        const lo = Math.min(0, -sgn * R * W0) - 2, hi = Math.max(H0, H0 - sgn * R * W0) + 2;
        return { sgn, lo, n: Math.ceil((hi - lo) / BIN) + 1, nx: -sgn * R / Math.hypot(R, 1), ny: 1 / Math.hypot(R, 1) };
      });
      fam.forEach(f => { f.hist = new Float64Array(f.n); f.tot = 0; f.cnt = 0; });
      for (let y = 1; y < H - 1; y++) {
        const Y = (y + 0.5) * sy, brow = ((y / B) | 0) * bw_;
        for (let x = 1; x < W - 1; x++) {
          if (useMask && !keep[brow + ((x / B) | 0)]) continue;
          const i = y * W + x;
          const gx = g[i + 1] - g[i - 1], gy = g[i + W] - g[i - W];
          const mag = Math.hypot(gx, gy);
          if (mag <= 20) continue;
          const X = (x + 0.5) * sx;
          for (let q = 0; q < 2; q++) {
            const f = fam[q], proj = Math.abs(gx * f.nx + gy * f.ny);
            if (proj / mag <= 0.92) continue;
            const s = Y - f.sgn * R * X;
            f.hist[Math.round((s - f.lo) / BIN)] += proj; f.tot += proj; f.cnt++;
          }
        }
      }
      if (!fam[0].tot || !fam[1].tot) return null;
      // trim empty ends of the histograms
      fam.forEach(f => {
        let a = 0, b = f.n - 1;
        while (a < b && !f.hist[a]) a++;
        while (b > a && !f.hist[b]) b--;
        f.a = a; f.b = b;
      });
      // Z for one family at period h: returns [re, im] (normalized)
      function Z(f, h) {
        const d = 2 * Math.PI * BIN / h, cd = Math.cos(d), sd = Math.sin(d);
        const ph0 = 2 * Math.PI * (f.lo + f.a * BIN) / h;
        let zr = Math.cos(ph0), zi = Math.sin(ph0), re = 0, im = 0;
        const hist = f.hist;
        for (let i = f.a; i <= f.b; i++) {
          const v = hist[i];
          if (v) { re += v * zr; im += v * zi; }
          const t = zr * cd - zi * sd; zi = zr * sd + zi * cd; zr = t;
        }
        return [re / f.tot, im / f.tot];
      }
      const abs = z => Math.hypot(z[0], z[1]);
      const score = w => {
        const h = R * w;
        let sc = 0;
        for (const f of fam) sc += abs(Z(f, h)) - abs(Z(f, 2 * h));
        return sc;
      };
      // candidate tile widths: prototype range 20…250 px, widened to 2.5 %…35 % of the image width.
      // v29: when the screenshot shows enough clouds, their pattern (identical on every cloud tile) gives the tile
      // width directly – the edge search then only refines it (± 3 %) and finds the offset.
      let cloud = opts.noCloud ? null : cloudPeriod(data, W, H, sx);
      if (cloud && cloud.conf < 0.3) cloud = null;
      // a caller-given range (e.g. the ½ / 2× buttons) wins; the cloud width is used if it lies inside
      if (cloud && opts.wMin && !(cloud.w >= opts.wMin && cloud.w <= (opts.wMax || Infinity))) cloud = null;
      let wMin = opts.wMin || Math.min(20, 0.025 * W0), wMax = opts.wMax || Math.max(250, 0.35 * W0);
      if (cloud) { wMin = cloud.w * 0.97; wMax = cloud.w * 1.03; }
      const step = 0.25 * Math.max(1, W0 / 1000);
      const curve = [];
      let best = -Infinity, bw = 0;
      for (let w = wMin; w <= wMax; w += step) { const sc = score(w); curve.push([w, sc]); if (sc > best) { best = sc; bw = w; } }
      // period guard: a lattice at w/2, 2w/3, 3w/2 or 2w that scores nearly as well is ambiguous
      let rival = 0;
      for (const f of [0.5, 2 / 3, 1.5, 2]) {
        const w = bw * f; if (w < wMin || w > wMax) continue;
        let m = -Infinity; for (let d = -0.02; d <= 0.02; d += 0.005) m = Math.max(m, score(w * (1 + d)));
        rival = Math.max(rival, m);
      }
      // second best local maximum away from the winner (± 6 %) → peak distinctness
      let second = 0;
      for (let i = 1; i < curve.length - 1; i++) {
        const [w, sc] = curve[i];
        if (Math.abs(w / bw - 1) > 0.06 && sc >= curve[i - 1][1] && sc >= curve[i + 1][1]) second = Math.max(second, sc);
      }
      for (let w = bw - step; w <= bw + step; w += step / 10) { const sc = score(w); if (sc > best) { best = sc; bw = w; } }
      // refinement: the coarse step (0.25 px) is too coarse for big tiles → ±1.5 % in 0.05 px (original px)
      if (cloud) { bw = cloud.w; best = score(bw); } // the cloud width is more precise than the edge refinement
      const coarseW = bw;
      if (!opts.noRefine && !cloud) {
        const st = 0.05 * Math.max(1, W0 / 1000);
        for (let w = coarseW * 0.985; w <= coarseW * 1.015; w += st) { const sc = score(w); if (sc > best) { best = sc; bw = w; } }
      }
      const h = R * bw;
      const za = Z(fam[0], h), zb = Z(fam[1], h);
      const bA = Math.atan2(za[1], za[0]) / (2 * Math.PI) * h, bB = Math.atan2(zb[1], zb[0]) / (2 * Math.PI) * h;
      const vx = (bB - bA) / (2 * R), vy = R * vx + bA;      // grid vertex (top corner of a tile)
      let cx = vx, cy = vy + h / 2;                           // its tile's center
      // move to the lattice center closest to the image center (same grid, nicer anchor)
      const dx = W0 / 2 - cx, dy = H0 / 2 - cy;
      const a = Math.round(dx / bw + dy / h), b = Math.round(dy / h - dx / bw); // basis u=(w/2,h/2), v=(-w/2,h/2)
      cx += (a - b) * bw / 2; cy += (a + b) * h / 2;
      const ms = performance.now() - t0;
      // sanity: plausible tile width, and enough diamond-edge pixels in BOTH directions (smooth photos/wallpapers
      // have few, one-sided edges and get spuriously high coherence). Sample: 0.058 / 0.061.
      const e0 = fam[0].cnt / (W * H), e1 = fam[1].cnt / (W * H);
      const sane = bw >= 0.025 * W0 && bw <= 0.35 * W0 && bw > wMin + 0.5 && bw < wMax - 0.5 &&
        Math.min(e0, e1) >= MIN_EDGE && Math.min(e0, e1) >= 0.35 * Math.max(e0, e1);
      // confidence: score level, peak distinctness vs. other periods, both families coherent
      const zmin = Math.min(abs(za), abs(zb)) / Math.max(1e-9, Math.max(abs(za), abs(zb)));
      const sat = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      const margin = 1 - Math.max(rival, second) / Math.max(1e-9, best);
      const conf = sane ? +(sat(best, MIN_SCORE, 0.25) * 0.5 + sat(margin, 0.05, 0.5) * 0.3 + sat(zmin, 0.3, 0.8) * 0.2).toFixed(2) : 0;
      if (cloud) return { w: bw, cx, cy, score: best, ok: true, conf: Math.max(conf, cloud.conf), ms: Math.round(ms), scale: k, cloud,
        edge: [+e0.toFixed(4), +e1.toFixed(4)], coarseW, margin: +margin.toFixed(3), map: +mapFrac.toFixed(2), masked: useMask };
      return { w: bw, cx, cy, score: best, ok: sane && best >= MIN_SCORE, conf, ms: Math.round(ms), scale: k,
        edge: [+e0.toFixed(4), +e1.toFixed(4)], coarseW, margin: +margin.toFixed(3), map: +mapFrac.toFixed(2), masked: useMask };
    } catch (e) {
      console.warn('detectGrid failed', e);
      return null;
    }
  }

  // ------------------------------------------------------------ OCR (Tesseract.js, lazy, self-hosted)
  let tessP = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessP) return tessP;
    tessP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = TESS_URL; s.async = true;
      s.onload = () => (window.Tesseract ? res(window.Tesseract) : rej(new Error('Tesseract missing')));
      s.onerror = () => { tessP = null; s.remove(); rej(new Error('Tesseract load failed')); };
      document.head.appendChild(s);
    });
    return tessP;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  // header crop: top 20 %, ×2, min(r,g,b) (white text stays bright, the gold ★ icon and colored stuff vanish), inverted
  function headerCanvas(src) {
    const { w, h } = dims(src);
    const ch = Math.max(1, Math.round(h * 0.2)), S = 2;
    const c = document.createElement('canvas');
    c.width = w * S; c.height = ch * S;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, w, ch, 0, 0, w * S, ch * S);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 255 - Math.min(d[i], d[i + 1], d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // parse Tesseract words → { stars, income, turn }
  function parseHeader(words, text) {
    const W = (words || []).filter(w => w && w.text && w.bbox).map(w => {
      const b = w.bbox;
      return { t: String(w.text).trim(), x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, xc: (b.x0 + b.x1) / 2 };
    });
    const num = s => { const m = String(s).replace(/[,.'’]/g, '').match(/\d+/); return m ? parseInt(m[0], 10) : null; };
    function below(label) {
      const lh = Math.max(4, label.y1 - label.y0), lw = Math.max(lh, label.x1 - label.x0);
      let best = null, bd = Infinity;
      for (const w of W) {
        if (w === label || !/\d/.test(w.t) || /[a-z]{2,}/i.test(w.t)) continue;
        if (w.y0 < label.y1 - lh * 0.3 || w.y0 > label.y1 + lh * 4) continue;
        const d = Math.abs(w.xc - label.xc);
        if (d > lw * 1.2 + lh) continue;
        if (d < bd) { bd = d; best = w; }
      }
      return best ? num(best.t) : null;
    }
    const out = { stars: null, income: null, turn: null };
    const lab = W.find(w => /^(stars|sterne)/i.test(w.t));
    const all = text || W.map(w => w.t).join(' ');
    let m = all.match(/(?:stars|sterne)\s*[([{]?\s*\+\s*(\d+)/i);
    if (m) out.income = parseInt(m[1], 10);
    if (lab) {
      if (out.income == null) {
        // "(+17)" as a separate word on the label's line
        const lh = lab.y1 - lab.y0;
        const nx = W.filter(w => w !== lab && w.x0 >= lab.x0 && Math.abs((w.y0 + w.y1) / 2 - (lab.y0 + lab.y1) / 2) < lh && /\+\s*\d/.test(w.t))
          .sort((a, b) => a.x0 - b.x0)[0];
        if (nx) out.income = num(nx.t);
      }
      out.stars = below(lab);
    }
    const tl = W.find(w => /^(turn|runde)$/i.test(w.t.replace(/[^a-z]/gi, '')));
    if (tl) out.turn = below(tl);
    if (out.turn == null) { m = all.match(/(?:turn|runde)\s+(\d+)/i); if (m) out.turn = parseInt(m[1], 10); }
    if (out.stars == null && out.income == null) return null;
    return out;
  }

  async function readHeader(src) {
    let worker = null;
    try {
      if (!src || !dims(src).w) return null;
      const canvas = headerCanvas(src);
      const T = await withTimeout(loadTesseract(), 20000);
      worker = await withTimeout(T.createWorker('eng', 1, { logger: () => {}, workerPath: TESS_DIR + 'worker.min.js', corePath: TESS_DIR, langPath: TESS_DIR }), 40000);
      const r = await withTimeout(worker.recognize(canvas), 40000);
      const d = (r && r.data) || {};
      let words = d.words;
      if (!words && d.blocks) { // tesseract v6 style output
        words = [];
        d.blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => (l.words || []).forEach(w => words.push(w)))));
      }
      const res = parseHeader(words, d.text);
      if (res) res.raw = d.text;
      return res;
    } catch (e) {
      console.warn('readHeader failed', e);
      return null;
    } finally {
      if (worker) try { worker.terminate(); } catch (e) { /* ignore */ }
    }
  }

  // ------------------------------------------------------------ unit badge detection (v4)
  // Every Polytopia unit shows a round badge (tribe colour fill, white unit icon) up-right of the figure.
  // Candidates = small white blobs (the icons); each is verified by a ring test: a uniform, not-bright fill
  // ring around it, white pixels inside, and a different colour just outside (round → plates/borders fail).
  // Badge size & badge→tile offset are relative to the tile width w (measured on the real sample, w = 76.5 px).
  const BADGE_R = 0.108;              // badge radius / w
  const BADGE_OFF = [-0.20, 0.30];    // badge centre → tile centre of its unit, in units of w (fit on 17 units)
  const NORM_W = 76;                  // work at a scale where w ≈ 76 px (thresholds were tuned there)

  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const cdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const isWhitePx = (r, g, b) => { const mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn >= 185 && mx - mn < 70; };

  // core detector on raw RGBA pixels (W×H), badge radius Rb in px → [{ x, y, score, color, parts }]
  function findBadges(d, W, H, Rb) {
    const N = W * H, white = new Uint8Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) if (isWhitePx(d[j], d[j + 1], d[j + 2])) white[i] = 1;
    const at = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? -1 : (y * W + x) * 4; };
    // 1) candidates: white connected components of icon size
    const seen = new Uint8Array(N), stack = new Int32Array(N), cands = [];
    const minA = Math.max(4, 0.06 * Math.PI * Rb * Rb), maxA = 0.5 * Math.PI * Rb * Rb, maxB = 1.6 * Rb;
    for (let s = 0; s < N; s++) {
      if (!white[s] || seen[s]) continue;
      let sp = 0, cnt = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
      stack[sp++] = s; seen[s] = 1;
      while (sp) {
        const p = stack[--sp], x = p % W, y = (p - x) / W;
        cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && white[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < W - 1 && white[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
        if (y > 0 && white[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
        if (y < H - 1 && white[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
      }
      if (cnt < minA || cnt > maxA || x1 - x0 + 1 > maxB || y1 - y0 + 1 > maxB) continue;
      cands.push({ x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2 });
    }
    // 2) ring test
    const ANG = 24, cs = [], sn = [];
    for (let k = 0; k < ANG; k++) { cs.push(Math.cos(2 * Math.PI * k / ANG)); sn.push(Math.sin(2 * Math.PI * k / ANG)); }
    function ring(cx, cy, rad, out) {
      for (let k = 0; k < ANG; k++) { const j = at(cx + cs[k] * rad, cy + sn[k] * rad); if (j >= 0) out.push([d[j], d[j + 1], d[j + 2]]); }
    }
    const med = arr => { const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
    function test(cx, cy, R) {
      const fillS = []; ring(cx, cy, 0.72 * R, fillS); ring(cx, cy, 0.86 * R, fillS);
      if (fillS.length < ANG) return null;
      const F = [0, 1, 2].map(i => med(fillS.map(s => s[i])));
      if (lum(F[0], F[1], F[2]) > 165 || isWhitePx(F[0], F[1], F[2])) return null;
      const T = 42;
      const inFill = fillS.filter(s => cdist(s, F) < T && !isWhitePx(s[0], s[1], s[2]));
      const fillFrac = inFill.length / fillS.length;
      if (fillFrac < 0.55) return null;
      // inside: white icon pixels
      let wc = 0, tot = 0;
      const ri = 0.55 * R, r2 = ri * ri;
      for (let yy = Math.ceil(cy - ri); yy <= cy + ri; yy++) for (let xx = Math.ceil(cx - ri); xx <= cx + ri; xx++) {
        if ((xx - cx) ** 2 + (yy - cy) ** 2 > r2) continue;
        const j = at(xx, yy); if (j < 0) continue;
        tot++; if (isWhitePx(d[j], d[j + 1], d[j + 2])) wc++;
      }
      const wf = tot ? wc / tot : 0;
      if (wf < 0.08 || wf > 0.85) return null;
      // just outside: must not continue in the fill colour (round badge, not a plate/border/strip)
      const outS = []; ring(cx, cy, 1.28 * R, outS); ring(cx, cy, 1.5 * R, outS);
      const outSim = outS.filter(s => cdist(s, F) < T).length / Math.max(1, outS.length);
      if (outSim > 0.3) return null;
      // grey/greyish-bright fills are buildings, rocks, snow shadows – tribe badges are saturated or dark
      const mxF = Math.max(F[0], F[1], F[2]), satF = mxF ? (mxF - Math.min(F[0], F[1], F[2])) / mxF : 0;
      const lF = lum(F[0], F[1], F[2]);
      if ((satF < 0.25 && lF > 90) || (satF < 0.45 && lF > 120)) return null;
      // UI elements float over the black space background; units stand on map tiles
      const farS = []; ring(cx, cy, 2.5 * R, farS); ring(cx, cy, 3.5 * R, farS);
      const black = farS.filter(s => Math.max(s[0], s[1], s[2]) < 35).length / Math.max(1, farS.length);
      if (black > 0.25) return null;
      const fm = [0, 1, 2].map(i => inFill.reduce((a, s) => a + s[i], 0) / inFill.length);
      const score = fillFrac * (1 - outSim) * Math.min(1, wf / 0.18);
      return { score, color: fm, parts: { fill: +fillFrac.toFixed(2), white: +wf.toFixed(2), out: +outSim.toFixed(2), sat: +satF.toFixed(2), black: +black.toFixed(2) } };
    }
    const found = [];
    for (const c of cands) {
      let best = null;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (const f of [0.92, 1.05]) {
        const r = test(c.x + dx, c.y + dy, Rb * f);
        if (r && (!best || r.score > best.score)) best = Object.assign(r, { x: c.x + dx, y: c.y + dy });
      }
      if (best && best.score >= 0.35) found.push(best);
    }
    // 3) non-maximum suppression (icons can split into several white blobs)
    found.sort((a, b) => b.score - a.score);
    const keep = [];
    for (const f of found) if (!keep.some(k => Math.hypot(k.x - f.x, k.y - f.y) < 1.6 * Rb)) keep.push(f);
    return keep;
  }

  // group colours into tribes (greedy by distance, then one k-means refinement) → [{ color, n }], idx per item
  function clusterColors(cols, thr) {
    thr = thr || 55;
    const cl = [];
    cols.forEach(c => {
      let bi = -1, bd = thr;
      cl.forEach((k, i) => { const dd = cdist(k.color, c); if (dd < bd) { bd = dd; bi = i; } });
      if (bi < 0) { cl.push({ color: c.slice(0, 3), sum: c.slice(0, 3), n: 1 }); return; }
      const k = cl[bi]; k.n++; for (let i = 0; i < 3; i++) k.sum[i] += c[i]; k.color = k.sum.map(v => v / k.n);
    });
    // refinement: reassign to nearest centre, recompute
    const idx2 = cols.map(c => { let bi = 0, bd = Infinity; cl.forEach((k, i) => { const dd = cdist(k.color, c); if (dd < bd) { bd = dd; bi = i; } }); return bi; });
    const out = cl.map(() => ({ sum: [0, 0, 0], n: 0 }));
    cols.forEach((c, i) => { const o = out[idx2[i]]; o.n++; for (let q = 0; q < 3; q++) o.sum[q] += c[q]; });
    const res = out.map((o, i) => ({ color: o.n ? o.sum.map(v => Math.round(v / o.n)) : cl[i].color.map(Math.round), n: o.n }));
    return { clusters: res, idx: idx2 };
  }

  // grid helpers (PP.state.grid shape)
  const gridW = g => Math.hypot(g.ux - g.vx, g.uy - g.vy);
  function gridToTile(g, x, y) {
    const det = g.ux * g.vy - g.vx * g.uy || 1e-9, dx = x - g.ox, dy = y - g.oy;
    return { c: Math.round((dx * g.vy - g.vx * dy) / det), r: Math.round((g.ux * dy - g.uy * dx) / det) };
  }

  // PP.vision.detectUnits(img, grid) → [{ c, r, color, conf, x, y }] (x,y = badge centre in image px)
  function detectUnits(src, grid, opts) {
    opts = opts || {};
    const t0 = performance.now();
    try {
      const { w: W0, h: H0 } = dims(src);
      if (!W0 || !H0 || !grid) return [];
      const w = gridW(grid);
      if (!(w > 8)) return [];
      const k = Math.max(0.2, Math.min(1, NORM_W / w));
      const W = Math.max(8, Math.round(W0 * k)), H = Math.max(8, Math.round(H0 * k));
      const data = canvasFrom(src, W, H).ctx.getImageData(0, 0, W, H).data;
      const raw = findBadges(data, W, H, BADGE_R * w * k);
      const cl = clusterColors(raw.map(b => b.color));
      const seen = new Map();
      raw.forEach((b, i) => {
        const x = b.x / k, y = b.y / k;
        const t = gridToTile(grid, x + BADGE_OFF[0] * w, y + BADGE_OFF[1] * w);
        const u = { c: t.c, r: t.r, x: Math.round(x), y: Math.round(y), color: cl.clusters[cl.idx[i]].color,
          rawColor: b.color.map(Math.round), conf: +Math.min(0.95, b.score).toFixed(2), score: +b.score.toFixed(3), parts: b.parts };
        const key = t.c + ',' + t.r, o = seen.get(key);
        if (!o || o.score < u.score) seen.set(key, u);
      });
      const out = [...seen.values()];
      detectUnits.last = { ms: Math.round(performance.now() - t0), raw: raw.length, scale: k, tribes: cl.clusters };
      return out;
    } catch (e) {
      console.warn('detectUnits failed', e);
      return [];
    }
  }

  PP.vision = { detectGrid, readHeader, parseHeader, headerCanvas, RATIO: R, MIN_SCORE,
    detectUnits, findBadges, clusterColors, BADGE_R, BADGE_OFF };

  // ------------------------------------------------------------ PP.recog: merge detections into the state
  const ST = () => PP.state;
  const isDet = u => u && (u.src === 'auto' || u.src === 'ai');
  const maxHpOf = u => {
    try { if (PP.engine && PP.engine.maxHp) { const v = PP.engine.maxHp(u); if (isFinite(v)) return v; } } catch (e) { /* ignore */ }
    const d = PP.UNITS && PP.UNITS[u.type]; return ((d && d.hp) || 10) + (u.vet ? 5 : 0);
  };
  const okColor = c => Array.isArray(c) && c.length >= 3 && c.slice(0, 3).every(v => isFinite(v));

  // tribe colours of all detected (non-user) units, biggest first
  function tribes() {
    const us = ST().units.filter(u => isDet(u) && okColor(u.color));
    if (!us.length) return [];
    return clusterColors(us.map(u => u.color.slice(0, 3)), 70).clusters.filter(c => c.n).sort((a, b) => b.n - a.n);
  }
  // 'me' if the unit's colour is closer to myColor than to any other tribe colour
  function sideFor(color, myColor, tribeList) {
    if (!okColor(myColor) || !okColor(color)) return 'enemy';
    const dm = cdist(color, myColor);
    if (dm > 90) return 'enemy';
    const others = (tribeList || []).filter(t => cdist(t.color, myColor) > 35);
    return others.every(t => cdist(color, t.color) >= dm) ? 'me' : 'enemy';
  }
  function reside() {
    const st = ST(), tl = tribes();
    st.units.forEach(u => { if (isDet(u) && okColor(u.color)) u.side = sideFor(u.color, st.ui.myColor, tl); });
  }

  // list items { c, r, type?, hp?, vet?, color, conf }; src 'auto' | 'ai'
  function applyDetections(list, src) {
    src = src === 'ai' ? 'ai' : 'auto';
    const st = ST();
    st.ui = st.ui || {};
    const kept = st.units.filter(u => !isDet(u));
    const userTiles = new Set(kept.map(u => u.c + ',' + u.r));
    const byTile = new Map();
    (list || []).forEach(it => {
      if (!it || !Number.isInteger(it.c) || !Number.isInteger(it.r)) return;
      const key = it.c + ',' + it.r;
      if (userTiles.has(key)) return;
      const o = byTile.get(key);
      if (!o || (o.conf || 0) < (it.conf || 0)) byTile.set(key, it);
    });
    const units = PP.UNITS || {};
    const added = [];
    byTile.forEach(it => {
      const hasType = typeof it.type === 'string' && units[it.type];
      let conf = isFinite(it.conf) ? Math.max(0, Math.min(1, +it.conf)) : 0.5;
      if (!hasType) conf = Math.min(conf, 0.4);
      const u = { id: PP.util.uid(), c: it.c, r: it.r, side: 'enemy', type: hasType ? it.type : (units.warrior ? 'warrior' : Object.keys(units)[0] || 'warrior'),
        hp: 10, vet: !!it.vet, bonus: 1, src, conf: +conf.toFixed(2) };
      if (okColor(it.color)) u.color = it.color.slice(0, 3).map(v => Math.round(v));
      const mx = maxHpOf(u);
      u.hp = Number.isFinite(+it.hp) && it.hp !== null && +it.hp > 0 ? Math.max(1, Math.min(mx, Math.round(+it.hp))) : mx;
      added.push(u);
    });
    st.units = kept.concat(added);
    reside();
    if (PP.app && PP.app.commit) PP.app.commit();
    return { added: added.length, kept: kept.length };
  }

  function setMyColor(color) {
    if (!okColor(color)) return;
    const st = ST(); st.ui = st.ui || {};
    st.ui.myColor = color.slice(0, 3).map(v => Math.round(v));
    reside();
    if (PP.app && PP.app.commit) PP.app.commit();
  }

  // local detection on the current screenshot; auto = only if the grid changed since the last run on this image
  let lastSig = null, lastImg = null;
  function runLocal(opts) {
    opts = opts || {};
    const im = PP.board && PP.board.image, st = ST();
    if (!im || st.board !== 'image') return Promise.resolve(null);
    const g = st.grid, sig = [g.ox, g.oy, g.ux, g.uy, g.vx, g.vy].map(v => Math.round(v * 10)).join(',');
    if (opts.auto && lastImg === im && lastSig === sig) return Promise.resolve(null);
    lastImg = im; lastSig = sig;
    return new Promise(res => setTimeout(() => {
      if (PP.board.image !== im) { res(null); return; }
      const list = detectUnits(im, Object.assign({}, g));
      const r = applyDetections(list, 'auto');
      const info = detectUnits.last || {};
      console.log('Unit detection', { n: list.length, ms: info.ms, tribes: info.tribes });
      if (PP.ui && PP.ui.toast) {
        if (list.length) PP.ui.toast(list.length + ' units detected – just tap wrong ones to fix them', 4000);
        else if (!opts.auto) PP.ui.toast('No units detected');
      }
      res({ list, applied: r, ms: info.ms });
    }, opts.delay == null ? 60 : opts.delay));
  }

  PP.recog = { applyDetections, setMyColor, tribes, sideFor, runLocal, autoRun: () => runLocal({ auto: true }) };
})(window.PP);

// ------------------------------------------------------------ v5 WORLD: tile classification + city name plates
(function (PP) {
  'use strict';
  const V = PP.vision;
  function hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
    return [h, mx ? d / mx : 0, mx];
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

  // Same buckets as PP.build.guessTerrain (tuned 98/98 on the v3 sample) + 'dark' → outside, fruit counter.
  function bucket(p) {
    const [h, s, v] = hsv(p[0], p[1], p[2]);
    if (v < 0.18) return 'dark';
    if ((s < 0.14 && v > 0.82) || (h >= 195 && h <= 290 && s < 0.45 && v > 0.7)) return 'cloud';
    if (h >= 170 && h <= 250 && s >= 0.3) return v > 0.85 && h < 205 ? 'blueL' : 'blueD';
    if (s < 0.16) return 'rock';
    if (h >= 10 && h < 34 && s > 0.35 && v < 0.62) return 'rock';
    if ((h >= 95 && h <= 170 && s > 0.35) || (h >= 60 && h <= 170 && s > 0.3 && v < 0.5)) return 'tree';
    if (h >= 60 && h < 95 && s > 0.3) return 'grass';
    if (h >= 285 && h <= 335 && s > 0.3 && v > 0.45) return 'pink'; // fruit (berries) – counts as ground for terrain
    return 'ground';
  }

  // pixels: [[r,g,b], ...] from the upper part of the diamond; opts.lower: pixels from its lower part
  // (map tiles never have black space in their lower half; tiles below the map edge show the cliff on top, space below)
  // → { terrain: 'field'|'forest'|'mountain'|'water'|'ocean'|'cloud'|'outside', conf, f, res? }
  function classifyTile(pixels, opts) {
    opts = opts || {};
    const f = { dark: 0, cloud: 0, blueL: 0, blueD: 0, tree: 0, rock: 0, grass: 0, ground: 0, pink: 0 };
    let n = 0;
    (pixels || []).forEach(p => { if (p && p.length >= 3) { f[bucket(p)]++; n++; } });
    if (!n) return { terrain: 'outside', conf: 0.5, f };
    for (const k in f) f[k] /= n;
    let lowDark = 0;
    if (opts.lower && opts.lower.length) lowDark = opts.lower.filter(p => Math.max(p[0], p[1], p[2]) < 46).length / opts.lower.length;
    const blue = f.blueL + f.blueD;
    let t, conf;
    if (f.dark > 0.5 || lowDark > 0.4) { t = 'outside'; conf = clamp(0.5 + Math.max(f.dark, lowDark) * 0.5, 0.5, 0.95); }
    else if (f.cloud > 0.6) { t = 'cloud'; conf = clamp(0.35 + f.cloud * 0.6, 0.5, 0.95); }
    else if (blue > 0.45) {
      t = f.blueD > f.blueL ? 'ocean' : 'water';
      conf = clamp(0.45 + (blue - 0.45) * 1.2, 0.45, 0.92) * (Math.abs(f.blueD - f.blueL) / blue < 0.25 ? 0.75 : 1);
    }
    else if (f.rock >= 0.3) { t = 'mountain'; conf = clamp(0.5 + (f.rock - 0.3) * 1.8, 0.45, 0.9); }
    else if (f.tree >= 0.17) { t = 'forest'; conf = clamp(0.5 + (f.tree - 0.17) * 2.2, 0.45, 0.9); }
    else {
      t = 'field';
      conf = clamp(0.55 + Math.min(0.17 - f.tree, 0.3 - f.rock) * 2.5, 0.45, 0.9);
      if (f.cloud > 0.4 || blue > 0.3) conf = Math.min(conf, 0.5);
    }
    const out = { terrain: t, conf: +conf.toFixed(2), f };
    if (t === 'field' && f.pink >= 0.05) out.res = ['fruit'];
    return out;
  }

  // sample a tile diamond from raw RGBA (W×H) → { upper, lower, inside (fraction of samples inside the image) }
  function sampleDiamond(data, W, H, g, c, r, N) {
    N = N || 11;
    const cx = g.ox + c * g.ux + r * g.vx, cy = g.oy + c * g.uy + r * g.vy, hh = Math.abs(g.uy + g.vy);
    const upper = [], lower = [];
    let tot = 0, ins = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const p = ((i + 0.5) / N - 0.5) * 0.9, q = ((j + 0.5) / N - 0.5) * 0.9;
      const dy = p * g.uy + q * g.vy, x = Math.floor(cx + p * g.ux + q * g.vx), y = Math.floor(cy + dy);
      tot++;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      ins++;
      const k = (y * W + x) * 4, px = [data[k], data[k + 1], data[k + 2]];
      if (dy > hh / 6) lower.push(px); else upper.push(px);
    }
    return { upper, lower, inside: tot ? ins / tot : 0, cx, cy };
  }

  // City name plates: rectangles filled in a tribe colour (same hue as the unit badges, lighter) with light text.
  // Per tribe colour: hue mask → connected components → plate-shaped boxes (size relative to tile width w,
  // solid, rows filled). Own plates have a white progress bar right below them → bar:true.
  function findPlates(d, W, H, w, tribes) {
    const N = W * H, Hh = new Float32Array(N), Ss = new Float32Array(N), Ll = new Float32Array(N), out = [];
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      const r = d[j], g = d[j + 1], b = d[j + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
      let h = 0;
      if (dd) h = 60 * (mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4);
      Hh[i] = h; Ss[i] = mx ? dd / mx : 0; Ll[i] = lum(r, g, b);
    }
    const m = new Uint8Array(N), seen = new Uint8Array(N), stack = new Int32Array(N);
    (tribes || []).forEach(T => {
      const th = hsv(T[0], T[1], T[2])[0];
      m.fill(0); seen.fill(0);
      for (let i = 0; i < N; i++) {
        let dh = Math.abs(Hh[i] - th); if (dh > 180) dh = 360 - dh;
        if (dh < 16 && Ss[i] >= 0.3 && Ll[i] >= 45 && Ll[i] <= 175) m[i] = 1;
      }
      for (let s = 0; s < N; s++) {
        if (!m[s] || seen[s]) continue;
        let sp = 0, x0 = W, x1 = 0, y0 = H, y1 = 0, cnt = 0, sr = 0, sg = 0, sb = 0;
        stack[sp++] = s; seen[s] = 1;
        while (sp) {
          const p = stack[--sp], x = p % W, y = (p - x) / W;
          cnt++; sr += d[p * 4]; sg += d[p * 4 + 1]; sb += d[p * 4 + 2];
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (x > 0 && m[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
          if (x < W - 1 && m[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
          if (y > 0 && m[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
          if (y < H - 1 && m[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
        }
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
        if (bh < 0.12 * w || bh > 0.4 * w || bw < 0.28 * w || bw > 1.5 * w || bw < 1.2 * bh || cnt < 0.04 * w * w) continue;
        let inr = 0, br = 0, rowsOk = 0;
        for (let y = y0; y <= y1; y++) {
          let rc = 0;
          for (let x = x0; x <= x1; x++) { const i = y * W + x; if (m[i]) { inr++; rc++; } else if (Ll[i] > 150) { br++; rc++; } }
          if (rc >= 0.75 * bw) rowsOk++;
        }
        const A = bw * bh, sol = (inr + br) / A, brf = br / A, rows = rowsOk / bh;
        if (sol < 0.7 || brf < 0.06 || brf > 0.45 || rows < 0.45) continue;
        // progress bar below (own cities): a row of bright, unsaturated pixels
        let bar = false;
        for (let y = y1 + 1; y <= Math.min(H - 1, y1 + Math.round(0.3 * w)) && !bar; y++) {
          let n = 0;
          for (let x = x0; x <= x1; x++) { const i = y * W + x; if (Ll[i] > 195 && Ss[i] < 0.2) n++; }
          if (n >= 0.35 * bw) bar = true;
        }
        const score = clamp(0.3 + 0.4 * sol + 0.3 * rows, 0, 1);
        out.push({ x0, y0, x1, y1, tribe: T.slice(0, 3), fill: [sr / cnt, sg / cnt, sb / cnt].map(Math.round), bar, score: +score.toFixed(2) });
      }
      // fallback for own plates that merged with similar-coloured terrain: find the white progress bar
      // (thin horizontal strip of bright segments) with this tribe colour right above it
      const bh0 = Math.max(2, Math.round(0.03 * w)), bh1 = Math.round(0.16 * w), minL = 0.28 * w, gapMax = Math.max(3, Math.round(0.05 * w));
      const brightU = i => Ll[i] > 190 && Ss[i] < 0.22;
      let prev = [];
      const strips = [];
      for (let y = 0; y < H; y++) {
        const runs = [];
        let a = -1, last = -1;
        for (let x = 0; x <= W; x++) {
          const on = x < W && brightU(y * W + x);
          if (on) { if (a < 0) a = x; last = x; }
          else if (a >= 0 && (x - last > gapMax || x === W)) { if (last - a + 1 >= minL) runs.push({ a, b: last }); a = -1; }
        }
        const cur = runs.map(r => {
          const p = prev.find(q => Math.abs(q.a - r.a) <= 3 && Math.abs(q.b - r.b) <= 3);
          return p ? { a: Math.min(p.a, r.a), b: Math.max(p.b, r.b), y0: p.y0, y1: y } : { a: r.a, b: r.b, y0: y, y1: y };
        });
        prev.forEach(q => { if (!cur.some(c => c.y0 === q.y0 && Math.abs(c.a - q.a) <= 3)) strips.push(q); });
        prev = cur;
      }
      strips.forEach(st => {
        const sh = st.y1 - st.y0 + 1, bw = st.b - st.a + 1;
        if (sh < bh0 || sh > bh1 || bw > 1.6 * w) return;
        // plate area above the bar must contain the tribe colour
        const py0 = Math.max(0, st.y0 - Math.round(0.3 * w)), py1 = st.y0 - 2;
        let mc = 0, tot = 0, sr = 0, sg = 0, sb = 0;
        for (let y = py0; y <= py1; y++) for (let x = st.a; x <= st.b; x++) { const i = y * W + x; tot++; if (m[i]) { mc++; sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; } }
        if (!tot || mc / tot < 0.3) return;
        // rows directly above/below the bar are not bright (not a cloud/white area)
        let edge = 0, en = 0;
        for (const y of [st.y0 - 2, st.y1 + 2]) { if (y < 0 || y >= H) continue; for (let x = st.a; x <= st.b; x++) { en++; if (brightU(y * W + x)) edge++; } }
        if (en && edge / en > 0.4) return;
        if (out.some(o => o.tribe.join() === T.slice(0, 3).join() && st.a < o.x1 && st.b > o.x0 && st.y0 >= o.y0 - 2 && st.y0 <= o.y1 + 0.35 * w)) return;
        out.push({ x0: st.a, y0: Math.max(0, st.y0 - Math.round(0.24 * w)), x1: st.b, y1: st.y0 - 1 - Math.round(0.02 * w), tribe: T.slice(0, 3), fill: [sr / mc, sg / mc, sb / mc].map(Math.round), bar: true, score: +clamp(0.35 + mc / tot * 0.4, 0, 0.75).toFixed(2), via: 'bar' });
      });
    });
    return out;
  }

  const gridW = g => Math.hypot(g.ux - g.vx, g.uy - g.vy);
  const NORM_W = 76;
  // → [{ c, r, color (tribe colour), plate (fill colour), conf, x, y, bar }]
  function detectCities(src, grid, tribes) {
    const t0 = performance.now();
    try {
      const W0 = src.naturalWidth || src.width, H0 = src.naturalHeight || src.height;
      if (!W0 || !H0 || !grid || !tribes || !tribes.length) return [];
      const w = gridW(grid); if (!(w > 8)) return [];
      let k = Math.max(0.2, Math.min(1.5, NORM_W / w));
      if (Math.abs(k - 1) < 0.15) k = 1; // no resampling blur for near-native sizes
      const W = Math.max(8, Math.round(W0 * k)), H = Math.max(8, Math.round(H0 * k));
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, W, H);
      const plates = findPlates(x.getImageData(0, 0, W, H).data, W, H, w * k, tribes);
      const h = Math.abs(grid.uy + grid.vy), det = grid.ux * grid.vy - grid.vx * grid.uy || 1e-9;
      const seen = new Map();
      plates.forEach(p => {
        // the name plate is centred on its city's tile (measured on the sample: plate centre ≈ tile centre)
        const px = (p.x0 + p.x1 + 1) / 2 / k, py = (p.y0 + p.y1 + 1) / 2 / k;
        const dx = px - grid.ox, dy = py - grid.oy;
        const cc = Math.round((dx * grid.vy - grid.vx * dy) / det), rr = Math.round((grid.ux * dy - grid.uy * dx) / det);
        const it = { c: cc, r: rr, color: p.tribe, plate: p.fill, conf: +Math.min(0.9, p.score).toFixed(2), x: Math.round(px), y: Math.round(p.y0 / k), bar: p.bar };
        const key = cc + ',' + rr, o = seen.get(key);
        if (!o || o.conf < it.conf) seen.set(key, it);
      });
      const out = [...seen.values()];
      detectCities.last = { ms: Math.round(performance.now() - t0), plates: plates.length };
      return out;
    } catch (e) { console.warn('detectCities failed', e); return []; }
  }

  // ------------------------------------------------------------ v15 resources on a tile
  // Tuned on two real phone screenshots (tile width 75 / 109 px, two tribes: green grass + brown ground).
  // Each tile is scanned on a dense lattice (diamond, shifted up a little because the art stands on the tile)
  // and pixels are counted per colour class. "Solid" classes also require the same class a few pixels away
  // in all four directions – thin roads, outlines and text fail that test, blobs (fruit, animals, fish) pass.
  //   fruit  : pink/purple berry bushes, or solid yellow-orange fruit bulbs on a field
  //   crop   : bright lime sprouts scattered on a field (rows on dark soil = an existing Farm, not crop)
  //   animal : dark red / orange-brown animal body inside a forest
  //   metal  : dark grey/blue-black ore lumps on a mountain (no example on the sample → strict, see report)
  //   fish   : darker blue fish shapes in shallow water
  // When unsure nothing is reported; the user adds a resource with the ⌂ correction ring.
  const pixCache = new WeakMap();
  function imageData(src) {
    let p = pixCache.get(src);
    if (p) return p;
    const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
    if (!W || !H) return null;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, 0, 0);
    p = { W, H, d: x.getImageData(0, 0, W, H).data };
    pixCache.set(src, p);
    return p;
  }
  // colour classes; the ground colour (most common colour of the tile) is passed for the relative tests
  function resClass(h, s, v, G) {
    if (h >= 280 && h <= 340 && s > 0.35 && v > 0.42) return 1;                  // pink / purple berries
    if (h >= 36 && h <= 58 && s > 0.55 && v > 0.86) return 2;                    // yellow-orange fruit bulb
    if (h >= 70 && h <= 110 && s > 0.55 && v > 0.6 && (s > G[1] + 0.14 || v > G[2] + 0.12)) return 3; // lime sprout
    if ((h >= 345 || h <= 14) && s > 0.5 && v > 0.27 && v < 0.56) return 4;      // dark red animal
    if (h >= 18 && h <= 34 && s > 0.45 && v > 0.45 && v < 0.85) return 5;        // orange-brown (deer)
    if (h >= 188 && h <= 211 && v > 0.78 && s <= 0.9 && s > Math.max(0.58, G[1] + 0.1)) return 6; // fish: more saturated blue
    if (s < 0.3 && v < 0.33 && v > 0.08) return 7;                               // dark grey (ore)
    if (h >= 36 && h <= 66 && s > 0.35 && v > 0.28 && v < 0.62) return 8;        // dark soil between farm rows
    if ((h >= 345 || h <= 14) && s > 0.45 && v >= 0.56) return 9;                // bright red (city domes, roofs)
    return 0;
  }
  const HSV = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
    return [h, mx ? d / mx : 0, mx / 255];
  };
  function detectResources(src, grid, c, r, opts) {
    opts = opts || {};
    try {
      const P = imageData(src);
      if (!P || !grid) return null;
      const { W, H, d } = P, g = grid, w = gridW(g), hh = Math.abs(g.uy + g.vy);
      if (!(w > 8)) return null;
      const cx = g.ox + c * g.ux + r * g.vx, cy = g.oy + c * g.uy + r * g.vy - 0.12 * hh;
      const N = Math.round(clamp(w / 2.2, 24, 48)), off = Math.max(1, Math.round(0.03 * w));
      const pts = [], hist = new Map();
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const p = ((i + 0.5) / N - 0.5) * 0.92, q = ((j + 0.5) / N - 0.5) * 0.92;
        const x = Math.floor(cx + p * g.ux + q * g.vx), y = Math.floor(cy + p * g.uy + q * g.vy);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const k = (y * W + x) * 4, key = (d[k] >> 4) << 8 | (d[k + 1] >> 4) << 4 | (d[k + 2] >> 4);
        pts.push([x, y, k]);
        hist.set(key, (hist.get(key) || 0) + 1);
      }
      const n = pts.length;
      if (!n) return null;
      let gk = 0, gn = -1;
      hist.forEach((v, k) => { if (v > gn) { gn = v; gk = k; } });
      const G = HSV(((gk >> 8) & 15) * 16 + 8, ((gk >> 4) & 15) * 16 + 8, (gk & 15) * 16 + 8);
      const clsAt = (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return -1;
        const k = (y * W + x) * 4, t = HSV(d[k], d[k + 1], d[k + 2]);
        return resClass(t[0], t[1], t[2], G);
      };
      const cnt = new Float32Array(10), solid = new Float32Array(10);
      pts.forEach(([x, y, k]) => {
        const t = HSV(d[k], d[k + 1], d[k + 2]), k0 = resClass(t[0], t[1], t[2], G);
        cnt[k0]++;
        if (k0 && clsAt(x - off, y) === k0 && clsAt(x + off, y) === k0 && clsAt(x, y - off) === k0 && clsAt(x, y + off) === k0) solid[k0]++;
      });
      const f = { ground: G.map(v => +v.toFixed(2)), groundFrac: +(gn / n).toFixed(2) };
      ['none', 'pink', 'yellow', 'sprout', 'red', 'brown', 'fish', 'grey', 'soil', 'roof'].forEach((nm, i) => { if (i) { f[nm] = +(cnt[i] / n).toFixed(4); f[nm + 'S'] = +(solid[i] / n).toFixed(4); } });
      const T = opts.terrain, res = [];
      let farm = false;
      const greenGround = G[0] >= 55 && G[0] <= 150;
      if (T === 'field') {
        if (f.soil >= 0.14) farm = true;                                       // planted rows on dark soil = Farm
        else if (f.sprout >= 0.012) res.push('crop');
        if (f.pinkS >= 0.006 || f.pink >= 0.025 || f.yellow >= 0.026) res.push('fruit');
      } else if (T === 'forest' && !opts.unit) {
        if ((f.redS >= 0.006 && f.roof < 0.015) || (greenGround && f.brownS >= 0.002)) res.push('animal'); // not the red domes of a city
      } else if (T === 'mountain') {
        if (f.greyS >= 0.03) res.push('ore');
      } else if (T === 'water') {
        if (f.fish >= 0.01) res.push('fish');
      }
      return { res, farm, f, n };
    } catch (e) { console.warn('detectResources failed', e); return null; }
  }

  V.detectResources = detectResources;
  V.classifyTile = classifyTile;
  V.sampleDiamond = sampleDiamond;
  V.findPlates = findPlates;
  V.detectCities = detectCities;
  V.hsv = hsv;
})(window.PP);
