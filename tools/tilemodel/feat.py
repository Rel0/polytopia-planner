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
