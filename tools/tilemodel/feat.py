# Tile features (to be ported 1:1 to JS). Geometry: tile center (x,y), width w, height h=0.6w.
import numpy as np, colorsys
N=14
def hsv(rgb):
    r,g,b=rgb[...,0]/255,rgb[...,1]/255,rgb[...,2]/255
    mx=np.max(rgb,-1)/255; mn=np.min(rgb,-1)/255; d=mx-mn
    h=np.zeros_like(mx)
    m=d>1e-6
    rr=(mx==r)&m; gg=(mx==g)&m&~rr; bb=m&~rr&~gg
    h[rr]=(60*((g-b)/np.where(d==0,1,d))%360)[rr]
    h[gg]=(60*((b-r)/np.where(d==0,1,d))+120)[gg]
    h[bb]=(60*((r-g)/np.where(d==0,1,d))+240)[bb]
    s=np.where(mx>0,d/np.where(mx==0,1,mx),0)
    return h,s,mx
def sample(a,x,y,w,region):
    H,W=a.shape[:2]; h=0.6*w
    i=(np.arange(N)+0.5)/N-0.5
    P,Q=np.meshgrid(i,i)
    if region=='dia':      # diamond, 85 % size: p,q along the two tile axes
        dx=(P-Q)*w/2*0.85; dy=(P+Q)*h/2*0.85
    else:                  # column above the tile: from the top corner up 0.55 w, width 0.6 w
        dx=P*0.6*w; dy=-h/2-(Q+0.5)*0.55*w
    xs=np.clip((x+dx).astype(int),0,W-1); ys=np.clip((y+dy).astype(int),0,H-1)
    inside=((x+dx)>=0)&((x+dx)<W)&((y+dy)>=0)&((y+dy)<H)
    return a[ys,xs], inside
def block(px, inside):
    h,s,v=hsv(px.astype(np.float32))
    f=[]
    w8=(s>0.25)&(v>0.15)&inside
    tot=max(1,inside.sum())
    hist=np.zeros(12)
    for k in range(12):
        hist[k]=(w8&(h>=k*30)&(h<(k+1)*30)).sum()/tot
    f+=list(hist)
    f.append(((s<0.18)&(v>0.8)&inside).sum()/tot)        # white / very pale
    f.append(((s<0.25)&(v>0.35)&(v<=0.8)&inside).sum()/tot) # grey
    f.append(((v<0.2)&inside).sum()/tot)                  # dark
    vi=v[inside] if inside.any() else v.ravel()
    si=s[inside] if inside.any() else s.ravel()
    f+= [vi.mean(), vi.std(), si.mean()]
    # texture: mean |Δv| to right / lower neighbour sample
    dv=np.abs(np.diff(v,axis=1)).mean()+np.abs(np.diff(v,axis=0)).mean()
    dh=np.abs(np.diff(np.where(w8,h,0),axis=1)).mean()/180
    f+=[dv, dh]
    f.append(inside.mean())
    return f
def features(a,x,y,w):
    p1,i1=sample(a,x,y,w,'dia'); p2,i2=sample(a,x,y,w,'col')
    return np.array(block(p1,i1)+block(p2,i2),dtype=np.float32)

# ---- v2: ring features – only the outer band of the tile diamond, without its top corner. A unit standing on the
# tile covers the centre and rises above it; the ring stays visible, so the terrain under units can still be told.
NR = 18
def _ring_grid():
    i = (np.arange(NR) + 0.5) / NR - 0.5
    P, Q = np.meshgrid(i, i)
    return P, Q, (np.maximum(np.abs(P), np.abs(Q)) >= 0.28) & (P + Q > -0.45)
_RP, _RQ, _RM = _ring_grid()
def ring_features(a, x, y, w):
    H, W = a.shape[:2]; h = 0.6 * w
    dx = (_RP - _RQ) * w / 2 * 0.92; dy = (_RP + _RQ) * h / 2 * 0.92
    fx, fy = x + dx, y + dy
    inside = (fx >= 0) & (fx < W) & (fy >= 0) & (fy < H) & _RM
    xs = np.clip(fx.astype(int), 0, W - 1); ys = np.clip(fy.astype(int), 0, H - 1)
    hh, s, v = hsv(a[ys, xs].astype(np.float32))
    tot = max(1, inside.sum()); f = []
    col = (s > 0.25) & (v > 0.15) & inside
    for k in range(12): f.append((col & (hh >= k * 30) & (hh < (k + 1) * 30)).sum() / tot)
    f.append(((s < 0.18) & (v > 0.8) & inside).sum() / tot)
    f.append(((s < 0.25) & (v > 0.35) & (v <= 0.8) & inside).sum() / tot)
    f.append(((v < 0.2) & inside).sum() / tot)
    vi = v[inside] if inside.any() else v.ravel(); si = s[inside] if inside.any() else s.ravel()
    f += [vi.mean(), vi.std(), si.mean()]
    m1 = inside[:, 1:] & inside[:, :-1]; m2 = inside[1:, :] & inside[:-1, :]
    dv = (np.abs(np.diff(v, axis=1))[m1].mean() if m1.any() else 0) + (np.abs(np.diff(v, axis=0))[m2].mean() if m2.any() else 0)
    f.append(dv); f.append(inside.sum() / _RM.sum())
    return np.array(f, dtype=np.float32)
