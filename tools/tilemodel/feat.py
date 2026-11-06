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