def all_features(a, x, y, w):
    """features of the v2 models: diamond + column (42) + ring (20) = 62"""
    return np.concatenate([features(a, x, y, w), ring_features(a, x, y, w)])

# ---- v3: city name plate. Every city (own or enemy) has a plate centred on its tile: a band of white italic text
# with a dark shadow on a tribe-coloured, half transparent box, own cities a light progress bar below. Villages have
# none. A fine lattice (PX × PY points) over a box 1.1 w wide, from 0.35 w above to 0.25 w below the tile centre.
# The row with the strongest "text" (white strokes) is found first, everything else is measured from there, so a
# plate a bit higher or lower still looks the same.
PX, PY = 48, 24
def plate_features(a, x, y, w):
    H, W = a.shape[:2]
    gx = ((np.arange(PX) + 0.5) / PX - 0.5) * 1.1 * w
    gy = -0.35 * w + (np.arange(PY) + 0.5) / PY * 0.6 * w
    X, Y = np.meshgrid(gx, gy)
    xs = np.clip((x + X).astype(int), 0, W - 1); ys = np.clip((y + Y).astype(int), 0, H - 1)
    h, s, v = hsv(a[ys, xs].astype(np.float64))   # float64 like the browser (thresholds must match exactly)
    T = (s < 0.25) & (v > 0.85); D = v < 0.3; S = (s > 0.3) & (v > 0.3)
    tw = T.mean(1); td = D.mean(1); ts = S.mean(1)
    tt = np.abs(np.diff(T.astype(np.int8), axis=1)).sum(1) / (PX - 1)
    pad = np.r_[0.0, tt, 0.0]; sm = (pad[:-2] + pad[1:-1] + pad[2:]) / 3   # same order of sums as the JS port
    k = int(np.argmax(sm)); lo, hi = max(0, k - 2), min(PY, k + 3)
    band = T[lo:hi]
    cols = band.any(0)
    width = cols.mean()
    cen = abs((np.nonzero(cols)[0].mean() / (PX - 1) - 0.5)) if cols.any() else 0.5
    rest = np.r_[sm[:max(0, k - 4)], sm[k + 5:]]
    contrast = sm[k] - (rest.mean() if len(rest) else 0)
    nrows = int((sm > 0.5 * sm[k]).sum()) if sm[k] > 0 else 0
    below = slice(min(PY, k + 2), min(PY, k + 9))
    bar = tw[below].max() if tw[below].size else 0
    bartt = tt[below][tw[below].argmax()] if tw[below].size else 0
    hist = np.zeros(12); SB = S[lo:hi]; hb = h[lo:hi]
    for q in range(12): hist[q] = (SB & (hb >= q * 30) & (hb < (q + 1) * 30)).sum()
    conc = hist.max() / max(1, SB.sum())
    # the plate box: a straight darker band → long horizontal edges above (getting darker) and below the text
    dv = np.diff(v, axis=0)                                    # (PY-1) × PX, row r → r+1
    c0, c1 = PX // 5, PX - PX // 5                             # central 60 % of the width
    up = dv[max(0, k - 6):k, c0:c1]; dn = dv[k:min(PY - 1, k + 7), c0:c1]
    eu = up.mean(1).min() if up.size else 0                    # strongest darkening row above
    ed = dn.mean(1).max() if dn.size else 0                    # strongest brightening row below
    fu = (up < -0.05).mean(1).max() if up.size else 0          # … and how much of the width it covers
    fd = (dn > 0.05).mean(1).max() if dn.size else 0
    # centred text: strokes in the left / middle / right third of the text band
    tb = np.abs(np.diff(T[lo:hi].astype(np.int8), axis=1))
    l3, m3, r3 = tb[:, :PX // 3].mean(), tb[:, PX // 3:2 * PX // 3].mean(), tb[:, 2 * PX // 3:].mean()
    return [sm[k], tw[k], td[lo:hi].mean(), ts[lo:hi].mean(), width, cen, contrast, nrows, bar, bartt, conc,
            k / PY, T.mean(), D.mean(), S.mean(), v.mean(), v.std(),
            eu, ed, fu, fd, l3, m3, r3, min(l3, r3) / (m3 + 1e-3), abs(l3 - r3)]
def city_features(a, x, y, w):
    return np.array(list(all_features(a, x, y, w)) + plate_features(a, x, y, w), dtype=np.float32)
